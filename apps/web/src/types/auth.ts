export interface OrganizationSummary {
  id: string;
  slug: string;
  name: string;
}

export interface LoginResponse {
  organization: OrganizationSummary;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
}

export interface AccessTokenClaims {
  sub: string;
  organizationId: string;
  email: string;
  permissions: string[];
  securityStamp: number;
  exp: number;
  iat: number;
}
