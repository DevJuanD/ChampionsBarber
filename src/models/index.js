const prisma = require('../config/prisma');


module.exports = {
  prisma,
  usuario: prisma.usuario,
  cliente: prisma.cliente,
  sessaoUsuario: prisma.sessaoUsuario,
  verificacaoContato: prisma.verificacaoContato,
  papel: prisma.papel,
  usuarioPapel: prisma.usuarioPapel,
  servico: prisma.servico,
  profissional: prisma.profissional,
  profissionalServico: prisma.profissionalServico,
  funcionamento: prisma.funcionamento,
  jornadaProfissional: prisma.jornadaProfissional,
  bloqueioAgenda: prisma.bloqueioAgenda,
  agendamento: prisma.agendamento,
  notificacao: prisma.notificacao,
  configuracao: prisma.configuracao,
  auditoria: prisma.auditoria,
};
