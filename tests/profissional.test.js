const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const { criarProfissional } = require('../src/controllers/profissionalController');

function resposta() {
  return { status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; return this; } };
}

test('profissional rejeita nome e vínculos inválidos antes de gravar', async () => {
  for (const dados of [
    {}, { nome: ' ' }, { nome: 'a'.repeat(151) }, { servicos: [] },
    { servicos: [1, 1] }, { servicos: ['1'] }, { servicos: [-1] },
    { servicos: [1.5] }, { descricao: {} },
  ]) {
    const res = resposta();
    await criarProfissional({ body: { nome: 'Juan', servicos: [1], ...dados,
      ...(Object.keys(dados).length ? {} : { nome: null }) } }, res, (error) => { throw error; });
    assert.equal(res.codigo, 400);
  }
});

test('profissional salva serviços na transação e rejeita serviço indisponível', async (t) => {
  let quantidade = 2;
  let gravacao;
  const transacaoOriginal = prisma.$transaction;
  t.after(() => { prisma.$transaction = transacaoOriginal; });
  prisma.$transaction = async (executar) => executar({
    servico: { count: async () => quantidade },
    profissional: { create: async (opcoes) => { gravacao = opcoes.data; return { cd_profissional: 1 }; } },
  });
  const req = { body: { nome: ' Juan ', descricao: ' Barbeiro ', servicos: [1, 2] } };
  const res = resposta();
  await criarProfissional(req, res, (error) => { throw error; });
  assert.equal(res.codigo, 201);
  assert.deepEqual(gravacao, { nome: 'Juan', descricao: 'Barbeiro', servicos: { create: [{ cd_servico: 1 }, { cd_servico: 2 }] } });
  quantidade = 1;
  gravacao = null;
  let falha;
  await criarProfissional(req, resposta(), (error) => { falha = error; });
  assert.equal(falha.status, 400);
  assert.equal(gravacao, null);
});

test('HTTP: profissionais exige sessão para consulta e proteção para escrita', async () => {
  const app = require('../src/server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/profissionais`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ChampionsBarber' }, body: '{}' })).status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
