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
