import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Prova que o isolamento multi-tenant é garantido pelo PostgreSQL (Row-Level
 * Security), não apenas por convenção de código. Conecta diretamente via
 * `pg`, como os papéis `app_migrator` (dono, roda a seed abaixo) e
 * `app_user` (runtime da API) — nunca passa pela camada de serviço do
 * NestJS, de propósito: se um bug de aplicação algum dia esquecer um
 * `WHERE organization_id = ?`, este teste teria que continuar passando
 * mesmo assim, porque quem garante o isolamento é o banco.
 *
 * Requer um Postgres com as migrações + roles aplicadas (ver README:
 * `docker-compose up -d`, `npm run prisma:migrate`). Pula automaticamente
 * se as variáveis de conexão não apontarem para um banco acessível.
 */

const MIGRATE_URL =
  process.env.MIGRATE_DATABASE_URL ?? "postgresql://app_migrator:app_migrator_dev_password@localhost:5432/santos_saf";
const APP_URL = process.env.DATABASE_URL ?? "postgresql://app_user:app_user_dev_password@localhost:5432/santos_saf";

async function withClient<T>(connectionString: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function setOrgContext(client: Client, organizationId: string | null): Promise<void> {
  await client.query("SELECT set_config('app.current_org_id', $1, true)", [organizationId ?? ""]);
}

describe("Isolamento multi-tenant via Row-Level Security", () => {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const accountA = randomUUID();
  const accountB = randomUUID();
  const journalEntryA = randomUUID();

  beforeAll(async () => {
    await withClient(MIGRATE_URL, async (admin) => {
      // app_migrator é dono das tabelas, mas FORCE ROW LEVEL SECURITY vale
      // até para o dono: precisa setar o contexto do tenant antes de
      // escrever, exatamente como a aplicação faz em produção.
      for (const [orgId, slug, name, accountId] of [
        [orgA, `empresa-a-${orgA.slice(0, 8)}`, "Empresa A", accountA],
        [orgB, `empresa-b-${orgB.slice(0, 8)}`, "Empresa B", accountB],
      ] as const) {
        await admin.query("BEGIN");
        await setOrgContext(admin, orgId);
        await admin.query(
          `INSERT INTO organizations (id, slug, name, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, true, now(), now())`,
          [orgId, slug, name],
        );
        await admin.query(
          `INSERT INTO accounts (id, organization_id, code, name, type, is_analytic, is_active, created_at, updated_at)
           VALUES ($1, $2, '1.1.01', 'Caixa', 'ASSET', true, true, now(), now())`,
          [accountId, orgId],
        );
        await admin.query("COMMIT");
      }

      // Um lançamento contábil balanceado em Org A, usado pelo teste de imutabilidade.
      await admin.query("BEGIN");
      await setOrgContext(admin, orgA);
      await admin.query(
        `INSERT INTO journal_entries
           (id, organization_id, entry_number, entry_date, competence_date, description, created_by, created_at)
         VALUES ($1, $2, 1, CURRENT_DATE, CURRENT_DATE, 'Lançamento de teste', $3, now())`,
        [journalEntryA, orgA, randomUUID()],
      );
      await admin.query(
        `INSERT INTO journal_entry_lines
           (id, organization_id, journal_entry_id, account_id, direction, amount, line_number)
         VALUES ($1, $2, $3, $4, 'DEBIT', 100.00, 1),
                ($5, $2, $3, $4, 'CREDIT', 100.00, 2)`,
        [randomUUID(), orgA, journalEntryA, accountA, randomUUID()],
      );
      await admin.query("COMMIT");
    });
  });

  it("RLS: contexto de Org A só enxerga contas de Org A, mesmo com linhas de Org B na tabela", async () => {
    await withClient(APP_URL, async (client) => {
      await client.query("BEGIN");
      await setOrgContext(client, orgA);
      const result = await client.query("SELECT id, organization_id FROM accounts");
      await client.query("COMMIT");

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every((row) => row.organization_id === orgA)).toBe(true);
      expect(result.rows.some((row) => row.id === accountB)).toBe(false);
    });
  });

  it("RLS sobrepõe um WHERE de aplicação errado: filtrar por Org B com contexto em Org A retorna zero linhas", async () => {
    await withClient(APP_URL, async (client) => {
      await client.query("BEGIN");
      await setOrgContext(client, orgA);
      const result = await client.query("SELECT id FROM accounts WHERE organization_id = $1", [orgB]);
      await client.query("COMMIT");

      expect(result.rows).toHaveLength(0);
    });
  });

  it("fail-closed: transação sem contexto de tenant definido retorna zero linhas, nunca todas", async () => {
    await withClient(APP_URL, async (client) => {
      await client.query("BEGIN");
      // Nenhum set_config chamado nesta transação.
      const result = await client.query("SELECT id FROM accounts");
      await client.query("COMMIT");

      expect(result.rows).toHaveLength(0);
    });
  });

  it("WITH CHECK bloqueia INSERT em outra organização mesmo com contexto definido", async () => {
    await withClient(APP_URL, async (client) => {
      await client.query("BEGIN");
      await setOrgContext(client, orgA);

      await expect(
        client.query(
          `INSERT INTO accounts (id, organization_id, code, name, type, is_analytic, is_active, created_at, updated_at)
           VALUES ($1, $2, '9.9.99', 'Conta cross-tenant', 'ASSET', true, true, now(), now())`,
          [randomUUID(), orgB],
        ),
      ).rejects.toThrow();

      await client.query("ROLLBACK");
    });
  });

  it("imutabilidade: app_user não pode UPDATE nem DELETE em journal_entries", async () => {
    await withClient(APP_URL, async (client) => {
      await client.query("BEGIN");
      await setOrgContext(client, orgA);

      await expect(
        client.query("UPDATE journal_entries SET description = 'alterado' WHERE id = $1", [journalEntryA]),
      ).rejects.toThrow(/permission denied/i);

      await expect(client.query("DELETE FROM journal_entries WHERE id = $1", [journalEntryA])).rejects.toThrow(
        /permission denied/i,
      );

      await client.query("ROLLBACK");
    });
  });

  it("contador de lançamentos: N incrementos concorrentes na mesma org geram {1..N} sem duplicata nem buraco", async () => {
    const counterOrg = randomUUID();
    await withClient(MIGRATE_URL, async (admin) => {
      await admin.query("BEGIN");
      await setOrgContext(admin, counterOrg);
      await admin.query(
        `INSERT INTO organizations (id, slug, name, is_active, created_at, updated_at)
         VALUES ($1, $2, 'Empresa Concorrência', true, now(), now())`,
        [counterOrg, `empresa-concorrencia-${counterOrg.slice(0, 8)}`],
      );
      await admin.query("COMMIT");
    });

    const N = 20;
    const increments = await Promise.all(
      Array.from({ length: N }, () =>
        withClient(APP_URL, async (client) => {
          await client.query("BEGIN");
          await setOrgContext(client, counterOrg);
          const result = await client.query<{ current_value: string }>(
            `INSERT INTO sequence_counters (organization_id, counter_key, current_value)
             VALUES ($1, 'journal_entry', 1)
             ON CONFLICT (organization_id, counter_key)
             DO UPDATE SET current_value = sequence_counters.current_value + 1
             RETURNING current_value`,
            [counterOrg],
          );
          await client.query("COMMIT");
          return Number(result.rows[0].current_value);
        }),
      ),
    );

    const sorted = [...increments].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: N }, (_, i) => i + 1));
  });
});
