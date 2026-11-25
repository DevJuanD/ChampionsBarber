# Autenticação

Backend com Argon2id, cookie HttpOnly e sessões PostgreSQL. Os formulários do
frontend estão conectados; `/painel` consulta a sessão e permite logout.
Nenhuma migração de tabela é necessária.

## Rotas

| Método | Caminho | Dados / resposta |
| --- | --- | --- |
| POST | `/api/auth/cadastro` | JSON com `nome`, `telefone`, `senha`, `email` opcional. Responde 202 com mensagem genérica, inclusive para contato existente. |
| POST | `/api/auth/login` | JSON com `telefone` e `senha`. Retorna usuário, permissões e expiração; a sessão fica no cookie. |
| GET | `/api/auth/sessao` | Retorna usuário e permissões atuais; 401 se a sessão não for válida. |
| POST | `/api/auth/logout` | Revoga a sessão atual, remove cookie e retorna 204. Pode ser repetido. |
| POST | `/api/auth/logout-todos` | Exige sessão e revoga todas as sessões da conta, retornando 204. |

Todas as requisições POST exigem `Content-Type: application/json`, o cabeçalho
`X-Requested-With: ChampionsBarber` e corpo JSON (`{}` para logout). O frontend
deve usar URLs relativas `/api/auth/...`, pelo proxy do Vite. Não há CORS aberto.

```js
await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'ChampionsBarber',
  },
  body: JSON.stringify({ telefone, senha }),
});
```

Erros retornam `{ mensagem }` com 400 para validação, 401 para credenciais/sessão
inválidas, 403 para conta sem acesso ou CSRF/origem recusados e 429 para excesso
de tentativas. Erros internos retornam mensagem genérica, sem dados sensíveis.

## Comportamento

- Telefone de entrada é normalizado para formato `+códigopaísDDDnumero`;
  números brasileiros de 10/11 dígitos recebem +55. Contatos legados precisam
  usar o mesmo padrão antes de permitir login; não há associação automática
  de clientes visitantes pelo telefone.
- Cadastro cria Usuario PENDENTE, Cliente e atribuição CLIENTE na mesma transação.
  Campos extras como status e papel são ignorados. Não existe cadastro público
  de profissionais ou administradores.
- Senhas de cadastro têm 8 a 128 caracteres, sem trim. O banco guarda Argon2id.
- Login exige conta ATIVO e telefone verificado. Contas pendentes, bloqueadas
  ou desativadas não recebem sessão. A senha é validada antes de informar o
  bloqueio. Telefone inexistente usa verificação de hash simulado.
- Token de sessão aleatório de 256 bits fica apenas no cookie; somente SHA-256
  do token é salvo em sessao_usuario. Expiração absoluta de 7 dias; dispositivos
  recebem sessões independentes. Cookie HttpOnly, SameSite=Lax e Secure em
  produção, sem Domain e com prefixo __Host- em produção.
- Papéis ativos, capacidades e escopos são lidos novamente a cada requisição.
  Use `exigirSessao` e `exigirPapel(...)` nas futuras rotas privadas; operações
  de agenda também precisam validar capacidade e o profissional no escopo.
- Limites por IP e telefone no login e por IP no cadastro usam memória do
  processo. Vários processos/instâncias exigem um store compartilhado. Ao
  hospedar atrás de proxy, configurar trust proxy apenas para proxies conhecidos.
- Defina `NODE_ENV=production`, HTTPS e `APP_ORIGINS` com as origens exatas
  da aplicação. Não habilite CORS amplo nem remova a proteção de escrita.

## Pendências

A conta administrativa inicial é provisionada pelo comando local
`npm run admin:criar`. Nome/telefone podem ser definidos em ADMIN_NOME e
ADMIN_TELEFONE no .env; a senha é solicitada sem eco no terminal, confirmada e
armazenada somente como Argon2id. O comando cria uma conta ativa com papel
ADMINISTRADOR, escopos globais e auditoria da ativação administrativa sem SMS.
Recusa executar se já houver uma atribuição ADMINISTRADOR e não promove contas
existentes. Não é uma rota pública. `npm run test:admin:db` testa com rollback.
O painel e as rotas administrativas de criação de outros usuários ainda precisam
ser implementados com exigirSessao + exigirPapel('ADMINISTRADOR').

O envio de SMS, a emissão/validação de OTP, a confirmação de e-mail e a recuperação
de senha ainda não estão implementados. O cadastro não envia SMS e não ativa
contas. Não há bypass de verificação para desenvolvimento. A criação de uma
conta pendente não abre painel. Não implementar alteração de senha sem revogar
as sessões anteriores na mesma transação.

## Verificação

`npm test` cobre normalização, autorização, CSRF, limites e contratos HTTP.
`npm run test:auth:db` testa cadastro, hashes, sessões, expiração e revogação com
o banco local, revertendo os registros de teste em uma transação. Sequências
INTEGER podem avançar mesmo com rollback, o que é normal no PostgreSQL.

Durante os testes foi corrigida a função compartilhada de auditoria, que
referenciava campos de tabelas diferentes no CASE de NEW. A correção aplicada
está em `prisma/sql/001_corrigir_auditoria.sql`; execute esse SQL ao levar o
mesmo banco para outro ambiente, preservando a definição específica do destino.
