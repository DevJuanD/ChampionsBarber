const express = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/authController');
const { exigirSessao, protegerEscrita } = require('../middlewares/authMiddleware');
const { hashToken } = require('../services/authService');

const router = express.Router();
const mensagemLimite = { mensagem: 'Muitas tentativas. Aguarde e tente novamente.' };
const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: mensagemLimite });
const limiteTelefone = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: mensagemLimite,
  keyGenerator: (req) => hashToken(typeof req.body?.telefone === 'string' ? req.body.telefone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '') : 'invalido'),
});
const limiteCadastro = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: mensagemLimite });

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(protegerEscrita);
router.post('/cadastro', limiteCadastro, controller.cadastrar);
router.post('/login', limiteLogin, limiteTelefone, controller.entrar);
router.get('/sessao', exigirSessao, controller.consultarSessao);
router.post('/logout', controller.sair);
router.post('/logout-todos', exigirSessao, controller.sairDeTodos);
router.post('/senha-inicial', limiteLogin, exigirSessao, controller.trocarSenhaInicial);

module.exports = router;
