import { useEffect, useRef, useState } from 'react';
import { consultarApi } from './api';
import CampoTelefone from './CampoTelefone';

function telefoneFormatado(telefone) {
  const numeros = telefone.replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(numeros)) return `(${numeros.slice(2, 4)}) ${numeros.slice(4, -4)}-${numeros.slice(-4)}`;
  return telefone;
}

export default function ClientesPainel() {
  const [resultado, setResultado] = useState({ clientes: [], total: 0, paginas: 1 });
  const [busca, setBusca] = useState('');
  const [consulta, setConsulta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroConsulta, setErroConsulta] = useState('');
  const [formulario, setFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');
  const dialogo = useRef(null);
  const areaFormulario = useRef(null);
  const ultimaAcao = useRef(null);
  const [salvando, setSalvando] = useState(false);
  const [erroCadastro, setErroCadastro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const botaoNovo = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setCarregando(true); setErroConsulta('');
    consultarApi(`/clientes?busca=${encodeURIComponent(consulta)}&pagina=${pagina}`, { signal: controller.signal })
      .then((dados) => { if (pagina > dados.paginas) setPagina(dados.paginas); else setResultado(dados); })
      .catch((error) => { if (error.name !== 'AbortError') setErroConsulta(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [consulta, pagina, tentativa]);

  useEffect(() => {
    if (excluindo && !dialogo.current?.open) dialogo.current?.showModal();
  }, [excluindo]);

  function fechar() { setFormulario(false); setEditando(null); (ultimaAcao.current || botaoNovo.current)?.focus(); }
  function abrirEdicao(cliente, botao) {
    ultimaAcao.current = botao; setEditando(cliente); setFormulario(true); setErroCadastro(''); setSucesso('');
    requestAnimationFrame(() => areaFormulario.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }
  function fecharExclusao() { dialogo.current?.close(); setExcluindo(null); setErroExclusao(''); ultimaAcao.current?.focus(); }
  async function excluir() {
    if (salvando) return;
    setSalvando(true); setErroExclusao(''); setSucesso('');
    try {
      await consultarApi(`/clientes/${excluindo.cd_cliente}`, { metodo: 'DELETE', dados: {} });
      fecharExclusao(); setSucesso('Cliente excluído. Se havia acesso vinculado, ele foi desativado.');
      setTentativa((valor) => valor + 1); botaoNovo.current?.focus();
    } catch (error) { setErroExclusao(error.message); }
    finally { setSalvando(false); }
  }

  async function salvar(event) {
    event.preventDefault();
    if (salvando) return;
    const dados = new FormData(event.currentTarget);
    setSalvando(true); setErroCadastro(''); setSucesso('');
    try {
      await consultarApi(editando ? `/clientes/${editando.cd_cliente}` : '/clientes', { metodo: editando ? 'PATCH' : 'POST', dados: { nome: dados.get('nome'), telefone: dados.get('telefone'), email: dados.get('email') } });
      fechar(); setSucesso(editando ? 'Dados do cliente atualizados.' : 'Cliente cadastrado com acesso. A senha inicial é o telefone com DDD, somente números, sem o 55 do país. A troca será obrigatória no primeiro acesso.');
      setBusca(''); setConsulta(''); setPagina(1); setTentativa((valor) => valor + 1);
    } catch (error) { setErroCadastro(error.message); }
    finally { setSalvando(false); }
  }

  return <section className="painel-cartao clientes-painel" aria-labelledby="titulo-clientes">
    <div className="painel-modulo-cabecalho"><div><h2 id="titulo-clientes">Clientes da barbearia</h2><p>Encontre contatos e cadastre novos clientes.</p></div><button ref={botaoNovo} className="botao" type="button" disabled={salvando} aria-expanded={formulario} aria-controls="cadastro-cliente" onClick={(event) => { ultimaAcao.current = event.currentTarget; setEditando(null); setFormulario(true); setErroCadastro(''); setSucesso(''); }}>Novo cliente</button></div>
    {sucesso && <p className="clientes-sucesso" role="status">{sucesso}</p>}
    {formulario && <form ref={areaFormulario} key={editando?.cd_cliente || 'novo'} id="cadastro-cliente" className="servico-formulario clientes-formulario" onSubmit={salvar}>
      <div><h3>{editando ? 'Editar cliente' : 'Novo cliente'}</h3><p>{editando ? 'O telefone e o e-mail também serão atualizados na conta vinculada. Ao alterar o contato, será necessário entrar novamente. Se a senha ainda for inicial, ela acompanhará o novo telefone.' : 'O telefone com DDD será a senha inicial, somente números. O cliente deverá trocá-la ao entrar.'}</p></div>
      {erroCadastro && <p className="erro-formulario" role="alert">{erroCadastro}</p>}
      <fieldset disabled={salvando}><label>Nome completo<input name="nome" defaultValue={editando?.nome_completo || ''} autoComplete="name" required minLength={3} maxLength={150} autoFocus /></label><label>Telefone com DDD<CampoTelefone name="telefone" defaultValue={editando ? telefoneFormatado(editando.telefone_contato) : ''} autoComplete="tel" required placeholder="(63) 99999-9999" /></label><label>E-mail <span>(opcional)</span><input name="email" defaultValue={editando?.email_contato || ''} type="email" autoComplete="email" maxLength={254} /></label></fieldset>
      <div className="servico-acoes"><button className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar cliente'}</button><button type="button" disabled={salvando} onClick={fechar}>Cancelar</button></div>
    </form>}
    <form className="clientes-busca" role="search" onSubmit={(event) => { event.preventDefault(); setConsulta(busca.trim()); setPagina(1); setTentativa((valor) => valor + 1); }}>
      <label htmlFor="busca-cliente">Buscar cliente</label><div><input id="busca-cliente" type="search" maxLength={150} placeholder="Nome ou telefone" value={busca} onChange={(event) => setBusca(event.target.value)} /><button type="submit">Buscar</button>{(consulta || busca) && <button type="button" onClick={() => { setBusca(''); setConsulta(''); setPagina(1); }}>Limpar</button>}</div>
    </form>
    {erroConsulta ? <div className="erro-formulario" role="alert"><p>{erroConsulta}</p><button type="button" onClick={() => setTentativa((valor) => valor + 1)}>Tentar novamente</button></div> : carregando ? <p role="status">Carregando clientes…</p> : <>
      <p className="horarios-resultado" role="status">{resultado.total} {resultado.total === 1 ? 'cliente encontrado' : 'clientes encontrados'}{consulta && ` para “${consulta}”`}</p>
      {!resultado.clientes.length ? <div className="horarios-vazio"><strong>{consulta ? 'Nenhum cliente encontrado' : 'Sua lista de clientes começa aqui'}</strong><p>{consulta ? 'Confira o nome ou tente buscar pelo telefone.' : 'Use Novo cliente para adicionar o primeiro contato.'}</p></div> : <ul className="clientes-lista">{resultado.clientes.map((cliente) => <li key={cliente.cd_cliente}>
        <span className="horarios-inicial" aria-hidden="true">{cliente.nome_completo.trim().slice(0, 1).toUpperCase()}</span><div className="cliente-identidade"><strong>{cliente.nome_completo}</strong><span>{cliente.cd_usuario ? 'Conta vinculada' : 'Cadastro de contato'}</span></div><div className="cliente-contato"><a href={`tel:${cliente.telefone_contato}`} aria-label={`Ligar para ${cliente.nome_completo}: ${telefoneFormatado(cliente.telefone_contato)}`}>{telefoneFormatado(cliente.telefone_contato)}</a>{cliente.email_contato && <span>{cliente.email_contato}</span>}</div>
        <div className="cliente-acoes"><button type="button" disabled={salvando} aria-label={`Editar ${cliente.nome_completo}`} onClick={(event) => abrirEdicao(cliente, event.currentTarget)}>Editar</button><button className="cliente-excluir" type="button" disabled={salvando} aria-label={`Excluir ${cliente.nome_completo}`} onClick={(event) => { ultimaAcao.current = event.currentTarget; setExcluindo(cliente); setErroExclusao(''); }}>Excluir</button></div>
      </li>)}</ul>}
      {resultado.paginas > 1 && <div className="horarios-paginacao"><button type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>Página {pagina} de {resultado.paginas}</span><button type="button" disabled={pagina >= resultado.paginas} onClick={() => setPagina(pagina + 1)}>Próxima</button></div>}
    </>}
    <dialog ref={dialogo} className="cliente-dialogo" aria-labelledby="titulo-exclusao" aria-describedby="descricao-exclusao" onCancel={(event) => { event.preventDefault(); if (!salvando) fecharExclusao(); }}>
      <h2 id="titulo-exclusao">Excluir cliente?</h2><p id="descricao-exclusao">O cadastro de <strong>{excluindo?.nome_completo}</strong> será removido. O acesso vinculado será desativado. Essa ação não pode ser desfeita por aqui.</p>
      {erroExclusao && <p className="erro-formulario" role="alert">{erroExclusao}</p>}
      <div className="cliente-dialogo-acoes"><button type="button" autoFocus disabled={salvando} onClick={fecharExclusao}>Cancelar</button><button className="cliente-confirmar-exclusao" type="button" disabled={salvando} onClick={excluir}>{salvando ? 'Excluindo…' : 'Excluir cliente'}</button></div>
    </dialog>
  </section>;
}
