const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularHorarios, validarConsulta, criarAgendamentoService } = require('../src/services/agendamentoService');
const hora = (valor) => new Date(`1970-01-01T${valor}:00Z`);
const faixa = (inicio, fim) => ({ hora_inicio: hora(inicio), hora_fim: hora(fim) });
const reserva = (inicio, fim) => ({ inicio_em: new Date(`2030-01-07T${inicio}:00-03:00`), fim_em: new Date(`2030-01-07T${fim}:00-03:00`) });

test('disponibilidade respeita pausas, duração, intervalo, bloqueios e agenda do cliente', () => {
  const horarios = calcularHorarios({ data: '2030-01-07', funcionamento: [faixa('08:00', '12:00'), faixa('14:00', '18:00')],
    jornadas: [faixa('09:00', '17:00')], ocupados: [reserva('10:00', '10:30')], bloqueios: [reserva('14:00', '15:00')], compromissos: [reserva('16:00', '16:30')],
    duracao: 30, intervalo: 5, antecedencia: 0, agora: new Date('2030-01-07T08:00:00-03:00') });
  for (const invalido of ['08:00', '09:30', '10:00', '10:30', '11:45', '12:00', '13:30', '14:00', '14:45', '15:45', '16:00', '16:45']) assert.ok(!horarios.includes(invalido), invalido);
  for (const valido of ['09:00', '10:45', '11:30', '15:00', '16:30']) assert.ok(horarios.includes(valido), valido);
});

test('horários passados e antecedência não são oferecidos', () => {
  const horarios = calcularHorarios({ data: '2030-01-07', funcionamento: [faixa('08:00', '12:00')], jornadas: [faixa('08:00', '12:00')], ocupados: [], bloqueios: [], compromissos: [], duracao: 30, intervalo: 0, antecedencia: 60, agora: new Date('2030-01-07T09:00:00-03:00') });
  assert.equal(horarios[0], '10:15');
});

test('consulta de horários rejeita datas inexistentes e identificadores inválidos', () => {
  for (const dados of [{ data: '2030-02-30' }, { data: 'ontem' }, { cd_servico: -1 }, { cd_profissional: 'abc' }]) {
    assert.throws(() => validarConsulta({ cd_servico: 1, cd_profissional: 1, data: '2030-01-07', ...dados }), { status: 400 });
  }
});

test('reserva indisponível não grava e adquire os bloqueios da agenda e do cliente', async () => {
  let bloqueios = 0;
  const service = criarAgendamentoService({ $transaction: async (executar) => executar({
    $executeRaw: async () => { bloqueios++; }, configuracao: { findFirst: async () => null },
    profissionalServico: { findFirst: async () => ({ servico: { duracao_minutos: 30 } }) },
    funcionamento: { findMany: async () => [] }, jornadaProfissional: { findMany: async () => [] },
    agendamento: { findMany: async () => [], create: async () => assert.fail('Reserva inválida') }, bloqueioAgenda: { findMany: async () => [] },
  }) });
  const data = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  await assert.rejects(service.agendar({ cd_servico: 1, cd_profissional: 1, data, hora: '10:00' }, 2), { status: 409 });
  assert.equal(bloqueios, 3);
});

test('HTTP: rotas de agendamento exigem sessão e proteção de escrita', async () => {
  const app = require('../src/server'); const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/agendamentos`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(`${url}/horarios`)).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
