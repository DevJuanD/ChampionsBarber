require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const { criarAgendamentoService } = require('../src/services/agendamentoService');
const { criarAgendaService } = require('../src/services/agendaService');
let etapa = 'conexão';
async function main() {
  const rollback = new Error('ROLLBACK_TESTE');
  try {
    await prisma.$transaction(async (tx) => {
      etapa = 'preparação';
      const config = await tx.configuracao.findFirst();
      if (config) await tx.configuracao.update({ where: { cd_configuracao: config.cd_configuracao }, data: { janela_agendamento_dias: 15, confirmacao_automatica: true } });
      else await tx.configuracao.create({ data: {} });
      const cliente = await tx.cliente.create({ data: { nome_completo: 'Teste reserva', telefone_contato: '+5563999999999' } });
      const servico = await tx.servico.create({ data: { nome: 'Teste reserva', preco: '30.00', duracao_minutos: 30 } });
      const profissional = await tx.profissional.create({ data: { nome: 'Teste reserva', servicos: { create: { cd_servico: servico.cd_servico } } } });
      const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
      const data = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(amanha);
      const periodo = { dia_semana: new Date(`${data}T12:00:00Z`).getUTCDay(), hora_inicio: new Date('1970-01-01T08:00:00Z'), hora_fim: new Date('1970-01-01T18:00:00Z') };
      await tx.funcionamento.create({ data: periodo });
      await tx.jornadaProfissional.create({ data: { ...periodo, cd_profissional: profissional.cd_profissional } });
      const adaptador = { ...Object.fromEntries(['configuracao', 'profissionalServico', 'funcionamento', 'jornadaProfissional', 'agendamento', 'bloqueioAgenda'].map((nome) => [nome, tx[nome]])), $transaction: async (executar) => Array.isArray(executar) ? Promise.all(executar) : executar(tx) };
      const service = criarAgendamentoService(adaptador);
      const dados = { cd_servico: servico.cd_servico, cd_profissional: profissional.cd_profissional, data };
      etapa = 'disponibilidade';
      const horarios = await service.horarios(dados, cliente.cd_cliente);
      assert.ok(horarios.length);
      etapa = 'reserva';
      const conta = await tx.usuario.findFirst({ where: { papeis: { some: { papel: { codigo: 'ADMINISTRADOR' } } } }, select: { cd_usuario: true } });
      assert.ok(conta);
      const administrador = { cd_usuario: conta.cd_usuario, papeis: ['ADMINISTRADOR'], permissoes: {} };
      const agendamento = await service.agendar({ ...dados, hora: horarios[0], cd_cliente: -1 }, cliente.cd_cliente, { cd_usuario: conta.cd_usuario });
      assert.equal(agendamento.status, 'CONFIRMADO');
      const salvo = await tx.agendamento.findUnique({ where: { cd_agendamento: agendamento.cd_agendamento } });
      assert.equal(salvo.cd_cliente, cliente.cd_cliente);
      assert.equal(Number(salvo.preco_registrado), 30);
      etapa = 'conflito';
      await assert.rejects(service.agendar({ ...dados, hora: horarios[0] }, cliente.cd_cliente), { status: 409 });
      assert.ok(!(await service.horarios(dados, cliente.cd_cliente)).includes(horarios[0]));
      etapa = 'consulta da equipe';
      const agenda = criarAgendaService(adaptador);
      const consulta = await agenda.listar({ data, cd_profissional: profissional.cd_profissional }, administrador);
      assert.equal(consulta.total, 1);
      assert.equal(consulta.agendamentos[0].cd_agendamento, agendamento.cd_agendamento);
      etapa = 'cancelamento';
      await agenda.alterarStatus(agendamento.cd_agendamento, { status: 'CANCELADO', motivo: 'Teste reversível' }, administrador);
      assert.ok((await service.horarios(dados, cliente.cd_cliente)).includes(horarios[0]));
      const cancelado = await tx.agendamento.findUnique({ where: { cd_agendamento: agendamento.cd_agendamento } });
      assert.equal(cancelado.cancelado_por, conta.cd_usuario);
      assert.equal(await tx.auditoria.count({ where: { entidade: 'agendamento', cd_registro: agendamento.cd_agendamento } }), 2);
      etapa = 'conclusão';
      await tx.agendamento.update({ where: { cd_agendamento: agendamento.cd_agendamento }, data: { status: 'CONFIRMADO', inicio_em: new Date('2020-01-01T10:00:00Z'), fim_em: new Date('2020-01-01T10:30:00Z'), cancelado_por: null, cancelado_em: null, motivo_cancelamento: null } });
      assert.equal((await agenda.alterarStatus(agendamento.cd_agendamento, { status: 'CONCLUIDO' }, administrador)).status, 'CONCLUIDO');
      await assert.rejects(agenda.alterarStatus(agendamento.cd_agendamento, { status: 'CANCELADO', motivo: 'Teste reversível' }, administrador), { status: 409 });
      etapa = 'registro de falta';
      await tx.agendamento.update({ where: { cd_agendamento: agendamento.cd_agendamento }, data: { status: 'CONFIRMADO' } });
      assert.equal((await agenda.alterarStatus(agendamento.cd_agendamento, { status: 'NAO_COMPARECEU' }, administrador)).status, 'NAO_COMPARECEU');
      console.log('OK: reserva interna, conflitos, agenda da equipe, cancelamento, horário liberado, conclusão, falta e auditoria.');
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await prisma.$disconnect(); }
  console.log('Dados de teste revertidos.');
}
main().catch((error) => { console.error(`Falha (${etapa}): ${error.code || error.name}${error.status ? `, HTTP ${error.status}` : ''}.`); process.exitCode = 1; });
