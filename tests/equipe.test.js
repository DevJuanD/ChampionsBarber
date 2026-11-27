const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/config/prisma');
const { validarPermissoes } = require('../src/services/usuarioEquipeService');
const { criarBloqueioService, escopoBloqueio } = require('../src/services/bloqueioService');
const padrao = { papel: 'BARBEIRO', escopo_visualizacao_agenda: 'PROPRIOS', escopo_gestao_agenda: 'PROPRIOS', pode_criar_agendamento: true, pode_cancelar_agendamento: false, pode_atualizar_status: true, pode_bloquear_agenda: true };
const usuario = { cd_usuario: 1, cd_profissional: 8, papeis: ['BARBEIRO'], permissoes: { ...padrao } };

test('permissões não aceitam escalada, escopo incoerente ou capacidades sem gestão', () => {
  assert.equal(validarPermissoes(padrao).pode_criar_agendamento, true);
  for (const alteracao of [{ papel: 'ADMINISTRADOR' }, { papel: 'RECEPCAO' }, { escopo_gestao_agenda: 'GLOBAL' }, { escopo_gestao_agenda: 'SEM_ACESSO' }, { pode_criar_agendamento: 'true' }, { escopo_visualizacao_agenda: 'INVALIDO' }]) {
    assert.throws(() => validarPermissoes({ ...padrao, ...alteracao }), { status: 400 });
  }
});

test('bloqueios respeitam alcance próprio, conflitos e auditoria', async () => {
  assert.deepEqual(escopoBloqueio(usuario), { cd_profissional: 8 });
  assert.throws(() => escopoBloqueio({ ...usuario, permissoes: { ...padrao, pode_bloquear_agenda: false } }), { status: 403 });
  let conflito = 1;
  let criados = 0;
  let auditou = false;
  const service = criarBloqueioService({ $transaction: async (executar) => executar({
    $executeRaw: async () => {}, profissional: { findFirst: async () => ({}) }, agendamento: { count: async () => conflito },
    bloqueioAgenda: { count: async () => 0, create: async () => { criados++; return { cd_bloqueio: 1 }; } },
    auditoria: { create: async () => { auditou = true; } },
  }) });
  const dados = { data: '2099-01-01', cd_profissional: 8, inicio: '09:00', fim: '10:00', motivo: 'Compromisso pessoal' };
  await assert.rejects(service.criar({ ...dados, cd_profissional: 9 }, usuario), { status: 403 });
  await assert.rejects(service.criar(dados, usuario), { status: 409 });
  assert.equal(criados, 0);
  conflito = 0;
  await service.criar(dados, usuario);
  assert.equal(criados, 1); assert.equal(auditou, true);
});

test('HTTP: equipe e ações da agenda recusam papéis e profissionais fora do alcance', async (t) => {
  const original = prisma.sessaoUsuario.findUnique;
  t.after(() => { prisma.sessaoUsuario.findUnique = original; });
  let permiteCriar = true;
  prisma.sessaoUsuario.findUnique = async () => ({ expira_em: new Date(Date.now() + 60000), usuario: {
    cd_usuario: 1, telefone: '+5563999991234', status: 'ATIVO', telefone_verificado_em: new Date(), deve_trocar_senha: false,
    profissional: { cd_profissional: 8, ativo: true }, papeis: [{ ...padrao, pode_criar_agendamento: permiteCriar, papel: { codigo: 'BARBEIRO' } }],
  } });
  const app = require('../src/server'); const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { Cookie: `champions_session=${'b'.repeat(64)}`, 'Content-Type': 'application/json', 'X-Requested-With': 'ChampionsBarber' };
  try {
    assert.equal((await fetch(`${base}/usuarios-equipe`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/agenda`, { method: 'POST', headers, body: JSON.stringify({ cd_cliente: 1, cd_profissional: 9 }) })).status, 403);
    assert.equal((await fetch(`${base}/agenda/horarios?cd_profissional=9&cd_cliente=1`, { headers })).status, 403);
    permiteCriar = false;
    assert.equal((await fetch(`${base}/agenda/clientes?busca=Juan`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/usuarios-equipe`, { method: 'POST', headers, body: '{}' })).status, 403);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
