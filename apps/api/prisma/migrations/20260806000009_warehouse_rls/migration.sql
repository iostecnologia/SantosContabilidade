-- ============================================================================
-- Row-Level Security: módulo Almoxarifado
-- ============================================================================
-- Mesmo padrão de 20260806000001_rls_and_triggers, 20260806000003_financeiro_rls,
-- 20260806000005_fixed_assets_rls e 20260806000007_budget_rls.

ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "warehouses"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_items"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "warehouse_stock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouse_stock" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "warehouse_stock"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "stock_movements"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "stock_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_transfers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "stock_transfers"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ============================================================================
-- CHECK constraints: quantidades/custos nunca negativos ou zerados onde não faz sentido
-- ============================================================================
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_total_quantity_check" CHECK (total_quantity >= 0);
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_average_cost_check" CHECK (average_cost >= 0);

ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_quantity_check" CHECK (quantity >= 0);

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_check" CHECK (quantity > 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_unit_cost_check" CHECK (unit_cost > 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_total_cost_check" CHECK (total_cost > 0);

ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_quantity_check" CHECK (quantity > 0);
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_warehouses_distinct_check" CHECK (from_warehouse_id <> to_warehouse_id);

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos já vêm de ALTER DEFAULT PRIVILEGES (docker/postgres-init/01-roles.sql).

-- Depósitos e itens não são hard-deletáveis: desativação via is_active,
-- mesmo padrão de accounts/counterparties/bank_accounts.
REVOKE DELETE ON "warehouses" FROM app_user;
REVOKE DELETE ON "inventory_items" FROM app_user;

-- warehouse_stock é saldo interno mantido pelo serviço a cada movimento/
-- transferência (mesmo raciocínio de accumulated_depreciation em
-- fixed_assets) — sem REVOKE, a própria aplicação escreve nela o tempo todo.

-- Movimentos e transferências são apêndice imutável do item, mesmo padrão de
-- accounts_payable_payments/fixed_asset_depreciation_entries: uma vez
-- registrados, não são editáveis nem removíveis via SQL direto — correção é
-- sempre por um novo movimento em sentido contrário.
REVOKE UPDATE, DELETE ON "stock_movements" FROM app_user;
REVOKE UPDATE, DELETE ON "stock_transfers" FROM app_user;
