const express = require('express');
const prisma = require('../config/prisma');
const { exigirSessao, exigirPapel, protegerEscrita } = require('../middlewares/authMiddleware');
const { criarUsuarioEquipeService } = require('../services/usuarioEquipeService');
const service = criarUsuarioEquipeService();
const router = express.Router();
router.use(protegerEscrita, exigirSessao, exigirPapel('ADMINISTRADOR'), (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/', async (req, res) => { res.json(await service.listar(req.query)); });
router.get('/profissionais', async (req, res) => { res.json(await prisma.profissional.findMany({ where: { ativo: true }, select: { cd_profissional: true, cd_usuario: true, nome: true }, orderBy: { nome: 'asc' } })); });
function conflito(error, res, next) {
  if (error.code === 'P2002') return res.status(409).json({ mensagem: 'Telefone, e-mail ou profissional já vinculados a outra conta.' });
  next(error);
}
router.post('/', async (req, res, next) => { try { res.status(201).json(await service.salvar(null, req.body || {}, req.usuario.cd_usuario)); } catch (error) { conflito(error, res, next); } });
router.patch('/:id', async (req, res, next) => { try { res.json(await service.salvar(Number(req.params.id), req.body || {}, req.usuario.cd_usuario)); } catch (error) { conflito(error, res, next); } });
module.exports = router;
