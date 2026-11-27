const prisma = require('../config/prisma');
const argon2 = require('@node-rs/argon2');
const { normalizarTelefone } = require('./authService');
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const papeisEquipe = ['BARBEIRO', 'RECEPCAO', 'ADMINISTRADOR'];
const capacidades = ['pode_criar_agendamento', 'pode_cancelar_agendamento', 'pode_atualizar_status', 'pode_bloquear_agenda'];
const selecao = { cd_usuario: true, telefone: true, email: true, status: true, deve_trocar_senha: true, telefone_verificado_em: true,
  cliente: { select: { nome_completo: true } }, profissional: { select: { cd_profissional: true, nome: true } },
  papeis: { where: { ativo: true }, select: { cd_papel: true, escopo_visualizacao_agenda: true, escopo_gestao_agenda: true,
    pode_criar_agendamento: true, pode_cancelar_agendamento: true, pode_atualizar_status: true, pode_bloquear_agenda: true,
    papel: { select: { codigo: true } } } } };

function validarPermissoes(dados) {
  const niveis = ['SEM_ACESSO', 'PROPRIOS', 'GLOBAL'];
  const { papel, escopo_visualizacao_agenda: visualizar, escopo_gestao_agenda: gerir } = dados;
  if (!['BARBEIRO', 'RECEPCAO'].includes(papel) || !niveis.includes(visualizar) || !niveis.includes(gerir) || niveis.indexOf(gerir) > niveis.indexOf(visualizar) ||
      (papel === 'RECEPCAO' && [visualizar, gerir].includes('PROPRIOS')) || capacidades.some((campo) => typeof dados[campo] !== 'boolean') ||
      (gerir === 'SEM_ACESSO' && capacidades.some((campo) => dados[campo]))) throw erro(400, 'Confira o perfil, o alcance da agenda e as permissões selecionadas.');
  return { escopo_visualizacao_agenda: visualizar, escopo_gestao_agenda: gerir, ...Object.fromEntries(capacidades.map((campo) => [campo, dados[campo]])) };
}

