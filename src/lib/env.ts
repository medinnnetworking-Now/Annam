// Settings pasted into a hosting dashboard often pick up spaces or line breaks. Trim them once, at start-up,
// before anything reads them.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('ANNAM_') || key === 'CRON_SECRET' || key === 'DATABASE_URL' || key === 'POSTGRES_URL') {
    const v = process.env[key];
    if (typeof v === 'string' && v !== v.trim()) process.env[key] = v.trim();
  }
}
export {};
