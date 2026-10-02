/**
 * Pure, deterministic arcade flight simulation. Distances: metres; speed: km/h.
 * Reference: https://www.youtube.com/watch?v=jZSvKuupWX0 (stage chapter timing,
 * tanker 3/9/11/16/19/21, airfield 5/13, canyon 8/17, carrier 23).
 * HIT weighting and stage HUD distinction:
 * https://replayburners.blog.jp/archives/19511009.html (section 4).
 * Flight response, health within each life, flares, scores and formation coordinates
 * are modern adaptations. No XP, upgrades, enemy-health scaling or invented boss.
 */
const STEP = 1 / 120;
const ROLL_DURATION = 1.1;
const ROLL_RECOVERY = 0.6;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const approach = (v, target, rate, dt) => target + (v - target) * Math.exp(-rate * dt);
const smooth = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const length = (x, y, z) => Math.hypot(x, y, z);
// Chapter lengths and special stages observed in the supplied arcade reference video.
// This is a modern adaptation of its progression, not an emulation of ROM wave data.
const DURATIONS = [40, 37, 41, 41, 19, 41, 41, 31, 50, 43, 42, 41, 19, 43, 44, 42, 32, 45, 42, 43, 41, 38, 19];
const RESUPPLY = new Set([3, 9, 11, 16, 19, 21]);
const STAGES = DURATIONS.map((duration, index) => {
  const number = index + 1;
  const kind = number === 23 ? 'return' : [5, 13].includes(number) ? 'landing'
    : [8, 17].includes(number) ? 'canyon' : RESUPPLY.has(number) ? 'resupply' : 'flight';
  const biome = kind === 'canyon' ? 'canyon' : number < 6 || kind === 'return' || kind === 'landing' ? 'coast'
    : number >= 18 ? 'dusk' : number >= 10 ? 'forest' : 'mountain';
  const name = kind === 'return' ? 'CARRIER RECOVERY' : kind === 'landing' ? 'AIRFIELD REFUEL'
    : kind === 'canyon' ? 'LOW ALTITUDE RUN' : kind === 'resupply' ? 'RELOAD WEAPONS' : 'AIR COMBAT';
  const objective = kind === 'return' ? 'Return to the carrier'
    : kind === 'landing' ? 'Land, refuel and rearm'
      : kind === 'canyon' ? 'Fly the low altitude route and evade incoming fire'
        : kind === 'resupply' ? 'Rendezvous with the tanker, then continue the interception'
          : 'Survive the attack formations. Build your HIT count';
  return { number, duration, kind, biome, name, objective, waveInterval: Math.max(3.8, 6.5 - number * 0.12) };
});

// Continuous collision against a moving sphere. Returns time along the segment.
function sweep(a, b, c, radius) {
  const sx = a.x - (c.px ?? c.x), sy = a.y - (c.py ?? c.y), sz = a.z - (c.pz ?? c.z);
  const dx = b.x - c.x - sx, dy = b.y - c.y - sy, dz = b.z - c.z - sz;
  const C = sx * sx + sy * sy + sz * sz - radius * radius;
  if (C <= 0) return 0;
  const A = dx * dx + dy * dy + dz * dz;
  if (A < 1e-12) return null;
  const B = 2 * (sx * dx + sy * dy + sz * dz);
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}

// Spherical steering bounds the seeker's turn rate, making missiles dodgeable.
function turnMissile(p, target, dt) {
  const currentSpeed = length(p.vx, p.vy, p.vz) || 1;
  const cx = p.vx / currentSpeed, cy = p.vy / currentSpeed, cz = p.vz / currentSpeed;
  const rx = target.x - p.x, ry = target.y - p.y, rz = target.z - p.z;
  const distance = length(rx, ry, rz) || 1;
  const tx = rx / distance, ty = ry / distance, tz = rz / distance;
  const angle = Math.acos(clamp(cx * tx + cy * ty + cz * tz, -1, 1));
  const fraction = angle < 1e-6 ? 1 : Math.min(1, p.turnRate * dt / angle);
  let x, y, z;
  if (angle < 1e-4 || Math.abs(Math.sin(angle)) < 1e-4) {
    x = cx + (tx - cx) * fraction;
    y = cy + (ty - cy) * fraction;
    z = cz + (tz - cz) * fraction;
  } else {
    const a = Math.sin((1 - fraction) * angle) / Math.sin(angle);
    const b = Math.sin(fraction * angle) / Math.sin(angle);
    x = cx * a + tx * b; y = cy * a + ty * b; z = cz * a + tz * b;
  }
  const n = length(x, y, z) || 1;
  const speed = approach(currentSpeed, p.maxSpeed, 1.7, dt);
  p.vx = x / n * speed; p.vy = y / n * speed; p.vz = z / n * speed;
}

