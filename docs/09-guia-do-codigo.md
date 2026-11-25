# Guia para compreender os códigos

[Voltar ao índice](README.md)

Este guia usa trechos reduzidos e exemplos didáticos. Eles explicam a sintaxe;
as implementações completas devem ser consultadas nos arquivos indicados.

## Importar e exportar

Backend com CommonJS:

```js
const { servico } = require('../models');
module.exports = { listarServicos };
```

`require` carrega um módulo. As chaves extraem uma propriedade do objeto exportado,
o que se chama desestruturação. `../` sobe uma pasta; `./` começa na pasta atual.

Frontend com ES Modules:

```js
import Login from './Login';
import { useState } from 'react';
export default function Login() { /* componente */ }
```

O default é importado sem chaves. Exportações nomeadas, como useState, usam chaves.
Cada package.json define o sistema de módulos daquela parte do projeto.

## req, res e next

```js
async function cadastrar(req, res) {
  await auth.cadastrar(req.body || {});
  res.status(202).json({ mensagem: 'Solicitação de cadastro recebida.' });
}
```

`req` representa a requisição; `req.body` vem do parser JSON. `res` constrói a
resposta. `status(202)` define o código, e `json` serializa o objeto.
`req.body || {}` fornece objeto vazio quando não há corpo aproveitável.

Middlewares recebem `next`. `next()` continua a cadeia; `next(error)` vai para
tratamento de erro. Retornar uma resposta sem chamar next interrompe aquele fluxo.

## async e await

Consultas de banco e fetch são assíncronos. `await` aguarda a Promise concluir
sem transformar toda a aplicação em código síncrono.

```js
try {
  const dados = await consultarApi('/auth/sessao');
  setUsuario(dados.usuario);
} catch (error) {
  setErro(error.message);
}
```

try/catch trata sucesso e falha. finally executa limpeza nos dois casos, como
liberar estado de carregamento ou desconectar o Prisma em um script.

## useState

```js
const [erro, setErro] = useState('');
```

`erro` é o valor atual. `setErro` agenda uma atualização e uma nova renderização.
Não é uma coluna do banco: perder o documento da página perde esse estado em memória.

No login, `enviando` muda o texto para Entrando e desativa o botão enquanto há
requisição. Isso melhora feedback e evita envios repetidos pela interface.

## useEffect e cleanup

```js
useEffect(() => {
  const controller = new AbortController();
  // Iniciar consulta usando controller.signal.
  return () => controller.abort();
}, []);
```

O efeito executa uma interação fora da renderização, como consultar a API.
O array vazio indica que ele não depende de valores variáveis do componente.
`[tentativa]` faz repetir o efeito quando tentativa muda.
A função retornada faz cleanup ao desmontar ou antes de executar o efeito novamente.

## JSX e renderização condicional

```jsx
{erro && <p role="alert">{erro}</p>}
{carregando ? 'Entrando…' : 'Entrar'}
```

JSX descreve elementos da interface dentro de JavaScript. Chaves inserem expressões.
`&&` mostra o trecho se a condição for verdadeira; o ternário escolhe entre dois
valores. `className` é o nome da classe CSS no JSX.

```jsx
{servicos.map((servico) => <h3 key={servico.cd_servico}>{servico.nome}</h3>)}
```

map transforma cada item em um elemento. A key ajuda o React a identificar itens
entre renderizações; não é um campo adicional enviado ao backend.

## Eventos e formulário

`onSubmit` trata envio. `event.preventDefault()` evita que o navegador recarregue
a página pelo comportamento padrão do formulário. `event.currentTarget` é o
formulário cujo handler está executando; `elements.telefone.value` lê o input.

Capturar o formulário e os dados antes de await evita depender de currentTarget
depois que o evento terminou. `required`, minLength e type=email fazem validação
nativa no navegador; o servidor valida novamente porque uma API pode ser chamada
sem passar pela tela.

## Objetos, spread e valores opcionais

```js
const nome = usuario.cliente?.nome_completo || null;
const opcoes = { ...opcoesCookie, maxAge: duracao };
```

`?.` acessa uma propriedade apenas se o objeto existir. `||` usa alternativa para
valor falsy. `...` copia propriedades de um objeto; propriedades seguintes
podem sobrescrever as anteriores. Isso evita repetir as opções do cookie.

## findMany, findUnique e select

```js
await prisma.usuario.findUnique({
  where: { telefone },
  select: { cd_usuario: true, senha_hash: true },
});
```

findUnique busca por chave única e retorna objeto ou null. findMany retorna array.
select escolhe campos; include carrega relacionamentos. Não devolver automaticamente
uma entidade inteira ao navegador, pois ela pode conter hash de senha e outros campos privados.

## Transações

```js
await prisma.$transaction(async (tx) => {
  // Operações relacionadas devem usar tx, não a instância externa prisma.
});
```

Se o callback termina com sucesso, confirma as operações; se lança erro, reverte.
No cadastro, isso mantém conta, cliente e papel consistentes. Nos testes, um erro
sentinela proposital provoca rollback das fixtures.

Uma transação não resolve automaticamente toda condição de corrida. O login usa
trava de linha, e o administrador inicial usa trava consultiva. A futura agenda
precisará de estratégia específica para concorrência entre reservas.

## SQL com template literal

```js
await tx.$queryRaw`SELECT cd_usuario FROM usuario WHERE cd_usuario = ${id} FOR UPDATE`;
```

Nesse uso, o Prisma trata o valor interpolado como parâmetro da consulta.
Não confundir com montar strings SQL concatenando dados do usuário. O arquivo SQL
da auditoria é uma definição administrativa controlada, não entrada de formulário.

## Hash, cookie e sessão

Hash não é criptografia reversível. Argon2id protege senhas; SHA-256 identifica
tokens aleatórios de sessão no banco. O navegador recebe o token original em cookie
HttpOnly e o devolve automaticamente nas requisições adequadas.

Uma sessão válida não dá acesso universal. A operação também precisa da autorização
correta. Mostrar ou esconder um botão no React é apresentação; negar a operação no
backend é a verificação de segurança.

## Leitura prática sugerida

Comece pelo fluxo mais curto: App.jsx → servicoRoutes → servicoController → model
Servico. Depois siga Login.jsx → api.js → authRoutes → authController → authService.
Finalize com Painel.jsx → exigirSessao → autenticar. Assim você acompanha um clique
até a consulta SQL, o cookie e a resposta mostrada na tela.
