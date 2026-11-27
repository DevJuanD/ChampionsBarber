const express = require('express');
const { listarClientes, criarCliente, editarCliente, excluirCliente } = require('../controllers/clienteController');
const { protegerEscrita, exigirSessao, exigirPapel } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(protegerEscrita, exigirSessao, exigirPapel('ADMINISTRADOR'));
router.get('/', listarClientes);
router.post('/', criarCliente);
router.patch('/:id', editarCliente);
router.delete('/:id', excluirCliente);
module.exports = router;
