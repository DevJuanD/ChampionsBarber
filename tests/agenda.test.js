const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAgendaService, escopoAgenda } = require('../src/services/agendaService');
const admin = { cd_usuario: 1, papeis: ['ADMINISTRADOR'], permissoes: {} };
const barbeiro = { cd_usuario: 2, papeis: ['BARBEIRO'], cd_profissional: 8, permissoes: { escopo_visualizacao_agenda: 'PROPRIOS', escopo_gestao_agenda: 'PROPRIOS', pode_atualizar_status: true } };

test('agenda limita o escopo e recusa consulta de outro profissional', async () => {
  assert.deepEqual(escopoAgenda(admin), {});
  assert.deepEqual(escopoAgenda(barbeiro), { cd_profissional: 8 });
  assert.throws(() => escopoAgenda({ papeis: ['CLIENTE'], permissoes: {} }), { status: 403 });
  await assert.rejects(criarAgendaService({}).listar({ data: '2030-01-01', cd_profissional: 9 }, barbeiro), { status: 403 });
});

test('consulta de agenda pagina e filtra no banco sem remover o escopo', async () => {
  let filtro;
  const service = criarAgendaService({ $transaction: async (operacoes) => Promise.all(operacoes), agendamento: {
    count: async () => 11, findMany: async (opcoes) => { filtro = opcoes; return []; },
  } });
  const resultado = await service.listar({ data: '2030-01-01', status: 'CONFIRMADO', pagina: 2 }, barbeiro);
  assert.equal(filtro.where.cd_profissional, 8);
  assert.equal(filtro.where.status, 'CONFIRMADO');
  assert.equal(filtro.skip, 10);
  assert.equal(filtro.take, 10);
  assert.equal(resultado.paginas, 2);
});

test('mudança de situação respeita permissões, transições, horário e registra auditoria', async () => {
  let atual = { status: 'CONFIRMADO', inicio_em: new Date('2020-01-01'), fim_em: new Date('2020-01-01') };
  let gravacao;
  let auditoria;
  let escopo;
  const service = criarAgendaService({ $transaction: async (executar) => executar({
    $queryRaw: async () => [], agendamento: {
      findFirst: async ({ where }) => { escopo = where; return atual; },
      update: async (opcoes) => { gravacao = opcoes; return { cd_agendamento: 1, status: opcoes.data.status }; },
    }, auditoria: { create: async (opcoes) => { auditoria = opcoes; } },
  }) });
  await assert.rejects(service.alterarStatus(1, { status: 'CANCELADO', motivo: 'Pedido do cliente' }, barbeiro), { status: 403 });
  await service.alterarStatus(1, { status: 'CONCLUIDO' }, barbeiro);
  assert.equal(escopo.cd_profissional, 8);
  assert.equal(gravacao.data.status, 'CONCLUIDO');
  assert.equal(auditoria.data.cd_usuario, 2);
  assert.deepEqual(auditoria.data.valor_anterior, { status: 'CONFIRMADO' });
  atual = { ...atual, status: 'CONCLUIDO' };
  await assert.rejects(service.alterarStatus(1, { status: 'CANCELADO', motivo: 'Pedido do cliente' }, admin), { status: 409 });
  atual = { status: 'CONFIRMADO', inicio_em: new Date('2099-01-01'), fim_em: new Date('2099-01-01') };
  await assert.rejects(service.alterarStatus(1, { status: 'CONCLUIDO' }, admin), { status: 409 });
  await assert.rejects(service.alterarStatus(1, { status: 'NAO_COMPARECEU' }, admin), { status: 409 });
  await assert.rejects(service.alterarStatus(1, { status: 'CANCELADO', motivo: '' }, admin), { status: 400 });
  await service.alterarStatus(1, { status: 'CANCELADO', motivo: 'Pedido do cliente' }, admin);
  assert.equal(gravacao.data.cancelado_por, 1);
  assert.equal(gravacao.data.motivo_cancelamento, 'Pedido do cliente');
});

test('HTTP: consulta, cadastro e ações da agenda exigem sessão', async () => {
  const app = require('../src/server'); const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/agenda`;
  const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'ChampionsBarber' };
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers, body: '{}' })).status, 401);
    assert.equal((await fetch(`${url}/1/status`, { method: 'PATCH', headers, body: '{}' })).status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
