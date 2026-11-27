const { randomBytes } = require('node:crypto');
const prisma = require('../config/prisma');

const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const dataLocal = (data) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
const minutos = (hora) => hora.getUTCHours() * 60 + hora.getUTCMinutes();
const instante = (data, minuto) => new Date(`${data}T${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}:00-03:00`);

function validarConsulta(dados) {
  const cd_servico = Number(dados.cd_servico);
  const cd_profissional = Number(dados.cd_profissional);
  const data = dados.data;
  if (!Number.isSafeInteger(cd_servico) || cd_servico <= 0 || !Number.isSafeInteger(cd_profissional) || cd_profissional <= 0 ||
      typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`)) || new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) !== data) {
    throw erro(400, 'Selecione o serviço, o profissional e uma data válida.');
  }
  return { cd_servico, cd_profissional, data };
}

function calcularHorarios({ data, funcionamento, jornadas, ocupados, bloqueios, compromissos, duracao, intervalo, antecedencia, agora = new Date() }) {
  const horarios = [];
  const limite = agora.getTime() + antecedencia * 60000;
  for (let minuto = 0; minuto + duracao < 1440; minuto += 15) {
    const fimMinuto = minuto + duracao;
    if (!funcionamento.some((periodo) => minutos(periodo.hora_inicio) <= minuto && minutos(periodo.hora_fim) >= fimMinuto) ||
        !jornadas.some((periodo) => minutos(periodo.hora_inicio) <= minuto && minutos(periodo.hora_fim) >= fimMinuto)) continue;
    const inicio = instante(data, minuto);
    const fim = instante(data, fimMinuto);
    if (inicio.getTime() <= limite) continue;
    if (ocupados.some((item) => inicio.getTime() < item.fim_em.getTime() + intervalo * 60000 && fim.getTime() + intervalo * 60000 > item.inicio_em.getTime()) ||
        [...bloqueios, ...compromissos].some((item) => inicio < item.fim_em && fim > item.inicio_em)) continue;
    horarios.push(String(Math.floor(minuto / 60)).padStart(2, '0') + ':' + String(minuto % 60).padStart(2, '0'));
  }
  return horarios;
}

async function disponibilidade(db, dados, cd_cliente) {
  const { cd_servico, cd_profissional, data } = validarConsulta(dados);
  const config = await db.configuracao.findFirst() || { janela_agendamento_dias: 15, intervalo_atendimentos_minutos: 5, antecedencia_agendamento_minutos: 0, confirmacao_automatica: true };
  const hoje = dataLocal(new Date());
  const ultimoDia = new Date(`${hoje}T12:00:00Z`);
  ultimoDia.setUTCDate(ultimoDia.getUTCDate() + config.janela_agendamento_dias);
  if (data < hoje || data > ultimoDia.toISOString().slice(0, 10)) throw erro(400, `Escolha uma data entre hoje e ${ultimoDia.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.`);
  const vinculo = await db.profissionalServico.findFirst({ where: { cd_servico, cd_profissional, profissional: { ativo: true }, servico: { ativo: true } }, include: { servico: true } });
  if (!vinculo) throw erro(400, 'Este profissional não está disponível para o serviço selecionado.');
  const dia_semana = new Date(`${data}T12:00:00Z`).getUTCDay();
  const inicioDia = instante(data, 0);
  const fimDia = new Date(inicioDia.getTime() + 86400000);
  const faixa = { inicio_em: { lt: fimDia }, fim_em: { gt: inicioDia } };
  const [funcionamento, jornadas, ocupados, bloqueios, compromissos] = await Promise.all([
    db.funcionamento.findMany({ where: { dia_semana, ativo: true } }),
    db.jornadaProfissional.findMany({ where: { dia_semana, cd_profissional, ativo: true } }),
    db.agendamento.findMany({ where: { cd_profissional, status: { not: 'CANCELADO' }, ...faixa }, select: { inicio_em: true, fim_em: true } }),
    db.bloqueioAgenda.findMany({ where: { cd_profissional, ...faixa }, select: { inicio_em: true, fim_em: true } }),
    db.agendamento.findMany({ where: { cd_cliente, status: { not: 'CANCELADO' }, ...faixa }, select: { inicio_em: true, fim_em: true } }),
  ]);
  const horarios = calcularHorarios({ data, funcionamento, jornadas, ocupados, bloqueios, compromissos, duracao: vinculo.servico.duracao_minutos,
    intervalo: config.intervalo_atendimentos_minutos, antecedencia: config.antecedencia_agendamento_minutos });
  return { horarios, servico: vinculo.servico, config, dia_semana };
}

function criarAgendamentoService(db = prisma) {
  return {
    async horarios(dados, cd_cliente) { return (await disponibilidade(db, dados, cd_cliente)).horarios; },
    async agendar(dados, cd_cliente, contexto = {}) {
      const consulta = validarConsulta(dados);
      if (typeof dados.hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dados.hora)) throw erro(400, 'Selecione um horário disponível.');
      return db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71001, ${new Date(`${consulta.data}T12:00:00Z`).getUTCDay()}::integer)`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(72001, ${consulta.cd_profissional}::integer)`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(72002, ${cd_cliente}::integer)`;
        const { horarios, servico, config } = await disponibilidade(tx, consulta, cd_cliente);
        if (!horarios.includes(dados.hora)) throw erro(409, 'Este horário não está mais disponível. Escolha outro horário.');
        const cliente = await tx.cliente.findUnique({ where: { cd_cliente } });
        if (!cliente) throw erro(403, 'Seu cadastro de cliente não está disponível.');
        const inicio_em = new Date(`${consulta.data}T${dados.hora}:00-03:00`);
        const registro = await tx.agendamento.create({ data: {
          referencia_publica: randomBytes(12).toString('hex'), cd_cliente, cd_profissional: consulta.cd_profissional, cd_servico: consulta.cd_servico,
          inicio_em, fim_em: new Date(inicio_em.getTime() + servico.duracao_minutos * 60000),
          preco_registrado: servico.preco, duracao_registrada: servico.duracao_minutos,
          nome_cliente_reserva: cliente.nome_completo, telefone_reserva: cliente.telefone_contato,
          origem: contexto.cd_usuario ? 'INTERNO' : 'ONLINE', status: config.confirmacao_automatica ? 'CONFIRMADO' : 'PENDENTE',
        }, select: { cd_agendamento: true, inicio_em: true, status: true } });
        if (contexto.cd_usuario) await tx.auditoria.create({ data: { cd_usuario: contexto.cd_usuario, operacao: 'CRIAR', entidade: 'agendamento', cd_registro: registro.cd_agendamento, valor_novo: { status: registro.status, origem: 'INTERNO' } } });
        return registro;
      }, { timeout: 30000 });
    },
  };
}

module.exports = { criarAgendamentoService, calcularHorarios, validarConsulta };
