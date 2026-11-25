# Frontend explicado por arquivo

[Voltar ao índice](README.md)

O frontend usa React, Vite, JavaScript e CSS. Não usa TypeScript, React Router,
biblioteca de componentes ou gerenciador global de estado nesta etapa.

## frontend/index.html

Contém idioma `pt-BR`, viewport, descrição, título e `<div id="root">`.
O script `/src/main.jsx` carrega o React durante o desenvolvimento.
Vite transforma essa entrada ao gerar o build.

## frontend/src/main.jsx

Importa as quatro páginas e o CSS global. `createRoot` monta a página dentro de
`#root`. O código lê `window.location.pathname`, retira uma barra final e procura
a página em um objeto:

| Caminho | Componente |
| --- | --- |
| `/` | App |
| `/login` | Login |
| `/cadastro` | Cadastro |
| `/painel` | Painel |

Um caminho não reconhecido também mostra App; não há tela 404 no front.
Os links usam navegação normal do navegador. Essa solução simples recarrega o
documento ao mudar de página; não é roteamento por React Router.

## frontend/src/App.jsx

É a página pública com cabeçalho, apresentação, catálogo, seção de experiência e
rodapé. O botão Entrar vai para `/login`; os links do catálogo usam `#servicos`.

Seus estados são:

| Estado | Uso |
| --- | --- |
| `servicos` | Array recebido da API. |
| `carregando` | Indica consulta em andamento. |
| `erro` | Mensagem de falha de consulta. |
| `tentativa` | Ao mudar, faz o efeito repetir a consulta. |

`useEffect` busca `/api/servicos`. A consulta da home usa fetch diretamente,
enquanto as telas de conta usam `api.js`. O efeito valida o status e confirma que
o resultado é um array. O cleanup chama `AbortController.abort()` para cancelar
uma consulta que não é mais necessária.

O componente apresenta carregamento, erro com botão de nova tentativa, catálogo
vazio ou lista. `map()` cria os cards e `cd_servico` é a chave estável. Preços
são formatados por `Intl.NumberFormat` em reais; a descrição só aparece se existir.
Não há agendamento funcional ou dados fictícios de serviços inseridos no banco.

## frontend/src/Login.jsx

Possui telefone, senha, mostrar/ocultar senha, criação de conta e volta ao site.
O botão de recuperação existe visualmente, mas permanece desativado.

Ao montar, consulta `/auth/sessao` pelo helper. Se já há sessão válida, usa
`location.replace('/painel')`. Se essa consulta inicial falha, mantém o formulário;
não impede uma tentativa de login posterior.

Ao enviar:

1. Impede o envio HTML padrão com `preventDefault`.
2. Evita duplicidade com `enviando`.
3. Valida quantidade de dígitos do telefone no front e focaliza o erro.
4. Envia telefone e senha para `POST /api/auth/login`.
5. Em sucesso, usa `location.assign('/painel')`.
6. Em falha, mostra a mensagem retornada e libera nova tentativa.

O estado `mostrarSenha` alterna o tipo do input; não altera a senha.
`autoComplete="username"` identifica o telefone como usuário, e
`autoComplete="current-password"` ajuda gerenciadores de senha.

As credenciais não são guardadas em localStorage. O cookie é tratado pelo navegador.
A validação do frontend facilita a interação; a validação oficial continua no backend.

## frontend/src/Cadastro.jsx

Campos: nome completo, telefone com DDD, e-mail opcional, senha e confirmação.
A senha aceita de 8 a 128 caracteres; o formulário usa validação nativa para
campos obrigatórios, comprimento e e-mail.

O handler acrescenta validação de nome após trim, telefone e igualdade das senhas.
O primeiro campo inválido recebe foco. Alterar um campo limpa seu erro; alterar
a senha também limpa o erro de confirmação.

Envia apenas `nome`, `telefone`, `email` e `senha` para a API. A confirmação é uma
verificação de interface, não é enviada. O backend não permite escolher papel ou status.

Em sucesso HTTP, limpa o formulário e mostra a mensagem genérica da API com link
para o login. Essa resposta 202 não significa que a conta já pode entrar, nem
confirma que SMS foi enviado. A conta nova fica PENDENTE e a ativação por telefone
ainda precisa ser implementada.

## frontend/src/Painel.jsx

É a página básica de conta, compartilhada pelos papéis. Ainda não há agenda,
gestão de usuários ou telas administrativas específicas.

Ao montar, consulta `GET /api/auth/sessao`. Uma falha 401 manda ao login com
`location.replace`; outras falhas exibem mensagem e opção de repetir. Em sucesso,
mostra nome, telefone, e-mail se existir e nomes legíveis dos papéis.

