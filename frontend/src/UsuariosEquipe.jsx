import { useEffect, useRef, useState } from 'react';
import { consultarApi } from './api';
import CampoTelefone from './CampoTelefone';

const capacidades = { pode_criar_agendamento: 'Criar agendamentos', pode_cancelar_agendamento: 'Cancelar agendamentos', pode_atualizar_status: 'Confirmar, concluir e registrar falta', pode_bloquear_agenda: 'Bloquear horários' };
const padrao = { papel: 'BARBEIRO', cd_profissional: '', nome: '', status: 'ATIVO', escopo_visualizacao_agenda: 'PROPRIOS', escopo_gestao_agenda: 'PROPRIOS', pode_criar_agendamento: true, pode_cancelar_agendamento: false, pode_atualizar_status: true, pode_bloquear_agenda: false };
const escopos = { SEM_ACESSO: 'Sem acesso', PROPRIOS: 'Somente própria agenda', GLOBAL: 'Agenda de toda a equipe' };

export default function UsuariosEquipe() {
  const [resultado, setResultado] = useState({ usuarios: [], total: 0, paginas: 1 });
  const [profissionais, setProfissionais] = useState([]);
  const [busca, setBusca] = useState('');
  const [consulta, setConsulta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [formulario, setFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [dados, setDados] = useState(padrao);
  const [erroFormulario, setErroFormulario] = useState('');
  const [salvando, setSalvando] = useState(false);
  const area = useRef(null);
  const botaoNovo = useRef(null);

  useEffect(() => {
    const controller = new AbortController(); setCarregando(true); setErro('');
    Promise.all([consultarApi(`/usuarios-equipe?busca=${encodeURIComponent(consulta)}&pagina=${pagina}`, { signal: controller.signal }), consultarApi('/usuarios-equipe/profissionais', { signal: controller.signal })])
      .then(([usuarios, equipe]) => { if (pagina > usuarios.paginas) setPagina(usuarios.paginas); else setResultado(usuarios); setProfissionais(equipe); })
      .catch((error) => { if (error.name !== 'AbortError') setErro(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [consulta, pagina, tentativa]);

  function abrir(usuario = null) {
    setEditando(usuario); setErroFormulario(''); setSucesso('');
    const vinculo = usuario?.papeis.find((item) => ['BARBEIRO', 'RECEPCAO'].includes(item.papel.codigo));
    setDados(vinculo ? { ...padrao, ...vinculo, papel: vinculo.papel.codigo, cd_profissional: usuario.profissional?.cd_profissional || '', nome: usuario.cliente?.nome_completo || '', status: usuario.status } : { ...padrao });
    setFormulario(true); requestAnimationFrame(() => area.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function fechar() { setFormulario(false); setEditando(null); botaoNovo.current?.focus(); }
  function alterar(campo, valor) { setDados((anteriores) => ({ ...anteriores, [campo]: valor })); }
  function mudarEscopo(campo, valor) {
    setDados((anteriores) => {
      const novos = { ...anteriores, [campo]: valor };
      const ordem = ['SEM_ACESSO', 'PROPRIOS', 'GLOBAL'];
      if (ordem.indexOf(novos.escopo_gestao_agenda) > ordem.indexOf(novos.escopo_visualizacao_agenda)) novos.escopo_gestao_agenda = novos.escopo_visualizacao_agenda;
      if (novos.escopo_gestao_agenda === 'SEM_ACESSO') for (const capacidade of Object.keys(capacidades)) novos[capacidade] = false;
      return novos;
    });
  }
  async function salvar(event) {
    event.preventDefault(); if (salvando) return;
    const campos = new FormData(event.currentTarget); setSalvando(true); setErroFormulario('');
    try {
      const resposta = await consultarApi(editando ? `/usuarios-equipe/${editando.cd_usuario}` : '/usuarios-equipe', { metodo: editando ? 'PATCH' : 'POST', dados: { ...dados, telefone: campos.get('telefone'), email: campos.get('email') } });
      setSucesso(editando ? 'Acesso e permissões atualizados. A pessoa deverá entrar novamente.' : resposta.conta_existente ? 'Conta existente vinculada à equipe. A senha anterior foi mantida.' : 'Acesso criado. Senha inicial: telefone com DDD, somente números. A troca é obrigatória no primeiro acesso.');
      fechar(); setTentativa((valor) => valor + 1);
    } catch (error) { setErroFormulario(error.message); }
    finally { setSalvando(false); }
  }
  const ordem = ['SEM_ACESSO', 'PROPRIOS', 'GLOBAL'];
  const opcoes = Object.entries(escopos).filter(([codigo]) => dados.papel !== 'RECEPCAO' || codigo !== 'PROPRIOS');

  return <section className="painel-cartao" aria-labelledby="titulo-usuarios"><div className="painel-modulo-cabecalho"><div><h2 id="titulo-usuarios">Acessos da equipe</h2><p>Defina quem entra no painel e o que pode fazer na agenda.</p></div><button ref={botaoNovo} className="botao" type="button" disabled={salvando} onClick={() => abrir()}>Novo acesso</button></div>
    {sucesso && <p className="clientes-sucesso" role="status">{sucesso}</p>}
    {formulario && <form className="servico-formulario" ref={area} key={editando?.cd_usuario || 'novo'} onSubmit={salvar}>
      <h3>{editando ? 'Editar acesso' : 'Novo acesso à equipe'}</h3>
      <fieldset className="agendamento-campos" disabled={salvando}>
        <label>Perfil<select value={dados.papel} onChange={(event) => setDados((anteriores) => ({ ...anteriores, papel: event.target.value, escopo_visualizacao_agenda: event.target.value === 'RECEPCAO' ? 'GLOBAL' : 'PROPRIOS', escopo_gestao_agenda: event.target.value === 'RECEPCAO' ? 'GLOBAL' : 'PROPRIOS' }))}><option value="BARBEIRO">Barbeiro</option><option value="RECEPCAO">Recepção</option></select></label>
        {dados.papel === 'BARBEIRO' ? <label>Profissional<select value={dados.cd_profissional} required onChange={(event) => alterar('cd_profissional', event.target.value)} autoFocus><option value="">Selecione o profissional cadastrado</option>{profissionais.filter((item) => !item.cd_usuario || item.cd_usuario === editando?.cd_usuario).map((item) => <option key={item.cd_profissional} value={item.cd_profissional}>{item.nome}</option>)}</select></label> : <label>Nome completo<input value={dados.nome} required minLength={3} maxLength={150} onChange={(event) => alterar('nome', event.target.value)} /></label>}
        {!editando ? <><label>Telefone com DDD<CampoTelefone name="telefone" required autoComplete="off" placeholder="(63) 99999-9999" /></label><label>E-mail (opcional)<input name="email" type="email" maxLength={254} /></label><p className="campo-ajuda">Contas novas usam o telefone com DDD como senha inicial. Se a pessoa já tiver uma conta de cliente, sua senha será mantida.</p></> : <p>Telefone de acesso: <strong>{editando.telefone}</strong></p>}
        <label>Situação<select value={dados.status} onChange={(event) => alterar('status', event.target.value)}><option value="ATIVO">Acesso ativo</option><option value="INATIVO">Acesso desativado</option></select></label>
        <div className="equipe-escopos"><label>Pode consultar<select value={dados.escopo_visualizacao_agenda} onChange={(event) => mudarEscopo('escopo_visualizacao_agenda', event.target.value)}>{opcoes.map(([codigo, nome]) => <option key={codigo} value={codigo}>{nome}</option>)}</select></label><label>Pode gerenciar<select value={dados.escopo_gestao_agenda} onChange={(event) => mudarEscopo('escopo_gestao_agenda', event.target.value)}>{opcoes.filter(([codigo]) => ordem.indexOf(codigo) <= ordem.indexOf(dados.escopo_visualizacao_agenda)).map(([codigo, nome]) => <option key={codigo} value={codigo}>{nome}</option>)}</select></label></div>
        <fieldset className="profissional-servicos equipe-permissoes" disabled={dados.escopo_gestao_agenda === 'SEM_ACESSO'}><legend>Ações permitidas na agenda que pode gerenciar</legend>{Object.entries(capacidades).map(([campo, nome]) => <label key={campo}><input type="checkbox" checked={dados[campo]} onChange={(event) => alterar(campo, event.target.checked)} />{nome}</label>)}</fieldset>
      </fieldset>
      {erroFormulario && <p className="erro-formulario" role="alert">{erroFormulario}</p>}
      <div className="servico-acoes"><button className="botao" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar acesso'}</button><button type="button" disabled={salvando} onClick={fechar}>Cancelar</button></div>
    </form>}
    <form className="clientes-busca" role="search" onSubmit={(event) => { event.preventDefault(); setConsulta(busca.trim()); setPagina(1); setTentativa((valor) => valor + 1); }}><label htmlFor="busca-equipe">Buscar pessoa da equipe</label><div><input id="busca-equipe" type="search" placeholder="Nome ou telefone" value={busca} maxLength={150} onChange={(event) => setBusca(event.target.value)} /><button>Buscar</button>{(busca || consulta) && <button type="button" onClick={() => { setBusca(''); setConsulta(''); setPagina(1); }}>Limpar</button>}</div></form>
    {erro ? <div role="alert"><p className="erro-formulario">{erro}</p><button type="button" onClick={() => setTentativa((valor) => valor + 1)}>Tentar novamente</button></div> : carregando ? <p role="status">Consultando equipe…</p> : <><p className="horarios-resultado" role="status">{resultado.total} {resultado.total === 1 ? 'acesso encontrado' : 'acessos encontrados'}</p><div className="horarios-equipe">{resultado.usuarios.map((usuario) => {
      const administrador = usuario.papeis.some((item) => item.papel.codigo === 'ADMINISTRADOR');
      const vinculo = usuario.papeis.find((item) => ['BARBEIRO', 'RECEPCAO'].includes(item.papel.codigo));
      const nome = usuario.profissional?.nome || usuario.cliente?.nome_completo || usuario.telefone;
      return <details key={usuario.cd_usuario} className="horarios-profissional"><summary><span className="horarios-inicial" aria-hidden="true">{nome.slice(0, 1).toUpperCase()}</span><span className="horarios-pessoa"><strong>{nome}</strong><span>{administrador ? 'Administrador' : vinculo?.papel.codigo === 'BARBEIRO' ? 'Barbeiro' : 'Recepção'} · {usuario.status === 'ATIVO' ? 'Acesso ativo' : 'Acesso desativado'}</span></span><span className="horarios-ver">Ver acesso</span><span aria-hidden="true">⌄</span></summary><div className="equipe-detalhes"><p>Telefone: <strong>{usuario.telefone}</strong></p>{administrador ? <p>Conta administrativa protegida, com acesso completo ao sistema.</p> : <><p>Consulta: <strong>{escopos[vinculo?.escopo_visualizacao_agenda] || 'Sem acesso'}</strong><br />Gestão: <strong>{escopos[vinculo?.escopo_gestao_agenda] || 'Sem acesso'}</strong></p><div className="equipe-resumo-permissoes">{Object.entries(capacidades).filter(([campo]) => vinculo?.[campo]).map(([campo, descricao]) => <span key={campo}>{descricao}</span>)}</div><button className="botao" type="button" disabled={salvando} onClick={() => abrir(usuario)}>Editar acesso e permissões</button></>}</div></details>;
    })}</div>{!resultado.total && <p className="horarios-vazio">Nenhum acesso encontrado. Ajuste a busca ou crie um novo acesso.</p>}{resultado.paginas > 1 && <div className="horarios-paginacao"><button type="button" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>Página {pagina} de {resultado.paginas}</span><button type="button" disabled={pagina >= resultado.paginas} onClick={() => setPagina(pagina + 1)}>Próxima</button></div>}</>}
  </section>;
}
