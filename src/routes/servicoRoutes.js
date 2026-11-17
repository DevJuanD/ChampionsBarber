const express = require('express');
const { listarServicos } = require('../controllers/servicoController');

const router = express.Router();

router.get('/', listarServicos);

module.exports = router;
