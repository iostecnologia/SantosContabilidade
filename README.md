# Santos Sistema Administrativo Financeiro

Plataforma SaaS multi-tenant de gestão administrativa e financeira. Backend (`apps/api`): isolamento multi-tenant real via PostgreSQL Row-Level Security, autenticação/RBAC, Plano de Contas hierárquico, Lançamentos Contábeis por partidas dobradas (header + linhas), o módulo de **Lançamento de Documentos Fiscais** (Strategy Pattern, CBS/IBS/reforma tributária + retenções), o módulo **Financeiro** (contas bancárias/caixa, contas a pagar/receber) e o módulo **Ativo Fixo / Depreciação**. Frontend (`apps/web`): React + Vite dark-mode, cobrindo por enquanto o fluxo contábil core (Plano de Contas, Centros de Custo, Lançamentos) — os demais módulos ganham tela nas próximas iterações. Ainda faltam: orçamento, almoxarifado, relatórios.

## Por que RLS, e por que header+lines nos lançamentos

Isolamento entre empresas é garantido pelo **Postgres**, não só por `WHERE organization_id = ?` no código — um bug de aplicação não deveria conseguir vazar dado entre tenants. Lançamentos contábeis usam header (`journal_entries`) + linhas (`journal_entry_lines`) em vez de duas colunas fixas de débito/crédito, porque o próprio escopo do produto já prevê lançamentos de "2ª/3ª/4ª fórmula" (um-para-muitos, muitos-para-um, muitos-para-muitos).

## Stack

- **Backend**: NestJS 10 + TypeScript, Prisma ORM
- **Frontend**: React 18 + Vite + TypeScript, Tailwind (tema escuro fixo), TanStack Query, React Hook Form + Zod
- **Banco**: PostgreSQL 15 (Row-Level Security + triggers para integridade contábil)
- **Auth**: JWT (access curto + refresh rotacionado com detecção de reuso)
- **Produção**: um único domínio — Caddy serve o frontend estático e faz proxy de `/api/*` pra API (mesma origem, sem CORS)

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose (recomendado) — ou um PostgreSQL 15 próprio

## Setup local (Docker)

```bash
cp .env.example .env
# edite .env e gere segredos fortes pra JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# POSTGRES_SUPERUSER_PASSWORD, APP_MIGRATOR_PASSWORD e APP_USER_PASSWORD:
#   openssl rand -base64 48

docker-compose up -d postgres
# espere o healthcheck ficar "healthy" (docker-compose ps)

cp apps/api/.env.example apps/api/.env
npm install

npm run prisma:migrate    # aplica as migrações (tabelas + RLS/triggers/grants)
npm run prisma:seed       # popula o catálogo global de permissões

npm run api:dev           # http://localhost:3000, Swagger em /api/docs
npm run -w apps/web dev   # http://localhost:5173, proxy de /api pro backend acima
```

## Deploy em VPS com Docker (stack completa)

```bash
cp .env.example .env
# gere segredos fortes pra TODAS as variáveis do .env (JWT_*, POSTGRES_SUPERUSER_PASSWORD,
# APP_MIGRATOR_PASSWORD, APP_USER_PASSWORD): openssl rand -base64 48

docker-compose up -d postgres
# espere ficar healthy

docker-compose build api
docker-compose run --rm api npm run prisma:migrate -w apps/api
docker-compose run --rm api npm run prisma:seed -w apps/api

docker-compose up -d api

# HTTPS via Caddy (Let's Encrypt automático) — ajuste o domínio no Caddyfile
# antes. O serviço `web` É o Caddy: builda o frontend e serve estático +
# proxy reverso de /api/* pro serviço `api`, tudo num container só.
docker-compose build web
docker-compose up -d web
```

Nem a API nem o frontend publicam porta diretamente no host — todo acesso externo passa pelo `web` (Caddy, `Caddyfile`, domínio configurado ali), que emite e renova o certificado TLS sozinho. Precisa de DNS (registro A) apontando pro IP da VPS antes de subir o `web`, senão a emissão do certificado falha.

As senhas do Postgres (`POSTGRES_SUPERUSER_PASSWORD`, `APP_MIGRATOR_PASSWORD`, `APP_USER_PASSWORD`) vêm só do `.env` (gitignored) — nunca hardcode em `docker/postgres-init/01-roles.sh` nem em `docker-compose.yml`, já que este repositório é público.

## Testes

```bash
npm run api:test        # unitários — domínio fiscal, sem banco (rodam neste ambiente, já verificados: 8/8 passando)
npm run api:test:e2e    # isolamento multi-tenant — precisa de Postgres com migrações aplicadas
```

Os testes **unitários** (`test/unit/contabilizacao-fiscal.spec.ts`) cobrem o motor de Strategy Pattern do módulo fiscal: cada estratégia gera um lançamento balanceado (débito = crédito) para o caso feliz, o dispatch por `TipoDocumentoFiscal` escolhe a estratégia certa, um documento com dado fiscal inconsistente (crédito tributário que não bate com a retenção) é rejeitado por `DesbalanceamentoContabilError` antes de qualquer persistência, e o rateio por centro de custo fecha exatamente o valor total mesmo com resíduo de centavos.

