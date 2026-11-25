# Evolução do projeto e pendências

[Voltar ao índice](README.md)

## Etapas realizadas

### Leitura e modelagem

Foram lidos o projeto v1.1, a atualização v1.5 e o cronograma de quatro semanas.
Inicialmente criamos 16 models com base na documentação. Após conectar ao banco
PostgreSQL local, a introspecção corrigiu os nomes reais, os tipos e as relações.
Isso evitou recriar as tabelas existentes.

### Primeira consulta do backend

Configuramos Express, dotenv, parser JSON e scripts de inicialização. Criamos
servicoController e servicoRoutes para GET /api/servicos. A consulta retorna apenas
serviços ativos, com campos públicos e ordenação previsível.

### Primeira interface

Criamos frontend separado com React/Vite e JavaScript. A home consulta a API e
trata carregamento, falha, repetição e catálogo vazio. O Figma serviu de inspiração,
com liberdade para adaptar o visual. A identidade adotada usa preto e dourado,
seção clara para catálogo e imagem ilustrativa de barbearia.

As setas foram substituídas por SVG e depois ajustadas ao chevron circular pedido.
O botão Entrar foi adicionado ao cabeçalho. A colisão de CSS que deixava o texto
dourado sobre fundo dourado foi corrigida no seletor de hover.

### Login e cadastro

As telas foram construídas antes da integração. Acrescentamos telefone, senha,
mostrar/ocultar, link de cadastro, campos de criação de conta e validações.
Os avisos de implementação indisponível foram retirados das telas a pedido do responsável.
Hoje o feedback é o resultado real das requisições, sem simular autenticação.

### Backend de autenticação

Implementamos Argon2id, sessões no banco, cookie HttpOnly, expiração, revogação,
limites, proteção de escrita e cálculo de papéis/escopos. Cadastro público concede
somente CLIENTE e mantém conta pendente.

Durante os testes surgiu um erro na função SQL de auditoria ao alterar papéis.
Corrigimos a função e preservamos o SQL em prisma/sql. Testes com rollback
exercitaram cadastro, senha, sessões, expiração, revogação e desativação.

### Administrador inicial e integração

Criamos o comando local para provisionar o primeiro ADMINISTRADOR, com senha
oculta no terminal, ativação administrativa e auditoria. Não criamos um papel
especial de desenvolvedor; usamos o ADMINISTRADOR existente.

Conectamos Login e Cadastro à API e criamos Painel para consultar a própria sessão,
mostrar dados/perfis e sair. O responsável confirmou que o login funcionou pela
interface. Isso valida esse fluxo de uso, não os módulos futuros da barbearia.

## O que existe no banco mas ainda não existe no produto

| Estrutura | Implementação de API/interface que falta |
| --- | --- |
| Profissional e ProfissionalServico | Consulta pública e gestão de barbeiros/habilitações. |
| Funcionamento e JornadaProfissional | Telas e validação de horários/pausas. |
| BloqueioAgenda | Operações autorizadas de bloqueio. |
| Agendamento | Disponibilidade, reserva, cancelamento, status e encaixes. |
| VerificacaoContato | Emissão/consumo de OTP, tentativas e expiração. |
| Notificacao | Provedor SMS, fila, retentativas e mensagens. |
| Configuracao | Tela e rotas de configuração operacional. |
| Auditoria | Consulta administrativa e contexto de autoria para todas as novas operações. |

## Próxima etapa recomendada

Construir a gestão administrativa de usuários antes de liberar operações da
equipe: consulta, criação, atribuição de papéis, vínculo do barbeiro e desativação.
Essa gestão deve usar autenticação e autorização no backend, com auditoria.

O comando de administrador inicial não deve virar endpoint público. O cadastro
público continua restrito ao cliente. O painel atual será expandido; não há CRUD
de usuários escondido em outro arquivo.

Depois, implementar catálogo administrativo e profissionais, horários/configurações,
motor de disponibilidade, reservas transacionais e os fluxos SMS. A ordem pode ser
ajustada, mas uma nova conta pública ainda depende da confirmação de telefone.

## Decisões ainda necessárias

- Provedor SMS, credenciais, custos, validade dos códigos, reenvios e suporte.
- Procedimento de confirmação de e-mail e recuperação de senha/contato.
- Política para criar e ativar contas internas pela administração.
- Fuso da barbearia e regras detalhadas de tolerância em múltiplos períodos.
- Desempate da atribuição automática de profissional.
- Proteção de concorrência e comportamento completo de encaixes/bloqueios.
- Ambiente de hospedagem, backup, retenção e tratamento de dados pessoais.

## Como manter os guias

Ao adicionar arquivo, incluir sua responsabilidade em 01-estrutura e no guia da
camada. Ao criar rota, atualizar 06-api com método, autorização e resposta.
Ao alterar senha/sessão/permissão, atualizar 05-autenticacao e os testes.
Ao concluir um módulo, mover seu estado neste documento sem tratar apenas a
existência da tabela ou do layout como funcionalidade pronta.
