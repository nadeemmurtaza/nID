export interface AuthenticatedTenant {
  tenantId: string;
  apiKeyId: string;
  scopes: string[];
}
