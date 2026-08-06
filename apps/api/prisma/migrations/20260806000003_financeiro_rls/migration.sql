-- ============================================================================
-- Row-Level Security: módulo Financeiro (contas bancárias/caixa, AP, AR)
-- ============================================================================
-- Mesmo padrão de 20260806000001_rls_and_triggers: policy única de isolamento
-- total por organização, FORCE (sem bypass nem para app_migrator).

ALTER TABLE "counterparties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "counterparties" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "counterparties"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bank_accounts"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "accounts_payable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts_payable" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounts_payable"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "accounts_payable_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts_payable_payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounts_payable_payments"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "accounts_receivable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts_receivable" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounts_receivable"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "accounts_receivable_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts_receivable_receipts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounts_receivable_receipts"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos já vêm de ALTER DEFAULT PRIVILEGES (docker/postgres-init/01-roles.sql).
-- Aqui revogamos o que a integridade do módulo exige:

-- Contrapartes e contas bancárias não são hard-deletáveis: desativação via
-- is_active, mesmo padrão de "accounts" (uma contraparte com títulos não pode
-- simplesmente sumir do histórico).
REVOKE DELETE ON "counterparties" FROM app_user;
REVOKE DELETE ON "bank_accounts" FROM app_user;

-- Títulos de AP/AR não são hard-deletáveis nem corrigíveis por edição livre:
-- a correção é sempre por cancelamento (que estorna o lançamento de
-- acréscimo) ou por novo título. UPDATE continua concedido porque a própria
-- aplicação precisa atualizar paid_amount/received_amount e status ao
-- registrar pagamento/recebimento — não há rota de edição genérica exposta.
REVOKE DELETE ON "accounts_payable" FROM app_user;
REVOKE DELETE ON "accounts_receivable" FROM app_user;

-- Pagamentos e recebimentos são apêndice imutável do título, mesmo padrão de
-- journal_entries/journal_entry_lines: uma vez registrados, não são editáveis
-- nem removíveis via SQL direto.
REVOKE UPDATE, DELETE ON "accounts_payable_payments" FROM app_user;
REVOKE UPDATE, DELETE ON "accounts_receivable_receipts" FROM app_user;
