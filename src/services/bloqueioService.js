const prisma = require('../config/prisma');
const { escopoAgenda, validarData } = require('./agendaService');
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
function escopoBloqueio(usuario) {
  if (!usuario.papeis.includes('ADMINISTRADOR') && !usuario.permissoes.pode_bloquear_agenda) throw erro(403, 'Você não tem permissão para bloquear horários.');
  return escopoAgenda(usuario, true);
}
function criarBloqueioService(db = prisma) {
  return {
    async listar(data, usuario) {
      const escopo = escopoBloqueio(usuario); validarData(data);
      const inicio = new Date(`${data}T00:00:00-03:00`);
      return db.bloqueioAgenda.findMany({ where: { ...escopo, inicio_em: { lt: new Date(inicio.getTime() + 86400000) }, fim_em: { gt: inicio } },
        select: { cd_bloqueio: true, cd_profissional: true, inicio_em: true, fim_em: true, motivo: true, profissional: { select: { nome: true } } }, orderBy: [{ inicio_em: 'asc' }, { cd_bloqueio: 'asc' }], take: 100 });
    },
    async criar(dados, usuario) {
      const escopo = escopoBloqueio(usuario);
      const cd_profissional = Number(dados.cd_profissional);
      validarData(dados.data);
      if (!Number.isSafeInteger(cd_profissional) || cd_profissional <= 0 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dados.inicio || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dados.fim || '') || dados.inicio >= dados.fim || typeof dados.motivo !== 'string' || dados.motivo.trim().length < 3 || dados.motivo.trim().length > 500) throw erro(400, 'Selecione o profissional e informe início, fim e motivo do bloqueio.');
      if (escopo.cd_profissional && escopo.cd_profissional !== cd_profissional) throw erro(403, 'Você só pode bloquear a sua própria agenda.');
      const inicio_em = new Date(`${dados.data}T${dados.inicio}:00-03:00`);
      const fim_em = new Date(`${dados.data}T${dados.fim}:00-03:00`);
      if (inicio_em <= new Date()) throw erro(400, 'O bloqueio deve começar em um horário futuro.');
      return db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71001, ${new Date(`${dados.data}T12:00:00Z`).getUTCDay()}::integer)`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(72001, ${cd_profissional}::integer)`;
        if (!await tx.profissional.findFirst({ where: { cd_profissional, ativo: true } })) throw erro(400, 'Selecione um profissional ativo.');
        const faixa = { cd_profissional, inicio_em: { lt: fim_em }, fim_em: { gt: inicio_em } };
        if (await tx.agendamento.count({ where: { ...faixa, status: { not: 'CANCELADO' } } })) throw erro(409, 'Este período possui atendimentos. Resolva os agendamentos antes de bloquear.');
        if (await tx.bloqueioAgenda.count({ where: faixa })) throw erro(409, 'Já existe um bloqueio nesse intervalo.');
        const bloqueio = await tx.bloqueioAgenda.create({ data: { cd_profissional, inicio_em, fim_em, motivo: dados.motivo.trim(), cd_usuario_responsavel: usuario.cd_usuario } });
        await tx.auditoria.create({ data: { cd_usuario: usuario.cd_usuario, operacao: 'BLOQUEAR', entidade: 'bloqueio_agenda', cd_registro: bloqueio.cd_bloqueio, valor_novo: { cd_profissional, inicio_em: inicio_em.toISOString(), fim_em: fim_em.toISOString() }, justificativa: dados.motivo.trim() } });
        return { cd_bloqueio: bloqueio.cd_bloqueio };
      }, { timeout: 30000 });
    },
    async remover(id, usuario) {
      const escopo = escopoBloqueio(usuario); const cd_bloqueio = Number(id);
      if (!Number.isSafeInteger(cd_bloqueio) || cd_bloqueio <= 0) throw erro(400, 'Bloqueio inválido.');
      await db.$transaction(async (tx) => {
        const registro = await tx.bloqueioAgenda.findFirst({ where: { cd_bloqueio, ...escopo } });
        if (!registro) throw erro(404, 'Bloqueio não encontrado nesta agenda.');
        await tx.bloqueioAgenda.delete({ where: { cd_bloqueio } });
        await tx.auditoria.create({ data: { cd_usuario: usuario.cd_usuario, operacao: 'DESBLOQUEAR', entidade: 'bloqueio_agenda', cd_registro: cd_bloqueio, valor_anterior: { cd_profissional: registro.cd_profissional, inicio_em: registro.inicio_em.toISOString(), fim_em: registro.fim_em.toISOString() } } });
      });
    },
  };
}
module.exports = { criarBloqueioService, escopoBloqueio };
