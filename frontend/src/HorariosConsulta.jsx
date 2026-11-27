import { useState } from 'react';

const semana = [1, 2, 3, 4, 5, 6, 0];
const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function Semana({ periodos, profissional = false }) {
  return <dl className="semana-horarios">
    {semana.map((dia) => {
      const horarios = periodos.filter((item) => item.dia_semana === dia).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
      return <div className={horarios.length ? '' : 'semana-sem-horario'} key={dia}>
        <dt>{dias[dia]}</dt>
        <dd>{horarios.length ? horarios.map((item) => <span className="horario-faixa" key={`${item.hora_inicio}-${item.hora_fim}`}><time>{item.hora_inicio}</time><span aria-label="até">–</span><time>{item.hora_fim}</time></span>) : <span className="horario-fechado">{profissional ? 'Sem jornada' : 'Fechado'}</span>}</dd>
      </div>;
    })}
  </dl>;
}

export default function HorariosConsulta({ horarios, profissionais }) {
  const [aba, setAba] = useState('barbearia');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const normalizar = (valor) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const equipe = new Map(profissionais.map((item) => [item.cd_profissional, { ...item, jornadas: [] }]));
  for (const jornada of horarios.jornadas) {
    if (!equipe.has(jornada.cd_profissional)) equipe.set(jornada.cd_profissional, { cd_profissional: jornada.cd_profissional, nome: jornada.profissional.nome, jornadas: [] });
    equipe.get(jornada.cd_profissional).jornadas.push(jornada);
  }
  const encontrados = [...equipe.values()].filter((item) => normalizar(item.nome).includes(normalizar(busca.trim()))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const paginas = Math.max(1, Math.ceil(encontrados.length / 8));
  const paginaAtual = Math.min(pagina, paginas);
  const exibidos = encontrados.slice((paginaAtual - 1) * 8, paginaAtual * 8);

  return <div className="horarios-consulta">
    <div className="horarios-abas" role="group" aria-label="Consultar horários">
      <button type="button" aria-pressed={aba === 'barbearia'} onClick={() => setAba('barbearia')}>Barbearia</button>
      <button type="button" aria-pressed={aba === 'equipe'} onClick={() => setAba('equipe')}>Profissionais <span>{equipe.size}</span></button>
    </div>
    {aba === 'barbearia' ? <section aria-labelledby="titulo-semana">
      <div className="horarios-secao-titulo"><div><h3 id="titulo-semana">Semana de funcionamento</h3><p>Todos os períodos do dia, no mesmo lugar.</p></div><span className="horarios-legenda">Horário local</span></div>
      <Semana periodos={horarios.funcionamento} />
    </section> : <section aria-labelledby="titulo-equipe">
      <div className="horarios-secao-titulo"><div><h3 id="titulo-equipe">Jornadas da equipe</h3><p>Selecione um profissional para consultar a semana.</p></div></div>
      <label className="horarios-busca">Buscar profissional<input type="search" placeholder="Digite o nome do profissional" value={busca} onChange={(event) => { setBusca(event.target.value); setPagina(1); }} /></label>
      <p className="horarios-resultado" role="status">{encontrados.length} {encontrados.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}</p>
      <div className="horarios-equipe">
        {exibidos.map((item) => {
          const quantidadeDias = new Set(item.jornadas.map((jornada) => jornada.dia_semana)).size;
          return <details className="horarios-profissional" key={item.cd_profissional}>
            <summary><span className="horarios-inicial" aria-hidden="true">{item.nome.trim().slice(0, 1).toUpperCase()}</span><span className="horarios-pessoa"><strong>{item.nome}</strong><span>{quantidadeDias ? `${quantidadeDias} ${quantidadeDias === 1 ? 'dia com jornada' : 'dias com jornada'}` : 'Jornada não cadastrada'}</span></span><span className="horarios-ver">Ver semana</span><svg className="horarios-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
            <div className="horarios-profissional-semana"><Semana periodos={item.jornadas} profissional /></div>
          </details>;
        })}
      </div>
      {!encontrados.length && <p className="horarios-vazio">{busca ? 'Nenhum profissional com esse nome. Tente outra busca.' : 'Nenhum profissional cadastrado.'}</p>}
      {paginas > 1 && <div className="horarios-paginacao"><button type="button" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button><span>Página {paginaAtual} de {paginas}</span><button type="button" disabled={paginaAtual === paginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button></div>}
    </section>}
  </div>;
}
