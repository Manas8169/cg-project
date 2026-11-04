// Temple Treasure Escape — canvas game engine (single level).
export const VW = 960;
export const VH = 540;
const GROUND = 460;
const LEVEL_W = 6400;
const GRAV = 2000;
const SPEED = 260;
const JUMP = 720;

type R = { x: number; y: number; w: number; h: number };
type Mover = R & { ax: number; ay: number; bx: number; by: number; t: number; speed: number; dx: number; dy: number };
type Coin = { x: number; y: number; got: boolean };

export type Status = "start" | "playing" | "paused" | "won" | "over";
export type HudState = { coins: number; total: number; lives: number; status: Status };

const groundSegs: [number, number][] = [
  [0, 1100], [1250, 2000], [2150, 2600], [2800, 3400], [3600, 4500], [4700, 5400], [5550, 6400],
];
const platformsDef: R[] = [
  { x: 420, y: 360, w: 128, h: 24 }, { x: 640, y: 290, w: 128, h: 24 },
  { x: 1120, y: 380, w: 96, h: 24 }, { x: 1450, y: 350, w: 160, h: 24 },
  { x: 1700, y: 270, w: 128, h: 24 }, { x: 2050, y: 360, w: 96, h: 24 },
  { x: 2350, y: 320, w: 128, h: 24 }, { x: 3000, y: 350, w: 128, h: 24 },
  { x: 3450, y: 380, w: 96, h: 24 }, { x: 3800, y: 340, w: 128, h: 24 },
  { x: 4050, y: 260, w: 128, h: 24 }, { x: 4300, y: 330, w: 96, h: 24 },
  { x: 4950, y: 350, w: 128, h: 24 }, { x: 5200, y: 280, w: 128, h: 24 },
  { x: 5420, y: 380, w: 96, h: 24 }, { x: 5800, y: 340, w: 128, h: 24 },
];
const spikesDef: R[] = [
  { x: 820, y: GROUND - 16, w: 64, h: 16 }, { x: 1550, y: GROUND - 16, w: 96, h: 16 },
  { x: 2300, y: GROUND - 16, w: 64, h: 16 }, { x: 3900, y: GROUND - 16, w: 128, h: 16 },
  { x: 5000, y: GROUND - 16, w: 96, h: 16 }, { x: 5900, y: GROUND - 16, w: 64, h: 16 },
];

function mover(x: number, y: number, w: number, h: number, bx: number, by: number, speed: number): Mover {
  return { x, y, w, h, ax: x, ay: y, bx, by, t: 0, speed, dx: 0, dy: 0 };
}

