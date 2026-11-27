import { useEffect, useId, useRef, useState } from 'react';
import { consultarApi } from './api';

function telefone(valor) {
  const numeros = valor.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return numeros.length >= 10 ? `(${numeros.slice(0, 2)}) ${numeros.slice(2, -4)}-${numeros.slice(-4)}` : valor;
}

export default function BuscaCliente({ aoSelecionar, caminho = '/clientes' }) {
  const id = useId();
  const campo = useRef(null);
  const botaoTrocar = useRef(null);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [total, setTotal] = useState(0);
  const [selecionado, setSelecionado] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (selecionado || busca.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const dados = await consultarApi(`${caminho}?busca=${encodeURIComponent(busca.trim())}&pagina=1`, { signal: controller.signal });
        if (!controller.signal.aborted) { setResultados(dados.clientes); setTotal(dados.total); }
      } catch (error) { if (!controller.signal.aborted) setErro(error.message); }
      finally { if (!controller.signal.aborted) setCarregando(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [busca, selecionado, tentativa, caminho]);

  function escolher(cliente) {
    setSelecionado(cliente); setAberto(false); setAtivo(-1); setCarregando(false); aoSelecionar(cliente);
  }
  function digitar(event) {
    setBusca(event.target.value); setResultados([]); setTotal(0); setAtivo(-1); setErro(''); setAberto(true);
    setCarregando(event.target.value.trim().length >= 2);
  }
  function teclado(event) {
    if (event.key === 'Escape') { event.preventDefault(); setAberto(false); setAtivo(-1); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setAberto(true);
      if (resultados.length) setAtivo((indice) => event.key === 'ArrowDown' ? (indice + 1) % resultados.length : (indice <= 0 ? resultados.length : indice) - 1);
    }
    if (event.key === 'Enter') { event.preventDefault(); if (aberto && ativo >= 0 && resultados[ativo]) escolher(resultados[ativo]); }
  }
  useEffect(() => { if (ativo >= 0) document.getElementById(`${id}-opcao-${ativo}`)?.scrollIntoView({ block: 'nearest' }); }, [ativo, id]);
  useEffect(() => { if (selecionado) botaoTrocar.current?.focus(); }, [selecionado]);

  if (selecionado) return <div className="busca-cliente-selecionado"><span className="horarios-inicial" aria-hidden="true">{selecionado.nome_completo.slice(0, 1).toUpperCase()}</span><div><span>Cliente selecionado</span><strong>{selecionado.nome_completo}</strong><small>{telefone(selecionado.telefone_contato)}</small></div><button ref={botaoTrocar} type="button" onClick={() => { setSelecionado(null); setBusca(''); setResultados([]); setTotal(0); setErro(''); setCarregando(false); aoSelecionar(null); requestAnimationFrame(() => campo.current?.focus()); }}>Trocar cliente</button></div>;

  return <div className="busca-cliente" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setAberto(false); setAtivo(-1); } }}>
    <label htmlFor={`${id}-campo`}>Cliente</label>
    <div className="busca-cliente-campo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input ref={campo} id={`${id}-campo`} role="combobox" aria-autocomplete="list" aria-expanded={aberto && resultados.length > 0} aria-controls={`${id}-lista`} aria-activedescendant={aberto && ativo >= 0 ? `${id}-opcao-${ativo}` : undefined} aria-describedby={`${id}-ajuda`} autoComplete="off" placeholder="Digite o nome ou telefone do cliente" value={busca} maxLength={150} onChange={digitar} onKeyDown={teclado} onFocus={() => setAberto(true)} /></div>
    <p id={`${id}-ajuda`} className="busca-cliente-ajuda">Digite pelo menos 2 caracteres e selecione o cliente nos resultados.</p>
    <div className="busca-cliente-status" role="status">{carregando ? 'Buscando clientes…' : erro ? '' : busca.trim().length >= 2 ? `${total} ${total === 1 ? 'cliente encontrado' : 'clientes encontrados'}` : ''}</div>
    {erro && <div className="erro-formulario" role="alert"><p>{erro}</p><button type="button" onClick={() => { setErro(''); setCarregando(true); setTentativa((valor) => valor + 1); setAberto(true); }}>Tentar novamente</button></div>}
    {aberto && !carregando && !erro && busca.trim().length >= 2 && !resultados.length && <p className="busca-cliente-vazio">Nenhum cliente encontrado. Confira o nome ou telefone.</p>}
    <ul id={`${id}-lista`} className="busca-cliente-resultados" role="listbox" aria-label="Clientes encontrados" hidden={!aberto || !resultados.length || carregando}>
      {resultados.map((cliente, indice) => <li id={`${id}-opcao-${indice}`} key={cliente.cd_cliente} role="option" tabIndex={-1} aria-selected={indice === ativo} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); escolher(cliente); } }} onPointerDown={(event) => { if (event.pointerType !== 'touch') event.preventDefault(); }} onClick={() => escolher(cliente)}><span className="horarios-inicial" aria-hidden="true">{cliente.nome_completo.slice(0, 1).toUpperCase()}</span><span><strong>{cliente.nome_completo}</strong><small>{telefone(cliente.telefone_contato)}</small></span><span className="busca-cliente-escolher" aria-hidden="true">Selecionar</span></li>)}
    </ul>
    {aberto && !carregando && total > resultados.length && <p className="busca-cliente-ajuda">Mostrando os primeiros {resultados.length} resultados. Digite mais para refinar a busca.</p>}
  </div>;
}
