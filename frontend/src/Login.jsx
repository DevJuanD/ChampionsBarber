import { useEffect, useState } from 'react';
import { consultarApi } from './api';
import CampoTelefone from './CampoTelefone';

export default function Login() {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroTelefone, setErroTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    document.title = 'Entrar | Champions Barbearia';
    const controller = new AbortController();
    consultarApi('/auth/sessao', { signal: controller.signal })
      .then(({ usuario }) => window.location.replace(usuario.deve_trocar_senha ? '/definir-senha' : '/painel'))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function entrar(event) {
    event.preventDefault();
    if (enviando) return;
    setErro('');

    const telefone = event.currentTarget.elements.telefone;
    const numeros = telefone.value.replace(/\D/g, '');

    if (![10, 11].includes(numeros.length)) {
      setErroTelefone('Informe um telefone válido com DDD.');
      telefone.focus();
      return;
    }

    setErroTelefone('');
    const senha = event.currentTarget.elements.senha.value;
    setEnviando(true);
    try {
      const { usuario } = await consultarApi('/auth/login', { dados: { telefone: telefone.value, senha } });
      window.location.assign(usuario.deve_trocar_senha ? '/definir-senha' : '/painel');
    } catch (error) {
      setErro(error.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pagina-login">
      <a className="pular" href="#formulario-login">Pular para o formulário</a>
      <aside className="login-apresentacao" aria-label="Champions Barbearia">
        <a className="marca" href="/" aria-label="Champions Barbearia, início">
          <span className="simbolo" aria-hidden="true">C<span>★</span></span>
          <span>CHAMPIONS<small>BARBEARIA</small></span>
        </a>
        <div className="login-chamada">
          <p className="etiqueta">SEU ESTILO. SUA IDENTIDADE.</p>
          <h2>Bom ter você<br /><em>por aqui.</em></h2>
          <p>O seu próximo momento na Champions começa com você.</p>
        </div>
        <span className="login-assinatura">CHAMPIONS BARBEARIA</span>
      </aside>

      <main className="login-principal" id="formulario-login">
        <a className="login-voltar" href="/">Voltar ao site</a>
        <div className="login-conteudo">
          <p className="etiqueta">SUA CONTA CHAMPIONS</p>
          <h1>Bem-vindo de volta<span>.</span></h1>
          <p className="login-descricao">Entre com seu telefone e senha.<br />Um só acesso para clientes e profissionais.</p>

          <form className="formulario-login" onSubmit={entrar} aria-busy={enviando} onChange={() => setErro('')}>
            {new URLSearchParams(window.location.search).get('senha') === 'alterada' && <p className="clientes-sucesso" role="status">Senha alterada. Entre com sua nova senha.</p>}
            <div className="campo-login">
              <label htmlFor="telefone">Telefone com DDD</label>
              <CampoTelefone
                id="telefone"
                name="telefone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="(00) 00000-0000"
                maxLength={24}
                required
                aria-invalid={Boolean(erroTelefone)}
                aria-describedby={erroTelefone ? 'erro-telefone' : undefined}
                onChange={() => setErroTelefone('')}
              />
              {erroTelefone && <p className="erro-campo" id="erro-telefone" role="alert">{erroTelefone}</p>}
            </div>

            <div className="campo-login">
              <label htmlFor="senha">Senha</label>
              <div className="campo-senha">
                <input
                  id="senha"
                  name="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  maxLength={128}
                  required

                />
                <button type="button" aria-controls="senha" aria-pressed={mostrarSenha} onClick={() => setMostrarSenha(!mostrarSenha)}>
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}<span className="somente-leitor"> senha</span>
                </button>
              </div>
            </div>

            <button className="login-recuperar" type="button" disabled>
              Esqueci minha senha
            </button>
            {erro && <p className="erro-formulario" role="alert">{erro}</p>}
            <button className="botao login-enviar" type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>

          </form>

          <div className="login-criar-conta">
            <p>Ainda não tem uma conta?</p>
            <a href="/cadastro">Criar minha conta</a>
          </div>

          <div className="login-visitante">
            <p>Quer apenas conhecer nossos serviços?</p>
            <a href="/#servicos">Continuar sem entrar</a>
          </div>
        </div>

      </main>
    </div>
  );
}
