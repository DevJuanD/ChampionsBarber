require('dotenv').config({ quiet: true });

const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const servicoRoutes = require('./routes/servicoRoutes');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/servicos', servicoRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  const mensagem = error.type === 'entity.parse.failed' ? 'JSON inválido.'
    : error.type === 'entity.too.large' ? 'Os dados enviados excedem o limite permitido.'
      : status >= 500 ? 'Não foi possível concluir a operação.' : error.message;
  res.status(status).json({ mensagem });
});

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
