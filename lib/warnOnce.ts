// Logs a setup warning (e.g. "RECAPTCHA_SECRET_KEY is not set") once per
// server instance instead of on every request.
const warned = new Set<string>();

export function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}
