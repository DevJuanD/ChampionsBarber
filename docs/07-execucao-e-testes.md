# Execução, configuração e testes

[Voltar ao índice](README.md)

## Requisitos

São necessários Node.js/npm compatíveis com as dependências, PostgreSQL acessível
e o banco já preparado com as 16 tabelas. O projeto não inclui o DDL completo
original nem um comando que construa um banco vazio do zero.

Os package.json atuais não fixam uma versão de Node em engines. Ao preparar outra
máquina, verificar compatibilidade com o Prisma e Vite instalados. Existem dois
projetos npm: backend na raiz e frontend em `frontend`.

## Instalação

Na raiz:

```powershell
npm install
```

No frontend:

```powershell
cd frontend
npm install
```

Em uma cópia com lockfiles consistentes, `npm ci` pode ser usado para instalação
reproduzível. Se o npm não conseguir escrever no cache padrão, usar
`--cache .npm-cache` na raiz ou `--cache ../.npm-cache` dentro de frontend.

## Configuração do backend

Copiar `.env.example` para `.env` apenas se o `.env` ainda não existir, para não
sobrescrever credenciais. Ajustar os valores localmente:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5433/ChampionsBarber?schema=public"
PORT=3000
NODE_ENV=development
APP_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ADMIN_NOME=
ADMIN_TELEFONE=
```

O exemplo usa a porta 5433 porque foi a porta encontrada no PostgreSQL local.
O arquivo de exemplo original usa 5432 como referência genérica: a porta correta
depende da instalação. Caracteres reservados da senha na URL precisam ser codificados.
Nunca publicar a URL real.

| Variável | Uso |
| --- | --- |
| DATABASE_URL | Conexão direta Prisma/PostgreSQL; não é uma URL de API Supabase. |
| PORT | Porta da API; padrão 3000. |
| NODE_ENV | `production` ativa Secure e nome __Host- do cookie. |
| APP_ORIGINS | Origens exatas aceitas na escrita; separar por vírgula, sem barra final extra. |
| ADMIN_NOME / ADMIN_TELEFONE | Preenchimento do comando local do primeiro administrador. |

A senha administrativa não é lida dessas variáveis: é solicitada interativamente.
Não é necessário colocar senha administrativa na documentação.

## Sincronização do client

Na raiz:

```powershell
npm run db:validate
npm run db:generate
npm run db:check
```

Se o banco existente foi alterado e o schema precisa refletir a mudança, usar
`npm run db:pull`, revisar o resultado e então gerar novamente o client.
Não executar esse comando como substituto de análise de mudanças em produção.

## Iniciar os dois processos

Terminal 1, na raiz:

```powershell
npm run dev
```

Terminal 2, no frontend:

```powershell
cd frontend
npm run dev
```

O comando do backend usa `node --watch`. O do front usa Vite. Os terminais devem
permanecer abertos. Parar com Ctrl+C encerra o respectivo processo.

| Endereço padrão | Uso |
| --- | --- |
| http://localhost:5173 | Home |
| http://localhost:5173/login | Login |
| http://localhost:5173/cadastro | Cadastro |
| http://localhost:5173/painel | Própria conta autenticada |
| http://localhost:3000/api/servicos | Consulta direta de serviços |

Use de forma consistente localhost ou 127.0.0.1: cookies são associados ao host,
e entrar em um não equivale a entrar no outro. Se Vite escolher outra porta porque
5173 está ocupada, a nova origem também precisa estar em APP_ORIGINS.

`frontend/.env` pode definir `API_TARGET=http://localhost:3000`. Se PORT mudar,
ajustar esse destino e reiniciar os processos. Vite não lê automaticamente PORT
do `.env` do backend para configurar o proxy.

## Administrador inicial

```powershell
npm run admin:criar
```

O script só funciona em terminal interativo. Solicita nome/telefone se ausentes
no ambiente, senha sem eco e confirmação. Senha administrativa: 12 a 128 caracteres.
Se já existe uma atribuição ADMINISTRADOR, recusa criar outra.

Esse comando é para provisionamento inicial, não deve ser executado a cada início
do servidor. A criação dos próximos usuários pelo administrador ainda é uma etapa futura.

## Build do frontend

Dentro de frontend:

```powershell
npm run build
```

Gera `frontend/dist`. `npm run preview` permite servir o build local, mas não deve
ser confundido com o servidor de desenvolvimento com proxy. A publicação ainda
precisa configurar acesso ao backend e fallback de páginas para index.html.

## Scripts explicados

### scripts/check-database.js

