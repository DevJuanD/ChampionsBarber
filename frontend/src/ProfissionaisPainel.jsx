import { useEffect, useState } from 'react';
import { consultarApi } from './api';

export default function ProfissionaisPainel() {
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [formulario, setFormulario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCarregando(true);
    setErro('');
    Promise.all([
      consultarApi('/profissionais', { signal: controller.signal }),
      consultarApi('/servicos', { signal: controller.signal }),
    ]).then(([equipe, catalogo]) => { setProfissionais(equipe); setServicos(catalogo); })
      .catch((error) => { if (error.name !== 'AbortError') setErro(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [tentativa]);

  async function salvar(event) {
    event.preventDefault();
    if (salvando) return;
    const dados = new FormData(event.currentTarget);
    const selecionados = dados.getAll('servicos').map(Number);
    setErro('');
    setSucesso('');
    if (!selecionados.length) { setErro('Selecione ao menos um serviço.'); return; }
    setSalvando(true);
    try {
      const profissional = await consultarApi('/profissionais', { dados: {
        nome: dados.get('nome'), descricao: dados.get('descricao'), servicos: selecionados,
      } });
      setProfissionais((anteriores) => [...anteriores, profissional].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      setFormulario(false);
      setSucesso('Profissional cadastrado com sucesso.');
    } catch (error) { setErro(error.message); }
    finally { setSalvando(false); }
  }

  return <section className="painel-cartao">
    <div className="painel-modulo-cabecalho"><div><h2>Equipe da barbearia</h2><p>Profissionais e serviços realizados.</p></div><button className="botao" type="button" disabled={carregando || salvando || !servicos.length} onClick={() => { setFormulario(true); setSucesso(''); }}>Novo profissional</button></div>
    {erro && <div role="alert"><p className="erro-formulario">{erro}</p><button type="button" disabled={salvando} onClick={() => setTentativa(tentativa + 1)}>Consultar novamente</button></div>}
    {sucesso && <p role="status">{sucesso}</p>}
    {!carregando && !erro && !servicos.length && <p>Cadastre um serviço em <a href="/painel?secao=servicos">Serviços</a> para adicionar profissionais.</p>}
    {formulario && <form className="servico-formulario" onSubmit={salvar}>
      <h3>Novo profissional</h3>
      <label>Nome<input name="nome" required maxLength={150} autoFocus disabled={salvando} /></label>
      <label>Descrição<textarea name="descricao" rows={3} maxLength={2000} disabled={salvando} /></label>
      <fieldset className="profissional-servicos" disabled={salvando}><legend>Serviços realizados — selecione ao menos um</legend>{servicos.map((servico) => <label key={servico.cd_servico}><input type="checkbox" name="servicos" value={servico.cd_servico} />{servico.nome}</label>)}</fieldset>
      <div className="servico-acoes"><button className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar profissional'}</button><button type="button" disabled={salvando} onClick={() => setFormulario(false)}>Cancelar</button></div>
    </form>}
    {carregando ? <p role="status">Carregando profissionais…</p> : !erro && !profissionais.length ? <p>Nenhum profissional cadastrado.</p> : profissionais.length > 0 && <div className="servico-tabela"><table><caption>Profissionais cadastrados</caption><thead><tr><th>Profissional</th><th>Serviços</th><th>Situação</th></tr></thead><tbody>{profissionais.map((profissional) => <tr key={profissional.cd_profissional}><td><strong>{profissional.nome}</strong>{profissional.descricao && <p>{profissional.descricao}</p>}</td><td>{profissional.servicos.map(({ servico }) => servico.nome).join(', ') || 'Sem serviços vinculados'}</td><td>{profissional.ativo ? 'Ativo' : 'Inativo'}</td></tr>)}</tbody></table></div>}
  </section>;
}
