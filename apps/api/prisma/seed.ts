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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
