const prisma = require('../config/prisma');

const selecao = {
  cd_profissional: true, nome: true, descricao: true, ativo: true,
  servicos: { select: { servico: { select: { cd_servico: true, nome: true } } } },
};

async function listarProfissionais(req, res, next) {
  try {
    res.json(await prisma.profissional.findMany({ select: selecao, orderBy: [{ nome: 'asc' }, { cd_profissional: 'asc' }] }));
  } catch (error) { next(error); }
}

async function criarProfissional(req, res, next) {
  const { nome, descricao, servicos } = req.body || {};
  if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 150 ||
      (descricao != null && (typeof descricao !== 'string' || descricao.length > 2000)) ||
      !Array.isArray(servicos) || !servicos.length || servicos.length > 100 ||
      servicos.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(servicos).size !== servicos.length) {
    return res.status(400).json({ mensagem: 'Informe o nome e selecione ao menos um serviço válido.' });
  }
  try {
    const profissional = await prisma.$transaction(async (tx) => {
      const quantidade = await tx.servico.count({ where: { cd_servico: { in: servicos }, ativo: true } });
      if (quantidade !== servicos.length) {
        const error = new Error('Um dos serviços selecionados não está disponível. Atualize a página.');
        error.status = 400;
        throw error;
      }
      return tx.profissional.create({
        data: { nome: nome.trim(), descricao: descricao?.trim() || null,
          servicos: { create: servicos.map((cd_servico) => ({ cd_servico })) } },
        select: selecao,
      });
    });
    res.status(201).json(profissional);
  } catch (error) { next(error); }
}

module.exports = { listarProfissionais, criarProfissional };