export class FlightGame {
  constructor({ onEvent = () => {}, seed = 0x41465452, difficulty = 'standard', stageDuration = null } = {}) {
    this.onEvent = onEvent;
    this.seed = seed >>> 0 || 1;
    this.bestScore = 0;
    this.difficulty = difficulty === 'rookie' ? 'rookie' : 'standard';
    // Explicitly intended for automated campaign tests; normal play uses video timing.
    this.stageDuration = Number.isFinite(stageDuration) && stageDuration > 0 ? stageDuration : null;
    this.reset();
  }

  reset() {
    this.rng = this.seed;
    this.nextId = 1;
    this.accumulator = 0;
    this.gunCooldown = this.missileCooldown = this.flareCooldown = 0;
    this.comboRemaining = 0;
    this.flareHeld = false;
    this.rollHeld = false;
    this.rollElapsed = 0;
    this.manualTargetUntil = 0;
    this.waveTimer = 0;
    this.stageKills = 0;
    this.stageWave = 0;
    this.rearmDone = false;
    this.approachAltitude = 230;
    this.approachSpeed = 1180;
    this.tanker = null;
    this.enemies = [];
    this.projectiles = [];
    this.player = {
      x: 0, y: 230, z: 0, px: 0, py: 230, pz: 0,
      vx: 0, vy: 0, bank: 0, pitch: 0, rollAngle: 0, speed: 1180, throttle: 0.72,
    };
    this.state = {
      status: 'attract', score: 0, kills: 0, stage: 1, stageName: STAGES[0].name,
      biome: STAGES[0].biome, time: 0, missionTime: 0, stageTime: 0,
      health: 100, lives: 3, invulnerable: 0, missiles: 50, maxMissiles: 100, flares: 4, maxFlares: 5,
      lockId: null, lockIds: [], lockProgress: 0, locked: false, combo: 0, multiplier: 1,
      rank: 'C', hit: 0, totalHit: 0, stageKind: STAGES[0].kind, objective: STAGES[0].objective,
      shots: 0, hits: 0, accuracy: 0, waves: 0, escaped: 0, boostEnergy: 100,
      threat: 0, closestThreat: Infinity, threatDirection: { x: 0, y: 0 },
      warning: '', stageTransition: 0, stageDuration: this.stageDuration ?? STAGES[0].duration,
      reloading: false, resupplyProgress: 0, autopilot: false, landingProgress: 0,
      rolling: false, rollProgress: 0, rollDirection: 0, rollCooldown: 0,
      lastStageSummary: null, difficulty: this.difficulty,
      highScore: this.bestScore, resultReason: '',
    };
    return this;
  }

  start() {
    this.reset();
    this.state.status = 'playing';
    this._enterStage(1);
    return this;
  }

  setPaused(paused) {
    if (paused && this.state.status === 'playing') this.state.status = 'paused';
    else if (!paused && this.state.status === 'paused') this.state.status = 'playing';
    return this.state.status;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty === 'rookie' ? 'rookie' : 'standard';
    this.state.difficulty = this.difficulty;
  }

  startRoll(direction) {
    const s = this.state;
    if (s.status !== 'playing' || s.autopilot || s.reloading || s.rolling || s.rollCooldown > 1e-8
      || (direction !== 1 && direction !== -1)) return false;
    s.rolling = true; s.rollProgress = 0; s.rollDirection = direction;
    this.rollElapsed = 0; this.player.rollAngle = 0;
    this._emit('roll', { phase: 'start', direction, duration: ROLL_DURATION });
    return true;
  }

