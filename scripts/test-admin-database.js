require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomInt, randomUUID } = require('node:crypto');
const prisma = require('../src/config/prisma');
const { criarAdminInicial } = require('../src/services/adminInicialService');
const { criarAuthService } = require('../src/services/authService');
const rollback = new Error('ROLLBACK_TESTE_ADMIN');

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const db = {
        usuario: tx.usuario, papel: tx.papel, usuarioPapel: tx.usuarioPapel,
        auditoria: tx.auditoria, sessaoUsuario: tx.sessaoUsuario,
        $queryRaw: tx.$queryRaw.bind(tx), $transaction: (callback) => callback(tx),
      };
      const dados = { nome: 'Administrador de teste', telefone: `+5599${randomInt(100000000, 999999999)}`, senha: randomUUID() };
      const existentes = await tx.usuarioPapel.count({ where: { papel: { codigo: 'ADMINISTRADOR' } } });
      if (existentes) {
        await assert.rejects(criarAdminInicial(dados, db), /Já existe um administrador/);
        console.log('OK: criação adicional bloqueada; administrador existente preservado.');
      } else {
        const admin = await criarAdminInicial(dados, db);
        const auth = criarAuthService(db);
        const resultado = await auth.entrar(dados);
        assert.equal(resultado.usuario.cd_usuario, admin.cd_usuario);
        assert.equal(resultado.usuario.nome, dados.nome);
        assert.deepEqual(resultado.usuario.papeis, ['ADMINISTRADOR']);
        assert.equal(resultado.usuario.permissoes.escopo_gestao_agenda, 'GLOBAL');
        assert.equal(resultado.usuario.permissoes.pode_criar_encaixe, true);
        const auditoria = await tx.auditoria.findFirst({ where: { cd_registro: admin.cd_usuario, operacao: 'PROVISIONAMENTO_INICIAL' } });
        assert.ok(auditoria);
        assert.ok(!JSON.stringify(auditoria).includes(dados.senha));
        await assert.rejects(criarAdminInicial({ ...dados, telefone: `+5599${randomInt(100000000, 999999999)}` }, db), /Já existe um administrador/);
        console.log('OK: administrador ativo, login, permissões globais e auditoria sem senha.');
        console.log('OK: segunda criação recusada, sem redefinir a conta inicial.');
      }
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('Teste concluído com rollback; nenhuma conta de teste foi mantida.');
}

main().catch((error) => {
  console.error(`Falha no teste de administrador (${error.code || error.name}).`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
