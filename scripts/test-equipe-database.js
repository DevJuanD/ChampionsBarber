require('dotenv').config({ quiet: true });
const { randomInt } = require('node:crypto');
const assert = require('node:assert/strict');
const argon2 = require('@node-rs/argon2');
const prisma = require('../src/config/prisma');
const { criarUsuarioEquipeService } = require('../src/services/usuarioEquipeService');
const { criarAuthService } = require('../src/services/authService');
const { criarAgendaService } = require('../src/services/agendaService');
const { criarAgendamentoService } = require('../src/services/agendamentoService');
const { criarBloqueioService } = require('../src/services/bloqueioService');
let etapa = 'conexão';

async function main() {
  const rollback = new Error('ROLLBACK_TESTE');
  try {
    await prisma.$transaction(async (tx) => {
      const db = new Proxy(tx, { get(alvo, chave) { return chave === '$transaction' ? async (executar) => Array.isArray(executar) ? Promise.all(executar) : executar(tx) : alvo[chave]; } });
      const admin = await tx.usuario.findFirst({ where: { papeis: { some: { papel: { codigo: 'ADMINISTRADOR' } } } }, select: { cd_usuario: true } });
      assert.ok(admin);
      const equipe = criarUsuarioEquipeService(db); const auth = criarAuthService(db); const bloqueios = criarBloqueioService(db); const reservas = criarAgendamentoService(db);
      const profissional = await tx.profissional.create({ data: { nome: 'Teste equipe' } });
      const telefone = `639${randomInt(10000000, 99999999)}`;
      const dados = { papel: 'BARBEIRO', cd_profissional: profissional.cd_profissional, status: 'ATIVO', telefone, nome: '', escopo_visualizacao_agenda: 'PROPRIOS', escopo_gestao_agenda: 'PROPRIOS', pode_criar_agendamento: true, pode_cancelar_agendamento: true, pode_atualizar_status: true, pode_bloquear_agenda: true };
      etapa = 'novo acesso';
      const criado = await equipe.salvar(null, dados, admin.cd_usuario);
      assert.equal(criado.conta_existente, false);
      assert.equal(criado.usuario.profissional.cd_profissional, profissional.cd_profissional);
      const login = await auth.entrar({ telefone, senha: telefone }); assert.equal(login.usuario.deve_trocar_senha, true);
      etapa = 'troca inicial';
      await auth.trocarSenhaInicial(criado.usuario.cd_usuario, { senha: 'TesteEquipe123!', confirmacao: 'TesteEquipe123!' });
      const sessao = await auth.entrar({ telefone, senha: 'TesteEquipe123!' });
      const usuario = sessao.usuario;
      assert.equal(usuario.permissoes.pode_criar_agendamento, true);
      etapa = 'restrição de alcance';
      const dataObj = new Date(); dataObj.setDate(dataObj.getDate() + 1);
      const data = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(dataObj);
      await assert.rejects(criarAgendaService(db).listar({ data, cd_profissional: profissional.cd_profissional + 1 }, usuario), { status: 403 });
      const config = await tx.configuracao.findFirst();
      if (config) await tx.configuracao.update({ where: { cd_configuracao: config.cd_configuracao }, data: { janela_agendamento_dias: 15 } }); else await tx.configuracao.create({ data: {} });
      const servico = await tx.servico.create({ data: { nome: 'Teste equipe', preco: 30, duracao_minutos: 30 } });
      await tx.profissionalServico.create({ data: { cd_profissional: profissional.cd_profissional, cd_servico: servico.cd_servico } });
      const periodo = { dia_semana: new Date(`${data}T12:00:00Z`).getUTCDay(), hora_inicio: new Date('1970-01-01T08:00:00Z'), hora_fim: new Date('1970-01-01T18:00:00Z') };
      await tx.funcionamento.create({ data: periodo }); await tx.jornadaProfissional.create({ data: { ...periodo, cd_profissional: profissional.cd_profissional } });
      const cliente = await tx.cliente.create({ data: { nome_completo: 'Teste equipe cliente', telefone_contato: '+5563999999999' } });
      etapa = 'bloqueio';
      const bloqueio = await bloqueios.criar({ data, cd_profissional: profissional.cd_profissional, inicio: '09:00', fim: '10:00', motivo: 'Teste reversível' }, usuario);
      const consulta = { data, cd_profissional: profissional.cd_profissional, cd_servico: servico.cd_servico };
      assert.ok(!(await reservas.horarios(consulta, cliente.cd_cliente)).includes('09:00'));
      assert.equal((await bloqueios.listar(data, usuario)).length, 1);
      await bloqueios.remover(bloqueio.cd_bloqueio, usuario);
      assert.ok((await reservas.horarios(consulta, cliente.cd_cliente)).includes('09:00'));
      etapa = 'reserva pela equipe';
      await reservas.agendar({ ...consulta, hora: '09:00' }, cliente.cd_cliente, { cd_usuario: usuario.cd_usuario });
      await assert.rejects(bloqueios.criar({ data, cd_profissional: profissional.cd_profissional, inicio: '09:00', fim: '10:00', motivo: 'Teste reversível' }, usuario), { status: 409 });
      etapa = 'alteração de permissões';
      await equipe.salvar(usuario.cd_usuario, { ...dados, pode_bloquear_agenda: false, pode_criar_agendamento: false }, admin.cd_usuario);
      await assert.rejects(auth.autenticar(sessao.token), { status: 401 });
      const novoLogin = await auth.entrar({ telefone, senha: 'TesteEquipe123!' });
      assert.equal(novoLogin.usuario.permissoes.pode_criar_agendamento, false);
      await assert.rejects(bloqueios.criar({ data, cd_profissional: profissional.cd_profissional, inicio: '11:00', fim: '12:00', motivo: 'Teste reversível' }, novoLogin.usuario), { status: 403 });
      etapa = 'conta de cliente reaproveitada';
      const telefoneCliente = `639${randomInt(10000000, 99999999)}`;
      const hash = await argon2.hash('SenhaExistente123!');
      const papel = await tx.papel.upsert({ where: { codigo: 'CLIENTE' }, update: {}, create: { codigo: 'CLIENTE', nome: 'Cliente' } });
      const antigo = await tx.usuario.create({ data: { telefone: `+55${telefoneCliente}`, senha_hash: hash, status: 'ATIVO', telefone_verificado_em: new Date(), cliente: { create: { nome_completo: 'Teste cliente equipe', telefone_contato: `+55${telefoneCliente}` } }, papeis: { create: { cd_papel: papel.cd_papel } } } });
      const vinculado = await equipe.salvar(null, { ...dados, papel: 'RECEPCAO', nome: 'Teste recepção', telefone: telefoneCliente, escopo_visualizacao_agenda: 'GLOBAL', escopo_gestao_agenda: 'GLOBAL' }, admin.cd_usuario);
      assert.equal(vinculado.usuario.cd_usuario, antigo.cd_usuario); assert.equal(vinculado.conta_existente, true);
      assert.equal((await tx.usuario.findUnique({ where: { cd_usuario: antigo.cd_usuario } })).senha_hash, hash);
      assert.ok((await auth.entrar({ telefone: telefoneCliente, senha: 'SenhaExistente123!' })).usuario.papeis.includes('RECEPCAO'));
      etapa = 'proteção do administrador';
      await assert.rejects(equipe.salvar(admin.cd_usuario, dados, admin.cd_usuario), { status: 403 });
      console.log('OK: acesso, senha inicial, vínculo, agenda própria, bloqueios, conflitos, agendamento, permissões, sessões e conta existente.');
      throw rollback;
    }, { timeout: 120000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await prisma.$disconnect(); }
  console.log('Todos os dados de teste foram revertidos.');
}
main().catch((error) => { console.error(`Falha (${etapa}): ${error.code || error.name}${error.status ? `, HTTP ${error.status}` : ''}.`); process.exitCode = 1; });