Carrega o ambiente e abre uma transação com `SET TRANSACTION READ ONLY`.
Percorre as models em `Prisma.dmmf`, deriva o nome do delegate e chama `findMany`
com `take: 1` e inclusão de relacionamentos. Exibe somente o nome da tabela e
o resultado do teste, sem imprimir registros.

Isso exercita consultas das models e, quando houver registros, relações incluídas.
Não prova que todos os dados ou todas as regras de escrita estão corretos.
No finally, fecha o Prisma.

### scripts/criar-admin.js

Usa readline/promises para perguntas e uma saída Writable para ocultar a senha.
Valida a confirmação e chama adminInicialService. Erros de banco mostram um
código sanitizado; mensagens próprias de validação são legíveis. O client é
encerrado ao final. Ctrl+C cancela o comando interativo.

### scripts/test-auth-database.js

Cria dados aleatórios dentro de uma transação. O service recebe delegates dessa
transação para consultar os mesmos registros sem persistir ao final.

Verifica cadastro PENDENTE com apenas CLIENTE, hash Argon2id, senha errada,
bloqueio de pendente, login de uma fixture ativada, sessões independentes,
hash do token, atualização dos papéis, revogação, expiração e conta desativada.

A ativação da fixture ocorre só no teste; não cria bypass público. No fim, um
erro sentinela força rollback. Usuários, sessões e auditorias de teste são revertidos.
Sequências inteiras podem avançar mesmo com rollback; lacunas em IDs são normais.
O banco de teste precisa ter CLIENTE ativo.

### scripts/test-admin-database.js

Quando não há administrador, testa provisionamento, login e permissões globais,
auditoria sem senha e recusa de segunda criação, tudo com rollback.
Quando já há administrador, testa a recusa de uma criação adicional e preserva
a conta real. Portanto, depois de criar o administrador definitivo, esse comando
não volta a testar o ramo de primeira criação nesse mesmo banco.

### tests/auth.test.js

Usa `node:test` e `node:assert/strict`. Os seis testes atuais cobrem normalização
de telefone, união de permissões, escopo próprio sem vínculo, administrador global,
contratos HTTP de autenticação e middleware de papéis.

O teste HTTP importa o app, abre porta temporária e verifica sessão obrigatória,
no-store, proteção de escrita/origem, dados inválidos, JSON inválido, logout e 429.
Ele não exercita sozinho um login real com credenciais válidas. Essa parte é
coberta pelo teste de service com banco e pelo teste manual já realizado na interface.

## Comandos de teste

Executar na raiz:

```powershell
npm test
npm run test:auth:db
npm run test:admin:db
```

Os testes de integração precisam de banco acessível, apesar de reverterem as
fixtures. A documentação foi escrita a partir do código e dos testes já executados;
não implica que todo o escopo do MVP esteja homologado.

## Problemas comuns

| Sintoma | Investigar |
| --- | --- |
| Site não abre | Processo do Vite, endereço exibido e porta ocupada. |
| Site abre, API falha | Processo Express, API_TARGET e conexão do banco. |
| Prisma não encontra coluna | Schema/client divergentes do banco; revisar introspecção. |
| 401 no login | Telefone normalizado, senha ou formato do hash. |
| 401 no painel | Cookie ausente, host diferente, sessão expirada/revogada ou conta sem acesso. |
| 403 com senha correta | Conta pendente, bloqueada ou desativada. |
| 403 ao enviar formulário | Origin, APP_ORIGINS, X-Requested-With e Sec-Fetch-Site. |
| 415 | Falta de Content-Type application/json. |
| 429 | Limites de cadastro/login atingidos. |
| Botão de recuperar senha desativado | Fluxo ainda não implementado. |
| Novo cadastro não entra | Conta continua PENDENTE sem confirmação de telefone. |
| Admin inicial já existe | O comando não permite criar outro ou redefinir o existente. |
| API em produção não mantém cookie | Conferir HTTPS, NODE_ENV, mesmo host/origem e configuração de proxy. |

## Antes de publicar

Configurar HTTPS, APP_ORIGINS e banco acessível pela hospedagem; localhost na
hospedagem aponta para a própria hospedagem, não para o computador do desenvolvedor.
Definir como servir o build, encaminhar /api e tratar caminhos de página.

Revisar dependências com `npm audit`. Auditorias anteriores apontaram alertas em
dependências de desenvolvimento; esta documentação não afirma que foram corrigidos.
Não usar `npm audit fix --force` sem revisar mudanças de versão e compatibilidade.

Também faltam baseline/migrações, política de backup, retenção, limpeza de sessões,
configuração segura de proxy e store compartilhado se houver várias instâncias.
