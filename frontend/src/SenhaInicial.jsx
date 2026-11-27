import { useEffect, useState } from 'react';
import { consultarApi } from './api';

export default function SenhaInicial() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    document.title = 'Definir senha | Champions Barbearia';
    const controller = new AbortController();
    consultarApi('/auth/sessao', { signal: controller.signal }).then(({ usuario }) => {
      if (!usuario.deve_trocar_senha) window.location.replace('/painel');
      else setPronto(true);
    }).catch((error) => {
      if (error.name === 'AbortError') return;
      if (error.status === 401) window.location.replace('/login');
      else setErro(error.message);
    });
    return () => controller.abort();
  }, []);

  async function salvar(event) {
    event.preventDefault();
    if (salvando) return;
    const dados = new FormData(event.currentTarget);
    if (dados.get('senha') !== dados.get('confirmacao')) { setErro('As senhas não coincidem.'); return; }
    setSalvando(true); setErro('');
    try {
      await consultarApi('/auth/senha-inicial', { dados: { senha: dados.get('senha'), confirmacao: dados.get('confirmacao') } });
      window.location.replace('/login?senha=alterada');
    } catch (error) { if (error.status === 401) window.location.replace('/login'); else setErro(error.message); }
    finally { setSalvando(false); }
  }

  async function sair() {
    setSalvando(true);
    try { await consultarApi('/auth/logout', { dados: {} }); window.location.replace('/login'); }
    catch (error) { setErro(error.message); setSalvando(false); }
  }

  return <main className="senha-inicial-pagina"><section className="senha-inicial-cartao">
    <a className="marca" href="/">CHAMPIONS<small>BARBEARIA</small></a>
    <p className="etiqueta">PRIMEIRO ACESSO</p><h1>Defina sua senha.</h1>
    <p>Escolha uma senha pessoal para continuar. Ela deve ter pelo menos 8 caracteres e ser diferente do seu telefone.</p>
    {erro && <p className="erro-formulario" role="alert">{erro}</p>}
    {pronto ? <form className="formulario-login" onSubmit={salvar} aria-busy={salvando}>
      <div className="campo-login"><label htmlFor="nova-senha">Nova senha</label><input id="nova-senha" name="senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required disabled={salvando} autoFocus /></div>
      <div className="campo-login"><label htmlFor="confirmacao-senha">Confirme a nova senha</label><input id="confirmacao-senha" name="confirmacao" type={mostrar ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required disabled={salvando} /></div>
      <label className="senha-inicial-mostrar"><input type="checkbox" checked={mostrar} onChange={(event) => setMostrar(event.target.checked)} />Mostrar senhas</label>
      <button className="botao login-enviar" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar nova senha'}</button>
      <button type="button" className="senha-inicial-sair" disabled={salvando} onClick={sair}>Sair da conta</button>
    </form> : !erro && <p role="status">Carregando sua conta…</p>}
  </section></main>;
}
