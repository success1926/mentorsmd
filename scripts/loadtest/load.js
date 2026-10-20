// Load test for MentorsMD, run with k6 (https://k6.io): brew install k6
// How to run it and read the results: scripts/loadtest/README.md
//
//   k6 run -e BASE_URL=https://www.mentorsmd.com scripts/loadtest/load.js
//
// Settings (all optional except BASE_URL):
//   PROFILE  smoke (default) | launch | spike   how many simulated visitors, and how fast they arrive
//   FORMS    trap (default) | off               trap: the waitlist and contact forms are sent with the
//                                               hidden spam-trap field filled in, so the site answers
//                                               "ok" and saves nothing. Safe on the live site.
//   BYPASS   Vercel "Protection Bypass for Automation" secret, for previews behind Vercel sign-in

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = (__ENV.BASE_URL || "").replace(/\/$/, "");
const PROFILE = __ENV.PROFILE || "smoke";
const FORMS = __ENV.FORMS || "trap";

if (!BASE) throw new Error("Set BASE_URL, e.g. -e BASE_URL=https://www.mentorsmd.com");
if (!["off", "trap"].includes(FORMS)) throw new Error("FORMS must be trap or off");

// Every visitor browses; about one in ten also fills out a form.
const PROFILES = {
  smoke: { browse: [{ duration: "5s", target: 5 }, { duration: "25s", target: 5 }], forms: [{ duration: "5s", target: 2 }, { duration: "25s", target: 2 }] },
  launch: {
    browse: [{ duration: "2m", target: 200 }, { duration: "5m", target: 200 }, { duration: "1m", target: 0 }],
    forms: [{ duration: "2m", target: 20 }, { duration: "5m", target: 20 }, { duration: "1m", target: 0 }],
  },
  spike: {
    browse: [{ duration: "30s", target: 1000 }, { duration: "2m", target: 1000 }, { duration: "30s", target: 0 }],
    forms: [{ duration: "30s", target: 100 }, { duration: "2m", target: 100 }, { duration: "30s", target: 0 }],
  },
};
const plan = PROFILES[PROFILE];
if (!plan) throw new Error(`PROFILE must be one of: ${Object.keys(PROFILES).join(", ")}`);

export const options = {
  scenarios: {
    browse: { executor: "ramping-vus", exec: "browse", startVUs: 0, stages: plan.browse, gracefulRampDown: "10s" },
    ...(FORMS === "off" ? {} : { forms: { executor: "ramping-vus", exec: "forms", startVUs: 0, stages: plan.forms, gracefulRampDown: "10s" } }),
  },
  // The test "fails" if more than 1% of requests error, or pages get slow.
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:page}": ["p(95)<1500"],
    "http_req_duration{kind:form}": ["p(95)<3000"],
  },
};

// Pauses between clicks, in seconds. The smoke run is a quick check, so its visitors hurry.
const pause = (min, spread) => sleep((min + Math.random() * spread) * (PROFILE === "smoke" ? 0.2 : 1));

const headers = __ENV.BYPASS ? { "x-vercel-protection-bypass": __ENV.BYPASS, "x-vercel-set-bypass-cookie": "true" } : {};

// Public pages a visitor might open. Rebuilt on every visit: /, /mentors, /mentors/<id>, /reviews, /contact.
const PAGES = ["/mentors", "/mentors", "/how-it-works", "/reviews", "/senior-team", "/become-a-mentor", "/contact", "/signup", "/login"];

function page(path, name = path) {
  const res = http.get(BASE + path, { headers, tags: { kind: "page", name } });
  check(res, { [`${name} loads`]: (r) => r.status === 200 });
  return res;
}

const mentorLinks = (res) => [...new Set([...String(res.body).matchAll(/href="(\/mentors\/[a-z0-9]+)"/g)].map((m) => m[1]))];

// One visitor: lands on the home page, opens 3–5 pages, and usually a mentor profile or two.
export function browse() {
  const home = page("/");
  let mentors = home.status === 200 ? mentorLinks(home) : [];
  pause(2, 3);
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const path = PAGES[Math.floor(Math.random() * PAGES.length)];
    const res = page(path);
    if (path === "/mentors" && res.status === 200) mentors = mentorLinks(res).length ? mentorLinks(res) : mentors;
    if (mentors.length && Math.random() < 0.6) {
      pause(2, 3);
      page(mentors[Math.floor(Math.random() * mentors.length)], "/mentors/[id]");
    }
    pause(2, 4);
  }
}

const trap = { website: "http://loadtest.invalid" };
const send = (path, body) => {
  const res = http.post(BASE + path, JSON.stringify({ ...body, ...trap }), {
    headers: { ...headers, "Content-Type": "application/json" },
    tags: { kind: "form", name: path },
  });
  check(res, { [`${path} answers`]: (r) => r.status === 200 });
};

// One visitor who fills out a form: opens the page, takes a while to fill it in, submits.
export function forms() {
  if (Math.random() < 0.5) {
    page("/mentors");
    pause(5, 10);
    send("/api/waitlist", { email: `loadtest+${__VU}-${__ITER}@example.com`, source: "mentors" });
  } else {
    page("/contact");
    pause(10, 20);
    send("/api/contact", { name: "Load Test", email: `loadtest+${__VU}-${__ITER}@example.com`, message: "Automated load test." });
  }
  pause(5, 0);
}
