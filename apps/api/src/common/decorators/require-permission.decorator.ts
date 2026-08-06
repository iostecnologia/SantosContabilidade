import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSION_KEY = "requiredPermission";

/**
 * Exige que o usuário autenticado tenha a permissão `module:action` (ver
 * PERMISSION_CATALOG) para acessar a rota. Checado por PermissionsGuard
 * contra as permissões "assadas" no JWT no momento do login.
 */
export const RequirePermission = (permission: string) => SetMetadata(REQUIRE_PERMISSION_KEY, permission);
