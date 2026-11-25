import { useEffect, useState } from 'react';
import { consultarApi } from './api';

export default function Cadastro() {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    document.title = 'Criar conta | Champions Barbearia';
  }, []);

  async function criarConta(event) {
    event.preventDefault();
    if (enviando) return;
    setErro('');
    const campos = event.currentTarget.elements;
    const numeros = campos.telefone.value.replace(/\D/g, '');
    const novosErros = {};

    if (campos.nome.value.trim().length < 3) novosErros.nome = 'Informe seu nome completo.';
    if (numeros.length < 10 || numeros.length > 15) novosErros.telefone = 'Informe um telefone válido com DDD.';
    if (campos.senha.value !== campos.confirmarSenha.value) novosErros.confirmarSenha = 'As senhas precisam ser iguais.';

    setErros(novosErros);
    const primeiroErro = Object.keys(novosErros)[0];
    if (primeiroErro) {
      campos[primeiroErro].focus();
      return;
    }

    const formulario = event.currentTarget;
    const dados = { nome: campos.nome.value, telefone: campos.telefone.value, email: campos.email.value, senha: campos.senha.value };
    setEnviando(true);
    try {
      const resposta = await consultarApi('/auth/cadastro', { dados });
      formulario.reset();
      setMostrarSenha(false);
      setMensagem(resposta.mensagem);
    } catch (error) {
      setErro(error.message);
    } finally {
      setEnviando(false);
    }
  }

  function limparErro(event) {
    const campo = event.target.name;
    setErro('');
    setErros((atuais) => ({ ...atuais, [campo]: '', ...(campo === 'senha' ? { confirmarSenha: '' } : {}) }));

  }

  return (
    <div className="pagina-login pagina-cadastro">
      <a className="pular" href="#formulario-cadastro">Pular para o formulário</a>
      <aside className="login-apresentacao" aria-label="Champions Barbearia">
        <a className="marca" href="/" aria-label="Champions Barbearia, início">
          <span className="simbolo" aria-hidden="true">C<span>★</span></span>
          <span>CHAMPIONS<small>BARBEARIA</small></span>
        </a>
        <div className="login-chamada">
          <p className="etiqueta">SEU ESTILO. SUA IDENTIDADE.</p>
          <h2>Seu espaço<br /><em>na Champions.</em></h2>
          <p>Uma conta para acompanhar seus agendamentos e cuidar do seu próximo visual.</p>
        </div>
        <span className="login-assinatura">CHAMPIONS BARBEARIA</span>
      </aside>

      <main className="login-principal" id="formulario-cadastro">
        <a className="login-voltar" href="/login">Voltar para entrar</a>
        <div className="login-conteudo">
          <p className="etiqueta">SUA CONTA CHAMPIONS</p>
          <h1>Crie sua conta<span>.</span></h1>
          <p className="login-descricao">Preencha seus dados para começar.<br />O e-mail é opcional.</p>

          {mensagem ? <div className="cadastro-recebido" role="status"><h2>{mensagem}</h2><a href="/login">Ir para entrar</a></div> : (
          <form className="formulario-login" onSubmit={criarConta} onChange={limparErro} aria-busy={enviando}>
            <div className="campo-login">
              <label htmlFor="nome">Nome completo</label>
              <input id="nome" name="nome" autoComplete="name" placeholder="Seu nome completo" minLength={3} maxLength={150} required aria-invalid={Boolean(erros.nome)} aria-describedby={erros.nome ? 'erro-nome' : undefined} />
              {erros.nome && <p className="erro-campo" id="erro-nome" role="alert">{erros.nome}</p>}
            </div>

            <div className="campo-login">
              <label htmlFor="telefone">Telefone com DDD</label>
              <input id="telefone" name="telefone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" maxLength={24} required aria-invalid={Boolean(erros.telefone)} aria-describedby={erros.telefone ? 'erro-telefone telefone-ajuda' : 'telefone-ajuda'} />
              <p className="campo-ajuda" id="telefone-ajuda">Você usará este telefone para entrar na sua conta.</p>
              {erros.telefone && <p className="erro-campo" id="erro-telefone" role="alert">{erros.telefone}</p>}
            </div>

            <div className="campo-login">
              <label htmlFor="email">E-mail <span className="campo-opcional">(opcional)</span></label>
              <input id="email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" maxLength={254} />
            </div>

            <div className="campo-login">
              <label htmlFor="senha">Senha</label>
              <div className="campo-senha">
                <input id="senha" name="senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" placeholder="Crie uma senha" minLength={8} maxLength={128} required aria-describedby="senha-ajuda" />
                <button type="button" aria-controls="senha confirmarSenha" aria-pressed={mostrarSenha} onClick={() => setMostrarSenha(!mostrarSenha)}>
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}<span className="somente-leitor"> senhas</span>
                </button>
              </div>
              <p className="campo-ajuda" id="senha-ajuda">Use pelo menos 8 caracteres.</p>
            </div>

            <div className="campo-login">
              <label htmlFor="confirmarSenha">Confirmar senha</label>
              <input id="confirmarSenha" name="confirmarSenha" type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" placeholder="Digite sua senha novamente" minLength={8} maxLength={128} required aria-invalid={Boolean(erros.confirmarSenha)} aria-describedby={erros.confirmarSenha ? 'erro-confirmar-senha' : undefined} />
              {erros.confirmarSenha && <p className="erro-campo" id="erro-confirmar-senha" role="alert">{erros.confirmarSenha}</p>}
            </div>

            {erro && <p className="erro-formulario" role="alert">{erro}</p>}
            <button className="botao login-enviar" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Criar minha conta'}</button>

          </form>
          )}

          <div className="login-criar-conta">
            <p>Já tem uma conta?</p>
            <a href="/login">Entrar na minha conta</a>
          </div>
        </div>

      </main>
    </div>
  );
}
