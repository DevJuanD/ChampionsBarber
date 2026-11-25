# Frontend

React com Vite, JavaScript e CSS. Página inicial inspirada na referência do Figma,
com consulta real de serviços e estados de carregamento, lista vazia e erro.

1. Na raiz, execute `npm run dev` para iniciar a API.
2. Em outro terminal, entre em `frontend` e execute `npm install` e `npm run dev`.
3. Abra o endereço exibido pelo Vite (normalmente http://localhost:5173).

O proxy do Vite encaminha `/api` para http://localhost:3000. Para outra porta,
configure `API_TARGET` em `frontend/.env`, conforme `.env.example`.
Nunca coloque senha de banco ou credenciais nas variáveis VITE_*.

`npm run build` gera `dist`. O proxy é exclusivo do desenvolvimento: na hospedagem,
configure `/api` no servidor. A imagem da apresentação é ilustrativa (Unsplash).
Login e cadastro usam `/api/auth`, com cookie de sessão HttpOnly. Após entrar,
`/painel` consulta a sessão e mostra os dados e papéis da própria conta, com logout.
Credenciais e tokens não são armazenados no localStorage. O cadastro público
permanece pendente até a confirmação do telefone; SMS e recuperação de senha
ainda precisam de integração. A gestão administrativa e o agendamento serão
implementados nas próximas etapas.
