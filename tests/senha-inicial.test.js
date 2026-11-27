const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('@node-rs/argon2');
const { criarAuthService } = require('../src/services/authService');
const prisma = require('../src/config/prisma');
const { exigirSessao } = require('../src/middlewares/authMiddleware');

test('troca da senha inicial valida confirmação, recusa telefone e revoga sessões', async () => {
  const usuario = { cd_usuario: 5, telefone: '+5563999991234', status: 'ATIVO', telefone_verificado_em: new Date(), deve_trocar_senha: true, senha_hash: await argon2.hash('63999991234') };
  let atualizado;
  let revogado;
  const auth = criarAuthService({ $transaction: async (executar) => executar({
    $queryRaw: async () => [],
    usuario: { findUnique: async () => usuario, update: async (opcoes) => { atualizado = opcoes; } },
    sessaoUsuario: { updateMany: async (opcoes) => { revogado = opcoes; } },
  }) });
  for (const dados of [ { senha: 'curta', confirmacao: 'curta' }, { senha: 'novaSenha123', confirmacao: 'outra' },
    { senha: '63999991234', confirmacao: '63999991234' }, { senha: '(63) 99999-1234', confirmacao: '(63) 99999-1234' } ]) {
    await assert.rejects(auth.trocarSenhaInicial(5, dados), { status: 400 });
    assert.equal(atualizado, undefined);
  }
  await auth.trocarSenhaInicial(5, { senha: 'novaSenha123!', confirmacao: 'novaSenha123!' });
  assert.equal(atualizado.data.deve_trocar_senha, false);
  assert.equal(await argon2.verify(atualizado.data.senha_hash, 'novaSenha123!'), true);
  assert.equal(revogado.where.cd_usuario, 5);
  usuario.deve_trocar_senha = false;
  await assert.rejects(auth.trocarSenhaInicial(5, { senha: 'outraSenha123!', confirmacao: 'outraSenha123!' }), { status: 409 });
});

test('sessão com senha temporária só acessa o fluxo de troca e encerramento', async (t) => {
  const original = prisma.sessaoUsuario.findUnique;
  t.after(() => { prisma.sessaoUsuario.findUnique = original; });
  prisma.sessaoUsuario.findUnique = async () => ({ expira_em: new Date(Date.now() + 60000), usuario: {
    cd_usuario: 5, telefone: '+5563999991234', status: 'ATIVO', telefone_verificado_em: new Date(), deve_trocar_senha: true, papeis: [],
  } });
  for (const url of ['/api/clientes', '/api/profissionais', '/api/horarios']) {
    const res = { status(codigo) { this.codigo = codigo; return this; }, json(valor) { this.valor = valor; } };
    await exigirSessao({ cookies: { champions_session: 'a'.repeat(64) }, originalUrl: url }, res, () => assert.fail('Acesso indevido'));
    assert.equal(res.codigo, 403);
    assert.equal(res.valor.codigo, 'TROCA_SENHA_OBRIGATORIA');
  }
  for (const url of ['/api/auth/sessao', '/api/auth/senha-inicial']) {
    let liberado = false;
    await exigirSessao({ cookies: { champions_session: 'a'.repeat(64) }, originalUrl: url }, {}, (error) => { if (error) throw error; liberado = true; });
    assert.equal(liberado, true);
  }
});
