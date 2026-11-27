import { useEffect, useState } from 'react';
import { consultarApi } from './api';

export default function ServicosPainel() {
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
    consultarApi('/servicos', { signal: controller.signal })
      .then(setServicos)
      .catch((error) => { if (error.name !== 'AbortError') setErro(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [tentativa]);

  async function salvar(event) {
    event.preventDefault();
    if (salvando) return;
    const dados = new FormData(event.currentTarget);
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const servico = await consultarApi('/servicos', { dados: {
        nome: dados.get('nome'), descricao: dados.get('descricao'),
        preco: dados.get('preco'), duracao_minutos: Number(dados.get('duracao')),
      } });
      setServicos((anteriores) => [...anteriores, servico].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      setFormulario(false);
      setSucesso('Serviço cadastrado com sucesso.');
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  return <section className="painel-cartao">
    <div className="painel-modulo-cabecalho"><div><h2>Serviços disponíveis</h2><p>Catálogo de serviços da barbearia.</p></div><button className="botao" type="button" disabled={carregando || salvando} onClick={() => { setFormulario(true); setSucesso(''); }}>Novo serviço</button></div>
    {erro && <p className="erro-formulario" role="alert">{erro}</p>}
    {sucesso && <p role="status">{sucesso}</p>}
    {formulario && <form className="servico-formulario" onSubmit={salvar}>
      <h3>Novo serviço</h3>
      <label>Nome<input name="nome" required maxLength={100} autoFocus disabled={salvando} /></label>
      <label>Descrição<textarea name="descricao" maxLength={2000} rows={3} disabled={salvando} /></label>
      <label>Preço (R$)<input name="preco" type="number" required min="0.01" max="99999999.99" step="0.01" disabled={salvando} /></label>
      <label>Duração (minutos)<input name="duracao" type="number" required min="1" max="1440" step="1" disabled={salvando} /></label>
      <div className="servico-acoes"><button className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar serviço'}</button><button type="button" disabled={salvando} onClick={() => setFormulario(false)}>Cancelar</button></div>
    </form>}
    {carregando ? <p role="status">Carregando serviços…</p> : erro && !servicos.length ? <button type="button" onClick={() => setTentativa(tentativa + 1)}>Consultar novamente</button> : !servicos.length ? <p>Nenhum serviço cadastrado.</p> : <div className="servico-tabela"><table><caption className="sr-only">Serviços disponíveis</caption><thead><tr><th>Serviço</th><th>Preço</th><th>Duração</th></tr></thead><tbody>{servicos.map((servico) => <tr key={servico.cd_servico}><td><strong>{servico.nome}</strong>{servico.descricao && <p>{servico.descricao}</p>}</td><td>{Number(servico.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>{servico.duracao_minutos} min</td></tr>)}</tbody></table></div>}
  </section>;
}
