export async function consultarApi(caminho, { dados, signal, metodo } = {}) {
  let resposta;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo || (dados === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      signal,
      headers: dados === undefined ? {} : {
        'Content-Type': 'application/json',
        'X-Requested-With': 'ChampionsBarber',
      },
      body: dados === undefined ? undefined : JSON.stringify(dados),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar. Tente novamente.');
  }

  if (resposta.status === 204) return null;
  const conteudo = await resposta.json().catch(() => null);
  if (!resposta.ok || !conteudo) {
    const error = new Error(conteudo?.mensagem || 'Não foi possível concluir. Tente novamente.');
    error.status = resposta.status;
    throw error;
  }
  return conteudo;
}
