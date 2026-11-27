require('dotenv').config({ quiet: true });
const { randomInt } = require('node:crypto');
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const { criarCliente, editarCliente, excluirCliente } = require('../src/controllers/clienteController');
const { criarAuthService } = require('../src/services/authService');
let etapa = 'conexão';
const resposta = () => ({ status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; }, end() {} });

async function main() {
  const transacao = prisma.$transaction.bind(prisma);
  const rollback = new Error('ROLLBACK_TESTE');
  try {
    await transacao(async (tx) => {
      prisma.$transaction = async (executar) => executar(tx);
      const telefone = `639${randomInt(10000000, 99999999)}`;
      const novoTelefone = `639${randomInt(10000000, 99999999)}`;
      const falhar = (error) => { throw error; };
      etapa = 'cadastro';
      const criado = resposta();
      await criarCliente({ body: { nome: 'Teste de cliente', telefone } }, criado, falhar);
      assert.equal(criado.codigo, 201);
      const id = criado.dados.cd_cliente;
      etapa = 'edição';
      const editado = resposta();
      await editarCliente({ params: { id }, body: { nome: 'Cliente alterado', telefone: novoTelefone, email: '' } }, editado, falhar);
      assert.equal(editado.dados.nome_completo, 'Cliente alterado');
      const auth = criarAuthService({ usuario: tx.usuario, sessaoUsuario: tx.sessaoUsuario, $transaction: async (executar) => executar(tx) });
      etapa = 'login com telefone alterado';
      const login = await auth.entrar({ telefone: novoTelefone, senha: novoTelefone });
      etapa = 'exclusão';
      const excluido = resposta();
      await excluirCliente({ params: { id } }, excluido, falhar);
      assert.equal(excluido.codigo, 204);
      assert.equal(await tx.cliente.findUnique({ where: { cd_cliente: id } }), null);
      await assert.rejects(auth.autenticar(login.token), { status: 401 });
      assert.equal((await tx.usuario.findUnique({ where: { cd_usuario: criado.dados.cd_usuario } })).status, 'INATIVO');
      console.log('OK: cadastro, edição, senha inicial atualizada, exclusão e acesso revogado.');
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { prisma.$transaction = transacao; await prisma.$disconnect(); }
  console.log('Dados de teste revertidos.');
}
main().catch((error) => { console.error(`Falha no teste (${etapa}): ${error.code || error.name}.`); process.exitCode = 1; });