Os testes **e2e** conectam diretamente via `pg` (não pela API), como os papéis `app_migrator` e `app_user`, e provam que a RLS: (1) filtra corretamente por tenant, (2) sobrepõe um `WHERE` de aplicação errado, (3) falha fechada sem contexto definido, (4) bloqueia `INSERT` cross-tenant, (5) bloqueia `UPDATE`/`DELETE` em `journal_entries` (imutabilidade contábil), e (6) gera numeração de lançamento sem duplicata/buraco sob concorrência.

## Fluxo de exemplo (curl)

```bash
# 1. Registrar organização + usuário admin (rota pública, já retorna tokens)
curl -X POST http://localhost:3000/api/auth/register-organization \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Acme Contabilidade",
    "organizationSlug": "acme-contabilidade",
    "adminFullName": "Admin",
    "adminEmail": "admin@acme.com",
    "adminPassword": "SenhaForte123"
  }'
# guarde o accessToken da resposta em $TOKEN

# 2. Centro de custo
curl -X POST http://localhost:3000/api/cost-centers \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "01", "name": "Administrativo"}'

# 3. Contas contábeis (sintética + analítica)
curl -X POST http://localhost:3000/api/accounts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "1.1", "name": "Ativo Circulante", "type": "ASSET"}'
# guarde o id retornado como $PARENT_ID

curl -X POST http://localhost:3000/api/accounts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"code\": \"1.1.01\", \"name\": \"Caixa\", \"type\": \"ASSET\", \"parentId\": \"$PARENT_ID\"}"
# a conta pai vira sintética automaticamente (trigger) assim que ganha esta filha

# 4. Lançamento contábil balanceado (débito = crédito)
curl -X POST http://localhost:3000/api/journal-entries \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "entryDate": "2026-08-06",
    "competenceDate": "2026-08-06",
    "description": "Aporte inicial de capital",
    "lines": [
      {"accountId": "<id da conta Caixa>", "direction": "DEBIT", "amount": 1000},
      {"accountId": "<id de outra conta analítica>", "direction": "CREDIT", "amount": 1000}
    ]
  }'

# 5. Tentar postar na conta pai (sintética) → 400 (bloqueado pelo trigger de postabilidade)
# 6. Tentar um lançamento desbalanceado → 400 antes mesmo de chegar ao banco
# 7. Estornar um lançamento (nunca editar/apagar)
curl -X POST http://localhost:3000/api/journal-entries/<id>/reverse -H "Authorization: Bearer $TOKEN"

# 8. Módulo fiscal: gerar só o rascunho (não persiste) de uma NFS-e de serviço tomado com retenções
curl -X POST http://localhost:3000/api/fiscal/lancamentos/preview \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "documento": {
      "id": "nfse-12345",
      "tipo": "NFSE_NACIONAL",
      "naturezaOperacao": "SERVICO_TOMADO",
      "numeroDocumento": "12345",
      "dataEmissao": "2026-08-06",
      "dataCompetencia": "2026-08-06",
      "fornecedorOuClienteId": "<id do fornecedor>",
      "valorTotal": 1000,
      "itens": [{"descricao": "Consultoria", "quantidade": 1, "valorUnitario": 1000, "valorTotal": 1000}],
      "retencoes": {"irrf": 15, "iss": 50}
    },
    "mapeamentoContabil": {
      "DESPESA_OPERACIONAL": "<id da conta de despesa>",
      "FORNECEDORES_A_PAGAR": "<id da conta de fornecedores>",
      "IRRF_A_RECOLHER": "<id da conta de IRRF a recolher>",
      "ISS_A_RECOLHER": "<id da conta de ISS a recolher>"
    }
  }'
# troque /preview por /fiscal/lancamentos (sem sufixo) para persistir como lançamento contábil de verdade
```

## Estrutura

```
apps/api/
  prisma/schema.prisma                 # modelos
  prisma/migrations/                   # tabelas, depois RLS+triggers+grants
  prisma/seed.ts                       # catálogo global de permissões
  src/tenancy/                         # nestjs-cls + interceptor (contexto de tenant por requisição)
  src/auth/                            # registro, login, refresh, logout
  src/roles/ src/users/                # RBAC
  src/cost-centers/ src/accounts/      # plano de contas + centros de custo
  src/journal-entries/                 # partidas dobradas, imutável
  src/fiscal/                          # domínio fiscal (Strategy Pattern) + integração com journal-entries
    domain/                            # DocumentoFiscal, PartidaLancamento, CategoriaContaFiscal, rateio — puro TS, sem I/O
    strategies/                        # ContabilizacaoNfseServicoStrategy, ContabilizacaoCbsIbsStrategy
  src/counterparties/ src/bank-accounts/   # contrapartes (fornecedor/cliente), contas bancárias/caixa
  src/accounts-payable/ src/accounts-receivable/  # títulos a pagar/receber, postam acréscimo e liquidação
  src/fixed-assets/                    # ativo fixo: registro (sem lançamento), depreciação periódica e baixa
  test/unit/contabilizacao-fiscal.spec.ts
  test/e2e/tenant-isolation.e2e-spec.ts
apps/web/
  src/lib/                              # api-client.ts (fetch + refresh automático), jwt.ts (decode client-side)
  src/contexts/auth-context.tsx         # AuthProvider: tokens, permissions do JWT, login/logout
  src/components/layout/AppShell.tsx    # sidebar dark-mode fixa + navegação
  src/components/ui/                    # Button, Input/Select, Modal, Card
  src/pages/                            # LoginPage, DashboardPage, cost-centers/, accounts/, journal-entries/
  Dockerfile                            # build Vite -> imagem caddy:2-alpine com o dist/ embutido
Caddyfile                               # split de rotas: /api/* -> api:3000, resto -> estático do apps/web
docker-compose.yml
```

