import { useEffect, useState } from 'react';
import { consultarApi } from './api';
import BuscaCliente from './BuscaCliente';

export default function NovoAgendamentoEquipe({ profissionais, dataInicial, aoSalvar, aoCancelar }) {
  const [servicos, setServicos] = useState([]);
  const [cliente, setCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [servico, setServico] = useState('');
  const [profissional, setProfissional] = useState('');
  const [data, setData] = useState(dataInicial);
  const [hora, setHora] = useState('');
  const [horarios, setHorarios] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroHorarios, setErroHorarios] = useState('');
  const [catalogoPronto, setCatalogoPronto] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    consultarApi('/servicos', { signal: controller.signal }).then((dados) => { setServicos(dados); setCatalogoPronto(true); })
      .catch((error) => { if (error.name !== 'AbortError') setErro(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setHora(''); setHorarios([]); setErroHorarios('');
    if (!cliente || !servico || !profissional || !data) { setBuscando(false); return; }
    const controller = new AbortController(); setBuscando(true);
    consultarApi(`/agenda/horarios?cd_cliente=${cliente}&cd_servico=${servico}&cd_profissional=${profissional}&data=${data}`, { signal: controller.signal })
      .then(setHorarios).catch((error) => { if (error.name !== 'AbortError') setErroHorarios(error.message); })
      .finally(() => { if (!controller.signal.aborted) setBuscando(false); });
    return () => controller.abort();
  }, [cliente, servico, profissional, data]);

  async function salvar(event) {
    event.preventDefault(); if (salvando || !hora || buscando || !cliente) return;
    setSalvando(true); setErro('');
    try {
      await consultarApi('/agenda', { dados: { cd_cliente: Number(cliente), cd_servico: Number(servico), cd_profissional: Number(profissional), data, hora } });
      aoSalvar(data);
    } catch (error) { setErro(error.message); if (error.status === 409) { setHora(''); setHorarios([]); } }
    finally { setSalvando(false); }
  }
  const equipe = profissionais.filter((item) => item.ativo && item.servicos.some((vinculo) => vinculo.cd_servico === Number(servico)));
  const selecionado = servicos.find((item) => item.cd_servico === Number(servico));
  return <form className="servico-formulario" onSubmit={salvar} aria-busy={salvando}>
    <h3>Novo agendamento</h3>
    <fieldset className="agendamento-campos" disabled={salvando}>
      <BuscaCliente caminho="/agenda/clientes" aoSelecionar={(item) => { setCliente(item?.cd_cliente || ''); setClienteSelecionado(item); setHora(''); setHorarios([]); }} />
      <label>Serviço<select required value={servico} disabled={!catalogoPronto} onChange={(event) => { setServico(event.target.value); setProfissional(''); setHora(''); }}><option value="">Selecione</option>{servicos.map((item) => <option key={item.cd_servico} value={item.cd_servico}>{item.nome} · {Number(item.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {item.duracao_minutos} min</option>)}</select></label>
      <label>Profissional<select value={profissional} required disabled={!servico} onChange={(event) => { setProfissional(event.target.value); setHora(''); }}><option value="">Selecione</option>{equipe.map((item) => <option key={item.cd_profissional} value={item.cd_profissional}>{item.nome}</option>)}</select></label>
      {servico && !equipe.length && <p>Não há profissional ativo para este serviço.</p>}
      <label>Dia<input type="date" required value={data} onChange={(event) => { setData(event.target.value); setHora(''); }} /></label>
    </fieldset>
    <fieldset className="agendamento-horarios" disabled={salvando || buscando}><legend>Horários disponíveis</legend>{buscando ? <p role="status">Consultando horários…</p> : horarios.length ? <div className="agendamento-opcoes">{horarios.map((item) => <label className={hora === item ? 'selecionado' : ''} key={item}><input type="radio" name="hora" checked={hora === item} onChange={() => setHora(item)} required /><span>{item}</span></label>)}</div> : <p>{cliente && servico && profissional && data ? 'Sem horários disponíveis. Confira a data e a jornada.' : 'Selecione cliente, serviço, profissional e dia.'}</p>}</fieldset>
    {erroHorarios && <p className="erro-formulario" role="alert">{erroHorarios}</p>}
    {erro && <p className="erro-formulario" role="alert">{erro}</p>}
    {hora && <div className="agendamento-resumo"><strong>Confira o atendimento</strong><p>{clienteSelecionado?.nome_completo} · {selecionado?.nome}</p><p>{profissionais.find((item) => item.cd_profissional === Number(profissional))?.nome} · {data.split('-').reverse().join('/')} às {hora}</p></div>}
    <div className="servico-acoes"><button className="botao" disabled={!hora || salvando || buscando}>{salvando ? 'Agendando…' : 'Confirmar agendamento'}</button><button type="button" disabled={salvando} onClick={aoCancelar}>Cancelar</button></div>
  </form>;
}
