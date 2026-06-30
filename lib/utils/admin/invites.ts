export const ADMIN_EMAIL_PATTERN = /^[^\s@]+@(?:[^\s@]+\.)*kanazawa-it\.ac\.jp$/i;

export function normalizeAdminInviteEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAIL_PATTERN.test(normalized) ? normalized : '';
}

export function buildAdminInviteDisplayName(email: string): string {
  return email.split('@')[0] || '';
}

export function buildAdminRecordUpdatePayload(params: {
  email: string;
  displayName: string;
  now: Date;
}): {
  adminId?: string;
  email: string;
  name: string;
  isActive: true;
  updatedAt: Date;
} {
  return {
    email: params.email,
    name: params.displayName,
    isActive: true,
    updatedAt: params.now,
  };
}

export function buildAdminRecordCreatePayload(params: {
  adminId: string;
  email: string;
  displayName: string;
  now: Date;
}) {
  return {
    adminId: params.adminId,
    email: params.email,
    name: params.displayName,
    isActive: true,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

export function buildAdminInviteLogPayload(params: {
  email: string;
  displayName: string;
  invitedBy: string;
  operation: 'created' | 'updated';
  uid: string;
  now: Date;
}) {
  return {
    email: params.email,
    name: params.displayName,
    invitedBy: params.invitedBy,
    invitedAt: params.now,
    operation: params.operation,
    uid: params.uid,
  };
}
