const { randomBytes, createHash } = require('node:crypto');
const argon2 = require('@node-rs/argon2');
const prisma = require('../config/prisma');

const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
const opcoesSenha = { algorithm: argon2.Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
let senhaSimulada;

function erroAuth(status, mensagem) {
  return Object.assign(new Error(mensagem), { status });
}

function normalizarTelefone(valor) {
  if (typeof valor !== 'string' || valor.length > 24 || !/^\+?[\d\s().-]+$/.test(valor.trim())) {
    throw erroAuth(400, 'Informe um telefone válido com DDD.');
  }
  let numeros = valor.replace(/\D/g, '');
  if (!valor.trim().startsWith('+') && [10, 11].includes(numeros.length)) numeros = `55${numeros}`;
  if (!/^55[1-9]\d{9,10}$/.test(numeros)) throw erroAuth(400, 'Informe um telefone com DDD de 10 ou 11 dígitos.');
  return `+${numeros}`;
}

function validarSenha(senha, cadastro = false) {
  if (typeof senha !== 'string' || senha.length < (cadastro ? 8 : 1) || senha.length > 128) {
    throw erroAuth(400, cadastro ? 'A senha deve ter entre 8 e 128 caracteres.' : 'Informe telefone e senha válidos.');
  }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

const camposUsuario = {
  cd_usuario: true, telefone: true, email: true, status: true, telefone_verificado_em: true, deve_trocar_senha: true,
  cliente: { select: { cd_cliente: true, nome_completo: true } },
  profissional: { select: { cd_profissional: true, nome: true, ativo: true } },
  papeis: {
    where: { ativo: true, papel: { ativo: true } },
    select: {
      escopo_visualizacao_agenda: true, escopo_gestao_agenda: true,
      pode_criar_agendamento: true, pode_cancelar_agendamento: true,
      pode_atualizar_status: true, pode_bloquear_agenda: true, pode_criar_encaixe: true,
      papel: { select: { codigo: true } },
    },
  },
};

const capacidades = ['pode_criar_agendamento', 'pode_cancelar_agendamento', 'pode_atualizar_status', 'pode_bloquear_agenda', 'pode_criar_encaixe'];

function usuarioPublico(usuario) {
  const papeis = usuario.papeis.map((vinculo) => vinculo.papel.codigo);
  const administrador = papeis.includes('ADMINISTRADOR');
  const profissional = usuario.profissional?.ativo ? usuario.profissional.cd_profissional : null;
  const niveis = ['SEM_ACESSO', 'PROPRIOS', 'GLOBAL'];
  function unirEscopo(campo) {
    if (administrador) return 'GLOBAL';
    return usuario.papeis.reduce((atual, vinculo) => {
      const escopo = vinculo[campo] === 'PROPRIOS' && !profissional ? 'SEM_ACESSO' : vinculo[campo];
      return niveis.indexOf(escopo) > niveis.indexOf(atual) ? escopo : atual;
    }, 'SEM_ACESSO');
  }
  return {
    cd_usuario: usuario.cd_usuario, telefone: usuario.telefone, email: usuario.email,
    deve_trocar_senha: Boolean(usuario.deve_trocar_senha),
    nome: usuario.cliente?.nome_completo || usuario.profissional?.nome || null, status: usuario.status,
    cd_cliente: usuario.cliente?.cd_cliente || null, cd_profissional: profissional, papeis,
    permissoes: {
      escopo_visualizacao_agenda: unirEscopo('escopo_visualizacao_agenda'),
      escopo_gestao_agenda: unirEscopo('escopo_gestao_agenda'),
      ...Object.fromEntries(capacidades.map((capacidade) => [capacidade,
        administrador || usuario.papeis.some((vinculo) => vinculo[capacidade]
          && (vinculo.escopo_gestao_agenda === 'GLOBAL'
            || (vinculo.escopo_gestao_agenda === 'PROPRIOS' && Boolean(profissional)))),
      ])),
    },
  };
}

function contaAtiva(usuario) {
  return usuario?.status === 'ATIVO' && Boolean(usuario.telefone_verificado_em);
}

function criarAuthService(db = prisma) {
  return {
    async cadastrar(dados) {
      const telefone = normalizarTelefone(dados.telefone);
      validarSenha(dados.senha, true);
      const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
      if (nome.length < 3 || nome.length > 150) throw erroAuth(400, 'Informe um nome entre 3 e 150 caracteres.');
      let email = null;
      if (dados.email !== undefined && dados.email !== null && dados.email !== '') {
        if (typeof dados.email !== 'string') throw erroAuth(400, 'Informe um e-mail válido.');
        email = dados.email.trim().toLowerCase() || null;
        if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw erroAuth(400, 'Informe um e-mail válido.');
      }
      const senha_hash = await argon2.hash(dados.senha, opcoesSenha);
      try {
        await db.$transaction(async (tx) => {
          const papel = await tx.papel.findUnique({ where: { codigo: 'CLIENTE' } });
          if (!papel?.ativo) throw erroAuth(503, 'Não foi possível concluir o cadastro.');
          await tx.usuario.create({
            data: {
              telefone, email, senha_hash, status: 'PENDENTE',
              cliente: { create: { nome_completo: nome, telefone_contato: telefone, email_contato: email } },
              papeis: { create: { cd_papel: papel.cd_papel } },
            },
          });
        });
      } catch (error) {
        // Mesma resposta para contatos já cadastrados, sem expor a existência da conta.
        if (error.code !== 'P2002') throw error;
      }
    },

    async entrar(dados) {
      const telefone = normalizarTelefone(dados.telefone);
      validarSenha(dados.senha);
      const usuario = await db.usuario.findUnique({ where: { telefone }, select: { cd_usuario: true, senha_hash: true } });
      senhaSimulada ||= argon2.hash(randomBytes(32).toString('hex'), opcoesSenha);
      let valida = false;
      try { valida = await argon2.verify(usuario?.senha_hash || await senhaSimulada, dados.senha); }
      catch { /* Hash inválido também resulta em credenciais recusadas. */ }
      if (!usuario || !valida) throw erroAuth(401, 'Telefone ou senha incorretos.');

      return db.$transaction(async (tx) => {
        // Serializa criação da sessão com alterações na conta.
        await tx.$queryRaw`SELECT cd_usuario FROM usuario WHERE cd_usuario = ${usuario.cd_usuario} FOR UPDATE`;
        const atual = await tx.usuario.findUnique({ where: { cd_usuario: usuario.cd_usuario }, select: { ...camposUsuario, senha_hash: true } });
        if (atual?.senha_hash !== usuario.senha_hash) throw erroAuth(401, 'Telefone ou senha incorretos.');
        if (!contaAtiva(atual)) throw erroAuth(403, atual.status === 'PENDENTE'
          ? 'Confirme seu telefone para acessar sua conta.' : 'Esta conta não pode acessar o sistema.');
        const token = randomBytes(32).toString('hex');
        const expira_em = new Date(Date.now() + DURACAO_SESSAO_MS);
        await tx.sessaoUsuario.create({ data: { cd_usuario: atual.cd_usuario, token_hash: hashToken(token), expira_em } });
        return { token, expira_em, usuario: usuarioPublico(atual) };
      });
    },

    async autenticar(token) {
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw erroAuth(401, 'Entre na sua conta para continuar.');
      const sessao = await db.sessaoUsuario.findUnique({
        where: { token_hash: hashToken(token) },
        select: { cd_sessao: true, revogado_em: true, expira_em: true, usuario: { select: camposUsuario } },
      });
      if (!sessao || sessao.revogado_em || sessao.expira_em <= new Date() || !contaAtiva(sessao.usuario)) {
        throw erroAuth(401, 'Sua sessão terminou. Entre novamente.');
      }
      // Consulta papéis atuais em toda requisição; não confia em permissões do navegador.
      return usuarioPublico(sessao.usuario);
    },

    async sair(token) {
      if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
        await db.sessaoUsuario.updateMany({ where: { token_hash: hashToken(token), revogado_em: null }, data: { revogado_em: new Date() } });
      }
    },

    async trocarSenhaInicial(cd_usuario, dados) {
      validarSenha(dados.senha, true);
      if (dados.senha !== dados.confirmacao) throw erroAuth(400, 'As senhas não coincidem.');
      const senha_hash = await argon2.hash(dados.senha, opcoesSenha);
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT cd_usuario FROM usuario WHERE cd_usuario = ${cd_usuario} FOR UPDATE`;
        const usuario = await tx.usuario.findUnique({ where: { cd_usuario } });
        if (!contaAtiva(usuario)) throw erroAuth(401, 'Sua sessão terminou. Entre novamente.');
        if (!usuario.deve_trocar_senha) throw erroAuth(409, 'A senha inicial já foi alterada. Entre novamente.');
        const digitos = dados.senha.replace(/\D/g, '');
        const telefone = usuario.telefone.replace(/\D/g, '');
        if ((digitos.length >= 10 && (digitos === telefone || `55${digitos}` === telefone)) || await argon2.verify(usuario.senha_hash, dados.senha)) {
          throw erroAuth(400, 'Escolha uma senha diferente do seu telefone e da senha inicial.');
        }
        await tx.usuario.update({ where: { cd_usuario }, data: { senha_hash, deve_trocar_senha: false } });
        await tx.sessaoUsuario.updateMany({ where: { cd_usuario, revogado_em: null }, data: { revogado_em: new Date() } });
      });
    },

    async sairDeTodos(cd_usuario) {
      await db.sessaoUsuario.updateMany({ where: { cd_usuario, revogado_em: null }, data: { revogado_em: new Date() } });
    },
  };
}

module.exports = { criarAuthService, normalizarTelefone, usuarioPublico, hashToken, DURACAO_SESSAO_MS };
