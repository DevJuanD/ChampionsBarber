require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');

function erroConfiguracao(mensagem) {
  return Object.assign(new Error(mensagem), { configuracao: true });
}

async function verificarConexao(nome, valor) {
  if (!valor) throw erroConfiguracao(`Configure ${nome} no .env.`);
  let url;
  try { url = new URL(valor); }
  catch { throw erroConfiguracao(`${nome} não contém uma URL válida.`); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw erroConfiguracao(`${nome} deve ser uma conexão PostgreSQL, não uma URL de API.`);
  }

  const client = new PrismaClient({ datasources: { db: { url: valor } } });
  try {
    const [resultado] = await client.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return tx.$queryRaw`SELECT current_database() AS banco, current_schema() AS esquema,
        (SELECT COUNT(*)::int FROM information_schema.tables
          WHERE table_schema = current_schema() AND table_type = 'BASE TABLE') AS tabelas`;
    });
    console.log(`${nome}: OK (${url.hostname}:${url.port || '5432'})`);
    console.log(`Banco: ${resultado.banco}; schema: ${resultado.esquema}; tabelas visíveis: ${resultado.tabelas}.`);
  } finally { await client.$disconnect(); }
}

async function main() {
  await verificarConexao('DATABASE_URL', process.env.DATABASE_URL);
  await verificarConexao('DIRECT_URL', process.env.DIRECT_URL);
  console.log('Conexões verificadas sem alterar tabelas ou registros.');
}

main().catch((error) => {
  // Erros do driver podem incluir a conexão; exibir apenas o código.
  console.error(error.configuracao ? error.message
    : `Falha de conexão (${error.code || error.errorCode || 'ERRO_CONEXAO'}). Confira rede e credenciais no .env.`);
  process.exitCode = 1;
});
