-- ============================================================================
-- Row-Level Security: módulo Orçamento
-- ============================================================================
-- Mesmo padrão de 20260806000001_rls_and_triggers, 20260806000003_financeiro_rls
-- e 20260806000005_fixed_assets_rls.

ALTER TABLE "budget_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "budget_plans"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "budget_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "budget_lines"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ============================================================================
-- CHECK constraint: mês válido (1 a 12)
-- ============================================================================
-- Prisma não expressa CHECK constraints no schema.prisma deste projeto —
-- reforço aqui o que o DTO já valida na API, mesmo raciocínio do trigger de
-- "amount > 0" em journal_entry_lines.
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_month_check" CHECK (month BETWEEN 1 AND 12);

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos já vêm de ALTER DEFAULT PRIVILEGES (docker/postgres-init/01-roles.sql).

-- Sem REVOKE de propósito, diferente de journal_entries/pagamentos/depreciações:
-- orçamento não posta lançamento algum (mesmo raciocínio de FixedAsset — ver
-- comentário no schema) e linhas/planos em DRAFT são legitimamente editáveis.
-- A imutabilidade pós-aprovação (plano não-DRAFT e suas linhas) é regra de
-- aplicação (BudgetService), não de banco — mesmo padrão usado para a base de
-- cálculo de FixedAsset (residual_value/useful_life_months).
