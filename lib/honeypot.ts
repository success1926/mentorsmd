// Hidden "trap" field on public forms (signup, login, forgot password,
// mentor signup, mentor application). People never see it, so anything
// typed into it means a bot filled in the form.
// (Same name the mentor application already used.)
export const HONEYPOT_FIELD = "website";

export function isBot(body: any): boolean {
  const v = body && typeof body === "object" ? body[HONEYPOT_FIELD] : undefined;
  return typeof v === "string" ? v.trim().length > 0 : !!v;
}
