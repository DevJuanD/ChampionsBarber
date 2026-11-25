require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomInt, randomUUID } = require('node:crypto');
const argon2 = require('@node-rs/argon2');
const prisma = require('../src/config/prisma');
const { criarAuthService, hashToken } = require('../src/services/authService');

const rollback = new Error('ROLLBACK_TESTE_AUTH');

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const auth = criarAuthService({
        usuario: tx.usuario, papel: tx.papel, sessaoUsuario: tx.sessaoUsuario,
        $queryRaw: tx.$queryRaw.bind(tx), $transaction: (callback) => callback(tx),
      });
      const telefone = `+5599${randomInt(100000000, 999999999)}`;
      const senha = randomUUID();
      const dados = { nome: 'Teste de autenticação', telefone, email: `${randomUUID()}@example.invalid`, senha, status: 'ATIVO', papeis: ['ADMINISTRADOR'] };
      await auth.cadastrar(dados);
      const conta = await tx.usuario.findUnique({ where: { telefone }, include: { cliente: true, papeis: { include: { papel: true } } } });
      assert.equal(conta.status, 'PENDENTE');
      assert.equal(conta.telefone_verificado_em, null);
      assert.equal(conta.cliente.nome_completo, dados.nome);
      assert.deepEqual(conta.papeis.map((p) => p.papel.codigo), ['CLIENTE']);
      assert.match(conta.senha_hash, /^\$argon2id\$/);
      assert.equal(await argon2.verify(conta.senha_hash, senha), true);
      await assert.rejects(auth.entrar({ telefone, senha: 'incorreta' }), { status: 401 });
      await assert.rejects(auth.entrar({ telefone, senha }), { status: 403 });
      console.log('OK: cadastro transacional, Argon2id, papel CLIENTE e bloqueio de conta pendente.');

      // Ativação exclusiva da fixture de teste; tudo será revertido no fim.
      await tx.usuario.update({ where: { cd_usuario: conta.cd_usuario }, data: { status: 'ATIVO', telefone_verificado_em: new Date() } });
      const primeira = await auth.entrar({ telefone, senha });
      const segunda = await auth.entrar({ telefone, senha });
      console.log('OK: login e criação de duas sessões.');
      assert.notEqual(primeira.token, segunda.token);
      const sessao = await tx.sessaoUsuario.findUnique({ where: { token_hash: hashToken(primeira.token) } });
      assert.notEqual(sessao.token_hash, primeira.token);
      assert.equal((await auth.autenticar(primeira.token)).cd_usuario, conta.cd_usuario);
      assert.ok(!JSON.stringify(primeira.usuario).includes('senha_hash'));
      console.log('OK: leitura da sessão e resposta sem senha.');
      await tx.usuarioPapel.updateMany({ where: { cd_usuario: conta.cd_usuario }, data: { ativo: false } });
      assert.deepEqual((await auth.autenticar(segunda.token)).papeis, []);
      await auth.sair(primeira.token);
      await assert.rejects(auth.autenticar(primeira.token), { status: 401 });
      assert.equal((await auth.autenticar(segunda.token)).cd_usuario, conta.cd_usuario);
      console.log('OK: sessões independentes, token protegido, revogação e atualização de papéis.');

      const expirada = await auth.entrar({ telefone, senha });
      await tx.sessaoUsuario.update({ where: { token_hash: hashToken(expirada.token) }, data: { criado_em: new Date(Date.now() - 60000), expira_em: new Date(Date.now() - 1000) } });
      await assert.rejects(auth.autenticar(expirada.token), { status: 401 });
      await auth.sairDeTodos(conta.cd_usuario);
      await assert.rejects(auth.autenticar(segunda.token), { status: 401 });
      const bloqueada = await auth.entrar({ telefone, senha });
      await tx.usuario.update({ where: { cd_usuario: conta.cd_usuario }, data: { status: 'DESATIVADO' } });
      await assert.rejects(auth.autenticar(bloqueada.token), { status: 401 });
      console.log('OK: expiração, logout de todos os dispositivos e conta desativada.');
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log('Testes concluídos com rollback; nenhum registro de teste foi mantido.');
}

main().catch((error) => {
  console.error(`Falha no teste de autenticação: ${error.code || error.name}.`);
  if (error.code === 'P2022') console.error(`Coluna: ${error.meta?.column}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
