import { useEffect, useRef, useState } from 'react';
import { consultarApi } from './api';
import NovoAgendamentoEquipe from './NovoAgendamentoEquipe';

const nomesStatus = { PENDENTE: 'Aguardando confirmação', CONFIRMADO: 'Confirmado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado', NAO_COMPARECEU: 'Não compareceu' };
const hora = (data) => new Date(data).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export default function AgendaEquipe({ usuario }) {
  const [data, setData] = useState(hoje);
  const [profissional, setProfissional] = useState('');
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const [equipe, setEquipe] = useState([]);
  const [resultado, setResultado] = useState({ total: 0, agendamentos: [], paginas: 1 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [formulario, setFormulario] = useState(false);
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const dialogo = useRef(null);
  const ultimoBotao = useRef(null);
  const botaoNovo = useRef(null);
  const admin = usuario.papeis.includes('ADMINISTRADOR');
  const gestao = usuario.permissoes.escopo_gestao_agenda;
  const podeCriar = admin || usuario.permissoes.pode_criar_agendamento;
  const podeGerir = (item) => admin || gestao === 'GLOBAL' || (gestao === 'PROPRIOS' && usuario.cd_profissional === item.cd_profissional);

  useEffect(() => {
    const controller = new AbortController();
    setCarregando(true); setErro('');
    Promise.all([consultarApi(`/agenda?data=${data}&cd_profissional=${profissional}&status=${status}&pagina=${pagina}`, { signal: controller.signal }), consultarApi('/agenda/opcoes', { signal: controller.signal })])
      .then(([reservas, profissionais]) => { if (pagina > reservas.paginas) setPagina(reservas.paginas); else setResultado(reservas); setEquipe(profissionais); })
      .catch((error) => { if (error.name !== 'AbortError') setErro(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [data, profissional, status, pagina, tentativa]);
  useEffect(() => { if (acao && !dialogo.current?.open) dialogo.current?.showModal(); }, [acao]);

  function mudarDia(diferenca) {
    const dia = new Date(`${data || hoje()}T12:00:00Z`); dia.setUTCDate(dia.getUTCDate() + diferenca); setData(dia.toISOString().slice(0, 10)); setPagina(1);
  }
  function abrirAcao(item, destino, botao) { ultimoBotao.current = botao; setMotivo(''); setErroAcao(''); setAcao({ item, destino }); }
  function fecharAcao() { dialogo.current?.close(); setAcao(null); ultimoBotao.current?.focus(); }
  async function aplicarAcao(event) {
    event.preventDefault(); if (salvando) return;
    setSalvando(true); setErroAcao(''); setSucesso('');
    try {
      await consultarApi(`/agenda/${acao.item.cd_agendamento}/status`, { metodo: 'PATCH', dados: { status: acao.destino, motivo } });
      fecharAcao(); setSucesso('Situação do agendamento atualizada.'); setTentativa((valor) => valor + 1);
    } catch (error) { setErroAcao(error.message); }
    finally { setSalvando(false); }
  }

  return <section className="painel-cartao" aria-labelledby="titulo-agenda">
    <div className="painel-modulo-cabecalho"><div><h2 id="titulo-agenda">Agenda do dia</h2><p>Acompanhe os atendimentos e abra uma reserva para ver os detalhes.</p></div>{podeCriar && <button className="botao" ref={botaoNovo} type="button" disabled={salvando} onClick={() => { setFormulario(true); setSucesso(''); }}>Novo agendamento</button>}</div>
    {sucesso && <p className="clientes-sucesso" role="status">{sucesso}</p>}
    {formulario && podeCriar && <NovoAgendamentoEquipe profissionais={!admin && gestao === 'PROPRIOS' ? equipe.filter((item) => item.cd_profissional === usuario.cd_profissional) : equipe} dataInicial={data} aoCancelar={() => { setFormulario(false); botaoNovo.current?.focus(); }} aoSalvar={(dia) => { setFormulario(false); setData(dia); setPagina(1); setProfissional(''); setStatus(''); setSucesso('Agendamento cadastrado.'); setTentativa((valor) => valor + 1); botaoNovo.current?.focus(); }} />}
    <div className="agenda-filtros">
      <div className="agenda-data"><label htmlFor="agenda-dia">Dia do atendimento</label><div><button type="button" aria-label="Dia anterior" onClick={() => mudarDia(-1)}>‹</button><input id="agenda-dia" type="date" value={data} onChange={(event) => { setData(event.target.value); setPagina(1); }} /><button type="button" aria-label="Próximo dia" onClick={() => mudarDia(1)}>›</button><button type="button" onClick={() => { setData(hoje()); setPagina(1); }}>Hoje</button></div></div>
      <label>Profissional<select value={profissional} onChange={(event) => { setProfissional(event.target.value); setPagina(1); }}><option value="">{equipe.length === 1 ? 'Minha agenda' : 'Todos os profissionais'}</option>{equipe.map((item) => <option key={item.cd_profissional} value={item.cd_profissional}>{item.nome}{!item.ativo ? ' (inativo)' : ''}</option>)}</select></label>
      <label>Situação<select value={status} onChange={(event) => { setStatus(event.target.value); setPagina(1); }}><option value="">Todas as situações</option>{Object.entries(nomesStatus).map(([codigo, nome]) => <option key={codigo} value={codigo}>{nome}</option>)}</select></label>
    </div>
    {erro ? <div role="alert"><p className="erro-formulario">{erro}</p><button type="button" onClick={() => setTentativa((valor) => valor + 1)}>Tentar novamente</button></div> : carregando ? <p role="status">Consultando agenda…</p> : <>
      <p className="horarios-resultado" role="status">{resultado.total} {resultado.total === 1 ? 'atendimento encontrado' : 'atendimentos encontrados'}</p>
      {!resultado.agendamentos.length ? <div className="horarios-vazio"><strong>Nenhum atendimento nesta consulta</strong><p>Escolha outro dia ou ajuste os filtros.</p></div> : <div className="agenda-atendimentos">{resultado.agendamentos.map((item) => <details key={item.cd_agendamento} className="agenda-atendimento">
        <summary><span className="agenda-hora"><strong>{hora(item.inicio_em)}</strong><small>até {hora(item.fim_em)}</small></span><span className="agenda-cliente"><strong>{item.nome_cliente_reserva}</strong><small>{item.servico.nome} · {item.profissional.nome}</small></span><span className={`agenda-situacao situacao-${item.status.toLowerCase()}`}>{nomesStatus[item.status] || item.status}</span><span className="agenda-abrir" aria-hidden="true">⌄</span></summary>
        <div className="agenda-detalhes"><dl><div><dt>Telefone</dt><dd><a href={`tel:${item.telefone_reserva}`}>{item.telefone_reserva}</a></dd></div><div><dt>Valor</dt><dd>{Number(item.preco_registrado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</dd></div><div><dt>Duração</dt><dd>{item.duracao_registrada} minutos</dd></div>{item.motivo_cancelamento && <div><dt>Motivo do cancelamento</dt><dd>{item.motivo_cancelamento}</dd></div>}</dl>
          {podeGerir(item) && <div className="agenda-acoes">
            {(admin || usuario.permissoes.pode_atualizar_status) && item.status === 'PENDENTE' && <button type="button" disabled={salvando} onClick={(event) => abrirAcao(item, 'CONFIRMADO', event.currentTarget)}>Confirmar atendimento</button>}
            {(admin || usuario.permissoes.pode_atualizar_status) && item.status === 'CONFIRMADO' && <><button type="button" disabled={salvando || new Date(item.fim_em) > new Date()} onClick={(event) => abrirAcao(item, 'CONCLUIDO', event.currentTarget)}>Concluir atendimento</button><button type="button" disabled={salvando || new Date(item.inicio_em) > new Date()} onClick={(event) => abrirAcao(item, 'NAO_COMPARECEU', event.currentTarget)}>Registrar falta</button></>}
            {(admin || usuario.permissoes.pode_cancelar_agendamento) && ['PENDENTE', 'CONFIRMADO'].includes(item.status) && <button className="cliente-excluir" type="button" disabled={salvando} onClick={(event) => abrirAcao(item, 'CANCELADO', event.currentTarget)}>Cancelar agendamento</button>}
          </div>}
          {item.status === 'CONFIRMADO' && new Date(item.fim_em) > new Date() && podeGerir(item) && <p className="agenda-observacao">Conclusão disponível após o fim do atendimento; falta, após o horário de início.</p>}
        </div>
      </details>)}</div>}
      {resultado.paginas > 1 && <div className="horarios-paginacao"><button type="button" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>Página {pagina} de {resultado.paginas}</span><button type="button" disabled={pagina >= resultado.paginas} onClick={() => setPagina(pagina + 1)}>Próxima</button></div>}
    </>}
    <dialog ref={dialogo} className="cliente-dialogo" aria-labelledby="titulo-acao-agenda" onCancel={(event) => { event.preventDefault(); if (!salvando) fecharAcao(); }}><form onSubmit={aplicarAcao}><h2 id="titulo-acao-agenda">{acao?.destino === 'CANCELADO' ? 'Cancelar agendamento?' : 'Atualizar atendimento?'}</h2><p><strong>{acao?.item.nome_cliente_reserva}</strong> · {acao && hora(acao.item.inicio_em)}</p><p>Nova situação: <strong>{acao && nomesStatus[acao.destino]}</strong>.</p>{acao?.destino === 'CANCELADO' && <label className="agenda-motivo">Motivo do cancelamento<textarea required minLength={3} maxLength={500} value={motivo} disabled={salvando} onChange={(event) => setMotivo(event.target.value)} /></label>}{erroAcao && <p className="erro-formulario" role="alert">{erroAcao}</p>}<div className="cliente-dialogo-acoes"><button type="button" disabled={salvando} autoFocus onClick={fecharAcao}>Voltar</button><button className={acao?.destino === 'CANCELADO' ? 'cliente-confirmar-exclusao' : ''} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar'}</button></div></form></dialog>
  </section>;
}
