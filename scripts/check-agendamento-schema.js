require('dotenv').config({ quiet: true });
const prisma = require('../src/config/prisma');
async function main() {
  const regras = await prisma.$queryRaw`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'agendamento'::regclass`;
  console.log(JSON.stringify(regras));
  const gatilhos = await prisma.$queryRaw`SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid = 'agendamento'::regclass AND NOT tgisinternal`;
  console.log(JSON.stringify(gatilhos));
}
main().catch((error) => { console.error(error.code || error.name); process.exitCode = 1; }).finally(() => prisma.$disconnect());
