const test = require('node:test');
const assert = require('node:assert/strict');
const { criarServico } = require('../src/controllers/servicoController');
const { exigirPapel } = require('../src/middlewares/authMiddleware');

function resposta() {
  return { status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; return this; } };
}

test('serviço rejeita valores inválidos antes de gravar', async () => {
  const valido = { nome: 'Corte', preco: '35.00', duracao_minutos: 30 };
  for (const alteracao of [
    { nome: ' ' }, { nome: 'a'.repeat(101) }, { preco: -1 }, { preco: '0' },
    { preco: '1.999' }, { preco: '100000000' }, { duracao_minutos: 0 },
    { duracao_minutos: 1.5 }, { duracao_minutos: 1441 }, { descricao: {} },
  ]) {
    const res = resposta();
    await criarServico({ body: { ...valido, ...alteracao } }, res, (error) => { throw error; });
    assert.equal(res.codigo, 400);
  }
});

test('cadastro de serviço exige perfil de administrador', () => {
  for (const papeis of [['CLIENTE'], ['BARBEIRO'], ['RECEPCAO']]) {
    const res = resposta();
    exigirPapel('ADMINISTRADOR')({ usuario: { papeis } }, res, () => assert.fail('Acesso indevido'));
    assert.equal(res.codigo, 403);
  }
  let permitido = false;
  exigirPapel('ADMINISTRADOR')({ usuario: { papeis: ['ADMINISTRADOR'] } }, resposta(), () => { permitido = true; });
  assert.equal(permitido, true);
});

test('HTTP: escrita de serviços exige proteção e sessão', async () => {
  const app = require('../src/server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/servicos`;
  try {
    let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 403);
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ChampionsBarber' }, body: '{}' });
    assert.equal(res.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
