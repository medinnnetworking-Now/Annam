import { expect, it } from 'vitest';

it('trims stray spaces from Annam settings only', async () => {
  process.env.ANNAM_TEST_VALUE = '  scrypt$abc \n';
  process.env.CRON_SECRET = ' secret ';
  process.env.OTHER_VALUE = ' keep ';
  await import('./env');
  expect(process.env.ANNAM_TEST_VALUE).toBe('scrypt$abc');
  expect(process.env.CRON_SECRET).toBe('secret');
  expect(process.env.OTHER_VALUE).toBe(' keep ');
});

it('removes SSL options from a database address but keeps everything else', async () => {
  const { cleanUrl } = await import('./db');
  expect(cleanUrl('postgres://u:p%40ss@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x&application_name=annam'))
    .toBe('postgres://u:p%40ss@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?application_name=annam');
});
