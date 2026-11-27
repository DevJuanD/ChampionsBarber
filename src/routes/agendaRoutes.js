const express = require('express');
const prisma = require('../config/prisma');
const { exigirSessao, protegerEscrita } = require('../middlewares/authMiddleware');
const { criarAgendaService, escopoAgenda } = require('../services/agendaService');
const { criarAgendamentoService } = require('../services/agendamentoService');
const agenda = criarAgendaService();
const reservas = criarAgendamentoService();
const router = express.Router();
function exigirCriacao(req, res, next) {
  try {
    const escopo = escopoAgenda(req.usuario, true);
    if (!req.usuario.papeis.includes('ADMINISTRADOR') && !req.usuario.permissoes.pode_criar_agendamento) return res.status(403).json({ mensagem: 'Você não tem permissão para criar agendamentos.' });
    const profissional = req.method === 'GET' ? req.query.cd_profissional : req.body?.cd_profissional;
    if (profissional && escopo.cd_profissional && Number(profissional) !== escopo.cd_profissional) return res.status(403).json({ mensagem: 'Você só pode agendar na sua própria agenda.' });
    next();
  } catch (error) { next(error); }
}
router.use(protegerEscrita, exigirSessao, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/', async (req, res) => { res.json(await agenda.listar(req.query, req.usuario)); });
router.get('/opcoes', async (req, res) => {
  const escopo = escopoAgenda(req.usuario);
  res.json(await prisma.profissional.findMany({ where: escopo, select: { cd_profissional: true, nome: true, ativo: true,
    servicos: { where: { servico: { ativo: true } }, select: { cd_servico: true } } }, orderBy: { nome: 'asc' } }));
});
router.get('/clientes', exigirCriacao, async (req, res) => {
  const busca = typeof req.query.busca === 'string' ? req.query.busca.trim() : '';
  if (busca.length < 2 || busca.length > 150) return res.status(400).json({ mensagem: 'Digite entre 2 e 150 caracteres.' });
  const digitos = busca.replace(/\D/g, '');
  const where = { OR: [{ nome_completo: { contains: busca, mode: 'insensitive' } }, ...(digitos ? [{ telefone_contato: { contains: digitos } }] : [])] };
  const [total, clientes] = await prisma.$transaction([prisma.cliente.count({ where }), prisma.cliente.findMany({ where, select: { cd_cliente: true, nome_completo: true, telefone_contato: true }, orderBy: [{ nome_completo: 'asc' }, { cd_cliente: 'asc' }], take: 10 })]);
  res.json({ total, clientes });
});
router.get('/horarios', exigirCriacao, async (req, res) => {
  const cliente = Number(req.query.cd_cliente);
  if (!Number.isSafeInteger(cliente) || cliente <= 0) return res.status(400).json({ mensagem: 'Selecione um cliente.' });
  res.json(await reservas.horarios(req.query, cliente));
});
router.post('/', exigirCriacao, async (req, res) => {
  const cliente = Number(req.body?.cd_cliente);
  if (!Number.isSafeInteger(cliente) || cliente <= 0) return res.status(400).json({ mensagem: 'Selecione um cliente.' });
  res.status(201).json(await reservas.agendar(req.body, cliente, { cd_usuario: req.usuario.cd_usuario }));
});
router.patch('/:id/status', async (req, res) => { res.json(await agenda.alterarStatus(req.params.id, req.body || {}, req.usuario)); });
module.exports = router;
