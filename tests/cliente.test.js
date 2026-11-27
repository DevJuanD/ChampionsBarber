const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const { criarCliente, listarClientes, editarCliente, excluirCliente } = require('../src/controllers/clienteController');

function resposta() { return { set() { return this; }, status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; return this; } }; }

test('cadastro de cliente valida contato e cria somente o papel CLIENTE com senha temporária', async (t) => {
  const valido = { nome: 'João Silva', telefone: '(63) 99999-1234', email: ' JOAO@EXEMPLO.COM ' };
  for (const alteracao of [{ nome: ' ' }, { nome: 'a'.repeat(151) }, { telefone: 'abc' }, { email: {} }, { email: 'invalido' }]) {
    const res = resposta();
    let erro;
    await criarCliente({ body: { ...valido, ...alteracao } }, res, (error) => { erro = error; });
    assert.equal(res.codigo || erro?.status, 400);
  }
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  let gravado;
  prisma.$transaction = async (executar) => executar({
    papel: { upsert: async () => ({ cd_papel: 4, ativo: true }) },
    cliente: { create: async ({ data }) => { gravado = data; return { cd_cliente: 1 }; } },
  });
  const res = resposta();
  await criarCliente({ body: { ...valido, cd_usuario: 1, papeis: ['ADMINISTRADOR'] } }, res, (error) => { throw error; });
  assert.equal(res.codigo, 201);
  assert.equal(gravado.telefone_contato, '+5563999991234');
  assert.equal(gravado.email_contato, 'joao@exemplo.com');
  assert.equal(gravado.usuario.create.deve_trocar_senha, true);
  assert.deepEqual(gravado.usuario.create.papeis, { create: { cd_papel: 4 } });
  assert.equal(await require('@node-rs/argon2').verify(gravado.usuario.create.senha_hash, '63999991234'), true);
});

test('exclusão preserva clientes com histórico e contas da equipe', async (t) => {
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  let historico = 1;
  let apagou = false;
  prisma.$transaction = async (executar) => executar({
    $queryRaw: async () => [],
    cliente: { findUnique: async () => ({ cd_cliente: 1, cd_usuario: 1 }), delete: async () => { apagou = true; } },
    agendamento: { count: async () => historico },
    usuario: { findUnique: async () => ({ profissional: null, papeis: [{ papel: { codigo: 'ADMINISTRADOR' } }] }) },
  });
  for (const quantidade of [1, 0]) {
    historico = quantidade;
    let erro;
    await excluirCliente({ params: { id: '1' } }, resposta(), (error) => { erro = error; });
    assert.equal(erro.status, 409);
    assert.equal(apagou, false);
  }
});

test('edição e exclusão rejeitam identificadores inválidos', async () => {
  for (const id of ['abc', '0', '-1', '1.5']) {
    for (const executar of [editarCliente, excluirCliente]) {
      const res = resposta();
      await executar({ params: { id }, body: {} }, res, (error) => { throw error; });
      assert.equal(res.codigo, 400);
    }
  }
});

test('consulta de clientes limita página e normaliza busca por telefone', async (t) => {
  for (const query of [{ pagina: '0' }, { pagina: '1.5' }, { busca: 'a'.repeat(151) }]) {
    const res = resposta();
    await listarClientes({ query }, res, (error) => { throw error; });
    assert.equal(res.codigo, 400);
  }
  const originais = { count: prisma.cliente.count, findMany: prisma.cliente.findMany, transaction: prisma.$transaction };
  t.after(() => { prisma.cliente.count = originais.count; prisma.cliente.findMany = originais.findMany; prisma.$transaction = originais.transaction; });
  let consulta;
  prisma.cliente.count = async () => 21;
  prisma.cliente.findMany = async (opcoes) => { consulta = opcoes; return []; };
  prisma.$transaction = async (operacoes) => Promise.all(operacoes);
  const res = resposta();
  await listarClientes({ query: { busca: '(63) 99999-1234', pagina: '2' } }, res, (error) => { throw error; });
  assert.equal(consulta.skip, 10);
  assert.equal(consulta.take, 10);
  assert.equal(consulta.where.OR[1].telefone_contato.contains, '63999991234');
  assert.equal(res.dados.paginas, 3);
});

test('HTTP: clientes protege consulta e cadastro', async () => {
  const app = require('../src/server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/clientes`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ChampionsBarber' }, body: '{}' })).status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