  _clearRoll() {
    this.rollElapsed = 0;
    this.player.rollAngle = 0;
    this.state.rolling = false;
    this.state.rollProgress = 0;
    this.state.rollDirection = 0;
    this.state.rollCooldown = 0;
  }

  _updateRoll(dt, input) {
    const s = this.state, left = !!input.rollLeft, right = !!input.rollRight;
    const held = left || right, pressed = held && !this.rollHeld;
    this.rollHeld = held;
    s.rollCooldown = Math.max(0, s.rollCooldown - dt);
    if (pressed && left !== right) this.startRoll(left ? 1 : -1);
    if (!s.rolling) return;
    this.rollElapsed += dt;
    s.rollProgress = clamp(this.rollElapsed / ROLL_DURATION, 0, 1);
    this.player.rollAngle = s.rollDirection * Math.PI * 2 * smooth(s.rollProgress);
    if (this.rollElapsed + 1e-8 >= ROLL_DURATION) {
      const direction = s.rollDirection;
      this.player.rollAngle = 0; // 2π and zero have the same rendered orientation.
      s.rolling = false; s.rollProgress = 0; s.rollDirection = 0; s.rollCooldown = ROLL_RECOVERY;
      this._emit('roll', { phase: 'complete', direction, angle: direction * Math.PI * 2 });
    }
  }

