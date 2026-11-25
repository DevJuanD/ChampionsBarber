const argon2 = require('@node-rs/argon2');
const prisma = require('../config/prisma');
const { normalizarTelefone } = require('./authService');

async function criarAdminInicial({ nome, telefone, senha }, db = prisma) {
  nome = typeof nome === 'string' ? nome.trim() : '';
  if (nome.length < 3 || nome.length > 150) throw new Error('Informe um nome entre 3 e 150 caracteres.');
  telefone = normalizarTelefone(telefone);
  if (typeof senha !== 'string' || senha.length < 12 || senha.length > 128) {
    throw new Error('Use uma senha entre 12 e 128 caracteres para o administrador.');
  }

  const senha_hash = await argon2.hash(senha, {
    algorithm: argon2.Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
  });

  return db.$transaction(async (tx) => {
    // Um único provisionamento por vez; não promove nem redefine contas existentes.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(739218)::text`;
    const existente = await tx.usuarioPapel.count({ where: { papel: { codigo: 'ADMINISTRADOR' } } });
    if (existente) throw new Error('Já existe um administrador. Use a gestão de usuários para criar outras contas.');
    if (await tx.usuario.findUnique({ where: { telefone }, select: { cd_usuario: true } })) {
      throw new Error('Este telefone já pertence a uma conta. Nenhuma permissão foi alterada.');
    }

    const papel = await tx.papel.upsert({
      where: { codigo: 'ADMINISTRADOR' },
      create: { codigo: 'ADMINISTRADOR', nome: 'Administrador' },
      update: {},
    });
    if (!papel.ativo) throw new Error('O papel ADMINISTRADOR está desativado.');

    const usuario = await tx.usuario.create({
      data: {
        telefone, senha_hash, status: 'ATIVO', telefone_verificado_em: new Date(),
        cliente: { create: { nome_completo: nome, telefone_contato: telefone } },
        papeis: {
          create: {
            cd_papel: papel.cd_papel,
            escopo_visualizacao_agenda: 'GLOBAL', escopo_gestao_agenda: 'GLOBAL',
            pode_criar_agendamento: true, pode_cancelar_agendamento: true,
            pode_atualizar_status: true, pode_bloquear_agenda: true, pode_criar_encaixe: true,
          },
        },
      },
      select: { cd_usuario: true },
    });

    await tx.auditoria.create({
      data: {
        cd_usuario: usuario.cd_usuario, operacao: 'PROVISIONAMENTO_INICIAL',
        entidade: 'USUARIO', cd_registro: usuario.cd_usuario,
        valor_novo: { status: 'ATIVO', papel: 'ADMINISTRADOR', origem: 'COMANDO_LOCAL' },
        justificativa: 'Conta inicial criada localmente pelo responsável; ativação administrativa sem SMS.',
      },
    });
    return usuario;
  });
}

module.exports = { criarAdminInicial };
