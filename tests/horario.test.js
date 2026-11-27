const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const { criarHorario } = require('../src/controllers/horarioController');

const dados = { tipo: 'funcionamento', dia_semana: 1, hora_inicio: '08:00', hora_fim: '12:00' };
function resposta() { return { status(codigo) { this.codigo = codigo; return this; }, json(valor) { this.valor = valor; return this; } }; }

test('horários rejeitam dia inválido, horário inválido e período invertido', async () => {
  for (const alteracao of [{ dia_semana: 7 }, { dia_semana: -1 }, { dia_semana: 1.5 }, { tipo: 'outro' },
    { hora_inicio: '24:00' }, { hora_inicio: '8:00' }, { hora_fim: '07:00' }, { hora_fim: '08:00' }, { tipo: 'jornada' }]) {
    const res = resposta();
    await criarHorario({ body: { ...dados, ...alteracao } }, res, (error) => { throw error; });
    assert.equal(res.codigo, 400);
  }
});

test('cadastro verifica conflitos, funcionamento e profissional na transação', async (t) => {
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  let conflito = false;
  let aberto = true;
  let ativo = true;
  let gravado;
  let bloqueios = 0;
  const criar = async ({ data }) => { gravado = data; return { ...data, cd_funcionamento: 1 }; };
  prisma.$transaction = async (executar) => executar({
    $executeRaw: async () => { bloqueios++; },
    profissional: { findFirst: async () => ativo ? {} : null },
    funcionamento: { findFirst: async ({ where }) => where.hora_inicio.lte ? (aberto ? {} : null) : (conflito ? {} : null), create: criar },
    jornadaProfissional: { findFirst: async () => conflito ? {} : null, create: criar },
  });
  const res = resposta();
  await criarHorario({ body: dados }, res, (error) => { throw error; });
  assert.equal(res.codigo, 201);
  assert.equal(res.valor.hora_inicio, '08:00');
  assert.equal(gravado.hora_inicio.toISOString(), '1970-01-01T08:00:00.000Z');
  const jornada = { ...dados, tipo: 'jornada', cd_profissional: 1 };
  await criarHorario({ body: jornada }, resposta(), (error) => { throw error; });
  assert.equal(gravado.cd_profissional, 1);
  for (const cenario of ['conflito', 'fechado', 'inativo']) {
    conflito = cenario === 'conflito'; aberto = cenario !== 'fechado'; ativo = cenario !== 'inativo'; gravado = null;
    let erro;
    await criarHorario({ body: jornada }, resposta(), (error) => { erro = error; });
    assert.equal(erro.status, conflito ? 409 : 400);
    assert.equal(gravado, null);
  }
  assert.equal(bloqueios, 5);
});

test('HTTP: consulta e cadastro de horários exigem sessão', async () => {
  const app = require('../src/server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/horarios`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ChampionsBarber' }, body: JSON.stringify(dados) })).status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('cadastro em lote rejeita dias repetidos e períodos sobrepostos', async () => {
  const lote = { tipo: 'funcionamento', dias_semana: [1, 2], periodos: [{ hora_inicio: '08:00', hora_fim: '12:00' }] };
  for (const alteracao of [
    { dias_semana: [] }, { dias_semana: [1, 1] }, { dias_semana: [7] }, { periodos: [] },
    { periodos: [null] }, { periodos: [{ hora_inicio: '08:00', hora_fim: '12:00' }, { hora_inicio: '11:00', hora_fim: '14:00' }] },
  ]) {
    const res = resposta();
    await criarHorario({ body: { ...lote, ...alteracao } }, res, (error) => { throw error; });
    assert.equal(res.codigo, 400);
  }
});

test('lote valida todos os dias antes de gravar e bloqueia dias em ordem', async (t) => {
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  const bloqueados = [];
  const gravados = [];
  let diaConflito = null;
  let transacoes = 0;
  prisma.$transaction = async (executar) => {
    transacoes++;
    return executar({
      $executeRaw: async (_, dia) => { bloqueados.push(dia); },
      funcionamento: {
        findFirst: async ({ where }) => where.dia_semana === diaConflito ? {} : null,
        create: async ({ data }) => { gravados.push(data); return { ...data, cd_funcionamento: gravados.length }; },
      },
    });
  };
  const req = { body: { tipo: 'funcionamento', dias_semana: [3, 1, 2], periodos: [
    { hora_inicio: '08:00', hora_fim: '12:00' }, { hora_inicio: '14:00', hora_fim: '18:00' },
  ] } };
  const res = resposta();
  await criarHorario(req, res, (error) => { throw error; });
  assert.equal(res.codigo, 201);
  assert.equal(res.valor.length, 6);
  assert.deepEqual(bloqueados, [1, 2, 3]);
  assert.deepEqual(gravados.map((item) => item.dia_semana), [1, 1, 2, 2, 3, 3]);
  gravados.length = 0;
  diaConflito = 3;
  let erro;
  await criarHorario(req, resposta(), (error) => { erro = error; });
  assert.equal(erro.status, 409);
  assert.equal(gravados.length, 0);
  assert.equal(transacoes, 2);
});
