// Generate the three fixed passwords and the admin two-factor secret.
// Prints the passwords once (give them to the right people) and the values to put in the hosting
// environment (Vercel project settings). Nothing is written to disk.
import { randomBytes, scryptSync } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32 = buf => { let bits = 0, v = 0, out = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(v << (5 - bits)) & 31]; return out; };
const words = () => randomBytes(15).toString('base64url');
const hash = pw => { const salt = randomBytes(16); return ['scrypt', 16384, 8, 1, salt.toString('base64url'), scryptSync(pw.normalize('NFKC'), salt, 32, { N: 16384, r: 8, p: 1 }).toString('base64url')].join('$'); };

const accounts = [['nutritionist', 'ANNAM_NUTRITIONIST_PASSWORD_HASH'], ['rmclinic', 'ANNAM_CLINIC_PASSWORD_HASH'], ['admin', 'ANNAM_ADMIN_PASSWORD_HASH']];
const totp = b32(randomBytes(20));
console.log('\nPasswords (share each one only with its team):');
const env = [];
for (const [user, key] of accounts) { const pw = words(); console.log(`  ${user.padEnd(13)} ${pw}`); env.push(`${key}=${hash(pw)}`); }
console.log(`\nAdmin two-factor: add this secret to an authenticator app (Google Authenticator, 1Password, etc.):\n  ${totp}\n  otpauth://totp/Annam:admin?secret=${totp}&issuer=Annam\n`);
env.push(`ANNAM_ADMIN_TOTP_SECRET=${totp}`, `CRON_SECRET=${randomBytes(24).toString('base64url')}`);
console.log('Environment variables for the server (keep secret):');
for (const e of env) console.log('  ' + e);
console.log('');
