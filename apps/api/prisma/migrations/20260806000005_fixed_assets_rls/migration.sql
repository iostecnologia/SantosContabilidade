-- ============================================================================
-- Row-Level Security: módulo Ativo Fixo / Depreciação
-- ============================================================================
-- Mesmo padrão de 20260806000001_rls_and_triggers e 20260806000003_financeiro_rls.

ALTER TABLE "fixed_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fixed_assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fixed_assets"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "fixed_asset_depreciation_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fixed_asset_depreciation_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fixed_asset_depreciation_entries"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos já vêm de ALTER DEFAULT PRIVILEGES (docker/postgres-init/01-roles.sql).

-- `fixed_assets` NÃO tem REVOKE de propósito: diferente de accounts_payable/
-- accounts_receivable, cadastrar um ativo não posta lançamento algum (ver
-- comentário em FixedAsset no schema) — então um registro sem histórico de
-- depreciação é seguro de apagar de verdade. UPDATE e DELETE continuam
-- concedidos; a aplicação é quem guarda a regra (só deleta/edita a base de
-- cálculo sem depreciação já lançada), mesmo padrão de `cost_centers`.

-- Depreciações lançadas são apêndice imutável do ativo, mesmo padrão de
-- journal_entries/pagamentos/recebimentos: uma vez registradas, não são
-- editáveis nem removíveis via SQL direto.
REVOKE UPDATE, DELETE ON "fixed_asset_depreciation_entries" FROM app_user;
