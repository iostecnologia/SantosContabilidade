-- ============================================================================
-- Row-Level Security: módulo Departamento Pessoal
-- ============================================================================
-- Mesmo padrão de 20260806000001_rls_and_triggers, 20260806000003_financeiro_rls,
-- 20260806000005_fixed_assets_rls, 20260806000007_budget_rls e
-- 20260806000011_bank_reconciliation_rls.

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "employees"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "payroll_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_settings"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "payroll_tax_brackets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_tax_brackets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_tax_brackets"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_runs"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "payroll_run_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_run_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_run_lines"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "vacations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vacations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "vacations"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "thirteenth_salary_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "thirteenth_salary_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "thirteenth_salary_runs"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "thirteenth_salary_run_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "thirteenth_salary_run_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "thirteenth_salary_run_lines"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "terminations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terminations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "terminations"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos já vêm de ALTER DEFAULT PRIVILEGES (docker/postgres-init/01-roles.sql).

-- Sem REVOKE de propósito: nenhuma destas tabelas é um livro-razão imutável
-- (payroll_run_lines/vacations/thirteenth_salary_run_lines/terminations vão
-- de DRAFT -> CALCULATED -> POSTED legitimamente pelo serviço, mesmo
-- raciocínio de BudgetPlan/BankReconciliation — a imutabilidade pós-POSTED
-- é regra de aplicação, não de banco). employees/payroll_settings/
-- payroll_tax_brackets são cadastros/configuração normais.
