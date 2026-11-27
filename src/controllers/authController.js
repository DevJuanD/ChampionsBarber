const { criarAuthService, DURACAO_SESSAO_MS } = require('../services/authService');
const { nomeCookie, opcoesCookie } = require('../config/auth');

const auth = criarAuthService();

async function cadastrar(req, res) {
  await auth.cadastrar(req.body || {});
  res.status(202).json({ mensagem: 'Solicitação de cadastro recebida.' });
}

async function entrar(req, res) {
  const resultado = await auth.entrar(req.body || {});
  res.cookie(nomeCookie, resultado.token, { ...opcoesCookie, maxAge: DURACAO_SESSAO_MS });
  res.json({ usuario: resultado.usuario, expira_em: resultado.expira_em });
}

function consultarSessao(req, res) {
  res.json({ usuario: req.usuario });
}

async function sair(req, res) {
  await auth.sair(req.cookies[nomeCookie]);
  res.clearCookie(nomeCookie, opcoesCookie);
  res.status(204).end();
}

async function sairDeTodos(req, res) {
  await auth.sairDeTodos(req.usuario.cd_usuario);
  res.clearCookie(nomeCookie, opcoesCookie);
  res.status(204).end();
}

async function trocarSenhaInicial(req, res) {
  await auth.trocarSenhaInicial(req.usuario.cd_usuario, req.body || {});
  res.clearCookie(nomeCookie, opcoesCookie);
  res.status(204).end();
}

module.exports = { cadastrar, entrar, consultarSessao, sair, sairDeTodos, trocarSenhaInicial };