### Módulo fiscal — como funciona

`POST /fiscal/lancamentos` recebe um `DocumentoFiscal` (já emitido/recebido — este módulo não faz parsing de XML de NF-e nem integra com SEFAZ, isso é trabalho de um futuro módulo de importação) mais um `mapeamentoContabil` (que conta real do plano de contas do tenant corresponde a cada categoria abstrata, ex. `FORNECEDORES_A_PAGAR`). O `ContextoContabilFiscal` escolhe a estratégia certa por `TipoDocumentoFiscal` (Strategy Pattern), gera as partidas, valida que débito = crédito, e persiste via o mesmo `JournalEntriesService` do resto do sistema — herdando de graça toda a garantia de RLS, numeração atômica e triggers de integridade já existentes. `POST /fiscal/lancamentos/preview` faz tudo isso menos o passo final de persistir, para pré-visualização.

Duas estratégias de referência estão implementadas (`ContabilizacaoNfseServicoStrategy` para serviço tomado com retenções federais/municipais/previdenciárias, `ContabilizacaoCbsIbsStrategy` para CBS/IBS retido na fonte com crédito tributário não-cumulativo); novos tipos de documento (NF-e, CT-e, MDF-e, ...) ganham suas próprias estratégias sem tocar no motor.

### Módulo Financeiro — como funciona

`counterparties` (fornecedor/cliente) e `bank-accounts` (banco/caixa, ligada a uma conta do plano de contas) são cadastros simples. `POST /accounts-payable` e `POST /accounts-receivable` criam um título e já postam o lançamento de **acréscimo** (débito despesa/ativo, crédito passivo/receita); `POST /accounts-payable/:id/payments` (ou `/accounts-receivable/:id/receipts`) postam a **liquidação** e atualizam o saldo com um `UPDATE` atômico que evita overpayment sob pagamentos concorrentes. Não há edição de título após criado — correção é sempre por `POST /:id/cancel` (que estorna o acréscimo, só permitido sem pagamentos) seguido de um novo título.

### Módulo Ativo Fixo — como funciona

`POST /fixed-assets` só cadastra o ativo (custo, vida útil, contas contábeis) — **não posta lançamento**, já que a capitalização pode ter vindo de vários caminhos (compra à vista, um título de AP, etc.), fora de escopo modelar aqui. `POST /fixed-assets/depreciation-runs` roda a depreciação linear de um período pra todos os ativos ativos (idempotente por período), postando um lançamento por ativo. `POST /fixed-assets/:id/dispose` faz a baixa (write-off puro, sem venda): estorna a depreciação acumulada e lança a perda pelo valor contábil restante.

### Frontend — como funciona

SPA em React + Vite, sem SSR, build estático servido pelo próprio Caddy. Autenticação via JWT guardado em `localStorage`; o `api-client.ts` injeta o `Authorization: Bearer` em toda chamada e, num 401, renova a sessão sozinho — com uma promise de refresh compartilhada entre chamadas concorrentes, porque o refresh token do backend é rotacionado e de uso único (duas renovações simultâneas com o mesmo token derrubariam a sessão à toa). Permissões do usuário (`hasPermission("cost_centers:create")` etc.) vêm decodificadas do próprio JWT de acesso, mesmas chaves do catálogo do backend — botões de criar/editar/remover somem da UI se o usuário não tiver a permissão (o backend continua sendo a fonte de verdade, a UI só evita mostrar ação que sabe que vai ser rejeitada).

Escopo atual: login, dashboard com cards resumo (calculados no cliente a partir das listas — sem endpoint de agregação, isso é trabalho do futuro módulo de relatórios), Plano de Contas (árvore hierárquica), Centros de Custo e Lançamentos Contábeis (linhas dinâmicas, valida saldo no cliente antes de enviar, estorno). Financeiro, Ativo Fixo, Fiscal e Roles/Users ainda não têm tela — endpoints já existem no backend, só falta a UI.

## Próximos módulos (não incluídos ainda)

Orçamento, Almoxarifado, cadastro persistido de mapeamento contábil fiscal por organização (hoje vem explícito na requisição), mais estratégias fiscais (NF-e de compra, CT-e, ...), Relatórios (Balancete, Razão, DRE, Fluxo de Caixa, ...), e telas de frontend pros módulos Financeiro/Ativo Fixo/Fiscal/Roles-Users.
