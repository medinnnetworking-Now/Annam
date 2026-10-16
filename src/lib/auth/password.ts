// Password hashing with scrypt (node:crypto). Format: scrypt$N$r$p$salt$hash, base64url.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384, R = 8, P = 1, LEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize('NFKC'), salt, LEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) {
    scryptSync(password, 'decoy', LEN, { N, r: R, p: P }); // keep timing similar for disabled accounts
    return false;
  }
  const expected = Buffer.from(hash, 'base64url');
  const got = scryptSync(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, { N: +n, r: +r, p: +p });
  return got.length === expected.length && timingSafeEqual(got, expected);
}
