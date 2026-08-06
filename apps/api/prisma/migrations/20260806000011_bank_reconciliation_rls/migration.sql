-- ============================================================================
-- Row-Level Security: módulo Conciliação Bancária
-- ============================================================================
-- Mesmo padrão de 20260806000001_rls_and_triggers, 20260806000003_financeiro_rls,
-- 20260806000005_fixed_assets_rls e 20260806000007_budget_rls.

ALTER TABLE "bank_reconciliations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_reconciliations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bank_reconciliations"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "bank_statement_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_statement_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bank_statement_lines"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos já vêm de ALTER DEFAULT PRIVILEGES (docker/postgres-init/01-roles.sql).

-- Sem REVOKE de propósito, diferente de journal_entries/pagamentos/depreciações/
-- movimentações de estoque: uma sessão de conciliação e suas linhas mudam de
-- status legitimamente pelo serviço (BankReconciliationService) até o
-- fechamento (OPEN -> CLOSED) — mesmo raciocínio de BudgetPlan/BudgetLine.
-- Os lançamentos contábeis que a conciliação eventualmente gera (via
-- create-entry) continuam sujeitos às regras normais de journal_entries,
-- que já são imutáveis por conta da migração 20260806000001.
