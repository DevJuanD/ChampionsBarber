# Models do Champions Barbearia

As 16 models de `prisma/schema.prisma` foram sincronizadas por introspecção do
PostgreSQL local. O acesso CommonJS permanece em `src/models/index.js`.
Nenhuma tabela, dado, trigger ou restrição do banco foi alterada.

## Uso

Configure `DATABASE_URL` no `.env` e carregue `require('dotenv').config()` antes
de importar `const { servico, prisma } = require('./src/models')`.
Por exemplo: `await servico.findMany({ where: { ativo: true } })`.
Em transações, use os delegates de `tx`; no encerramento, `prisma.$disconnect()`.

- `npm run db:validate`: valida o schema.
- `npm run db:generate`: gera o client após mudanças nas models.
- `npm run db:check`: consulta as 16 models em transação somente leitura,
  sem mostrar dados pessoais.
- `npm run db:pull`: atualiza as models a partir do banco; revise o resultado
  antes de regenerar o client. Não modifica o banco.

## Estrutura real do banco

- PKs inteiras `cd_*`; vínculo profissional/serviço com chave composta.
- Capacidades e escopos pertencem a `UsuarioPapel`, não a `Papel`.
- Status, códigos e escopos são String com CHECKs no PostgreSQL, não enums
  nativos. Notificação aceita PENDENTE, ENVIADO e FALHOU; usuário aceita
  também BLOQUEADO.
- Cliente usa `nome_completo`; períodos usam `hora_inicio` e `hora_fim`.
- Agendamento usa `referencia_publica` (VARCHAR de até 32 caracteres, sem default).
  Gere na aplicação uma referência segura, por exemplo com
  `require('node:crypto').randomBytes(16).toString('hex')`.
- Encaixes usam `encaixe_autorizado_por`, `encaixe_autorizado_em`,
  `encaixe_justificativa` e `encaixe_alertas`. Preço e duração históricos ficam
  em `preco_registrado` e `duracao_registrada`.
- Campos `atualizado_em` existentes mantêm @updatedAt: escritas pelo Prisma
  atualizam o instante automaticamente; isso não cria uma trigger no banco.
- Configuracao não possui coluna de fuso horário. Defina o fuso na configuração
  da aplicação ao implementar a agenda.

## Restrições e regras de negócio

O banco possui CHECKs, uma exclusion constraint para reservas normais confirmadas
 e triggers de validação de agendamentos e auditoria. O Prisma não representa
integralmente essas estruturas; os comentários gerados no schema registram as
restrições não suportadas. Elas continuam vigentes no PostgreSQL.

A sincronização e os testes de leitura não homologam concorrência, autorização,
cancelamento, SMS ou o comportamento das triggers. Os services ainda precisam
validar entradas, capacidades, escopos, jornadas, intervalos, bloqueios e OTP.
Não presumir que a exclusion constraint de NORMAL sozinha impede colisões com
ENCAIXE; revisar as triggers e testar as transações antes das reservas.

Senhas, tokens e códigos devem ser protegidos antes da persistência e excluídos
dos logs e snapshots de auditoria. Visitantes com telefone igual não devem ser
unificados automaticamente.

Não execute db push, migrate reset ou migrações de recriação sobre este banco.
Uma futura adoção de migrações exige baseline e preservação do SQL específico.
