type AdminClaims = {
  role?: unknown;
  isAdmin?: unknown;
};

export function hasAdminPrivileges(claims: AdminClaims | null | undefined): boolean {
  return claims?.role === 'admin' || claims?.isAdmin === true;
}
