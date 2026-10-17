// Roles and what each may do. Checked on the server for every page, action and route.
export type Role = 'clinic' | 'nutritionist' | 'admin';

export const ACCOUNTS: { username: string; role: Role; displayName: string; env: string; devPassword: string }[] = [
  { username: 'nutritionist', role: 'nutritionist', displayName: 'Nutritionist', env: 'ANNAM_NUTRITIONIST_PASSWORD_HASH', devPassword: 'annam-nutritionist-dev' },
  { username: 'rmclinic', role: 'clinic', displayName: 'RM Clinic staff', env: 'ANNAM_CLINIC_PASSWORD_HASH', devPassword: 'annam-clinic-dev' },
  { username: 'admin', role: 'admin', displayName: 'Admin', env: 'ANNAM_ADMIN_PASSWORD_HASH', devPassword: 'annam-admin-dev' }
];

const P = {
  'patient.view': ['clinic', 'nutritionist'],
  'patient.create': ['clinic'],
  'patient.state': ['clinic'],
  'patient.export': ['clinic'],
  'consent.withdraw': ['clinic'],
  'visit.create': ['clinic', 'nutritionist'],
  'plate.upload': ['clinic', 'nutritionist'],
  'plate.review': ['nutritionist'],
  'plate.delete': ['clinic', 'nutritionist'],
  'review.write': ['nutritionist'],
  'report.create': ['clinic', 'nutritionist'],
  'report.approve': ['clinic'], // records the doctor's decision and approval, by name
  'alert.acknowledge': ['clinic'],
  'cohort.view': ['admin', 'clinic'],
  'audit.view': ['admin']
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof P;
export const can = (role: Role, p: Permission) => (P[p] as readonly Role[]).includes(role);
export const PERMISSION_TABLE = P;

export const HOME: Record<Role, string> = { clinic: '/patients', nutritionist: '/patients', admin: '/cohort' };
export const SESSION_HOURS: Record<Role, number> = { clinic: 10, nutritionist: 10, admin: 2 };
export const MAX_FAILED_SIGN_INS = 5;
export const LOCK_MINUTES = 15;

/**
 * Failed attempts after one more wrong password. A lock that has run out starts the count again,
 * so people get the full number of tries after waiting, not one.
 */
export function afterFailedSignIn(failedAttempts: number, lockedUntil: string | null, now = new Date()): { failedAttempts: number; lock: boolean } {
  const lockExpired = lockedUntil !== null && new Date(lockedUntil) <= now;
  const failed = (lockExpired ? 0 : failedAttempts) + 1;
  return { failedAttempts: failed, lock: failed >= MAX_FAILED_SIGN_INS };
}
