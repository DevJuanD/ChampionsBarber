import { useEffect, useState } from 'react';
import { consultarApi } from './api';
import IconePainel from './IconePainel';
import ServicosPainel from './ServicosPainel';
import ProfissionaisPainel from './ProfissionaisPainel';
import HorariosPainel from './HorariosPainel';
import ClientesPainel from './ClientesPainel';
import AgendamentosCliente from './AgendamentosCliente';
import AgendaEquipe from './AgendaEquipe';
import UsuariosEquipe from './UsuariosEquipe';
import BloqueiosPainel from './BloqueiosPainel';
import { modulosPermitidos, nomesPapeis } from './painelConfig';

function DadosConta({ usuario }) {
  return (
    <section className="painel-cartao" aria-labelledby="titulo-dados">
      <div className="painel-cartao-titulo"><IconePainel nome="conta" /><h2 id="titulo-dados">Dados da conta</h2></div>
      <dl className="painel-dados">
        <div><dt>Nome</dt><dd>{usuario.nome || 'Não informado'}</dd></div>
        <div><dt>Telefone</dt><dd>{usuario.telefone}</dd></div>
        <div><dt>E-mail</dt><dd>{usuario.email || 'Não informado'}</dd></div>
        <div><dt>Perfis de acesso</dt><dd>{usuario.papeis.map((papel) => nomesPapeis[papel] || papel).join(', ') || 'Sem papel atribuído'}</dd></div>
      </dl>
    </section>
  );
}

function EstruturaModulo({ modulo }) {
  return (
    <section className="painel-cartao painel-modulo" aria-labelledby="titulo-modulo">
      <div className="painel-modulo-cabecalho">
        <div><h2 id="titulo-modulo">{modulo.titulo}</h2><p>{modulo.descricao}</p></div>
        {modulo.acao && <button className="botao" type="button" disabled>{modulo.acao}</button>}
      </div>
      <div className="painel-escopo">
        {modulo.campos.map((campo) => <div key={campo}><span>{campo}</span><div className="painel-linha-modelo" aria-hidden="true" /></div>)}
      </div>
    </section>
  );
}

