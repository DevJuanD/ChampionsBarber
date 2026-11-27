import { useEffect, useState } from 'react';
import { consultarApi } from './api';
import HorariosConsulta from './HorariosConsulta';

const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function HorariosPainel() {
  const [horarios, setHorarios] = useState({ funcionamento: [], jornadas: [] });
  const [profissionais, setProfissionais] = useState([]);
  const [tipo, setTipo] = useState('funcionamento');
  const [diasSelecionados, setDiasSelecionados] = useState([1, 2, 3, 4, 5]);
  const [periodos, setPeriodos] = useState([{ hora_inicio: '08:00', hora_fim: '12:00' }, { hora_inicio: '14:00', hora_fim: '18:00' }]);
  const [formulario, setFormulario] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCarregando(true);
    setErro('');
    Promise.all([consultarApi('/horarios', { signal: controller.signal }), consultarApi('/profissionais', { signal: controller.signal })])
      .then(([periodos, equipe]) => { setHorarios(periodos); setProfissionais(equipe.filter((item) => item.ativo)); })
      .catch((error) => { if (error.name !== 'AbortError') setErro(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [tentativa]);

  async function salvar(event) {
    event.preventDefault();
    if (salvando) return;
    const dados = new FormData(event.currentTarget);
    if (!diasSelecionados.length) { setErro('Selecione ao menos um dia da semana.'); return; }
    setSalvando(true); setErro(''); setSucesso('');
    try {
      await consultarApi('/horarios', { dados: { tipo, dias_semana: diasSelecionados, periodos,
        ...(tipo === 'jornada' ? { cd_profissional: Number(dados.get('profissional')) } : {}),
      } });
      setFormulario(false); setSucesso('Horários cadastrados com sucesso.'); setTentativa((valor) => valor + 1);
    } catch (error) { setErro(error.message); }
    finally { setSalvando(false); }
  }

  return <section className="painel-cartao">
    <div className="painel-modulo-cabecalho"><div><h2>Funcionamento e jornadas</h2><p>Consulte a semana da barbearia e os horários da equipe.</p></div><button className="botao" disabled={carregando || salvando} onClick={() => { setFormulario(true); setSucesso(''); }}>Cadastrar horários</button></div>
    {erro && <div role="alert"><p className="erro-formulario">{erro}</p><button type="button" disabled={salvando} onClick={() => setTentativa((valor) => valor + 1)}>Consultar novamente</button></div>}
    {sucesso && <p role="status">{sucesso}</p>}
    {formulario && <form className="servico-formulario" onSubmit={salvar}>
      <label>Tipo de período<select value={tipo} onChange={(event) => setTipo(event.target.value)} disabled={salvando}><option value="funcionamento">Funcionamento da barbearia</option><option value="jornada">Jornada do profissional</option></select></label>
      {tipo === 'jornada' && <label>Profissional<select name="profissional" required disabled={salvando}><option value="">Selecione</option>{profissionais.map((item) => <option key={item.cd_profissional} value={item.cd_profissional}>{item.nome}</option>)}</select></label>}
      <fieldset className="horario-dias" disabled={salvando}><legend>Dias da semana</legend>
        <div className="servico-acoes"><button type="button" onClick={() => setDiasSelecionados([1, 2, 3, 4, 5])}>Segunda a sexta</button><button type="button" onClick={() => setDiasSelecionados([1, 2, 3, 4, 5, 6])}>Segunda a sábado</button><button type="button" onClick={() => setDiasSelecionados([0, 1, 2, 3, 4, 5, 6])}>Todos os dias</button></div>
        <div className="horario-dias-opcoes">{dias.map((dia, indice) => <label key={dia}><input type="checkbox" checked={diasSelecionados.includes(indice)} onChange={(event) => setDiasSelecionados((anteriores) => event.target.checked ? [...anteriores, indice] : anteriores.filter((valor) => valor !== indice))} />{dia}</label>)}</div>
      </fieldset>
      <fieldset className="horario-periodos" disabled={salvando}><legend>Períodos de atendimento</legend><p>Os intervalos entre os períodos ficam reservados para as pausas.</p>
        {periodos.map((periodo, indice) => <div className="horario-periodo" key={indice}>
          <label>Início do período {indice + 1}<input type="time" required value={periodo.hora_inicio} onChange={(event) => setPeriodos((anteriores) => anteriores.map((item, i) => i === indice ? { ...item, hora_inicio: event.target.value } : item))} /></label>
          <label>Fim do período {indice + 1}<input type="time" required value={periodo.hora_fim} onChange={(event) => setPeriodos((anteriores) => anteriores.map((item, i) => i === indice ? { ...item, hora_fim: event.target.value } : item))} /></label>
          <button type="button" disabled={periodos.length === 1} aria-label={`Remover período ${indice + 1}`} onClick={() => setPeriodos((anteriores) => anteriores.filter((_, i) => i !== indice))}>Remover</button>
        </div>)}
        <button type="button" disabled={periodos.length >= 6} onClick={() => setPeriodos([...periodos, { hora_inicio: '', hora_fim: '' }])}>Adicionar período</button>
      </fieldset>
      <p role="status">{diasSelecionados.length} dia(s) selecionado(s), com {periodos.length} período(s) por dia.</p>
      <div className="servico-acoes"><button className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar horários'}</button><button type="button" disabled={salvando} onClick={() => setFormulario(false)}>Cancelar</button></div>
    </form>}
    {carregando ? <p role="status">Carregando horários…</p> : <HorariosConsulta horarios={horarios} profissionais={profissionais} />}
  </section>;
}