export class Game {
  ctx: CanvasRenderingContext2D;
  keys = new Set<string>();
  status: Status = "start";
  onHud: (h: HudState) => void;
  p = { x: 80, y: GROUND - 40, w: 24, h: 36, vx: 0, vy: 0, onGround: false, face: 1, anim: 0, inv: 0 };
  cam = 0;
  time = 0;
  lives = 3;
  coins: Coin[] = [];
  checkpoint = false;
  spawn = { x: 80, y: GROUND - 40 };
  platforms: R[] = [];
  movers: Mover[] = [];
  hazards: Mover[] = [];
  particles: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  raf = 0;
  last = 0;
  audio: AudioContext | null = null;
  jumpHeld = false;

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudState) => void) {
    this.ctx = canvas.getContext("2d")!;
    this.onHud = onHud;
    this.reset();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  reset() {
    this.platforms = [...groundSegs.map(([a, b]) => ({ x: a, y: GROUND, w: b - a, h: VH - GROUND })), ...platformsDef];
    this.movers = [
      mover(2610, 400, 96, 20, 2700, 400, 0.5),
      mover(4520, 420, 96, 20, 4520, 260, 0.45),
      mover(4600, 260, 80, 20, 4600, 400, 0.45),
    ];
    this.hazards = [
      mover(1300, GROUND - 28, 28, 28, 1900, GROUND - 28, 0.18),
      mover(3100, 200, 28, 28, 3100, GROUND - 28, 0.5),
      mover(3650, GROUND - 28, 28, 28, 4400, GROUND - 28, 0.15),
      mover(5600, 220, 28, 28, 5600, GROUND - 28, 0.6),
      mover(5700, GROUND - 28, 28, 28, 6050, GROUND - 28, 0.3),
    ];
    const c: Coin[] = [];
    const row = (x: number, y: number, n: number) => { for (let i = 0; i < n; i++) c.push({ x: x + i * 32, y, got: false }); };
    row(300, 420, 3); row(450, 325, 3); row(670, 255, 3); row(1140, 340, 2); row(1480, 315, 4);
    row(1720, 235, 3); row(2370, 285, 3); row(2640, 340, 3); row(3020, 315, 3); row(3300, 420, 3);
    row(3820, 305, 3); row(4070, 225, 3); row(4560, 220, 3); row(4970, 315, 3); row(5220, 245, 3);
    row(5820, 305, 3); row(6000, 420, 3);
    this.coins = c;
    this.lives = 3;
    this.checkpoint = false;
    this.spawn = { x: 80, y: GROUND - 40 };
    this.particles = [];
    this.time = 0;
    this.respawn();
    this.emit();
  }

  respawn() {
    Object.assign(this.p, { x: this.spawn.x, y: this.spawn.y, vx: 0, vy: 0, onGround: false, inv: 1.2 });
    this.cam = Math.max(0, this.p.x - VW / 3);
  }

  emit() {
    this.onHud({ coins: this.coins.filter((c) => c.got).length, total: this.coins.length, lives: this.lives, status: this.status });
  }

  setStatus(s: Status) { this.status = s; this.last = performance.now(); this.emit(); }
  start() { this.initAudio(); this.reset(); this.setStatus("playing"); }
  togglePause() {
    if (this.status === "playing") this.setStatus("paused");
    else if (this.status === "paused") this.setStatus("playing");
  }
  destroy() { cancelAnimationFrame(this.raf); this.audio?.close(); }

  initAudio() {
    if (!this.audio) { try { this.audio = new AudioContext(); } catch { /* no audio */ } }
  }
  beep(freq: number, dur: number, type: OscillatorType = "square", slide = 0) {
    const a = this.audio; if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + dur);
    g.gain.setValueAtTime(0.08, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }

  loop(now: number) {
    const dt = Math.min(0.033, (now - this.last) / 1000 || 0);
    this.last = now;
    if (this.status === "playing") this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  solids(): R[] { return [...this.platforms, ...this.movers]; }

  update(dt: number) {
    this.time += dt;
    const p = this.p, k = this.keys;
    // movers
    for (const m of [...this.movers, ...this.hazards]) {
      m.t += dt * m.speed;
      const f = (1 - Math.cos(m.t * Math.PI)) / 2;
      const nx = m.ax + (m.bx - m.ax) * f, ny = m.ay + (m.by - m.ay) * f;
      m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny;
    }
    // carry on moving platform
    for (const m of this.movers) {
      if (p.onGround && p.x + p.w > m.x - m.dx && p.x < m.x - m.dx + m.w && Math.abs(p.y + p.h - (m.y - m.dy)) < 2) {
        p.x += m.dx; p.y += m.dy;
      }
    }
    const left = k.has("ArrowLeft") || k.has("KeyA"), right = k.has("ArrowRight") || k.has("KeyD");
    const jump = k.has("Space") || k.has("KeyW") || k.has("ArrowUp");
    p.vx = (right ? SPEED : 0) - (left ? SPEED : 0);
    if (p.vx) p.face = Math.sign(p.vx);
    if (jump && !this.jumpHeld && p.onGround) { p.vy = -JUMP; p.onGround = false; this.beep(420, 0.15, "square", 300); }
    if (!jump && p.vy < -250) p.vy = -250; // variable jump height
    this.jumpHeld = jump;
    p.vy = Math.min(p.vy + GRAV * dt, 1100);
    p.anim += dt * (p.vx ? 12 : 2);
    if (p.inv > 0) p.inv -= dt;

    const solids = this.solids();
    p.x += p.vx * dt;
    p.x = Math.max(0, Math.min(LEVEL_W - p.w, p.x));
    for (const s of solids) if (hit(p, s)) { p.x = p.vx > 0 ? s.x - p.w : p.vx < 0 ? s.x + s.w : p.x; }
    p.y += p.vy * dt;
    p.onGround = false;
    for (const s of solids) if (hit(p, s)) {
      if (p.vy > 0) { p.y = s.y - p.h; p.onGround = true; } else if (p.vy < 0) p.y = s.y + s.h;
      p.vy = 0;
    }

    // coins
    for (const c of this.coins) if (!c.got && hit(p, { x: c.x - 9, y: c.y - 9, w: 18, h: 18 })) {
      c.got = true; this.beep(988, 0.08); setTimeout(() => this.beep(1318, 0.12), 70);
      this.burst(c.x, c.y, "#ffd34d"); this.emit();
    }
    // checkpoint
    if (!this.checkpoint && p.x > 3200) {
      this.checkpoint = true; this.spawn = { x: 3200, y: GROUND - 40 };
      this.beep(660, 0.1); setTimeout(() => this.beep(880, 0.2), 100); this.burst(3216, GROUND - 60, "#7cf0ff");
    }
    // death
    const dead = p.y > VH + 50 || (p.inv <= 0 && (
      spikesDef.some((s) => hit(p, { x: s.x + 4, y: s.y + 4, w: s.w - 8, h: s.h })) ||
      this.hazards.some((h) => hit(p, { x: h.x + 4, y: h.y + 4, w: h.w - 8, h: h.h - 8 }))));
    if (dead) {
      this.lives--; this.beep(300, 0.4, "sawtooth", -220); this.burst(p.x + 12, Math.min(p.y, VH - 20), "#ff5a3c");
      if (this.lives <= 0) { this.setStatus("over"); return; }
      this.respawn(); this.emit();
    }
    // chest
    if (hit(p, { x: 6200, y: GROUND - 40, w: 48, h: 40 })) {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.2, "triangle"), i * 120));
      this.setStatus("won");
    }
    // particles & camera
    for (const q of this.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 600 * dt; q.life -= dt; }
    this.particles = this.particles.filter((q) => q.life > 0);
    const target = Math.max(0, Math.min(LEVEL_W - VW, p.x - VW / 3));
    this.cam += (target - this.cam) * Math.min(1, dt * 8);
  }

  burst(x: number, y: number, c: string) {
    for (let i = 0; i < 12; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 300, life: 0.6, c });
  }

  // ---------- rendering ----------
  draw() {
    const g = this.ctx, t = this.time + performance.now() / 1000 * (this.status === "playing" ? 0 : 1);
    const sky = g.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, "#2b1b4d"); sky.addColorStop(0.45, "#e0525a"); sky.addColorStop(0.75, "#ffa64d"); sky.addColorStop(1, "#ffd27a");
    g.fillStyle = sky; g.fillRect(0, 0, VW, VH);
    // sun
    g.fillStyle = "#fff0a8"; g.beginPath(); g.arc(VW * 0.7 - this.cam * 0.02, 300, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,240,168,0.25)"; g.beginPath(); g.arc(VW * 0.7 - this.cam * 0.02, 300, 100, 0, Math.PI * 2); g.fill();
    // stars
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i))})`;
      g.fillRect((i * 211 - this.cam * 0.02) % VW, (i * 37) % 120, 2, 2);
    }
    // pixel clouds
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 260 - this.cam * 0.1 - t * 8) % (VW + 300) + VW + 300) % (VW + 300) - 150, cy = 90 + (i % 3) * 45;
      g.fillStyle = "rgba(255,170,150,0.55)"; g.fillRect(cx, cy, 120, 14); g.fillRect(cx + 20, cy - 10, 70, 12);
      g.fillStyle = "rgba(255,215,170,0.6)"; g.fillRect(cx + 10, cy - 4, 90, 6);
    }
    // birds
    for (let i = 0; i < 3; i++) {
      const bx = ((t * 40 + i * 300) % (VW + 100)) - 50, by = 160 + i * 25 + Math.sin(t * 2 + i) * 8, w = Math.sin(t * 10 + i) > 0 ? -3 : 3;
      g.fillStyle = "#3a1530"; g.fillRect(bx, by, 3, 2); g.fillRect(bx - 4, by + w / 2, 4, 2); g.fillRect(bx + 3, by + w / 2, 4, 2);
    }
    // far mountains / ziggurats
    g.fillStyle = "#7a2f4f";
    for (let i = -1; i < 8; i++) {
      const x = i * 300 - ((this.cam * 0.2) % 300);
      g.beginPath(); g.moveTo(x, 420); g.lineTo(x + 150, 250 + (i % 3) * 30); g.lineTo(x + 300, 420); g.fill();
    }
    g.fillStyle = "#5a2440";
    for (let i = -1; i < 6; i++) {
      const x = i * 420 - ((this.cam * 0.4) % 420) + 60;
      for (let s = 0; s < 5; s++) g.fillRect(x + s * 16, 330 + s * 0 - s * 22 + 110, 200 - s * 32, 22);
      g.fillRect(x + 80, 330, 40, 30);
    }
    g.save(); g.translate(-Math.round(this.cam), 0);
    const x0 = this.cam - 100, x1 = this.cam + VW + 100;
    // background pillars with torches
    for (let x = 200; x < LEVEL_W; x += 520) {
      if (x < x0 - 60 || x > x1) continue;
      g.fillStyle = "#8c6a5a"; g.fillRect(x, 200, 36, GROUND - 200);
      g.fillStyle = "#a8836f"; g.fillRect(x - 6, 192, 48, 14); g.fillRect(x - 6, GROUND - 14, 48, 14);
      g.fillStyle = "#6e5246"; for (let y = 220; y < GROUND - 14; y += 30) g.fillRect(x + 6, y, 4, 20);
      // torch
      g.fillStyle = "#4a3326"; g.fillRect(x + 40, 260, 14, 6); g.fillRect(x + 44, 250, 6, 14);
      const fl = Math.sin(t * 20 + x) * 3;
      g.fillStyle = "rgba(255,180,60,0.18)"; g.beginPath(); g.arc(x + 47, 240, 34 + fl, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ff7a1a"; g.fillRect(x + 41, 236 + fl / 2, 12, 14);
      g.fillStyle = "#ffe066"; g.fillRect(x + 44, 240 + fl / 2, 6, 8);
    }
    // platforms
    for (const s of this.platforms) if (s.x + s.w > x0 && s.x < x1) this.drawStone(s, s.y === GROUND);
    for (const m of this.movers) {
      g.fillStyle = "#c79a3c"; g.fillRect(m.x, m.y, m.w, m.h);
      g.fillStyle = "#8a6420"; g.fillRect(m.x, m.y + m.h - 5, m.w, 5);
      g.fillStyle = "#ffe08a"; for (let i = 6; i < m.w - 4; i += 18) g.fillRect(m.x + i, m.y + 5, 8, 4);
    }
    // spikes
    for (const s of spikesDef) {
      for (let i = 0; i < s.w; i += 16) {
        g.fillStyle = "#cfd4dc"; g.beginPath(); g.moveTo(s.x + i, s.y + s.h); g.lineTo(s.x + i + 8, s.y); g.lineTo(s.x + i + 16, s.y + s.h); g.fill();
        g.fillStyle = "#8a909a"; g.beginPath(); g.moveTo(s.x + i + 8, s.y); g.lineTo(s.x + i + 16, s.y + s.h); g.lineTo(s.x + i + 8, s.y + s.h); g.fill();
      }
    }
    // hazards: spiked stone balls
    for (const h of this.hazards) {
      const cx = h.x + h.w / 2, cy = h.y + h.h / 2, rot = (h.x + h.y) / 14;
      g.fillStyle = "#3a2a2a";
      for (let i = 0; i < 8; i++) {
        const a = rot + (i * Math.PI) / 4;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20);
        g.lineTo(cx + Math.cos(a + 0.3) * 12, cy + Math.sin(a + 0.3) * 12); g.lineTo(cx + Math.cos(a - 0.3) * 12, cy + Math.sin(a - 0.3) * 12); g.fill();
      }
      g.fillStyle = "#6b5550"; g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ff3b3b"; g.fillRect(cx - 6, cy - 3, 4, 4); g.fillRect(cx + 2, cy - 3, 4, 4);
    }
    // coins
    for (const c of this.coins) if (!c.got) {
      const sw = Math.abs(Math.cos(t * 4 + c.x * 0.05)) * 9 + 2, by = Math.sin(t * 3 + c.x) * 3;
      g.fillStyle = "#b8860b"; g.fillRect(c.x - sw, c.y - 9 + by, sw * 2, 18);
      g.fillStyle = "#ffd34d"; g.fillRect(c.x - sw + 2, c.y - 7 + by, sw * 2 - 4, 14);
      g.fillStyle = "#fff6c2"; g.fillRect(c.x - 1, c.y - 5 + by, 2, 6);
    }
    // checkpoint flag
    const fx = 3210;
    g.fillStyle = "#5a4030"; g.fillRect(fx, GROUND - 90, 6, 90);
    g.fillStyle = this.checkpoint ? "#3ee0ff" : "#8a8a8a";
    const wv = Math.sin(t * 6) * 3;
    g.beginPath(); g.moveTo(fx + 6, GROUND - 90); g.lineTo(fx + 40, GROUND - 80 + wv); g.lineTo(fx + 6, GROUND - 68); g.fill();
    // chest
    const glow = 50 + Math.sin(t * 3) * 10;
    const rg = g.createRadialGradient(6224, GROUND - 20, 5, 6224, GROUND - 20, glow + 40);
    rg.addColorStop(0, "rgba(255,230,100,0.7)"); rg.addColorStop(1, "rgba(255,230,100,0)");
    g.fillStyle = rg; g.fillRect(6224 - 120, GROUND - 140, 240, 160);
    g.fillStyle = "#7a3e12"; g.fillRect(6200, GROUND - 36, 48, 36);
    g.fillStyle = "#a35a1e"; g.fillRect(6200, GROUND - 44, 48, 14);
    g.fillStyle = "#ffcc33"; g.fillRect(6200, GROUND - 30, 48, 4); g.fillRect(6220, GROUND - 32, 8, 12);
    g.fillRect(6200, GROUND - 44, 4, 44); g.fillRect(6244, GROUND - 44, 4, 44);
    for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.6; g.fillStyle = "#fff6c2"; g.fillRect(6224 + Math.cos(a) * 34, GROUND - 40 + Math.sin(a * 1.3) * 20, 3, 3); }
    // big temple gate at end
    g.fillStyle = "#8c6a5a"; g.fillRect(6120, 220, 30, GROUND - 220); g.fillRect(6300, 220, 30, GROUND - 220); g.fillRect(6110, 200, 230, 26);
    // player shadow + player
    if (this.p.onGround) { g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(this.p.x + 12, this.p.y + this.p.h, 14, 4, 0, 0, Math.PI * 2); g.fill(); }
    this.drawPlayer();
    for (const q of this.particles) { g.fillStyle = q.c; g.globalAlpha = Math.max(0, q.life / 0.6); g.fillRect(q.x, q.y, 4, 4); }
    g.globalAlpha = 1;
    g.restore();
    // floating embers
    for (let i = 0; i < 24; i++) {
      const ex = ((i * 173 - this.cam * 0.6 + Math.sin(t + i) * 20) % VW + VW) % VW;
      const ey = VH - ((t * (20 + (i % 5) * 8) + i * 97) % VH);
      g.fillStyle = `rgba(255,${170 + (i % 4) * 20},80,${0.35 + (i % 3) * 0.2})`; g.fillRect(ex, ey, 3, 3);
    }
    // warm vignette
    const vg = g.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VW * 0.7);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(40,0,30,0.45)");
    g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
    // HUD
    g.fillStyle = "rgba(20,10,30,0.55)"; g.fillRect(12, 12, 300, 40);
    g.font = "14px 'Press Start 2P', monospace"; g.textBaseline = "middle";
    g.fillStyle = "#ffd34d"; g.fillText(`◉ ${this.coins.filter((c) => c.got).length}/${this.coins.length}`, 24, 33);
    g.fillStyle = "#ff5a6a"; g.fillText("♥".repeat(Math.max(0, this.lives)), 180, 33);
    if (this.checkpoint && this.status === "playing") { g.fillStyle = "#7cf0ff"; g.font = "10px 'Press Start 2P', monospace"; g.fillText("CHECKPOINT", 24, 66); }
  }

  drawStone(s: R, ground: boolean) {
    const g = this.ctx;
    g.fillStyle = ground ? "#7a5a48" : "#9b7b63"; g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = ground ? "#5e4436" : "#6e5444";
    for (let y = s.y + 12; y < s.y + s.h; y += 22) for (let x = s.x + ((y / 22) % 2 ? 0 : 20); x < s.x + s.w; x += 40) { g.fillRect(x, y, 2, 20); g.fillRect(s.x, y + 18, s.w, 2); }
    // stone highlights, moss and cracks
    g.fillStyle = "rgba(255,220,180,0.12)"; g.fillRect(s.x, s.y + 8, s.w, 4);
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(s.x + s.w - 3, s.y, 3, s.h);
    for (let x = s.x + 17; x < s.x + s.w - 10; x += 53) {
      g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(x, s.y + 30, 2, 10); g.fillRect(x + 2, s.y + 38, 6, 2);
      if (ground) { g.fillStyle = "#c9a07a"; g.fillRect(x + 20, s.y + 50, 4, 3); }
    }
    g.fillStyle = "#4caf50"; g.fillRect(s.x, s.y, s.w, 8);
    g.fillStyle = "#7ed957"; g.fillRect(s.x, s.y, s.w, 3);
    g.fillStyle = "#3a8a3e"; for (let x = s.x + 4; x < s.x + s.w - 4; x += 10) g.fillRect(x, s.y + 8, 4, 3 + ((x * 13) % 5));
    // grass tufts & flowers
    for (let x = s.x + 6; x < s.x + s.w - 6; x += 23) {
      g.fillStyle = "#7ed957"; g.fillRect(x, s.y - 4, 2, 4); g.fillRect(x + 3, s.y - 6, 2, 6); g.fillRect(x + 6, s.y - 3, 2, 3);
      if ((x * 7) % 5 === 0) { g.fillStyle = (x % 2) ? "#ff7eb6" : "#fff275"; g.fillRect(x + 2, s.y - 9, 4, 4); }
    }
    if (!ground) { // vines
      g.fillStyle = "#2f7d32";
      for (let x = s.x + 10; x < s.x + s.w - 6; x += 34) {
        const len = 20 + ((x * 7) % 30);
        g.fillRect(x, s.y + s.h, 3, len); g.fillStyle = "#58c25c"; g.fillRect(x - 3, s.y + s.h + len / 2, 4, 4); g.fillStyle = "#2f7d32";
      }
    }
  }

  drawPlayer() {
    const g = this.ctx, p = this.p;
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2) return;
    const x = Math.round(p.x), y = Math.round(p.y), f = p.face;
    const leg = p.onGround ? Math.round(Math.sin(p.anim) * 4) : 3;
    const px = (dx: number, dy: number, w: number, h: number, c: string) => {
      g.fillStyle = c; g.fillRect(f > 0 ? x + dx : x + p.w - dx - w, y + dy, w, h);
    };
    px(0, 0, 24, 6, "#8b5a2b"); px(-3, 5, 30, 3, "#6b4220"); // hat
    px(4, 8, 16, 10, "#f2c38f"); px(14, 11, 3, 3, "#1a1a1a"); // face
    px(3, 18, 18, 10, "#2e86de"); px(3, 23, 18, 2, "#6b4220"); // shirt + belt
    px(f > 0 ? -1 : 21, 19 + (p.onGround ? -leg / 2 : -4), 4, 8, "#f2c38f"); // arm
    px(5, 28, 6, 6 + leg, "#5a3a1e"); px(13, 28, 6, 6 - leg, "#5a3a1e"); // legs
  }
}

function hit(a: R, b: R) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
