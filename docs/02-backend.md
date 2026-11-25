# Backend explicado por arquivo

[Voltar ao índice](README.md)

## Fluxo de uma requisição

```text
Requisição HTTP
  → server.js
  → middleware e rota
  → controller
  → service, quando houver regra de negócio
  → Prisma Client
  → PostgreSQL
  → resposta JSON
```

O backend usa CommonJS: `require()` importa e `module.exports` exporta. Ele roda
no Node.js e tem acesso ao banco. Esses arquivos não devem ser enviados como código
de navegador junto com o frontend.

## src/server.js

É a entrada da API. A ordem do código importa:

1. `dotenv.config()` carrega o `.env` antes de importar módulos que usam configuração.
2. Importa Express, cookie-parser e os routers.
3. `express()` cria a aplicação.
4. Desativa `X-Powered-By`, evitando expor esse cabeçalho de identificação.
5. `express.json({ limit: '16kb' })` interpreta JSON e limita o tamanho do corpo.
6. `cookieParser()` disponibiliza cookies em `req.cookies`.
7. Registra `/api/auth` e `/api/servicos`.
8. Registra o tratamento central de erros.
9. Quando executado diretamente, inicia o servidor em `PORT` ou 3000.

```js
app.use('/api/servicos', servicoRoutes);
```

Essa linha não executa uma consulta. Ela encaminha requisições desse prefixo ao
router de serviços. Uma rota `/` dentro do router vira `/api/servicos` no endereço final.

O middleware de erros possui quatro parâmetros: `(error, req, res, next)`. JSON
inválido recebe mensagem específica; erros internos recebem mensagem genérica.
Se uma resposta já começou, o erro é repassado com `next(error)`.

`require.main === module` distingue execução direta de importação. Nos testes,
podemos importar `app` e iniciar uma porta temporária sem abrir automaticamente a 3000.
`module.exports = app` é o que permite isso.

O servidor valida o intervalo da porta e trata falhas de inicialização. A mensagem
`localhost` no console é informativa; não define um domínio público de hospedagem.
Ainda não há shutdown coordenado do servidor e do Prisma.

