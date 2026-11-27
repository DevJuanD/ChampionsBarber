export const nomesPapeis = { ADMINISTRADOR: 'Administrador', BARBEIRO: 'Barbeiro', RECEPCAO: 'Recepção', CLIENTE: 'Cliente' };

export const modulosPainel = [
  { id: 'inicio', titulo: 'Visão geral', grupo: 'PRINCIPAL', icone: 'inicio' },
  { id: 'agenda', titulo: 'Agenda', grupo: 'PRINCIPAL', icone: 'agenda', descricao: 'Atendimentos e disponibilidade dos profissionais.', campos: ['Data e horário', 'Cliente e serviço', 'Profissional', 'Situação'], acao: 'Novo agendamento' },
  { id: 'agendamentos', titulo: 'Meus agendamentos', grupo: 'PRINCIPAL', icone: 'agenda', descricao: 'Seus horários e histórico de atendimentos.', campos: ['Data e horário', 'Serviço', 'Profissional', 'Situação'] },
  { id: 'usuarios', titulo: 'Usuários e acessos', grupo: 'GESTÃO', icone: 'usuarios', descricao: 'Contas da equipe, papéis e permissões de acesso.', campos: ['Nome e telefone', 'Papéis', 'Escopos e permissões', 'Status da conta'], acao: 'Novo usuário' },
  { id: 'clientes', titulo: 'Clientes', grupo: 'GESTÃO', icone: 'conta', descricao: 'Dados de contato e histórico dos clientes da barbearia.', campos: ['Nome completo', 'Contato', 'Conta vinculada', 'Histórico'], acao: 'Novo cliente' },
  { id: 'servicos', titulo: 'Serviços', grupo: 'GESTÃO', icone: 'servicos', descricao: 'Catálogo, preços e duração dos serviços oferecidos.', campos: ['Nome e descrição', 'Preço', 'Duração', 'Visibilidade no catálogo'], acao: 'Novo serviço' },
  { id: 'profissionais', titulo: 'Profissionais', grupo: 'GESTÃO', icone: 'profissionais', descricao: 'Equipe da barbearia e serviços executados por cada profissional.', campos: ['Nome', 'Serviços habilitados', 'Conta vinculada', 'Status do profissional'], acao: 'Novo profissional' },
  { id: 'horarios', titulo: 'Horários e jornadas', grupo: 'OPERAÇÃO', icone: 'horarios', descricao: 'Funcionamento da barbearia e jornadas de cada profissional.', campos: ['Dia da semana', 'Períodos de trabalho', 'Pausas', 'Tolerância de jornada'], acao: 'Adicionar período' },
  { id: 'bloqueios', titulo: 'Bloqueios', grupo: 'OPERAÇÃO', icone: 'bloqueios', descricao: 'Períodos reservados para pausas e indisponibilidades.', campos: ['Profissional', 'Início e fim', 'Motivo', 'Responsável'], acao: 'Novo bloqueio' },
  { id: 'encaixes', titulo: 'Encaixes', grupo: 'OPERAÇÃO', icone: 'encaixes', descricao: 'Atendimentos excepcionais com autorização e justificativa.', campos: ['Cliente e serviço', 'Janela de atendimento', 'Alertas de conflito', 'Autorização'], acao: 'Novo encaixe' },
  { id: 'notificacoes', titulo: 'Notificações', grupo: 'SISTEMA', icone: 'notificacoes', descricao: 'Acompanhamento das comunicações e tentativas de envio.', campos: ['Destinatário', 'Tipo e canal', 'Situação do envio', 'Tentativas'] },
  { id: 'auditoria', titulo: 'Auditoria', grupo: 'SISTEMA', icone: 'auditoria', descricao: 'Histórico das alterações e operações administrativas.', campos: ['Data', 'Responsável', 'Operação', 'Registro alterado'] },
  { id: 'configuracoes', titulo: 'Configurações', grupo: 'SISTEMA', icone: 'configuracoes', descricao: 'Regras gerais de funcionamento e agendamento.', campos: ['Intervalo entre atendimentos', 'Janela de reservas', 'Prazo de cancelamento', 'Tolerância de fechamento'] },
  { id: 'conta', titulo: 'Minha conta', grupo: 'CONTA', icone: 'conta' },
];

export function modulosPermitidos(usuario) {
  const admin = usuario.papeis.includes('ADMINISTRADOR');
  return modulosPainel.filter((modulo) => {
    if (['inicio', 'conta'].includes(modulo.id)) return true;
    if (modulo.id === 'agendamentos') return !admin && usuario.papeis.includes('CLIENTE');
    if (admin) return true;
    if (modulo.id === 'agenda') return usuario.permissoes.escopo_visualizacao_agenda !== 'SEM_ACESSO';
    if (modulo.id === 'bloqueios') return usuario.permissoes.pode_bloquear_agenda;
    if (modulo.id === 'encaixes') return usuario.permissoes.pode_criar_encaixe;
    return false;
  });
}
