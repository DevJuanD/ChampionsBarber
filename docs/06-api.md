# Contratos da API

[Voltar ao índice](README.md)

No desenvolvimento, a API escuta normalmente em `http://localhost:3000`.
O front usa URLs relativas, encaminhadas pelo Vite. Caminhos de página, como
`/login`, são diferentes de endpoints de dados, como `/api/auth/login`.

## Endpoints existentes

| Método | Caminho | Sessão | Sucesso |
| --- | --- | --- | --- |
| GET | `/api/servicos` | Não | 200 com array de serviços ativos |
| POST | `/api/auth/cadastro` | Não | 202 com mensagem genérica |
| POST | `/api/auth/login` | Não | 200 com usuário, expiração e cookie |
| GET | `/api/auth/sessao` | Sim | 200 com usuário atual |
| POST | `/api/auth/logout` | Não obrigatória | 204 e remoção do cookie |
| POST | `/api/auth/logout-todos` | Sim | 204 e revogação das sessões |

Não há endpoints de gestão de usuários, profissionais, criação/edição de serviços,
agendamento, confirmação de telefone, recuperação de senha ou health check nesta versão.

## Cabeçalhos de escrita

Todas as rotas POST de autenticação exigem:

```http
Content-Type: application/json
X-Requested-With: ChampionsBarber
```

Quando Origin é enviado, deve estar em APP_ORIGINS. O navegador envia o cookie
automaticamente nas requisições de mesma origem. No front, `api.js` configura
esses detalhes. Não copie o token para localStorage ou para o corpo do JSON.

## Consulta de serviços

```http
GET /api/servicos
```

Exemplo ilustrativo de retorno, sem afirmar que esses dados estão cadastrados:

```json
[
  {
    "cd_servico": 1,
    "nome": "Corte",
    "descricao": "Descrição do serviço",
    "preco": "35",
    "duracao_minutos": 30
  }
]
```

Sem serviços ativos, retorna `[]`. Ordenação por nome e ID. Não há paginação,
consulta de um serviço por ID nem filtros fornecidos pelo cliente nessa rota.

## Cadastro

```http
POST /api/auth/cadastro
```

```json
{
  "nome": "Pessoa de Exemplo",
  "telefone": "(11) 99999-0000",
  "email": "pessoa@example.com",
  "senha": "uma-senha-de-exemplo"
}
```

O e-mail pode ser omitido. Confirmação de senha é validada pelo frontend e não
precisa ser enviada. Papel, status e datas de verificação não são aceitos como
concessões do cadastro público.

```json
{
  "mensagem": "Solicitação de cadastro recebida."
}
```

O backend também devolve a resposta genérica quando encontra conflito de unicidade.
Ela não revela se o contato já estava cadastrado. Uma conta nova é PENDENTE;
o endpoint não cria sessão, não envia SMS e não ativa a conta.

## Login

```http
POST /api/auth/login
```

```json
{
  "telefone": "(11) 99999-0000",
  "senha": "senha-da-conta"
}
```

Em sucesso, grava Set-Cookie HttpOnly e devolve um objeto com `usuario` e
`expira_em`, uma data ISO. O objeto de usuário contém:

| Campo | Conteúdo |
| --- | --- |
| `cd_usuario` | ID interno da conta. |
| `telefone`, `email` | Contatos da própria conta; e-mail pode ser null. |
| `nome` | Nome do Cliente associado ou do Profissional, quando houver. |
| `status` | Estado da conta, ATIVO para login permitido. |
| `cd_cliente`, `cd_profissional` | Vínculos opcionais; profissional só é retornado como vínculo operacional se ativo. |
| `papeis` | Array de códigos ativos. |
| `permissoes` | Escopos e cinco capacidades efetivas. |

Token e hash de senha não fazem parte desse JSON. Telefone/senha inválidos retornam
401; conta pendente ou impedida retorna 403 após verificação da senha.

## Consulta da sessão

```http
GET /api/auth/sessao
```

Retorna `{ "usuario": ... }` com os mesmos campos seguros, carregados novamente
do banco. Sem sessão válida, retorna 401 e limpa o cookie quando aplicável.
Todas as respostas do router de autenticação usam `Cache-Control: no-store`.

## Logout

```http
POST /api/auth/logout
Content-Type: application/json
X-Requested-With: ChampionsBarber

{}
```

Revoga apenas a sessão informada pelo cookie, limpa o cookie e retorna 204 sem
corpo. Pode ser chamado sem sessão válida. Não tente ler JSON de uma resposta 204.

`POST /api/auth/logout-todos` usa o mesmo corpo/cabeçalhos, mas exige sessão e
revoga todas as sessões abertas da conta autenticada. O frontend atual só oferece
o logout da sessão presente.

## Erros

```json
{
  "mensagem": "Telefone ou senha incorretos."
}
```

| Status | Interpretação |
| --- | --- |
| 400 | Dados inválidos, campos ausentes ou JSON malformado. |
| 401 | Credenciais incorretas ou sessão ausente/inválida/expirada. |
| 403 | Conta sem acesso, papel não permitido, origem ou proteção de escrita recusados. |
| 413 | Corpo maior que 16 KiB no parser JSON. |
| 415 | Escrita de autenticação sem tipo de conteúdo JSON. |
| 429 | Limite de requisições atingido. |
| 500 | Falha interna, incluindo falhas inesperadas de acesso ao banco. |
| 503 | Cadastro sem papel CLIENTE ativo disponível. |

Um endpoint inexistente usa o comportamento 404 padrão do Express e não tem
garantia do mesmo envelope JSON. O helper do front trata resposta não JSON como
falha genérica. Não existe retorno de detalhes SQL ou stack trace nas respostas
controladas pelos controllers/middleware de erro.
