import { useEffect, useState } from 'react';
import { consultarApi } from './api';

const nomesPapeis = { ADMINISTRADOR: 'Administrador', BARBEIRO: 'Barbeiro', RECEPCAO: 'Recepção', CLIENTE: 'Cliente' };

export default function Painel() {
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState('');
  const [saindo, setSaindo] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    document.title = 'Minha conta | Champions Barbearia';
    const controller = new AbortController();
    setErro('');
    async function carregarSessao() {
      try {
        const resposta = await consultarApi('/auth/sessao', { signal: controller.signal });
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
    <div className="pagina-conta">
      <header className="cabecalho">
        <div className="container navegacao">
          <a className="marca" href="/"><span>CHAMPIONS<small>BARBEARIA</small></span></a>
          <a className="botao-entrar" href="/">Voltar ao site</a>
        </div>
      </header>
      <main className="container conta-conteudo">
        {erro && <div className="erro-formulario" role="alert"><p>{erro}</p>{!usuario && <button className="botao" onClick={() => setTentativa(tentativa + 1)}>Tentar novamente</button>}</div>}
        {!usuario && !erro && <p role="status">Carregando sua conta…</p>}
        {usuario && <>
          <p className="etiqueta">MINHA CONTA</p>
          <h1>Olá{usuario.nome ? `, ${usuario.nome}` : ''}<span>.</span></h1>
          <section className="conta-dados" aria-labelledby="titulo-dados">
            <h2 id="titulo-dados">Dados da conta</h2>
            <dl>
              <div><dt>Telefone</dt><dd>{usuario.telefone}</dd></div>
              {usuario.email && <div><dt>E-mail</dt><dd>{usuario.email}</dd></div>}
              <div><dt>Perfil de acesso</dt><dd>{usuario.papeis.map((papel) => nomesPapeis[papel] || papel).join(', ') || 'Sem papel atribuído'}</dd></div>
            </dl>
          </section>
          <button className="botao" type="button" disabled={saindo} onClick={sair}>{saindo ? 'Saindo…' : 'Sair da conta'}</button>
        </>}
      </main>
    </div>
  );
}
