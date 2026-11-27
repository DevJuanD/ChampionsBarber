const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarTelefone, usuarioPublico } = require('../src/services/authService');

test('normaliza telefone brasileiro com ou sem código do país', () => {
  for (const telefone of ['(11) 99999-0000', '11999990000', '5511999990000', '+55 (11) 99999-0000']) {
    assert.equal(normalizarTelefone(telefone), '+5511999990000');
  }
  assert.equal(normalizarTelefone('(11) 3333-4444'), '+551133334444');
  for (const telefone of [null, {}, 11999990000, 'abc11999990000', '123', '++5511999990000', '119999900001', '+55119999900001', '+14155552671', '01999990000']) {
    assert.throws(() => normalizarTelefone(telefone), { status: 400 });
  }
});

function usuario(papeis, profissional = null) {
  return {
    cd_usuario: 1, telefone: '+5511999990000', email: null, status: 'ATIVO', profissional,
    senha_hash: 'nao-deve-aparecer', papeis,
  };
}

function papel(codigo, visualizar, gerir, capacidades = {}) {
  return { papel: { codigo }, escopo_visualizacao_agenda: visualizar, escopo_gestao_agenda: gerir, ...capacidades };
}

test('permissões unem papéis sem confundir leitura com gestão', () => {
  const resultado = usuarioPublico(usuario([
    papel('BARBEIRO', 'PROPRIOS', 'PROPRIOS', { pode_atualizar_status: true }),
    papel('RECEPCAO', 'GLOBAL', 'SEM_ACESSO'),
  ], { cd_profissional: 10, ativo: true }));
  assert.equal(resultado.permissoes.escopo_visualizacao_agenda, 'GLOBAL');
  assert.equal(resultado.permissoes.escopo_gestao_agenda, 'PROPRIOS');
  assert.equal(resultado.permissoes.pode_atualizar_status, true);
  assert.equal(resultado.permissoes.pode_criar_encaixe, false);
  assert.ok(!JSON.stringify(resultado).includes('senha_hash'));
});

test('escopo próprio sem profissional ativo não concede acesso', () => {
  for (const profissional of [null, { cd_profissional: 10, ativo: false }]) {
    const resultado = usuarioPublico(usuario([papel('BARBEIRO', 'PROPRIOS', 'PROPRIOS', { pode_criar_encaixe: true })], profissional));
    assert.equal(resultado.permissoes.escopo_visualizacao_agenda, 'SEM_ACESSO');
    assert.equal(resultado.permissoes.pode_criar_encaixe, false);
  }
});

test('administrador ativo tem capacidades globais', () => {
  const resultado = usuarioPublico(usuario([papel('ADMINISTRADOR', 'SEM_ACESSO', 'SEM_ACESSO')]));
  assert.equal(resultado.permissoes.escopo_gestao_agenda, 'GLOBAL');
  assert.equal(resultado.permissoes.pode_criar_encaixe, true);
});

test('HTTP: sessão obrigatória, CSRF, validação e erros sem detalhes internos', async () => {
  const app = require('../src/server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'ChampionsBarber' };
  try {
    let res = await fetch(`${base}/sessao`);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    res = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 403);
    res = await fetch(`${base}/login`, { method: 'POST', headers: { ...headers, Origin: 'https://site-externo.invalid' }, body: '{}' });
    assert.equal(res.status, 403);
    res = await fetch(`${base}/login`, { method: 'POST', headers, body: '{}' });
    assert.equal(res.status, 400);
    res = await fetch(`${base}/login`, { method: 'POST', headers, body: '{invalid' });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(await res.json()), ['mensagem']);
    res = await fetch(`${base}/logout`, { method: 'POST', headers, body: '{}' });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('set-cookie'), /HttpOnly/);
    assert.match(res.headers.get('set-cookie'), /SameSite=Lax/);
    for (let tentativa = 0; tentativa < 11; tentativa++) {
      res = await fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ telefone: 'invalid-rate-test' }) });
    }
    assert.equal(res.status, 429);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('middleware de papéis nega visitante e papel não concedido', () => {
  const { exigirPapel } = require('../src/middlewares/authMiddleware');
  const proteger = exigirPapel('ADMINISTRADOR');
  const res = { status(code) { this.code = code; return this; }, json() { return this; } };
  proteger({}, res, () => assert.fail('Visitante não pode entrar'));
  assert.equal(res.code, 401);
  proteger({ usuario: { papeis: ['CLIENTE'] } }, res, () => assert.fail('Cliente não pode administrar'));
  assert.equal(res.code, 403);
  let permitido = false;
  proteger({ usuario: { papeis: ['ADMINISTRADOR'] } }, res, () => { permitido = true; });
  assert.equal(permitido, true);
});
