const express = require('express');
const { listarHorarios, criarHorario } = require('../controllers/horarioController');
const { protegerEscrita, exigirSessao, exigirPapel } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(protegerEscrita, exigirSessao, exigirPapel('ADMINISTRADOR'));
router.get('/', listarHorarios);
router.post('/', criarHorario);
module.exports = router;
