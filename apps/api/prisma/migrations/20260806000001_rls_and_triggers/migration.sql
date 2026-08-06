-- ============================================================================
-- Row-Level Security: isolamento total entre organizações (tenants)
-- ============================================================================
-- O contexto de tenant é definido por requisição via:
--   SELECT set_config('app.current_org_id', '<uuid>', true)
-- executado como primeira instrução da MESMA transação que roda as queries
-- do handler (ver src/tenancy/tenancy.interceptor.ts). `true` = escopo local
-- à transação (equivalente a SET LOCAL), nunca vaza para outras conexões do pool.
--
-- NULLIF(current_setting(..., true), '') faz toda policy falhar fechada
-- (zero linhas) quando o contexto não foi definido — nunca um erro, nunca
-- "libera tudo".
--
-- FORCE ROW LEVEL SECURITY é aplicado em todas as tabelas de tenant, inclusive
-- para o papel dono (`app_migrator`). Isso significa que TODO código que
-- escreve nessas tabelas — a API em runtime (app_user) e scripts
-- administrativos/seed (app_migrator) — precisa definir o contexto do tenant
-- antes de operar. Não existe caminho de bypass silencioso.

-- ----------------------------------------------------------------------------
-- organizations: tabela raiz do tenant. SELECT é público dentro da aplicação
-- (nome/slug não são dados sensíveis) porque o fluxo de login precisa
-- resolver o tenant pelo slug ANTES de existir qualquer contexto autenticado.
-- Escrita (INSERT/UPDATE) continua restrita ao próprio tenant: o registro de
-- uma nova organização define o contexto para o id recém-gerado antes do
-- INSERT, satisfazendo o WITH CHECK.
-- ----------------------------------------------------------------------------
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_public ON "organizations"
  FOR SELECT USING (true);

CREATE POLICY organizations_insert_own ON "organizations"
  FOR INSERT WITH CHECK (id = NULLIF(current_setting('app.current_org_id', true), ''));

CREATE POLICY organizations_update_own ON "organizations"
  FOR UPDATE
  USING (id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (id = NULLIF(current_setting('app.current_org_id', true), ''));

-- ----------------------------------------------------------------------------
-- Demais tabelas de tenant: policy única de isolamento total (USING = WITH CHECK).
-- ----------------------------------------------------------------------------
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "role_permissions"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_roles"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "refresh_tokens"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "cost_centers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_centers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cost_centers"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounts"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "sequence_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sequence_counters" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sequence_counters"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "journal_entries"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

ALTER TABLE "journal_entry_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entry_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "journal_entry_lines"
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));

-- `permissions` é catálogo global de sistema (module:action), não é dado de
-- tenant — sem organization_id, sem RLS. Só leitura para app_user (grants abaixo).

-- ============================================================================
-- GRANT / REVOKE para o papel de runtime (app_user)
-- ============================================================================
-- Privilégios básicos (SELECT/INSERT/UPDATE/DELETE em todas as tabelas) já
-- vêm de ALTER DEFAULT PRIVILEGES definido em docker/postgres-init/01-roles.sql.
-- Aqui revogamos o que a integridade contábil exige que NINGUÉM (nem um bug
-- de aplicação) consiga fazer via SQL direto:

-- Lançamentos contábeis são imutáveis: correção só via lançamento de estorno
-- (reversal_of_id). Isso é garantido pelo Postgres, não apenas pela ausência
-- de endpoint PUT/DELETE na API.
REVOKE UPDATE, DELETE ON "journal_entries" FROM app_user;
REVOKE UPDATE, DELETE ON "journal_entry_lines" FROM app_user;

-- Plano de contas não é hard-deletável: desativação via is_active (uma conta
-- com lançamentos ou filhos não pode simplesmente sumir do histórico).
REVOKE DELETE ON "accounts" FROM app_user;

-- Catálogo de permissões é gerenciado só por migração/seed administrativo.
REVOKE INSERT, UPDATE, DELETE ON "permissions" FROM app_user;

