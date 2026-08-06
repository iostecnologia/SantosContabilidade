import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marca uma rota como pública: nem JwtAuthGuard exige token, nem
 * TenancyInterceptor abre transação/contexto de tenant para ela.
 * Usado só pelo bootstrapping (registro de organização, login, refresh).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