## src/config/prisma.js

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
```

Cria uma instância compartilhada do client. Os demais arquivos a reutilizam,
evitando criar uma instância por requisição. Criar o objeto não comprova que o
banco está acessível: a comunicação é exercitada pelas consultas.

## src/config/auth.js

Centraliza nome e opções do cookie. `NODE_ENV === 'production'` ativa `Secure` e
o prefixo `__Host-`. Tanto gravar quanto remover o cookie usam as mesmas opções
de caminho e segurança. Os detalhes estão no [guia de autenticação](05-autenticacao.md).

## src/models/index.js

Exporta `prisma` e os delegates, por exemplo `servico: prisma.servico` e
`usuario: prisma.usuario`. Um delegate é o objeto que fornece operações como
`findMany`, `findUnique`, `create`, `update` e `updateMany` para uma model.

As definições de campo, relacionamento e tipo não ficam nesse arquivo. Elas estão
no `prisma/schema.prisma`. O index é uma conveniência de importação.

## src/routes/servicoRoutes.js

Cria `express.Router()`, associa `GET /` a `listarServicos` e exporta o router.
É uma consulta pública: nenhum middleware de sessão é aplicado nessa rota.

## src/controllers/servicoController.js

`listarServicos(req, res)` consulta os serviços com `ativo: true`.

```js
const servicos = await servico.findMany({
  where: { ativo: true },
  select: {
    cd_servico: true,
    nome: true,
    descricao: true,
    preco: true,
    duracao_minutos: true,
  },
  orderBy: [{ nome: 'asc' }, { cd_servico: 'asc' }],
});
```

`where` filtra, `select` limita campos e `orderBy` ordena. O ID desempata nomes
iguais para tornar a ordem previsível. Sem resultados, retorna `[]` com status 200;
não é um erro. Se a consulta falha, retorna 500 com uma mensagem genérica.

Não existe service de serviços porque a operação atual é simples. Um CRUD com
validações e auditoria poderá justificar um service próprio.

## src/routes/authRoutes.js

Define as cinco rotas de autenticação e aplica `Cache-Control: no-store` para
evitar cache das respostas sensíveis. `protegerEscrita` verifica as operações POST.

| Limitador | Aplicação | Limite atual |
| --- | --- | --- |
| `limiteLogin` | Login por IP | 20 requisições em 15 minutos |
| `limiteTelefone` | Login por chave derivada do telefone | 10 requisições em 15 minutos |
| `limiteCadastro` | Cadastro por IP | 5 requisições em 60 minutos |

Os limites contam requisições que chegam aos respectivos middlewares, não apenas
senhas erradas. A chave por telefone remove formatação e o prefixo brasileiro
quando aplicável e usa SHA-256 para não guardar o número diretamente como chave.
Isso não substitui a normalização oficial feita no service.

Os contadores ficam em memória: reiniciar a API zera o estado. Uma implantação
com várias instâncias precisará de armazenamento compartilhado.

## src/controllers/authController.js

O controller cria uma instância do service e adapta seus resultados:

| Função | Responsabilidade HTTP |
| --- | --- |
| `cadastrar` | Passa o corpo ao service e responde 202 com mensagem genérica. |
| `entrar` | Recebe token/usuário do service, grava token em cookie e devolve usuário/expiração em JSON. |
| `consultarSessao` | Devolve `req.usuario`, já validado pelo middleware. |
| `sair` | Revoga a sessão do cookie, remove o cookie e responde 204. |
| `sairDeTodos` | Revoga as sessões da conta autenticada e remove o cookie atual. |

O token original não é enviado no JSON do login. Os erros assíncronos são
encaminhados pelo Express 5 ao tratamento central de `server.js`.

## src/middlewares/authMiddleware.js

`exigirSessao` lê o cookie, pede ao service para validá-lo e coloca o usuário seguro
em `req.usuario`. Se a sessão é inválida, limpa o cookie e repassa o erro 401.

`exigirPapel(...papeis)` exige sessão previamente carregada e pelo menos um dos
papéis informados. Sem usuário, devolve 401; sem papel aceito, 403.

```js
// Exemplo de uma FUTURA rota, ainda não existente:
router.get('/usuarios', exigirSessao, exigirPapel('ADMINISTRADOR'), listarUsuarios);
```

Não basta copiar esse exemplo para autorizar alterações de agenda. Nessas operações
também devem ser verificadas capacidades e se o profissional pertence ao escopo.

`protegerEscrita` ignora GET/HEAD/OPTIONS; em escrita exige cabeçalho próprio,
JSON e origem permitida quando `Origin` está presente. Rejeita `Sec-Fetch-Site:
cross-site`. Hoje está aplicado ao router de autenticação, não globalmente a todas
as futuras rotas. Uma nova rota de escrita deve aplicar a proteção explicitamente.

## src/services/authService.js

Este arquivo contém a lógica principal. A explicação dos fluxos está no
[guia de autenticação](05-autenticacao.md).

| Elemento | O que faz |
| --- | --- |
| `DURACAO_SESSAO_MS` | Duração absoluta de sete dias em milissegundos. |
| `opcoesSenha` | Parâmetros do Argon2id. |
| `senhaSimulada` | Hash aleatório reaproveitado para verificar senha quando o telefone não existe. |
| `erroAuth` | Cria `Error` com status HTTP conhecido. |
| `normalizarTelefone` | Valida tipo/formato e converte para telefone internacional com `+`. |
| `validarSenha` | Verifica tipo e comprimento sem remover espaços da senha. |
| `hashToken` | Converte token em SHA-256 hexadecimal. |
| `camposUsuario` | Define os dados e relacionamentos necessários para sessão e autorização. |
| `capacidades` | Lista as cinco concessões operacionais de agenda. |
| `usuarioPublico` | Constrói resposta sem hash de senha e calcula permissões efetivas. |
| `contaAtiva` | Exige status ATIVO e telefone verificado. |
| `criarAuthService(db)` | Retorna métodos `cadastrar`, `entrar`, `autenticar`, `sair` e `sairDeTodos`. |

O parâmetro `db` tem Prisma como valor padrão. Nos testes de integração recebe
delegates ligados a uma transação para permitir rollback ao final.

## src/services/adminInicialService.js

Contém `criarAdminInicial`. Valida nome, telefone e senha administrativa, protege a
senha e faz o provisionamento em transação. Bloqueia criação duplicada por uma
trava consultiva do PostgreSQL e recusa executar quando já existe atribuição de
ADMINISTRADOR. Não troca senha nem promove uma conta que já usa o telefone.

Cria Usuario ATIVO, Cliente associado para armazenar o nome, atribuição administrativa
global e registro de auditoria sem senha. A criação do Cliente associado não adiciona
automaticamente o papel CLIENTE; o papel concedido é ADMINISTRADOR.

O registro de telefone verificado nessa conta é uma ativação administrativa local,
não uma comprovação de SMS. O service não é exposto por endpoint público.
