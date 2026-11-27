const express = require('express');
const { listarProfissionais, criarProfissional } = require('../controllers/profissionalController');
const { exigirSessao, exigirPapel, protegerEscrita } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(protegerEscrita, exigirSessao, exigirPapel('ADMINISTRADOR'));
router.get('/', listarProfissionais);
router.post('/', criarProfissional);

module.exports = router;