-- ============================================================================
-- Trigger: manter accounts.is_analytic automaticamente
-- ============================================================================
-- Só contas SEM filhos (folhas da hierarquia) podem receber lançamento.
-- A aplicação nunca define is_analytic diretamente — é recalculado aqui
-- sempre que a hierarquia de contas muda (conta ganha, perde ou troca de pai).
CREATE OR REPLACE FUNCTION fn_accounts_maintain_is_analytic() RETURNS TRIGGER AS $$
DECLARE
  v_parent_id TEXT;
  v_old_parent_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_parent_id := OLD.parent_id;
  ELSE
    v_parent_id := NEW.parent_id;
  END IF;

  IF v_parent_id IS NOT NULL THEN
    UPDATE "accounts"
    SET is_analytic = NOT EXISTS (SELECT 1 FROM "accounts" WHERE parent_id = v_parent_id)
    WHERE id = v_parent_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_parent_id := OLD.parent_id;
    IF v_old_parent_id IS NOT NULL AND v_old_parent_id IS DISTINCT FROM v_parent_id THEN
      UPDATE "accounts"
      SET is_analytic = NOT EXISTS (SELECT 1 FROM "accounts" WHERE parent_id = v_old_parent_id)
      WHERE id = v_old_parent_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounts_maintain_is_analytic
AFTER INSERT OR UPDATE OF parent_id OR DELETE ON "accounts"
FOR EACH ROW EXECUTE FUNCTION fn_accounts_maintain_is_analytic();

-- ============================================================================
-- Trigger: validar linha de lançamento antes de inserir
-- ============================================================================
-- Garante, no banco (não só na aplicação): a linha pertence à mesma
-- organização do lançamento; a conta existe, é da mesma organização, está
-- ativa e é analítica (só folha recebe lançamento); e o valor é positivo.
CREATE OR REPLACE FUNCTION fn_journal_entry_lines_validate() RETURNS TRIGGER AS $$
DECLARE
  v_entry_org TEXT;
  v_account "accounts"%ROWTYPE;
BEGIN
  SELECT organization_id INTO v_entry_org FROM "journal_entries" WHERE id = NEW.journal_entry_id;
  IF v_entry_org IS NULL THEN
    RAISE EXCEPTION 'Lançamento contábil % não encontrado', NEW.journal_entry_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM v_entry_org THEN
    RAISE EXCEPTION 'organization_id da linha (%) não confere com o lançamento (%)', NEW.organization_id, v_entry_org
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_account FROM "accounts" WHERE id = NEW.account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta contábil % não encontrada', NEW.account_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_account.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Conta contábil % pertence a outra organização', NEW.account_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT v_account.is_analytic THEN
    RAISE EXCEPTION 'Conta contábil % é sintética e não pode receber lançamentos', v_account.code
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'Conta contábil % está inativa', v_account.code
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Valor da linha de lançamento deve ser maior que zero'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_entry_lines_validate
BEFORE INSERT ON "journal_entry_lines"
FOR EACH ROW EXECUTE FUNCTION fn_journal_entry_lines_validate();

-- ============================================================================
-- Constraint trigger: partida dobrada balanceada
-- ============================================================================
-- Checado no COMMIT (DEFERRABLE INITIALLY DEFERRED), depois que todas as
-- linhas de um lançamento já foram inseridas na mesma transação: soma de
-- débitos menos créditos deve ser zero, e deve haver ao menos uma linha de
-- cada direção.
CREATE OR REPLACE FUNCTION fn_check_journal_entry_balanced() RETURNS TRIGGER AS $$
DECLARE
  v_journal_entry_id TEXT;
  v_balance NUMERIC;
  v_debit_count INT;
  v_credit_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_journal_entry_id := OLD.journal_entry_id;
  ELSE
    v_journal_entry_id := NEW.journal_entry_id;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END), 0),
    COUNT(*) FILTER (WHERE direction = 'DEBIT'),
    COUNT(*) FILTER (WHERE direction = 'CREDIT')
  INTO v_balance, v_debit_count, v_credit_count
  FROM "journal_entry_lines"
  WHERE journal_entry_id = v_journal_entry_id;

  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'Lançamento % desbalanceado: diferença de %', v_journal_entry_id, v_balance
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_debit_count = 0 OR v_credit_count = 0 THEN
    RAISE EXCEPTION 'Lançamento % precisa de ao menos uma linha de débito e uma de crédito', v_journal_entry_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_journal_entry_balanced
AFTER INSERT OR UPDATE OR DELETE ON "journal_entry_lines"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION fn_check_journal_entry_balanced();
