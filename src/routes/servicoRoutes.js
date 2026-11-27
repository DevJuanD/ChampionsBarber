const express = require('express');
const { listarServicos, criarServico } = require('../controllers/servicoController');
const { exigirSessao, exigirPapel, protegerEscrita } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', listarServicos);
router.post('/', protegerEscrita, exigirSessao, exigirPapel('ADMINISTRADOR'), criarServico);

module.exports = router;
