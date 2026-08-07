-- ============================================================================
-- Row-Level Security: módulo SPED / eSocial
-- ============================================================================
-- Mesmo padrão de 20260806000001_rls_and_triggers e das RLS subsequentes
-- (financeiro, fixed_assets, budget, warehouse, bank_reconciliation,
-- departamento_pessoal, fiscal_apuracao).

ALTER TABLE "company_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_registrations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "company_registrations"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "esocial_eventos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "esocial_eventos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "esocial_eventos"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos já vêm de ALTER DEFAULT PRIVILEGES (docker/postgres-init/01-roles.sql).

-- esocial_eventos é um livro-razão imutável na prática (um evento "emitido"
-- não deveria ter seu XML reescrito por baixo do contador depois que ele já
-- pode ter sido conferido) — mesmo raciocínio de accounts_payable_payments/
-- stock_movements. UPDATE continua permitido só para os dois campos que o
-- contador preenche manualmente depois (status/submissionProtocol); como o
-- Postgres não faz REVOKE por coluna de forma prática aqui, a restrição de
-- "só esses dois campos mudam depois de criado" fica a cargo do serviço
-- (EsocialEventosService), não do banco — mesmo padrão usado em BudgetPlan/
-- BankReconciliation para imutabilidade pós-POSTED.
REVOKE DELETE ON "esocial_eventos" FROM app_user;

-- company_registrations é cadastro/configuração normal (como payroll_settings/
-- fiscal_tax_settings) — sem REVOKE de propósito.
