// A tiny page with a "Continue" button, for one-time links in emails.
//
// Link previews in Messages, Slack, WhatsApp and some email apps (and the
// link scanners of work email) open every link on their own, which used
// to use up one-time links before the person ever clicked. They never
// press a button, so a one-time link only shows this page when opened
// (GET) and does its work when the button is pressed (a POST to the same
// address, with the same ?token=...).

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Without `button` it's just a message (the page shown after the button).
export function continuePage(opts: { title: string; text: string; button?: string }) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(opts.title)} · MentorsMD</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:96px 16px;box-sizing:border-box;background:#F6F3FF;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1B1834}
.card{width:100%;max-width:440px;background:#fff;border:1px solid #E7E3EF;border-radius:20px;padding:36px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px;box-shadow:0 20px 50px -24px rgba(63,36,176,.35)}
.brand{font-weight:700;font-size:20px;letter-spacing:-.02em;color:#5536D6}
h1{margin:0;font-family:Georgia,serif;font-weight:400;font-size:32px;line-height:1.1;letter-spacing:-.025em}
p{margin:0;color:#5D5973;line-height:1.55}
button{width:100%;min-height:50px;border-radius:999px;background:#BFB0FF;color:#1B1834;border:0;font:inherit;font-size:16px;font-weight:600;cursor:pointer}
button:hover{background:#AE9CFF}
</style></head><body><main class="card"><div class="brand">MentorsMD</div>
<h1>${esc(opts.title)}</h1><p>${esc(opts.text)}</p>
${opts.button ? `<form method="post"><button type="submit">${esc(opts.button)}</button></form>` : ""}
</main></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
