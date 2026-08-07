-- ============================================================================
-- Row-Level Security: apuração tributária do módulo Fiscal
-- ============================================================================
-- Mesmo padrão de 20260806000001_rls_and_triggers e das migrações de RLS
-- subsequentes (financeiro, ativo fixo, orçamento, almoxarifado, conciliação
-- bancária, departamento pessoal).

ALTER TABLE "fiscal_tax_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiscal_tax_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fiscal_tax_settings"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "simples_nacional_brackets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "simples_nacional_brackets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "simples_nacional_brackets"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "icms_uf_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icms_uf_rates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "icms_uf_rates"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "fiscal_documentos_emitidos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiscal_documentos_emitidos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fiscal_documentos_emitidos"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos já vêm de ALTER DEFAULT PRIVILEGES (docker/postgres-init/01-roles.sql).

-- fiscal_documentos_emitidos é imutável por design (mesmo raciocínio de
-- journal_entries): um documento fiscal emitido não é editado — correção é
-- por documento de ajuste/estorno do lançamento contábil associado, nunca
-- editando o snapshot já emitido.
REVOKE UPDATE, DELETE ON "fiscal_documentos_emitidos" FROM app_user;

-- Sem REVOKE nas demais: fiscal_tax_settings/simples_nacional_brackets/
-- icms_uf_rates são configuração normal, editável a qualquer momento pelo
-- serviço (mesmo raciocínio de PayrollSettings/PayrollTaxBracket).
