import { useEffect, useState } from 'react';
import Seta from './Seta';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function App() {
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function carregarServicos() {
      setCarregando(true);
      setErro('');
      try {
        const resposta = await fetch('/api/servicos', { signal: controller.signal });
        if (!resposta.ok) throw new Error('Falha na consulta');
        const dados = await resposta.json();
        if (!Array.isArray(dados)) throw new Error('Resposta inválida');
        setServicos(dados);
      } catch (error) {
        if (error.name !== 'AbortError') setErro('Não foi possível carregar os serviços.');
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }

    carregarServicos();
    return () => controller.abort();
  }, [tentativa]);

  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <header className="cabecalho">
        <div className="container navegacao">
          <a className="marca" href="#inicio" aria-label="Champions Barbearia, início">
            <span className="simbolo" aria-hidden="true">C<span>★</span></span>
            <span>CHAMPIONS<small>BARBEARIA</small></span>
          </a>
          <nav aria-label="Navegação principal">
            <a href="#inicio">Início</a>
            <a href="#servicos">Serviços</a>
            <a className="botao pequeno" href="#servicos">Conhecer serviços <Seta /></a>
            <a className="botao-entrar" href="/login">Entrar</a>
          </nav>
        </div>
      </header>

      <main id="conteudo">
        <section id="inicio" className="hero" aria-labelledby="titulo">
          <div className="container hero-conteudo">
            <p className="etiqueta">ESTILO. PERSONALIDADE. CHAMPIONS.</p>
            <h1 id="titulo">Seu estilo merece<br />um corte de <em>campeão.</em></h1>
            <p className="introducao">Um novo corte. Uma nova atitude.<br />Encontre o serviço que combina com você.</p>
            <a className="botao" href="#servicos">Explore nossos serviços <Seta /></a>
            <div className="hero-rodape"><span>CHAMPIONS BARBEARIA</span><a href="#servicos">Conheça a experiência <Seta direcao="baixo" /></a></div>
          </div>
        </section>

        <section id="servicos" className="secao-servicos" aria-labelledby="titulo-servicos">
          <div className="container">
            <div className="titulo-secao">
              <div><p className="etiqueta">O PRÓXIMO PASSO DO SEU ESTILO</p><h2 id="titulo-servicos">Nossos serviços<span>.</span></h2></div>
              <p>Escolha seu cuidado.<br />Confira os preços e a duração de cada serviço.</p>
            </div>
            {carregando && <p className="aviso" role="status">Carregando serviços…</p>}
            {erro && <div className="aviso" role="alert"><p>{erro}</p><button className="botao" onClick={() => setTentativa(tentativa + 1)}>Tentar novamente</button></div>}
            {!carregando && !erro && servicos.length === 0 && <p className="aviso" role="status">Nenhum serviço cadastrado.</p>}
            {!carregando && !erro && servicos.length > 0 && (
              <div className="lista-servicos">
                {servicos.map((servico, index) => (
                  <article className="servico" key={servico.cd_servico}>
                    <span className="numero">{String(index + 1).padStart(2, '0')}</span>
                    <h3>{servico.nome}</h3>
                    {servico.descricao && <p>{servico.descricao}</p>}
                    <div className="detalhes"><span>{servico.duracao_minutos} min</span><strong>{moeda.format(Number(servico.preco))}</strong></div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="experiencia" aria-labelledby="titulo-experiencia">
          <div className="container experiencia-grid">
            <div><p className="etiqueta">DO SEU JEITO</p><h2 id="titulo-experiencia">Mais que um corte.<br /><em>Seu momento.</em></h2></div>
            <div className="manifesto"><p>Clássico ou moderno, discreto ou marcante. O estilo é seu.</p><p>Conheça o catálogo e encontre o cuidado que faz sentido para o seu próximo visual.</p><a href="#servicos" className="link-dourado">Explorar serviços <Seta direcao="cima" /></a></div>
          </div>
        </section>
      </main>

      <footer><div className="container rodape"><a className="marca" href="#inicio"><span>CHAMPIONS<small>BARBEARIA</small></span></a><p>Seu estilo. Sua identidade.</p><a className="voltar-inicio" href="#inicio">Voltar ao início <Seta direcao="cima" /></a></div></footer>
    </>
  );
}
