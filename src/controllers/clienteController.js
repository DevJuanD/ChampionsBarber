const prisma = require('../config/prisma');
const { normalizarTelefone } = require('../services/authService');
const argon2 = require('@node-rs/argon2');

const selecao = { cd_cliente: true, nome_completo: true, telefone_contato: true, email_contato: true, cd_usuario: true };

async function listarClientes(req, res, next) {
  const busca = typeof req.query.busca === 'string' ? req.query.busca.trim() : '';
  const pagina = Number(req.query.pagina || 1);
  if (busca.length > 150 || !Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000) {
    return res.status(400).json({ mensagem: 'Informe uma busca e uma página válidas.' });
  }
  const numeros = busca.replace(/\D/g, '');
  const where = busca ? { OR: [
    { nome_completo: { contains: busca, mode: 'insensitive' } },
    ...(numeros ? [{ telefone_contato: { contains: numeros } }] : []),
  ] } : {};
  try {
    const [total, clientes] = await prisma.$transaction([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({ where, select: selecao, orderBy: [{ nome_completo: 'asc' }, { cd_cliente: 'asc' }], skip: (pagina - 1) * 10, take: 10 }),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ clientes, total, pagina, paginas: Math.max(1, Math.ceil(total / 10)) });
  } catch (error) { next(error); }
}

async function criarCliente(req, res, next) {
  try {
    const { nome, telefone, email } = req.body || {};
    if (typeof nome !== 'string' || nome.trim().length < 3 || nome.trim().length > 150) {
      return res.status(400).json({ mensagem: 'Informe um nome entre 3 e 150 caracteres.' });
    }
    if (email != null && (typeof email !== 'string' || (email.trim() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254)))) {
      return res.status(400).json({ mensagem: 'Informe um e-mail válido.' });
    }
    const telefoneContato = normalizarTelefone(telefone);
    const emailContato = email?.trim().toLowerCase() || null;
    const senhaInicial = telefoneContato.startsWith('+55') ? telefoneContato.slice(3) : telefoneContato.slice(1);
    const senha_hash = await argon2.hash(senhaInicial, { algorithm: argon2.Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const cliente = await prisma.$transaction(async (tx) => {
      const papel = await tx.papel.upsert({ where: { codigo: 'CLIENTE' }, update: {}, create: { codigo: 'CLIENTE', nome: 'Cliente' } });
      if (!papel?.ativo) throw Object.assign(new Error('O perfil de cliente não está disponível.'), { status: 503 });
      return tx.cliente.create({ data: {
        nome_completo: nome.trim(), telefone_contato: telefoneContato, email_contato: emailContato,
        usuario: { create: { telefone: telefoneContato, email: emailContato, senha_hash, status: 'ATIVO',
          telefone_verificado_em: new Date(), deve_trocar_senha: true, papeis: { create: { cd_papel: papel.cd_papel } } } },
      }, select: selecao });
    });
    res.status(201).json(cliente);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ mensagem: 'Já existe uma conta com esse telefone ou e-mail. Confira os dados antes de cadastrar.' });
    next(error);
  }
}

function erroCliente(status, mensagem) { return Object.assign(new Error(mensagem), { status }); }

async function editarCliente(req, res, next) {
  const id = Number(req.params.id);
  const { nome, telefone, email } = req.body || {};
  if (!Number.isSafeInteger(id) || id <= 0 || typeof nome !== 'string' || nome.trim().length < 3 || nome.trim().length > 150 ||
      (email != null && (typeof email !== 'string' || (email.trim() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254))))) {
    return res.status(400).json({ mensagem: 'Confira o nome, telefone e e-mail do cliente.' });
  }
  try {
    const telefoneContato = normalizarTelefone(telefone);
    const emailContato = email?.trim().toLowerCase() || null;
    const cliente = await prisma.$transaction(async (tx) => {
      const atual = await tx.cliente.findUnique({ where: { cd_cliente: id } });
      if (!atual) throw erroCliente(404, 'Cliente não encontrado.');
      if (atual.cd_usuario) {
        await tx.$queryRaw`SELECT cd_usuario FROM usuario WHERE cd_usuario = ${atual.cd_usuario} FOR UPDATE`;
        const usuario = await tx.usuario.findUnique({ where: { cd_usuario: atual.cd_usuario } });
        const mudouContato = usuario.telefone !== telefoneContato || usuario.email !== emailContato;
        const data = { telefone: telefoneContato, email: emailContato };
        if (usuario.deve_trocar_senha && usuario.telefone !== telefoneContato) {
          data.senha_hash = await argon2.hash(telefoneContato.slice(3), { algorithm: argon2.Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
        }
        await tx.usuario.update({ where: { cd_usuario: atual.cd_usuario }, data });
        if (mudouContato) await tx.sessaoUsuario.updateMany({ where: { cd_usuario: atual.cd_usuario, revogado_em: null }, data: { revogado_em: new Date() } });
      }
      return tx.cliente.update({ where: { cd_cliente: id }, data: { nome_completo: nome.trim(), telefone_contato: telefoneContato, email_contato: emailContato }, select: selecao });
    });
    res.json(cliente);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ mensagem: 'Já existe uma conta com esse telefone ou e-mail.' });
    if (error.code === 'P2025') return res.status(404).json({ mensagem: 'Cliente não encontrado.' });
    next(error);
  }
}

async function excluirCliente(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ mensagem: 'Cliente inválido.' });
  try {
    await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { cd_cliente: id } });
      if (!cliente) throw erroCliente(404, 'Cliente não encontrado.');
      if (await tx.agendamento.count({ where: { cd_cliente: id } })) throw erroCliente(409, 'Este cliente possui agendamentos. Seu cadastro deve ser mantido para preservar o histórico.');
      if (cliente.cd_usuario) {
        await tx.$queryRaw`SELECT cd_usuario FROM usuario WHERE cd_usuario = ${cliente.cd_usuario} FOR UPDATE`;
        const usuario = await tx.usuario.findUnique({ where: { cd_usuario: cliente.cd_usuario }, include: { profissional: true, papeis: { include: { papel: true } } } });
        if (usuario.profissional || usuario.papeis.some((vinculo) => vinculo.papel.codigo !== 'CLIENTE')) throw erroCliente(409, 'Este cadastro pertence a uma conta da equipe e não pode ser excluído por aqui.');
        await tx.usuario.update({ where: { cd_usuario: cliente.cd_usuario }, data: { status: 'INATIVO' } });
        await tx.sessaoUsuario.updateMany({ where: { cd_usuario: cliente.cd_usuario, revogado_em: null }, data: { revogado_em: new Date() } });
      }
      await tx.cliente.delete({ where: { cd_cliente: id } });
    });
    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2003') return res.status(409).json({ mensagem: 'Este cliente possui registros vinculados e não pode ser excluído.' });
    if (error.code === 'P2025') return res.status(404).json({ mensagem: 'Cliente não encontrado.' });
    next(error);
  }
}

module.exports = { listarClientes, criarCliente, editarCliente, excluirCliente };
