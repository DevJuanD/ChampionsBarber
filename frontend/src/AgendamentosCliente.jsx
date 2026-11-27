import { useEffect, useState } from 'react';
import { consultarApi } from './api';

const dinheiro = (valor) => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = (valor) => new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AgendamentosCliente() {
  const [servicos, setServicos] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [servico, setServico] = useState('');
  const [profissional, setProfissional] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [horarios, setHorarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroHorarios, setErroHorarios] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [atualizarHorarios, setAtualizarHorarios] = useState(0);
  const [formulario, setFormulario] = useState(false);

  useEffect(() => { setErroHorarios(''); }, [servico, profissional, data]);

  useEffect(() => {
    const controller = new AbortController();
    setCarregando(true); setErro('');
    Promise.all([consultarApi('/servicos', { signal: controller.signal }), consultarApi('/agendamentos/opcoes', { signal: controller.signal }), consultarApi('/agendamentos', { signal: controller.signal })])
      .then(([catalogo, equipe, reservas]) => { setServicos(catalogo); setProfissionais(equipe); setAgendamentos(reservas); })
      .catch((error) => { if (error.name !== 'AbortError') setErro(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [tentativa]);

  useEffect(() => {
    setHorarios([]); setHora('');
    if (!servico || !profissional || !data) { setBuscando(false); return; }
    const controller = new AbortController();
    setBuscando(true);
    consultarApi(`/agendamentos/horarios?cd_servico=${servico}&cd_profissional=${profissional}&data=${data}`, { signal: controller.signal })
      .then(setHorarios)
      .catch((error) => { if (error.name !== 'AbortError') setErroHorarios(error.message); })
      .finally(() => { if (!controller.signal.aborted) setBuscando(false); });
    return () => controller.abort();
  }, [servico, profissional, data, atualizarHorarios]);

  const selecionado = servicos.find((item) => item.cd_servico === Number(servico));
  const profissionalSelecionado = profissionais.find((item) => item.cd_profissional === Number(profissional));
  const equipe = profissionais.filter((item) => item.servicos.some((vinculo) => vinculo.cd_servico === Number(servico)));

  async function agendar(event) {
    event.preventDefault();
    if (salvando || !hora || buscando) return;
    setSalvando(true); setErroHorarios(''); setSucesso('');
    try {
      const reserva = await consultarApi('/agendamentos', { dados: { cd_servico: Number(servico), cd_profissional: Number(profissional), data, hora } });
      setFormulario(false); setHora(''); setData('');
      setSucesso(`${reserva.status === 'CONFIRMADO' ? 'Agendamento confirmado' : 'Agendamento solicitado'} para ${dataHora(reserva.inicio_em)}.`);
      setTentativa((valor) => valor + 1);
    } catch (error) { setErroHorarios(error.message); setAtualizarHorarios((valor) => valor + 1); }
    finally { setSalvando(false); }
  }

  return <section className="painel-cartao" aria-labelledby="titulo-reservas">
    <div className="painel-modulo-cabecalho"><div><h2 id="titulo-reservas">Seu próximo horário</h2><p>Escolha um serviço e encontre um horário para você.</p></div><button className="botao" type="button" disabled={carregando || salvando || Boolean(erro)} onClick={() => { setFormulario(true); setSucesso(''); }}>Agendar horário</button></div>
    {sucesso && <p className="clientes-sucesso" role="status">{sucesso}</p>}
    {erro && <div role="alert"><p className="erro-formulario">{erro}</p><button type="button" onClick={() => setTentativa((valor) => valor + 1)}>Tentar novamente</button></div>}
    {formulario && <form className="servico-formulario agendamento-formulario" onSubmit={agendar} aria-busy={salvando}>
      <h3>Agendar horário</h3>
      <fieldset disabled={salvando} className="agendamento-campos">
        <label>1. Serviço<select required value={servico} onChange={(event) => { setServico(event.target.value); setProfissional(''); setHora(''); }}><option value="">Selecione um serviço</option>{servicos.map((item) => <option key={item.cd_servico} value={item.cd_servico}>{item.nome} · {dinheiro(item.preco)} · {item.duracao_minutos} min</option>)}</select></label>
        <label>2. Profissional<select required value={profissional} disabled={!servico} onChange={(event) => { setProfissional(event.target.value); setHora(''); }}><option value="">Selecione um profissional</option>{equipe.map((item) => <option key={item.cd_profissional} value={item.cd_profissional}>{item.nome}</option>)}</select></label>
        {servico && !equipe.length && <p>Nenhum profissional disponível para este serviço. Escolha outro serviço.</p>}
        <label>3. Dia<input type="date" required value={data} disabled={!profissional} onChange={(event) => { setData(event.target.value); setHora(''); }} /></label>
      </fieldset>
      <fieldset className="agendamento-horarios" disabled={salvando || buscando}><legend>4. Horário disponível</legend>
        {buscando ? <p role="status">Consultando horários…</p> : !data || !profissional ? <p>Selecione o serviço, o profissional e o dia.</p> : horarios.length ? <div className="agendamento-opcoes">{horarios.map((item) => <label className={hora === item ? 'selecionado' : ''} key={item}><input type="radio" name="hora" value={item} checked={hora === item} onChange={() => setHora(item)} required /><span>{item}</span></label>)}</div> : !erroHorarios && <p role="status">Não há horários disponíveis neste dia. Escolha outra data.</p>}
      </fieldset>
      {erroHorarios && <p className="erro-formulario" role="alert">{erroHorarios}</p>}
      {hora && selecionado && <div className="agendamento-resumo"><strong>Confira sua reserva</strong><p>{selecionado.nome} com {profissionalSelecionado?.nome}</p><p>{data.split('-').reverse().join('/')} às {hora} · {selecionado.duracao_minutos} min · {dinheiro(selecionado.preco)}</p><small>Horário da barbearia — Brasília.</small></div>}
      <div className="servico-acoes"><button className="botao" disabled={!hora || salvando || buscando}>{salvando ? 'Agendando…' : 'Confirmar agendamento'}</button><button type="button" disabled={salvando} onClick={() => setFormulario(false)}>Cancelar</button></div>
    </form>}
    <div className="horarios-secao-titulo agendamento-lista-titulo"><div><h3>Meus agendamentos</h3><p>Seus últimos 30 agendamentos, do mais recente ao mais antigo.</p></div></div>
    {carregando ? <p role="status">Carregando agendamentos…</p> : !erro && (!agendamentos.length ? <div className="horarios-vazio"><strong>Você ainda não tem agendamentos</strong><p>Use Agendar horário para reservar seu atendimento.</p></div> : <ul className="agendamento-lista">{agendamentos.map((item) => <li key={item.cd_agendamento}><div><strong>{item.servico.nome}</strong><span>Com {item.profissional.nome}</span><span>{dataHora(item.inicio_em)}</span></div><div><strong>{dinheiro(item.preco_registrado)}</strong><span className="agendamento-status">{({ CONFIRMADO: 'Confirmado', PENDENTE: 'Aguardando confirmação', CANCELADO: 'Cancelado', CONCLUIDO: 'Concluído', NAO_COMPARECEU: 'Não compareceu' })[item.status] || item.status}</span></div></li>)}</ul>)}
  </section>;
}
