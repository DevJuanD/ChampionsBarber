const { criarAuthService } = require('../services/authService');
const { nomeCookie, opcoesCookie } = require('../config/auth');

const auth = criarAuthService();

async function exigirSessao(req, res, next) {
  try {
    req.usuario = await auth.autenticar(req.cookies[nomeCookie]);
    if (req.usuario.deve_trocar_senha && !['/api/auth/sessao', '/api/auth/senha-inicial', '/api/auth/logout-todos'].includes(req.originalUrl.split('?')[0])) {
      return res.status(403).json({ mensagem: 'Defina sua nova senha para continuar.', codigo: 'TROCA_SENHA_OBRIGATORIA' });
    }
    next();
  } catch (error) {
    if (error.status === 401) res.clearCookie(nomeCookie, opcoesCookie);
    next(error);
  }
}

function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ mensagem: 'Entre na sua conta para continuar.' });
    if (!req.usuario.papeis.some((papel) => papeis.includes(papel))) {
      return res.status(403).json({ mensagem: 'Você não tem permissão para esta operação.' });
    }
    next();
  };
}

// Usar em toda rota de escrita autenticada. Cabeçalho próprio impede CSRF via formulários externos.
function protegerEscrita(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'ChampionsBarber' || req.get('Sec-Fetch-Site') === 'cross-site') {
    return res.status(403).json({ mensagem: 'Requisição não autorizada.' });
  }
  const origem = req.get('Origin');
  const permitidas = process.env.APP_ORIGINS
    ? process.env.APP_ORIGINS.split(',').map((valor) => valor.trim())
    : process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  if (origem && !permitidas.includes(origem)) return res.status(403).json({ mensagem: 'Origem não autorizada.' });
  if (!req.is('application/json')) return res.status(415).json({ mensagem: 'Envie os dados em JSON.' });
  next();
}

module.exports = { exigirSessao, exigirPapel, protegerEscrita };
