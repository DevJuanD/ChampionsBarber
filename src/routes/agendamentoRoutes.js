const express = require('express');
const prisma = require('../config/prisma');
const { exigirSessao, exigirPapel, protegerEscrita } = require('../middlewares/authMiddleware');
const { criarAgendamentoService } = require('../services/agendamentoService');
const service = criarAgendamentoService();
const router = express.Router();
router.use(protegerEscrita, exigirSessao, exigirPapel('CLIENTE'));
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!req.usuario.cd_cliente) return res.status(403).json({ mensagem: 'Seu cadastro de cliente não está disponível.' });
  next();
});
router.get('/opcoes', async (req, res) => {
  const profissionais = await prisma.profissional.findMany({ where: { ativo: true }, select: { cd_profissional: true, nome: true,
    servicos: { where: { servico: { ativo: true } }, select: { cd_servico: true } } }, orderBy: { nome: 'asc' } });
  res.json(profissionais);
});
router.get('/horarios', async (req, res) => { res.json(await service.horarios(req.query, req.usuario.cd_cliente)); });
router.get('/', async (req, res) => {
  res.json(await prisma.agendamento.findMany({ where: { cd_cliente: req.usuario.cd_cliente },
    select: { cd_agendamento: true, inicio_em: true, status: true, preco_registrado: true, duracao_registrada: true,
      servico: { select: { nome: true } }, profissional: { select: { nome: true } } },
    orderBy: { inicio_em: 'desc' }, take: 30 }));
});
router.post('/', async (req, res) => { res.status(201).json(await service.agendar(req.body || {}, req.usuario.cd_cliente)); });
module.exports = router;