export default function Painel() {
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState('');
  const [saindo, setSaindo] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setErro('');
    async function carregarSessao() {
      try {
        const resposta = await consultarApi('/auth/sessao', { signal: controller.signal });
        if (resposta.usuario.deve_trocar_senha) { window.location.replace('/definir-senha'); return; }
        setUsuario(resposta.usuario);
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (error.status === 401) window.location.replace('/login');
        else setErro(error.message);
      }
    }
    carregarSessao();
    return () => controller.abort();
  }, [tentativa]);

  const modulos = usuario ? modulosPermitidos(usuario) : [];
  const secao = new URLSearchParams(window.location.search).get('secao') || 'inicio';
  const modulo = modulos.find((item) => item.id === secao) || modulos[0];
  const administrador = usuario?.papeis.includes('ADMINISTRADOR');
  const perfil = administrador ? 'Administrador' : usuario?.papeis.map((papel) => nomesPapeis[papel] || papel).join(' · ') || 'Minha conta';
  const iniciais = (usuario?.nome || 'Champions Barber').trim().split(/\s+/).slice(0, 2).map((nome) => nome[0]).join('').toUpperCase();
  const grupos = [...new Set(modulos.map((item) => item.grupo))];

  useEffect(() => {
    document.title = `${modulo?.titulo || 'Painel'} | Champions Barbearia`;
  }, [modulo?.titulo]);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setErro('');
    try {
      await consultarApi('/auth/logout', { dados: {} });
      window.location.replace('/login');
    } catch (error) {
      setErro(error.message);
      setSaindo(false);
    }
  }

  return (
    <div className="painel-layout">
      <a className="pular" href="#painel-conteudo">Pular para o conteúdo</a>
      <aside className={`painel-menu ${menuAberto ? 'menu-aberto' : ''}`}>
        <div className="painel-marca-linha">
          <a className="marca" href="/painel"><span className="simbolo" aria-hidden="true">C<span>★</span></span><span>CHAMPIONS<small>BARBEARIA</small></span></a>
          <button className="painel-toggle" type="button" aria-controls="painel-navegacao" aria-expanded={menuAberto} onClick={() => setMenuAberto(!menuAberto)}><IconePainel nome="menu" /><span>{menuAberto ? 'Fechar' : 'Menu'}</span></button>
        </div>
        <div className="painel-menu-conteudo" id="painel-navegacao">
          <p className="painel-identificacao">{administrador ? 'GESTÃO DA BARBEARIA' : 'SEU ESPAÇO CHAMPIONS'}</p>
          <nav className="painel-nav" aria-label="Navegação do painel">
            {grupos.map((grupo) => <div className="painel-grupo" key={grupo}>
              <p>{grupo}</p>
              {modulos.filter((item) => item.grupo === grupo).map((item) => (
                <a key={item.id} href={`/painel?secao=${item.id}`} aria-current={modulo?.id === item.id ? 'page' : undefined}>
                  <IconePainel nome={item.icone} /><span>{item.titulo}</span>
                </a>
              ))}
            </div>)}
          </nav>
          <div className="painel-menu-rodape">
            <a href="/"><IconePainel nome="site" /><span>Ver site público</span></a>
            <button type="button" disabled={!usuario || saindo} onClick={sair}><IconePainel nome="sair" /><span>{saindo ? 'Saindo…' : 'Sair da conta'}</span></button>
          </div>
        </div>
      </aside>

      <div className="painel-area">
        <header className="painel-topo">
          <div><span className="painel-caminho">{administrador ? 'Painel administrativo' : 'Painel da conta'}</span><p>{modulo?.titulo || 'Acesso à conta'}</p></div>
          {usuario && <a className="painel-perfil" href="/painel?secao=conta"><span className="painel-avatar" aria-hidden="true">{iniciais}</span><span><strong>{usuario.nome || 'Minha conta'}</strong><small>{perfil}</small></span></a>}
        </header>

        <main className="painel-conteudo" id="painel-conteudo">
          {erro && <div className="erro-formulario" role="alert"><p>{erro}</p>{!usuario && <button className="botao" onClick={() => setTentativa(tentativa + 1)}>Tentar novamente</button>}</div>}
          {!usuario && !erro && <p role="status">Carregando seu painel…</p>}
          {usuario && modulo && <>
            <div className="painel-pagina-titulo"><p>{modulo.id === 'inicio' ? 'BEM-VINDO À CHAMPIONS' : modulo.grupo}</p><h1>{modulo.id === 'inicio' ? `Olá${usuario.nome ? `, ${usuario.nome.split(' ')[0]}` : ''}.` : modulo.titulo}</h1><span>{modulo.id === 'inicio' ? 'Seu espaço para acompanhar a barbearia e organizar o dia.' : modulo.id === 'conta' ? 'Suas informações e seu perfil de acesso.' : modulo.descricao}</span></div>

            {modulo.id === 'inicio' && <>
              {!administrador && usuario.papeis.includes('CLIENTE') && <div className="cliente-convite-agendar"><div><strong>Seu próximo atendimento começa aqui.</strong><p>Escolha o serviço e reserve um horário na Champions.</p></div><a className="botao" href="/painel?secao=agendamentos">Agendar horário<IconePainel nome="agenda" /></a></div>}
              <div className="painel-resumo">
                <section><span className="painel-resumo-icone"><IconePainel nome="conta" /></span><div><p>Perfil de acesso</p><strong>{perfil}</strong></div></section>
                <section><span className="painel-resumo-icone"><IconePainel nome="usuarios" /></span><div><p>Situação da conta</p><strong>{usuario.status === 'ATIVO' ? 'Ativa' : usuario.status}</strong></div></section>
                <section><span className="painel-resumo-icone"><IconePainel nome="site" /></span><div><p>Portal Champions</p><a href="/">Acessar site público</a></div></section>
              </div>
              <section className="painel-cartao" aria-labelledby="titulo-atalhos">
                <div className="painel-cartao-titulo"><h2 id="titulo-atalhos">Acesso rápido</h2><span>Escolha uma área para continuar</span></div>
                <div className="painel-atalhos">
                  {modulos.filter((item) => ['agenda', 'agendamentos', 'usuarios', 'servicos', 'profissionais', 'conta'].includes(item.id)).map((item) => (
                    <a href={`/painel?secao=${item.id}`} key={item.id}><IconePainel nome={item.icone} /><strong>{item.titulo}</strong><span>{item.descricao || 'Informações e perfil da sua conta.'}</span></a>
                  ))}
                </div>
              </section>
            </>}
            {modulo.id === 'conta' && <><DadosConta usuario={usuario} /><button className="painel-botao-sair" type="button" disabled={saindo} onClick={sair}><IconePainel nome="sair" />{saindo ? 'Saindo…' : 'Sair da conta'}</button></>}
            {modulo.id === 'servicos' && <ServicosPainel />}
            {modulo.id === 'profissionais' && <ProfissionaisPainel />}
            {modulo.id === 'horarios' && <HorariosPainel />}
            {modulo.id === 'clientes' && <ClientesPainel />}
            {modulo.id === 'agendamentos' && <AgendamentosCliente />}
            {modulo.id === 'agenda' && <AgendaEquipe usuario={usuario} />}
            {modulo.id === 'usuarios' && <UsuariosEquipe />}
            {modulo.id === 'bloqueios' && <BloqueiosPainel usuario={usuario} />}
            {!['inicio', 'conta', 'servicos', 'profissionais', 'horarios', 'clientes', 'agendamentos', 'agenda', 'usuarios', 'bloqueios'].includes(modulo.id) && <EstruturaModulo modulo={modulo} />}
          </>}
        </main>
        <footer className="painel-rodape"><span>Champions Barbearia</span><span>Seu estilo. Sua identidade.</span></footer>
      </div>
    </div>
  );
}
