require('dotenv').config({ quiet: true });

const { Prisma } = require('@prisma/client');
const { prisma } = require('../src/models');

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    for (const model of Prisma.dmmf.datamodel.models) {
      const delegate = model.name[0].toLowerCase() + model.name.slice(1);
      // Verifica colunas e relações sem exibir os registros consultados.
      const relations = Object.fromEntries(
        model.fields.filter((field) => field.kind === 'object')
          .map((field) => [field.name, true]),
      );
      await tx[delegate].findMany({ take: 1, include: relations });
      console.log(`OK: ${model.dbName || model.name}`);
    }
  }, { timeout: 30000 });
  console.log('Leitura das 16 models concluída. Nenhum dado foi alterado.');
}

main()
  .catch((error) => {
    // Não expor URL, parâmetros ou registros em mensagens de erro.
    console.error(`Falha na verificação do banco (${error.code || error.name}).`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