O botão Sair envia `POST /api/auth/logout` com `{}` e redireciona ao login.
Se a saída falha, mantém o usuário na página e mostra o erro; não finge que a
sessão foi encerrada. O componente não implementa o botão de logout de todos os
dispositivos, embora a rota exista.

Proteger visualmente uma página não é suficiente para segurança. Quem protege
os dados é a API. Não se deve usar uma variável do React como prova de administrador.

## frontend/src/api.js

`consultarApi(caminho, { dados, signal })` centraliza o fetch das telas de conta:

| Situação | Comportamento |
| --- | --- |
| `dados` ausente | GET. |
| `dados` presente | POST com JSON e `X-Requested-With: ChampionsBarber`. |
| `credentials: 'same-origin'` | Permite o uso do cookie no mesmo endereço de origem. |
| `signal` recebido | Permite cancelar consultas ao sair da página. |
| Status 204 | Retorna null, pois não há JSON para ler. |
| JSON válido e sucesso | Retorna o conteúdo. |
| Falha HTTP | Lança Error com mensagem e propriedade `status`. |
| Falha de rede | Mostra mensagem genérica de conexão. |

Exemplo: `consultarApi('/auth/sessao')` chama `/api/auth/sessao`.
Não há tratamento genérico de PUT/PATCH/DELETE: o helper deve ser ampliado quando
essas operações forem necessárias.

## frontend/src/Seta.jsx

É um pequeno SVG reutilizável em formato de chevron. Recebe `direcao`, com padrão
`direita`. As classes CSS giram o mesmo desenho para cima ou para baixo.

`stroke="currentColor"` usa a cor do elemento, e `viewBox` permite redimensionar
sem perder nitidez. `aria-hidden` e `focusable="false"` evitam que o ícone decorativo
seja lido ou selecionado como um controle independente. O texto do link explica a ação.

O desenho circular com contraste no botão dourado foi escolhido a partir da
referência fornecida pelo responsável. Não depende de fonte ou caractere Unicode
para renderizar uma seta pequena.

## frontend/src/style.css

É a folha global, organizada por grupos de classes:

| Grupo | Elementos |
| --- | --- |
| Base | `:root`, box-sizing, corpo, links, foco e rolagem. |
| Estrutura pública | `.container`, `.cabecalho`, `.navegacao`, `.marca`, `.hero`. |
| Controles | `.botao`, `.botao-entrar`, `.icone-seta`, estados hover/active/focus. |
| Catálogo | `.secao-servicos`, `.lista-servicos`, `.servico`, `.detalhes`, `.aviso`. |
| Conteúdo e rodapé | `.experiencia`, `.manifesto`, `.rodape`. |
| Login/cadastro | `.pagina-login`, `.login-*`, `.campo-login`, `.campo-senha`. |
| Feedback | `.erro-campo`, `.erro-formulario`, `.cadastro-recebido`. |
| Minha conta | `.pagina-conta`, `.conta-conteudo`, `.conta-dados`. |

Media queries em 760px transformam colunas em uma e adaptam cabeçalho e telas de
conta. `clamp()` ajusta tamanhos de título entre limites. `prefers-reduced-motion`
retira a rolagem suave quando o usuário solicita menos movimento.

Há labels associados aos inputs, foco por teclado, áreas de toque ampliadas,
mensagens com `role="alert"`/`status`, `aria-busy` e link para pular conteúdo.
Esses recursos são cuidados implementados, não uma certificação completa de acessibilidade.

A regra de hover dos links comuns exclui `.botao-entrar`: isso evita o erro anterior
de texto dourado sobre fundo dourado. A imagem de apresentação é ilustrativa,
carregada de uma URL externa do Unsplash; não é uma foto local cadastrada da barbearia.

## frontend/vite.config.js e arquivos de configuração

O plugin React transforma JSX. `loadEnv` lê a configuração local, e o proxy envia
`/api` para `API_TARGET` ou `http://localhost:3000`.

O navegador acessa a porta 5173 e vê uma origem só. O Vite conversa com a API em
outra porta nos bastidores. Isso permite usar cookie e URLs relativas sem abrir CORS.

`API_TARGET` é configuração do servidor Vite; não é segredo enviado ao cliente.
Variáveis com prefixo VITE_ podem ser incorporadas no JavaScript do navegador,
portanto não devem conter senha de banco nem chaves privadas.

`frontend/package.json` usa ES Modules e separa dependências do front das do backend.
`frontend/package-lock.json` fixa a árvore resolvida. O README local resume como iniciar.

Na publicação, é necessário servir `index.html` também para `/login`, `/cadastro`
e `/painel`, além de encaminhar `/api` ao backend. `vite preview` não reproduz
automaticamente o proxy configurado em `server.proxy` para desenvolvimento.
