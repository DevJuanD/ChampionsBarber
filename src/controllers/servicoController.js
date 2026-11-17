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

module.exports = { listarServicos };