  update(dt, input = {}) {
    if (this.state.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    // Up to two seconds can be caught up after a stall; hidden tabs should be paused.
    this.accumulator += Math.min(dt, 2);
    while (this.accumulator + 1e-10 >= STEP && this.state.status === 'playing') {
      this.accumulator -= STEP;
      this._step(STEP, input);
    }
  }

  fireGun() {
    if (this.state.status !== 'playing' || this.state.autopilot || this.state.reloading || this.gunCooldown > 1e-8) return false;
    this.gunCooldown = 0.075;
    const p = this.player;
    const side = this.state.shots % 2 ? -1 : 1;
    let vx = 0, vy = 0, vz = -2200;
    // Small ballistic assist rewards alignment without firing at an arbitrary lock.
    const aim = this.enemies.find(e => !e.dead && this._angle(e) < 0.055 && e.z < -70);
    if (aim) {
      const d = length(aim.x - p.x, aim.y - p.y, aim.z - p.z);
      vx = (aim.x - p.x) / d * 2200;
      vy = (aim.y - p.y) / d * 2200;
      vz = (aim.z - p.z) / d * 2200;
    }
    const projectile = this._projectile({
      owner: 'player', type: 'gun', x: p.x + side * 4, y: p.y - 1.5, z: -15,
      vx, vy, vz, life: 1.2, damage: 18, radius: 2.4,
    });
    this.state.shots++;
    this._emit('shot', { ...projectile, type: undefined, weapon: 'gun', kind: 'gun' });
    return true;
  }

  fireMissile() {
    if (this.state.status !== 'playing' || this.state.autopilot || this.state.reloading || this.missileCooldown > 1e-8 || this.state.missiles <= 0) return false;
    const pending = new Set(this.projectiles.filter(q => q.owner === 'player' && q.type === 'missile' && !q.dead).map(q => q.targetId));
    const targets = this.enemies.filter(e => e.locked && !e.dead && !e.ecm && !pending.has(e.id))
      .sort((a, b) => (a.id === this.state.lockId ? -1 : b.id === this.state.lockId ? 1 : this._angle(a) - this._angle(b)));
    const target = targets[0];
    if (!target) return false;
    this.missileCooldown = 0.25;
    this.state.missiles--;
    const side = this.state.missiles % 2 ? -1 : 1;
    const projectile = this._projectile({
      owner: 'player', type: 'missile', x: this.player.x + side * 7,
      y: this.player.y - 3, z: -10, vx: side * 12, vy: 0, vz: -680,
      life: 5, damage: 108, radius: 4,
      targetId: target.id, turnRate: 3.4, maxSpeed: 1250,
    });
    this.state.shots++;
    this._emit('shot', { ...projectile, type: undefined, weapon: 'missile', kind: 'missile' });
    return true;
  }

  deployFlares() {
    if (this.state.status !== 'playing' || this.flareCooldown > 1e-8 || this.state.flares <= 0) return false;
    this.flareCooldown = 2.5;
    this.state.flares--;
    const flare = this._projectile({
      owner: 'player', type: 'flare', x: this.player.x, y: this.player.y - 5,
      z: 15, vx: -this.player.vx * 0.15, vy: -32, vz: 90, life: 2.3,
      radius: 1, damage: 0,
    });
    let diverted = 0;
    for (const p of this.projectiles) {
      if (p.owner === 'enemy' && p.type === 'missile' && p.z > -1600) {
        p.targetId = flare.id;
        p.diverted = true;
        diverted++;
      }
    }
    this._emit('flare', { id: flare.id, x: flare.x, y: flare.y, z: flare.z, diverted });
    return true;
  }

  cycleTarget() {
    if (this.state.status !== 'playing') return null;
    const candidates = this.enemies.filter(e => !e.dead && e.z < -80 && e.z > -1600)
      .sort((a, b) => a.x - b.x || a.id - b.id);
    if (!candidates.length) return null;
    const index = candidates.findIndex(e => e.id === this.state.lockId);
    const next = candidates[(index + 1) % candidates.length];
    this._setLockCandidate(next.id);
    this.manualTargetUntil = this.state.time + 2;
    return next.id;
  }

  _rand() {
    let x = this.rng;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.rng = x >>> 0;
    return this.rng / 4294967296;
  }

  _emit(type, data = {}) {
    this.onEvent({ ...data, type, time: this.state.time });
  }

  _projectile(properties) {
    const p = { id: this.nextId++, age: 0, ...properties };
    this.projectiles.push(p);
    return p;
  }

  _enterStage(stage) {
    const spec = STAGES[stage - 1];
    this.state.stage = stage;
    this.state.stageName = spec.name;
    this.state.biome = spec.biome;
    this.state.objective = spec.objective;
    this.state.stageKind = spec.kind;
    this.state.stageDuration = this.stageDuration ?? spec.duration;
    this.state.hit = 0;
    this.state.stageTime = 0;
    this.state.stageTransition = 2.6;
    this.stageKills = 0;
    this.stageWave = 0;
    this.rearmDone = false;
    this.enemies = [];
    this.projectiles = [];
    this._setLockCandidate(null);
    this.state.lockIds = [];
    this.state.threat = 0;
    this.state.warning = '';
    this.state.reloading = spec.kind === 'resupply';
    this.state.resupplyProgress = 0;
    this.state.landingProgress = 0;
    this.state.autopilot = ['landing', 'return'].includes(spec.kind);
    if (this.state.autopilot || this.state.reloading) this._clearRoll();
    this.approachAltitude = this.player.y;
    this.approachSpeed = this.player.speed;
    this.tanker = spec.kind === 'resupply' ? { x: 0, y: 275, z: -270, bank: 0, pitch: 0 } : null;
    this.waveTimer = spec.waveInterval;
    if (!this.state.autopilot && !this.state.reloading) this._spawnWave();
    this._emit('stage', { stage, name: spec.name, kind: spec.kind, stageName: spec.name, biome: spec.biome,
      objective: spec.objective, health: this.state.health, missiles: this.state.missiles });
  }

  _spawnWave() {
    if (this.state.autopilot || this.state.reloading || this.state.stageKind === 'canyon') return;
    if (this.enemies.filter(e => !e.dead).length > 8) return;
    const stage = this.state.stage;
    const count = Math.min(5, 3 + Math.floor((stage - 1) / 7));
    const pattern = (this.stageWave + stage - 1) % 5;
    const center = [-50, 65, -75, 45, 0][pattern];
    const altitude = [230, 310, 175, 275, 340][pattern];
    const formation = this.stageWave % 3;
    this.stageWave++;
    this.state.waves++;
    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2;
      const x = center + offset * 62;
      const y = altitude + (formation === 1 ? offset * 26 : Math.abs(offset) * 12);
      const z = -850 - (formation === 0 ? Math.abs(offset) * 140 : i * 85);
      this.enemies.push({
        id: this.nextId++, x, y, z, px: x, py: y, pz: z,
        baseX: x, baseY: y, age: 0, bank: 0, pitch: 0,
        health: 48, maxHealth: 48,
        radius: 17, boss: false, name: `BANDIT ${this.state.waves}-${i + 1}`,
        phase: this._rand() * Math.PI * 2, attackTimer: 0.9 + i * 0.65,
        attacker: i === 0 || (stage >= 7 && i === 2), dead: false,
      });
    }
  }

