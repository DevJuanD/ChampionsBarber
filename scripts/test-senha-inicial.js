require('dotenv').config({ quiet: true });
const { randomInt } = require('node:crypto');
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const { criarCliente } = require('../src/controllers/clienteController');
const { criarAuthService } = require('../src/services/authService');
let etapa = 'conexão';

async function main() {
  const transacao = prisma.$transaction.bind(prisma);
  const rollback = new Error('ROLLBACK_TESTE');
  try {
    await transacao(async (tx) => {
      prisma.$transaction = async (executar) => executar(tx);
      const telefone = `639${randomInt(10000000, 99999999)}`;
      const res = { status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; } };
      etapa = 'cadastro';
      await criarCliente({ body: { nome: 'Teste de senha inicial', telefone } }, res, (error) => { throw error; });
      assert.equal(res.codigo, 201);
      assert.ok(res.dados.cd_usuario);
      const auth = criarAuthService({ usuario: tx.usuario, sessaoUsuario: tx.sessaoUsuario, $transaction: async (executar) => executar(tx) });
      etapa = 'primeiro login';
      const primeira = await auth.entrar({ telefone, senha: telefone });
      assert.equal(primeira.usuario.deve_trocar_senha, true);
      assert.deepEqual(primeira.usuario.papeis, ['CLIENTE']);
      etapa = 'troca de senha';
      const senha = `Teste!${randomInt(10000000, 99999999)}a`;
      await auth.trocarSenhaInicial(primeira.usuario.cd_usuario, { senha, confirmacao: senha });
      etapa = 'sessão antiga revogada';
      await assert.rejects(auth.autenticar(primeira.token), { status: 401 });
      etapa = 'senha antiga recusada';
      await assert.rejects(auth.entrar({ telefone, senha: telefone }), { status: 401 });
      etapa = 'novo login';
      const segunda = await auth.entrar({ telefone, senha });
      assert.equal(segunda.usuario.deve_trocar_senha, false);
      console.log('OK: cadastro, senha pelo telefone, troca obrigatória, revogação e novo login.');
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { prisma.$transaction = transacao; await prisma.$disconnect(); }
  console.log('Dados de teste revertidos; nenhuma conta de teste foi mantida.');
}

main().catch((error) => { console.error(`Falha no teste (${etapa}): ${error.code || error.name}${error.status ? `, HTTP ${error.status}` : ''}.`); process.exitCode = 1; });
