const prisma = require('../config/prisma');
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const situacoes = ['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'];

function escopoAgenda(usuario, gestao = false) {
  if (usuario.papeis.includes('ADMINISTRADOR')) return {};
  const escopo = usuario.permissoes[gestao ? 'escopo_gestao_agenda' : 'escopo_visualizacao_agenda'];
  if (escopo === 'GLOBAL') return {};
  if (escopo === 'PROPRIOS' && usuario.cd_profissional) return { cd_profissional: usuario.cd_profissional };
  throw erro(403, 'Você não tem permissão para acessar esta agenda.');
}

function validarData(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`)) || new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) !== data) throw erro(400, 'Selecione uma data válida.');
}

function criarAgendaService(db = prisma) {
  return {
    async listar(query, usuario) {
      const escopo = escopoAgenda(usuario);
      validarData(query.data);
      const pagina = Number(query.pagina || 1);
      const profissional = query.cd_profissional ? Number(query.cd_profissional) : null;
      if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000 || (profissional !== null && (!Number.isSafeInteger(profissional) || profissional <= 0)) || (query.status && !situacoes.includes(query.status))) throw erro(400, 'Confira os filtros da agenda.');
      if (escopo.cd_profissional && profissional && escopo.cd_profissional !== profissional) throw erro(403, 'Você só pode consultar a sua agenda.');
      const inicio = new Date(`${query.data}T00:00:00-03:00`);
      const where = { ...escopo, ...(profissional ? { cd_profissional: profissional } : {}), ...(query.status ? { status: query.status } : {}), inicio_em: { gte: inicio, lt: new Date(inicio.getTime() + 86400000) } };
      const [total, agendamentos] = await db.$transaction([
        db.agendamento.count({ where }),
        db.agendamento.findMany({ where, select: { cd_agendamento: true, cd_profissional: true, nome_cliente_reserva: true, telefone_reserva: true,
          inicio_em: true, fim_em: true, status: true, preco_registrado: true, duracao_registrada: true, modalidade: true, motivo_cancelamento: true,
          servico: { select: { nome: true } }, profissional: { select: { nome: true } } }, orderBy: [{ inicio_em: 'asc' }, { cd_agendamento: 'asc' }], skip: (pagina - 1) * 10, take: 10 }),
      ]);
      return { total, agendamentos, paginas: Math.max(1, Math.ceil(total / 10)) };
    },
    async alterarStatus(id, dados, usuario) {
      const cd_agendamento = Number(id);
      const { status, motivo } = dados;
      if (!Number.isSafeInteger(cd_agendamento) || cd_agendamento <= 0 || !situacoes.includes(status) || status === 'PENDENTE') throw erro(400, 'Selecione uma ação válida.');
      const escopo = escopoAgenda(usuario, true);
      if (!usuario.papeis.includes('ADMINISTRADOR') && !usuario.permissoes[status === 'CANCELADO' ? 'pode_cancelar_agendamento' : 'pode_atualizar_status']) throw erro(403, 'Você não tem permissão para esta ação.');
      if (status === 'CANCELADO' && (typeof motivo !== 'string' || motivo.trim().length < 3 || motivo.trim().length > 500)) throw erro(400, 'Informe um motivo de cancelamento entre 3 e 500 caracteres.');
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT cd_agendamento FROM agendamento WHERE cd_agendamento = ${cd_agendamento} FOR UPDATE`;
        const atual = await tx.agendamento.findFirst({ where: { cd_agendamento, ...escopo } });
        if (!atual) throw erro(404, 'Agendamento não encontrado nesta agenda.');
        const transicoes = { PENDENTE: ['CONFIRMADO', 'CANCELADO'], CONFIRMADO: ['CONCLUIDO', 'NAO_COMPARECEU', 'CANCELADO'] };
        if (!transicoes[atual.status]?.includes(status)) throw erro(409, 'A situação deste agendamento mudou. Atualize a agenda antes de continuar.');
        if ((status === 'CONCLUIDO' && atual.fim_em > new Date()) || (status === 'NAO_COMPARECEU' && atual.inicio_em > new Date())) throw erro(409, 'Ainda não é possível registrar esta ação para um atendimento futuro.');
        const registro = await tx.agendamento.update({ where: { cd_agendamento }, data: { status,
          ...(status === 'CANCELADO' ? { cancelado_por: usuario.cd_usuario, cancelado_em: new Date(), motivo_cancelamento: motivo.trim() } : {}) }, select: { cd_agendamento: true, status: true } });
        await tx.auditoria.create({ data: { cd_usuario: usuario.cd_usuario, operacao: status === 'CANCELADO' ? 'CANCELAR' : 'ATUALIZAR_STATUS', entidade: 'agendamento', cd_registro: cd_agendamento, valor_anterior: { status: atual.status }, valor_novo: { status }, justificativa: status === 'CANCELADO' ? motivo.trim() : null } });
        return registro;
      });
    },
  };
}

module.exports = { criarAgendaService, escopoAgenda, validarData };
