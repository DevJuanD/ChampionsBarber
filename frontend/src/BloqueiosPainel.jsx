import { useEffect, useRef, useState } from 'react';
import { consultarApi } from './api';
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const hora = (data) => new Date(data).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

export default function BloqueiosPainel({ usuario }) {
  const [data, setData] = useState(hoje);
  const [bloqueios, setBloqueios] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [formulario, setFormulario] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroFormulario, setErroFormulario] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [removendo, setRemovendo] = useState(null);
  const dialogo = useRef(null);
  const botaoNovo = useRef(null);
  const admin = usuario.papeis.includes('ADMINISTRADOR');

  useEffect(() => {
    const controller = new AbortController(); setCarregando(true); setErro('');
    Promise.all([consultarApi(`/bloqueios?data=${data}`, { signal: controller.signal }), consultarApi('/agenda/opcoes', { signal: controller.signal })])
      .then(([registros, profissionais]) => { setBloqueios(registros); setEquipe(profissionais.filter((item) => item.ativo && (admin || usuario.permissoes.escopo_gestao_agenda === 'GLOBAL' || item.cd_profissional === usuario.cd_profissional))); })
      .catch((error) => { if (error.name !== 'AbortError') setErro(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [data, tentativa, admin, usuario.cd_profissional, usuario.permissoes.escopo_gestao_agenda]);
  useEffect(() => { if (removendo && !dialogo.current?.open) dialogo.current?.showModal(); }, [removendo]);

  async function salvar(event) {
    event.preventDefault(); if (salvando) return;
    const dados = new FormData(event.currentTarget); setSalvando(true); setErroFormulario('');
    try {
      await consultarApi('/bloqueios', { dados: { data: dados.get('data'), cd_profissional: Number(dados.get('profissional')), inicio: dados.get('inicio'), fim: dados.get('fim'), motivo: dados.get('motivo') } });
      setFormulario(false); setData(dados.get('data')); setSucesso('Horário bloqueado.'); setTentativa((valor) => valor + 1); botaoNovo.current?.focus();
    } catch (error) { setErroFormulario(error.message); }
    finally { setSalvando(false); }
  }
  function fecharDialogo() { dialogo.current?.close(); setRemovendo(null); setErroFormulario(''); botaoNovo.current?.focus(); }
  async function remover() {
    if (salvando) return; setSalvando(true); setErroFormulario('');
    try { await consultarApi(`/bloqueios/${removendo.cd_bloqueio}`, { metodo: 'DELETE', dados: {} }); fecharDialogo(); setSucesso('Bloqueio removido.'); setTentativa((valor) => valor + 1); }
    catch (error) { setErroFormulario(error.message); }
    finally { setSalvando(false); }
  }

  return <section className="painel-cartao"><div className="painel-modulo-cabecalho"><div><h2>Bloqueios de horário</h2><p>Reserve períodos para pausas e indisponibilidades.</p></div><button ref={botaoNovo} className="botao" type="button" disabled={salvando || carregando} onClick={() => { setFormulario(true); setErroFormulario(''); setSucesso(''); }}>Novo bloqueio</button></div>
    {sucesso && <p className="clientes-sucesso" role="status">{sucesso}</p>}
    {formulario && <form className="servico-formulario" onSubmit={salvar}><h3>Novo bloqueio</h3><fieldset className="agendamento-campos" disabled={salvando}><label>Profissional<select name="profissional" required autoFocus><option value="">Selecione</option>{equipe.map((item) => <option key={item.cd_profissional} value={item.cd_profissional}>{item.nome}</option>)}</select></label><label>Dia<input name="data" type="date" defaultValue={data} required /></label><div className="equipe-escopos"><label>Início<input name="inicio" type="time" required /></label><label>Fim<input name="fim" type="time" required /></label></div><label>Motivo<textarea name="motivo" required minLength={3} maxLength={500} rows={3} placeholder="Ex.: compromisso pessoal" /></label></fieldset>{erroFormulario && <p className="erro-formulario" role="alert">{erroFormulario}</p>}<div className="servico-acoes"><button className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar bloqueio'}</button><button type="button" disabled={salvando} onClick={() => { setFormulario(false); botaoNovo.current?.focus(); }}>Cancelar</button></div></form>}
    <div className="agenda-filtros"><label>Dia da consulta<input type="date" value={data} onChange={(event) => setData(event.target.value)} /></label></div>
    {erro ? <div role="alert"><p className="erro-formulario">{erro}</p><button type="button" onClick={() => setTentativa((valor) => valor + 1)}>Tentar novamente</button></div> : carregando ? <p role="status">Consultando bloqueios…</p> : <><p className="horarios-resultado" role="status">{bloqueios.length} bloqueio(s) no dia{bloqueios.length === 100 ? ' — limite de exibição atingido' : ''}</p>{!bloqueios.length ? <p className="horarios-vazio">Nenhum bloqueio neste dia.</p> : <ul className="clientes-lista">{bloqueios.map((item) => <li key={item.cd_bloqueio}><div className="cliente-identidade"><strong>{item.profissional.nome}</strong><span>{hora(item.inicio_em)} – {hora(item.fim_em)} · {item.motivo}</span></div><div className="cliente-acoes" style={{ marginLeft: 'auto' }}><button type="button" disabled={salvando} onClick={() => { setRemovendo(item); setErroFormulario(''); }}>Remover bloqueio</button></div></li>)}</ul>}</>}
    <dialog ref={dialogo} className="cliente-dialogo" aria-labelledby="titulo-remover-bloqueio" onCancel={(event) => { event.preventDefault(); if (!salvando) fecharDialogo(); }}><h2 id="titulo-remover-bloqueio">Liberar este período?</h2><p>{removendo?.profissional.nome} · {removendo && `${hora(removendo.inicio_em)} – ${hora(removendo.fim_em)}`}</p><p>O período voltará a aceitar agendamentos conforme a disponibilidade.</p>{erroFormulario && <p className="erro-formulario" role="alert">{erroFormulario}</p>}<div className="cliente-dialogo-acoes"><button type="button" autoFocus disabled={salvando} onClick={fecharDialogo}>Voltar</button><button type="button" disabled={salvando} onClick={remover}>{salvando ? 'Removendo…' : 'Remover bloqueio'}</button></div></dialog>
  </section>;
}