function criarUsuarioEquipeService(db = prisma) {
  return {
    async listar(query) {
      const busca = typeof query.busca === 'string' ? query.busca.trim() : '';
      const pagina = Number(query.pagina || 1);
      if (busca.length > 150 || !Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000) throw erro(400, 'Confira a busca e a página.');
      const digitos = busca.replace(/\D/g, '');
      const where = { papeis: { some: { papel: { codigo: { in: papeisEquipe } } } }, ...(busca ? { OR: [
        { cliente: { nome_completo: { contains: busca, mode: 'insensitive' } } }, { profissional: { nome: { contains: busca, mode: 'insensitive' } } },
        ...(digitos ? [{ telefone: { contains: digitos } }] : []),
      ] } : {}) };
      const [total, usuarios] = await db.$transaction([db.usuario.count({ where }), db.usuario.findMany({ where, select: selecao, orderBy: { cd_usuario: 'asc' }, take: 10, skip: (pagina - 1) * 10 })]);
      return { usuarios, total, paginas: Math.max(1, Math.ceil(total / 10)) };
    },
    async salvar(id, dados, autor) {
      const permissoes = validarPermissoes(dados);
      const cd_profissional = dados.papel === 'BARBEIRO' ? Number(dados.cd_profissional) : null;
      const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
      if ((dados.papel === 'BARBEIRO' && (!Number.isSafeInteger(cd_profissional) || cd_profissional <= 0)) || (dados.papel === 'RECEPCAO' && (nome.length < 3 || nome.length > 150))) throw erro(400, 'Selecione o profissional ou informe o nome da pessoa da recepção.');
      if (id != null && (!Number.isSafeInteger(id) || id <= 0)) throw erro(400, 'Usuário inválido.');
      if (!['ATIVO', 'INATIVO'].includes(dados.status)) throw erro(400, 'Selecione uma situação válida.');
      const telefone = id == null ? normalizarTelefone(dados.telefone) : null;
      let email = id == null ? dados.email : null;
      if (email != null && (typeof email !== 'string' || (email.trim() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254)))) throw erro(400, 'Informe um e-mail válido.');
      email = email?.trim().toLowerCase() || null;
      const senha_hash = id == null ? await argon2.hash(telefone.slice(3), { algorithm: argon2.Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }) : null;
      return db.$transaction(async (tx) => {
        let usuario = await tx.usuario.findUnique({ where: id == null ? { telefone } : { cd_usuario: id }, select: selecao });
        const existente = Boolean(usuario);
        if (id != null && !usuario) throw erro(404, 'Usuário não encontrado.');
        if (usuario) {
          await tx.$queryRaw`SELECT cd_usuario FROM usuario WHERE cd_usuario = ${usuario.cd_usuario} FOR UPDATE`;
          usuario = await tx.usuario.findUnique({ where: { cd_usuario: usuario.cd_usuario }, select: selecao });
          if (usuario.papeis.some((vinculo) => vinculo.papel.codigo === 'ADMINISTRADOR')) throw erro(403, 'Contas de administrador são protegidas neste módulo.');
          if (id == null && usuario.papeis.some((vinculo) => ['BARBEIRO', 'RECEPCAO'].includes(vinculo.papel.codigo))) throw erro(409, 'Esta pessoa já tem acesso à equipe. Edite o cadastro existente.');
        } else {
          usuario = await tx.usuario.create({ data: { telefone, email, senha_hash, status: dados.status, telefone_verificado_em: new Date(), deve_trocar_senha: true }, select: selecao });
        }
        const cd_usuario = usuario.cd_usuario;
        if (usuario.profissional && usuario.profissional.cd_profissional !== cd_profissional) await tx.profissional.update({ where: { cd_profissional: usuario.profissional.cd_profissional }, data: { cd_usuario: null } });
        if (cd_profissional) {
          const vinculo = await tx.profissional.updateMany({ where: { cd_profissional, ativo: true, OR: [{ cd_usuario: null }, { cd_usuario }] }, data: { cd_usuario } });
          if (vinculo.count !== 1) throw erro(409, 'Este profissional está inativo ou já possui outra conta vinculada.');
        } else if (!usuario.cliente) {
          await tx.cliente.create({ data: { cd_usuario, nome_completo: nome, telefone_contato: usuario.telefone, email_contato: usuario.email } });
        } else {
          await tx.cliente.update({ where: { cd_usuario }, data: { nome_completo: nome } });
        }
        const papel = await tx.papel.upsert({ where: { codigo: dados.papel }, update: {}, create: { codigo: dados.papel, nome: dados.papel === 'BARBEIRO' ? 'Barbeiro' : 'Recepção' } });
        if (!papel.ativo) throw erro(409, 'Este perfil de acesso está desativado.');
        await tx.usuarioPapel.updateMany({ where: { cd_usuario, papel: { codigo: { in: ['BARBEIRO', 'RECEPCAO'] } } }, data: { ativo: false } });
        await tx.usuarioPapel.upsert({ where: { cd_usuario_cd_papel: { cd_usuario, cd_papel: papel.cd_papel } },
          create: { cd_usuario, cd_papel: papel.cd_papel, atribuido_por: autor, ...permissoes }, update: { ativo: true, atribuido_por: autor, ...permissoes } });
        await tx.usuario.update({ where: { cd_usuario }, data: { status: dados.status, ...(dados.status === 'ATIVO' && !usuario.telefone_verificado_em ? { telefone_verificado_em: new Date() } : {}) } });
        await tx.sessaoUsuario.updateMany({ where: { cd_usuario, revogado_em: null }, data: { revogado_em: new Date() } });
        await tx.auditoria.create({ data: { cd_usuario: autor, operacao: existente ? 'ATUALIZAR_ACESSO' : 'CRIAR_ACESSO', entidade: 'usuario', cd_registro: cd_usuario, valor_novo: { papel: dados.papel, status: dados.status, ...permissoes } } });
        return { usuario: await tx.usuario.findUnique({ where: { cd_usuario }, select: selecao }), conta_existente: existente };
      }, { timeout: 30000 });
    },
  };
}
module.exports = { criarUsuarioEquipeService, validarPermissoes };
