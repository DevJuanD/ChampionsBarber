const { servico } = require('../models');

async function listarServicos(req, res) {
  try {
    const servicos = await servico.findMany({
      where: { ativo: true },
      select: {
        cd_servico: true,
        nome: true,
        descricao: true,
        preco: true,
        duracao_minutos: true,
      },
      orderBy: [{ nome: 'asc' }, { cd_servico: 'asc' }],
    });

    return res.status(200).json(servicos);
  } catch {
    return res.status(500).json({
      mensagem: 'Não foi possível consultar os serviços.',
    });
  }
}

async function criarServico(req, res, next) {
  const { nome, descricao, preco, duracao_minutos } = req.body || {};
  const valor = String(preco ?? '').replace(',', '.');
  if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 100 ||
      (descricao != null && (typeof descricao !== 'string' || descricao.length > 2000)) ||
      !/^\d{1,8}(\.\d{1,2})?$/.test(valor) || Number(valor) <= 0 ||
      !Number.isInteger(duracao_minutos) || duracao_minutos <= 0 || duracao_minutos > 1440) {
    return res.status(400).json({ mensagem: 'Informe nome, preço positivo e duração entre 1 e 1440 minutos.' });
  }
  try {
    const registro = await servico.create({ data: {
      nome: nome.trim(), descricao: descricao?.trim() || null,
      preco: valor, duracao_minutos,
    } });
    return res.status(201).json(registro);
  } catch (error) {
    next(error);
  }
}

module.exports = { listarServicos, criarServico };
