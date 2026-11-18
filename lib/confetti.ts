// Confetti in the MentorsMD colours (Nov 18, 2026; copied from AdmitMD), for the small celebrations in
// lib/moments.ts. Browser only. One canvas over the page, made on first use and kept across page changes,
// so a burst keeps going when a pop-up closes. Nothing happens for people who ask for reduced motion.

const COLORS = ["#5536D6", "#3F24B0", "#BFB0FF", "#F5B9CD", "#DDD5FF", "#E4EEFF"];
type Piece = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; t0: number; life: number; g: number };
export type BurstOptions = { count?: number; speed?: number; size?: number; spread?: number; life?: number };

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let pieces: Piece[] = [];
let running = false;

export const SMALL: BurstOptions = { count: 24, speed: 4.5, size: 0.6, spread: Math.PI * 2, life: 1100 };
export const BIG: BurstOptions = { count: 90, speed: 8.5, size: 1, spread: Math.PI * 1.1, life: 2400 };

export function burst(x: number, y: number, o: BurstOptions = BIG) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { count = 80, speed = 8, size = 1, spread = Math.PI * 1.1, life = 2400 } = o;
  if (!canvas || !canvas.isConnected) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "10000" });
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(innerWidth * dpr) || canvas.height !== Math.round(innerHeight * dpr)) {
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const t0 = performance.now();
  for (let n = 0; n < count; n++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * spread, sp = speed * (0.6 + Math.random() * 0.8);
    pieces.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: (6 + Math.random() * 6) * size, h: (3 + Math.random() * 5) * size, c: COLORS[(Math.random() * COLORS.length) | 0], t0, life, g: 0.32 * Math.max(0.5, size) });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
}

// Confetti from the middle of an element, or of a box measured earlier (e.g. before a pop-up closed).
export function burstFrom(el: Element | DOMRect | null | undefined, o?: BurstOptions) {
  if (!el) return;
  const r = el instanceof Element ? (el.getClientRects().length ? el.getBoundingClientRect() : null) : el;
  if (!r || (!r.width && !r.height)) return;
  burst(r.left + r.width / 2, r.top + r.height / 2, o);
}

function frame(now: number) {
  if (!ctx) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  pieces = pieces.filter((p) => now - p.t0 < p.life);
  for (const p of pieces) {
    p.vy += p.g;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.r += p.vr;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (now - p.t0) / p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.scale(1, Math.cos(p.r * 2));
    ctx.fillStyle = p.c;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  if (pieces.length) requestAnimationFrame(frame);
  else {
    running = false;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}
