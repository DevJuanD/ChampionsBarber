# Estrutura de pastas e arquivos

[Voltar ao índice](README.md)

## Visão da organização

```text
ChampionsBarber/
├── docs/                          Guias técnicos que você está lendo
├── frontend/
│   ├── src/
│   │   ├── main.jsx               Entrada do React e seleção das páginas
│   │   ├── App.jsx                Home e catálogo público
│   │   ├── Login.jsx              Formulário de login
│   │   ├── Cadastro.jsx           Formulário de criação de conta
│   │   ├── Painel.jsx             Dados da conta autenticada e logout
│   │   ├── Seta.jsx               Ícone SVG reutilizável
│   │   ├── api.js                 Comunicação das telas de conta com a API
│   │   └── style.css              Estilos e responsividade
│   ├── index.html                 Documento HTML que recebe o React
│   ├── vite.config.js             Plugin React e proxy de desenvolvimento
│   ├── package.json               Dependências e comandos do front
│   ├── package-lock.json          Versões resolvidas das dependências
│   ├── .env.example               Exemplo de configuração do proxy
│   ├── README.md                  Instruções curtas do front
│   ├── node_modules/              Dependências instaladas, geradas
│   └── dist/                      Build de publicação, gerado
├── prisma/
│   ├── schema.prisma              As 16 models do banco existente
│   └── sql/
│       └── 001_corrigir_auditoria.sql
├── scripts/
│   ├── check-database.js          Teste de leitura das models
│   ├── criar-admin.js             Comando interativo do primeiro administrador
│   ├── test-auth-database.js      Integração de autenticação com rollback
│   └── test-admin-database.js     Integração do administrador com rollback
├── src/
│   ├── config/
│   │   ├── prisma.js              Instância compartilhada do Prisma Client
│   │   └── auth.js                Nome e opções do cookie
│   ├── controllers/
│   │   ├── servicoController.js   Consulta de serviços e resposta HTTP
│   │   └── authController.js      Respostas de autenticação e cookies
│   ├── middlewares/
│   │   └── authMiddleware.js      Sessão, papel e proteção de escrita
│   ├── models/
│   │   ├── index.js               Exporta os delegates das 16 models
│   │   └── README.md              Notas curtas de modelagem
│   ├── routes/
│   │   ├── servicoRoutes.js       URL de listagem pública
│   │   ├── authRoutes.js          URLs de autenticação e limites
│   │   └── auth.md                Referência curta da autenticação
│   ├── services/
│   │   ├── authService.js         Regras de cadastro, login e sessão
│   │   └── adminInicialService.js Provisionamento administrativo local
│   ├── doc/                      Documentos originais, ignorados no Git
│   └── server.js                 Configuração e inicialização da API
├── tests/
│   └── auth.test.js               Testes automatizados de funções e HTTP
├── package.json                  Dependências e comandos do backend
├── package-lock.json             Versões resolvidas do backend
├── .env                          Configuração local e segredos, ignorados
├── .env.example                  Modelo sem credenciais reais
├── .gitignore                    Regras de exclusão do Git
├── node_modules/                 Dependências instaladas do backend
└── .npm-cache/                   Cache local de instalação
```

As pastas geradas podem não existir em uma cópia nova até instalar ou executar build.
`frontend/.env` é opcional e não é necessário se a API usa a porta padrão.

## Pastas do backend

`src/config` reúne configurações compartilhadas. Assim, controllers não precisam
criar conexões próprias ou repetir opções de cookie.

`src/routes` associa um endereço HTTP a uma função. É também onde a autenticação
escolhe quais proteções e limites aplicar antes de chamar o controller.

`src/controllers` recebe `req` e `res`. Extrai dados da requisição, chama regras
de negócio e define JSON, status e cookies da resposta.

`src/services` concentra decisões de negócio. O service de autenticação sabe
quando uma conta pode entrar; o controller apenas transforma o resultado em HTTP.

`src/middlewares` contém verificações intermediárias. Uma requisição recusada
por falta de sessão não deve chegar à operação protegida.

`src/models` dá acesso ao banco. Com Prisma, as definições das entidades não ficam
em 16 arquivos JavaScript: estão no `schema.prisma`, que gera o client.

## Arquivos da raiz

| Arquivo | Função e cuidados |
| --- | --- |
| `package.json` | Define projeto CommonJS, bibliotecas e comandos do backend. `main` aponta para `src/server.js`. |
| `package-lock.json` | Registra as versões exatas resolvidas pelo npm. Deve acompanhar mudanças de dependências. Não editar à mão. |
| `.env` | Guarda `DATABASE_URL` e outras configurações locais. Também pode guardar nome e telefone usados pelo comando administrativo. Não versionar. |
| `.env.example` | Mostra nomes e formatos das variáveis, usando valores fictícios. Deve ser versionado. |
| `.gitignore` | Ignora dependências, `.env`, cache, `dist` e os documentos originais de `src/doc`. |

As dependências incluem `@supabase/supabase-js`, mas os fluxos implementados usam
Prisma com conexão PostgreSQL. A biblioteca instalada não significa que a API do
Supabase ou Supabase Auth esteja sendo usada.

## O que é gerado

`node_modules` contém bibliotecas de terceiros. Não é código autoral do app e
pode ser recriado a partir de `package.json` e `package-lock.json`.

`frontend/dist` contém o site compilado. Seu `index.html` referencia JavaScript e
CSS em `dist/assets`. Os nomes possuem hashes para identificar versões no cache.
Edite `frontend/src` e faça outro build; não ajuste o conteúdo de `dist` manualmente.

O Prisma Client também é gerado em `node_modules`. Após alterar o schema,
execute `npm run db:generate` para atualizar esse código.

`.npm-cache` guarda downloads/metadados do npm. Não participa das funcionalidades.

## Git

As regras `node_modules/`, `.env` e `dist/` também cobrem nomes equivalentes
em subpastas. `/src/doc/` aponta especificamente para essa pasta na raiz do repositório.
A pasta `docs` não foi adicionada ao `.gitignore`, portanto pode ser versionada.

O `.gitignore` não retira automaticamente arquivos que já foram rastreados.
Não é necessário adicionar arquivos gerados para compartilhar o projeto.

## Documentos originais

Em `src/doc` estão os arquivos de planejamento:

- `Champions_Barbearia_Projeto_MVP_v1_1.docx`;
- `Champions_Barbearia_Projeto_MVP_Atualizado_v1_5.docx`;
- `Champions_Barbearia_Cronograma_4_Semanas.docx`.

A versão 1.5 substitui decisões antigas de modelagem, como usar UUID em todas as
PKs. O banco real e o schema sincronizado usam IDs inteiros `cd_*`. Planejamento,
modelagem e implementação devem ser consultados juntos: uma funcionalidade no
documento não significa que ela já tenha controller, rota e tela.
