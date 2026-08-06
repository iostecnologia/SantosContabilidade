import { PrismaClient } from "@prisma/client";
import { PERMISSION_CATALOG, permissionKey } from "../src/common/permissions/permission-catalog";

// Roda como app_migrator (dono das tabelas): a tabela `permissions` tem
// INSERT/UPDATE/DELETE revogados de app_user (ver migração de RLS), de
// propósito — o catálogo global só pode ser alterado por este script.
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL },
  },
});

/**
 * `RolesService.setPermissions` recusa alterar papéis `isSystem` (o
 * "Administrador" criado no registro de cada organização) — de propósito,
 * pra impedir um admin de auto-remover o próprio acesso total. Mas isso
 * significa que, sem este passo, um papel de sistema criado ANTES de um
 * módulo novo existir nunca ganha as permissões desse módulo: o catálogo
 * cresce, o papel fica pra trás. Aqui replicamos o bootstrap de
 * AuthService.registerOrganization (concede TODAS as permissões do
 * catálogo) para papéis de sistema já existentes, mantendo a promessa de
 * que "Administrador" sempre tem acesso total.
 *
 * RLS força contexto de tenant pra tudo, inclusive pra este papel dono
 * (FORCE ROW LEVEL SECURITY) — só `organizations` é de leitura pública,
 * então iteramos org por org, abrindo uma transação e definindo
 * app.current_org_id antes de tocar roles/role_permissions/users daquele
 * tenant (mesmo padrão do tenancy.interceptor.ts).
 */
async function syncSystemRolePermissions(): Promise<void> {
  const permissions = await prisma.permission.findMany({ select: { id: true } });
  const organizations = await prisma.organization.findMany({ select: { id: true } });

  let rolesSynced = 0;
  for (const org of organizations) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org.id}, true)`;

      const systemRoles = await tx.role.findMany({
        where: { organizationId: org.id, isSystem: true },
        select: { id: true },
      });

      for (const role of systemRoles) {
        const { count } = await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ organizationId: org.id, roleId: role.id, permissionId: p.id })),
          skipDuplicates: true,
        });
        if (count > 0) {
          rolesSynced += 1;
          // Mesma lógica de RolesService.bumpSecurityStampForRoleUsers:
          // força reautenticação pra que a mudança de permissões valha no
          // JWT (que "assa" a lista de permissões no login).
          await tx.$executeRaw`
            UPDATE users SET security_stamp = security_stamp + 1
            WHERE organization_id = ${org.id}
              AND id IN (SELECT user_id FROM user_roles WHERE organization_id = ${org.id} AND role_id = ${role.id})
          `;
        }
      }
    });
  }

  console.log(`Papéis de sistema sincronizados com o catálogo completo: ${rolesSynced}.`);
}

async function main() {
  for (const { module, action } of PERMISSION_CATALOG) {
    const key = permissionKey(module, action);
    await prisma.permission.upsert({
      where: { key },
      update: { module, action },
      create: { module, action, key },
    });
  }
  console.log(`Catálogo de permissões: ${PERMISSION_CATALOG.length} entradas sincronizadas.`);

  await syncSystemRolePermissions();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
