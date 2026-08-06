export interface AccessTokenPayload {
  sub: string;
  organizationId: string;
  email: string;
  permissions: string[];
  securityStamp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  organizationId: string;
  familyId: string;
  jti: string;
}
