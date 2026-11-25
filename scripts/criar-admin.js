require('dotenv').config({ quiet: true });
const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');
const prisma = require('../src/config/prisma');
const { criarAdminInicial } = require('../src/services/adminInicialService');

async function main() {
  if (!process.stdin.isTTY) throw new Error('Execute npm run admin:criar no terminal interativo.');

  let ocultar = false;
  const saida = new Writable({
    write(texto, encoding, callback) {
      if (!ocultar) process.stdout.write(texto, encoding);
      callback();
    },
  });
  const perguntas = createInterface({ input: process.stdin, output: saida, terminal: true });
  perguntas.on('SIGINT', () => { perguntas.close(); process.exit(130); });

  try {
    const nome = process.env.ADMIN_NOME || await perguntas.question('Nome completo: ');
    const telefone = process.env.ADMIN_TELEFONE || await perguntas.question('Telefone com DDD: ');

    async function perguntarSenha(rotulo) {
      process.stdout.write(rotulo);
      ocultar = true;
      try { return await perguntas.question(''); }
      finally { ocultar = false; process.stdout.write('\n'); }
    }

    const senha = await perguntarSenha('Senha (12 a 128 caracteres; não será exibida): ');
    const confirmar = await perguntarSenha('Confirme a senha: ');
    if (senha !== confirmar) throw new Error('As senhas não coincidem.');

    await criarAdminInicial({ nome, telefone, senha });
    console.log('Administrador inicial criado com sucesso.');
  } finally { perguntas.close(); }
}

main().catch((error) => {
  console.error(error.code ? `Não foi possível criar o administrador (${error.code}).` : error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
