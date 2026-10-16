// Run the retention job by hand against a deployment: node scripts/retention.mjs https://your-app CRON_SECRET
const [url, secret] = process.argv.slice(2);
if (!url || !secret) { console.error('Usage: node scripts/retention.mjs <base-url> <CRON_SECRET>'); process.exit(1); }
const r = await fetch(new URL('/api/cron/retention', url), { headers: { authorization: `Bearer ${secret}` } });
console.log(r.status, await r.text());