  _step(dt, input) {
    const s = this.state, p = this.player;
    s.time += dt;
    s.missionTime = s.time;
    s.stageTime += dt;
    s.invulnerable = Math.max(0, s.invulnerable - dt);
    s.stageTransition = Math.max(0, s.stageTransition - dt);
    this.gunCooldown = Math.max(0, this.gunCooldown - dt);
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    this.flareCooldown = Math.max(0, this.flareCooldown - dt);
    this.comboRemaining = Math.max(0, this.comboRemaining - dt);
    if (!this.comboRemaining) { s.combo = 0; s.multiplier = 1; }

    const ix = s.autopilot ? clamp(-p.x / 100, -1, 1) : Number.isFinite(input.x) ? clamp(input.x, -1, 1) : 0;
    const iy = Number.isFinite(input.y) ? clamp(input.y, -1, 1) : 0;
    // Sustained HI/LOW throttle follows the reference lever: no stamina system.
    const boosting = !s.autopilot && !!input.boost && !input.brake;
    s.boostEnergy = 100;
    const landingT = clamp(s.stageTime / s.stageDuration, 0, 1);
    const departing = s.stageKind === 'landing' && landingT >= 0.7;
    const autopilotSpeed = departing ? 120 + (1180 - 120) * smooth((landingT - 0.7) / 0.3)
      : landingT < 0.4 ? this.approachSpeed + (400 - this.approachSpeed) * smooth(landingT / 0.4) : 120;
    const targetSpeed = s.autopilot ? autopilotSpeed : input.brake ? 850 : boosting ? 1600 : 1180;
    p.speed = approach(p.speed, targetSpeed, boosting ? 1.8 : 1.25, dt);
    p.throttle = approach(p.throttle, s.autopilot ? departing ? 0.78 : landingT < 0.4 ? 0.34 : 0.12 : input.brake ? 0.28 : boosting ? 1 : 0.72, 5, dt);
    p.px = p.x; p.py = p.y; p.pz = p.z;
    p.vx = approach(p.vx, ix * (boosting ? 252 : 218), 4.8, dt);
    p.vy = approach(p.vy, iy * (boosting ? 230 : 205), 4.8, dt);
    p.x = clamp(p.x + p.vx * dt, -170, 170);
    p.y = clamp(p.y + p.vy * dt, 80, 520);
    if (s.autopilot) {
      // These unplayable original service phases follow a scripted approach,
      // deck stop and (at airfields) departure. Carrier deck y=20; runway y=80.
      // Scripted recovery intentionally bypasses the playable flight minimum.
      const deckAltitude = s.stageKind === 'return' ? 22 : 82;
      const desiredAltitude = departing ? deckAltitude + (230 - deckAltitude) * smooth((landingT - 0.7) / 0.3)
        : this.approachAltitude + (deckAltitude - this.approachAltitude) * smooth(landingT / 0.4);
      p.y = desiredAltitude;
      p.vy = (p.y - p.py) / dt;
    }
    if (Math.abs(p.x) === 170 && Math.sign(p.vx) === Math.sign(p.x)) p.vx = 0;
    if ((p.y === 80 && p.vy < 0) || (p.y === 520 && p.vy > 0)) p.vy = 0;
    p.bank = approach(p.bank, -ix * 0.78, 6, dt);
    p.pitch = approach(p.pitch, clamp(p.vy / 600, -0.34, 0.34), 5, dt);
    this._updateRoll(dt, input);

    this._updateEnemies(dt);
    this._updateLock(dt);
    if (input.gun) this.fireGun();
    if (input.missile) this.fireMissile();
    if (input.flare && !this.flareHeld) this.deployFlares();
    this.flareHeld = !!input.flare;
    this._updateProjectiles(dt);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(q => !q.dead);
    this._updateThreat();
    this._updatePerformance();
    if (s.status !== 'playing') return;

    const spec = STAGES[s.stage - 1];
    this._updateSpecialStage();
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer += spec.waveInterval;
      if (s.stageKind === 'canyon') this._enemyMissile({ x: [-160, 150, 0][this.stageWave++ % 3], y: 55, z: -1100 });
      else this._spawnWave();
    }
    if (s.stageTime + 1e-8 >= s.stageDuration) {
      // Reference count-up at 06:12 shows 3 / 60000 and 5 / 100000;
      // 08:12 shows 2 / 40000. These verify the 20,000-per-stage-HIT bonus.
      const bonus = s.hit * 20000;
      s.score += bonus;
      this.bestScore = Math.max(this.bestScore, s.score);
      s.highScore = this.bestScore;
      s.lastStageSummary = { stage: s.stage, hit: s.hit, totalHit: s.totalHit, bonus, score: s.score, lives: s.lives };
      this._emit('stageComplete', s.lastStageSummary);
      if (s.stage === 23) this._finish('victory', 'Carrier recovery complete');
      else this._enterStage(s.stage + 1);
    }
  }

  _updateSpecialStage() {
    const s = this.state;
    const duration = s.stageDuration;
    if (s.stageKind === 'resupply') {
      const supplyDuration = Math.min(7, duration * 0.4);
      s.resupplyProgress = clamp(s.stageTime / supplyDuration, 0, 1);
      if (this.tanker) {
        this.tanker.z = -210 - Math.max(0, s.stageTime - supplyDuration) * 180;
        this.tanker.y = this.player.y + 48;
        this.tanker.x = approach(this.tanker.x, this.player.x, 0.9, STEP);
      }
      if (!this.rearmDone && s.resupplyProgress >= 1) {
        this.rearmDone = true;
        s.missiles = 50;
        s.flares = s.maxFlares;
        s.reloading = false;
        this._emit('resupply', { missiles: s.missiles, stage: s.stage });
        this._spawnWave();
      }
      if (s.stageTime > supplyDuration + 4) this.tanker = null;
    } else if (s.autopilot) {
      s.landingProgress = clamp(s.stageTime / duration, 0, 1);
      if (s.stageKind === 'landing' && !this.rearmDone && s.landingProgress >= 0.5) {
        this.rearmDone = true;
        s.missiles = 50; s.flares = s.maxFlares; s.health = 100;
        this._emit('resupply', { missiles: s.missiles, stage: s.stage });
      }
    }
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.px = e.x; e.py = e.y; e.pz = e.z;
      e.age += dt;
      {
        e.x = e.baseX + Math.sin(e.age * 0.8 + e.phase) * 22;
        e.y = e.baseY + Math.sin(e.age * 0.6 + e.phase) * 18;
        if (e.age > 1.5) e.z += (this.player.speed / 3.6 - 185) * dt;
        e.bank = -Math.cos(e.age * 0.8 + e.phase) * 0.2;
        e.pitch = Math.cos(e.age * 0.6 + e.phase) * 0.025;
      }
      e.attackTimer -= dt;
      if (e.attacker && e.attackTimer <= 0 && e.z < -320 && e.z > -1350) {
        this._enemyMissile(e);
        e.attackTimer = Math.max(4.8, 7.2 - this.state.stage * 0.1);
      }
      if (!e.boss && e.z > 160) {
        e.dead = true;
        this.state.escaped++;
      } else if (sweep({ x: e.px, y: e.py, z: e.pz }, e, this.player, e.radius + 10) !== null) {
        e.dead = true;
        this._damagePlayer(22, 'collision');
        this._emit('explosion', { id: e.id, x: e.x, y: e.y, z: e.z, source: 'enemy', owner: 'enemy', scale: 1.1 });
      }
    }
  }

  _enemyMissile(enemy) {
    const dx = this.player.x - enemy.x, dy = this.player.y - enemy.y, dz = -enemy.z;
    const distance = length(dx, dy, dz) || 1;
    const q = this._projectile({
      owner: 'enemy', type: 'missile', x: enemy.x, y: enemy.y - 3, z: enemy.z + 12,
      vx: dx / distance * 330, vy: dy / distance * 330, vz: dz / distance * 330,
      life: 5, damage: this.difficulty === 'rookie' ? 10 : 16, radius: 4, targetId: 'player',
      turnRate: this.difficulty === 'rookie' ? 0.38 : 0.5 + Math.min(0.18, this.state.stage * 0.008),
      maxSpeed: this.difficulty === 'rookie' ? 470 : 550,
    });
    this._emit('shot', { ...q, type: undefined, weapon: 'missile', kind: 'missile' });
  }

  _angle(e) {
    const p = this.player;
    return Math.atan2(Math.hypot(e.x - p.x, e.y - p.y), p.z - e.z);
  }

  _setLockCandidate(id) {
    const s = this.state;
    if (s.lockId === id) return;
    if (s.locked) this._emit('lock', { id: s.lockId, targetId: s.lockId, locked: false });
    s.lockId = id;
    s.lockProgress = 0;
    s.locked = false;
  }

  _updateLock(dt) {
    const s = this.state;
    const eligible = this.enemies.filter(e => !e.dead && !e.ecm && e.z < -100 && e.z > -1500 && this._angle(e) < 0.2)
      .sort((a, b) => this._angle(a) - this._angle(b) || b.z - a.z).slice(0, 4);
    for (const e of this.enemies) {
      const wasLocked = !!e.locked;
      const inCone = eligible.includes(e);
      e.lockProgress = clamp((e.lockProgress ?? 0) + (inCone ? dt / 0.72 : -dt * 2.8), 0, 1);
      e.locked = inCone && e.lockProgress >= 1;
      if (e.locked !== wasLocked) this._emit('lock', { id: e.id, targetId: e.id, locked: e.locked, x: e.x, y: e.y, z: e.z });
    }
    s.lockIds = eligible.filter(e => e.locked).map(e => e.id);
    let candidate = eligible.find(e => e.id === s.lockId);
    if (!candidate && this.manualTargetUntil <= s.time) {
      candidate = eligible[0];
    }
    if (!candidate) {
      s.lockProgress = Math.max(0, s.lockProgress - dt * 2.8);
      if (s.locked) {
        s.locked = false;
        this._emit('lock', { id: s.lockId, targetId: s.lockId, locked: false });
      }
      if (!s.lockProgress && this.manualTargetUntil <= s.time) this._setLockCandidate(null);
      return;
    }
    this._setLockCandidate(candidate.id);
    s.lockProgress = candidate.lockProgress;
    s.locked = candidate.locked;
  }

  _updateProjectiles(dt) {
    for (const q of this.projectiles) {
      if (q.dead) continue;
      if (this.state.status !== 'playing') break;
      q.age += dt; q.life -= dt;
      if (q.life <= 0) { q.dead = true; continue; }
      const before = { x: q.x, y: q.y, z: q.z };
      if (q.type === 'missile') {
        const target = q.owner === 'player'
          ? this.enemies.find(e => e.id === q.targetId && !e.dead)
          : q.targetId === 'player' ? this.player
            : this.projectiles.find(p => p.id === q.targetId && !p.dead);
        if (target) turnMissile(q, target, dt);
      }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.type === 'flare') { q.vy -= 18 * dt; continue; }
      if (q.owner === 'player') {
        let nearest = null, nearestTime = Infinity;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const t = sweep(before, q, e, e.radius + q.radius);
          if (t !== null && t < nearestTime) { nearest = e; nearestTime = t; }
        }
        if (nearest) {
          q.dead = true;
          this.state.hits++;
          this._damageEnemy(nearest, q.damage, q.type);
          if (q.type === 'missile' && !nearest.dead) {
            this._emit('explosion', { id: q.id, x: q.x, y: q.y, z: q.z, source: 'impact', owner: 'player', scale: 0.7 });
          }
        }
      } else if (!q.diverted && sweep(before, q, this.player, 12 + q.radius) !== null) {
        q.dead = true;
        this._damagePlayer(q.damage, 'missile');
        this._emit('explosion', { id: q.id, x: q.x, y: q.y, z: q.z, source: 'missile', owner: 'enemy', scale: 0.65 });
      }
      if (q.z < -2400 || q.z > 220 || Math.abs(q.x) > 1800 || q.y < -80) q.dead = true;
    }
  }

  _damageEnemy(enemy, amount, weapon) {
    enemy.health -= amount;
    const killed = enemy.health <= 0;
    this._emit('hit', { id: enemy.id, targetId: enemy.id, damage: amount, weapon,
      x: enemy.x, y: enemy.y, z: enemy.z, health: Math.max(0, enemy.health), killed });
    if (!killed) return;
    enemy.dead = true;
    this.state.kills++;
    this.state.hit++;
    this.state.totalHit += weapon === 'missile' ? 2 : 1;
    this.stageKills++;
    this.state.combo = Math.min(10, this.state.combo + 1);
    this.state.multiplier = 1 + Math.min(6, this.state.combo - 1) * 0.25;
    this.comboRemaining = 5;
    const points = weapon === 'missile' ? 700 : 1000;
    this.state.score += points;
    this.bestScore = Math.max(this.bestScore, this.state.score);
    this.state.highScore = this.bestScore;
    this._emit('explosion', { id: enemy.id, x: enemy.x, y: enemy.y, z: enemy.z,
      source: 'enemy', owner: 'enemy', boss: enemy.boss, scale: enemy.boss ? 2.2 : 1, points });
    if (this.state.lockId === enemy.id) this._setLockCandidate(null);
  }

  _damagePlayer(amount, source) {
    if (this.state.status !== 'playing' || this.state.invulnerable > 0 || this.state.autopilot) return;
    this.state.health = Math.max(0, this.state.health - amount);
    this.state.combo = 0;
    this.state.multiplier = 1;
    this.comboRemaining = 0;
    this._emit('damage', { amount, damage: amount, health: this.state.health, source,
      owner: 'player', x: this.player.x, y: this.player.y, z: this.player.z });
    if (!this.state.health) {
      this._emit('explosion', { x: this.player.x, y: this.player.y, z: this.player.z,
        source: 'player', owner: 'player', scale: 2 });
      this.state.lives--;
      this._emit('life', { lives: this.state.lives, lost: true, respawn: this.state.lives > 0 });
      if (this.state.lives <= 0) this._finish('defeat', 'All aircraft lost');
      else {
        this.state.health = 100;
        this.state.invulnerable = 3;
        this.player.x = this.player.px = 0;
        this.player.y = this.player.py = 230;
        this.player.vx = this.player.vy = 0;
        this._clearRoll();
        for (const q of this.projectiles) if (q.owner === 'enemy') q.dead = true;
        for (const e of this.enemies) if (e.z > -180) e.dead = true;
        this._emit('respawn', { lives: this.state.lives, health: 100 });
      }
    }
  }

  _updateThreat() {
    const threats = this.projectiles.filter(q => !q.dead && q.owner === 'enemy' && !q.diverted && q.type === 'missile');
    let closest = null, distance = Infinity;
    for (const q of threats) {
      const d = length(q.x - this.player.x, q.y - this.player.y, q.z);
      if (d < distance) { distance = d; closest = q; }
    }
    this.state.threat = threats.length;
    this.state.closestThreat = distance;
    this.state.threatDirection = closest ? { x: closest.x - this.player.x, y: closest.y - this.player.y } : { x: 0, y: 0 };
    this.state.warning = closest ? 'MISSILE INBOUND' : '';
  }

  _updatePerformance() {
    const s = this.state;
    s.accuracy = s.shots ? s.hits / s.shots : 0;
    const rating = s.totalHit / 5 + Math.min(1, s.accuracy) * 30 + s.lives * 4 + s.health * 0.08;
    s.rank = rating >= 140 ? 'S+' : rating >= 100 ? 'S' : rating >= 70 ? 'A' : rating >= 45 ? 'B' : rating >= 12 ? 'C' : 'D';
  }

  _finish(status, reason) {
    if (this.state.status !== 'playing') return;
    this.state.status = status;
    this.state.resultReason = reason;
    this._updatePerformance();
    this._emit('complete', { status, result: status, reason, score: this.state.score,
      rank: this.state.rank, kills: this.state.kills, accuracy: this.state.accuracy,
      hit: this.state.hit, totalHit: this.state.totalHit, lives: this.state.lives,
      duration: this.state.time });
  }
}
