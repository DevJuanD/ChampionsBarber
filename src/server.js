require('dotenv').config({ quiet: true });

const express = require('express');
const servicoRoutes = require('./routes/servicoRoutes');

const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.use('/api/servicos', servicoRoutes);

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT deve ser um número inteiro entre 1 e 65535.');
    process.exitCode = 1;
  } else {
    const server = app.listen(port, () => {
      console.log(`API Champions Barber disponível em http://localhost:${port}`);
    });

    server.on('error', (error) => {
      console.error(`Não foi possível iniciar o servidor (${error.code}).`);
      process.exitCode = 1;
    });
  }
}

module.exports = app;
