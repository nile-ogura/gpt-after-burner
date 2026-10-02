import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightGame } from '../src/gameplay.js';

function run(game, seconds, input = {}, fps = 60) {
  for (let i = 0; i < Math.round(seconds * fps); i++) game.update(1 / fps, input);
}

function target(game, properties = {}) {
  const e = { id: 900, x: 0, y: 230, z: -640, px: 0, py: 230, pz: -640,
    baseX: 0, baseY: 230, health: 48, maxHealth: 48, age: 0, radius: 17,
    phase: 0, attackTimer: 100, attacker: false, boss: false, dead: false, ...properties };
  game.enemies = [e];
  return e;
}

test('flight remains bounded, boost and brake change speed, pause preserves all simulation', () => {
  const g = new FlightGame().start();
  run(g, 1.6, { x: 1, y: 1, boost: true });
  assert.equal(g.player.x, 170);
  assert.equal(g.player.y, 520);
  assert.ok(g.player.speed > 1500 && g.player.speed <= 1600);
  assert.ok(g.player.bank < -0.7);
  const time = g.state.time, position = g.player.x, projectiles = JSON.stringify(g.projectiles);
  g.setPaused(true);
  run(g, 8, { x: -1, gun: true });
  assert.equal(g.state.time, time);
  assert.equal(g.player.x, position);
  assert.equal(JSON.stringify(g.projectiles), projectiles);
  g.setPaused(false);
  run(g, 3, { x: -1, y: -1, brake: true });
  assert.equal(g.player.x, -170);
  assert.equal(g.player.y, 80);
  assert.ok(g.player.speed < 880);
});

test('the same seed and controls produce the same simulation at 30, 60 and 144 Hz', () => {
  const games = [30, 60, 144].map(fps => {
    const g = new FlightGame({ seed: 42 }).start();
    run(g, 2, { x: 0.2, y: -0.12, gun: true }, fps);
    run(g, 1, { x: -0.3, y: 0.4, boost: true }, fps);
    return g;
  });
  for (const g of games.slice(1)) {
    assert.deepEqual(g.state, games[0].state);
    assert.deepEqual(g.player, games[0].player);
    assert.deepEqual(g.enemies, games[0].enemies);
    assert.deepEqual(g.projectiles, games[0].projectiles);
  }
});

test('a target requires alignment and acquisition time before limited missiles can fire', () => {
  const events = [];
  const g = new FlightGame({ onEvent: e => events.push(e) }).start();
  target(g);
  assert.equal(g.fireMissile(), false);
  run(g, 0.5);
  assert.equal(g.state.locked, false);
  run(g, 0.3);
  assert.equal(g.state.locked, true);
  assert.equal(g.fireMissile(), true);
  assert.equal(g.state.missiles, 49);
  assert.equal(g.fireMissile(), false, 'cooldown prevents spending another missile immediately');
  run(g, 1.5);
  assert.equal(g.state.kills, 1, 'a homing missile must actually intersect and destroy its target');
  assert.ok(events.some(e => e.type === 'lock' && e.locked));
  assert.ok(events.some(e => e.type === 'hit' && e.weapon === 'missile' && e.killed));
  target(g, { id: 901, x: 900, baseX: 900 });
  run(g, 1);
  assert.equal(g.state.locked, false, 'far off-axis targets cannot be locked');
  g.state.missiles = 0;
  assert.equal(g.fireMissile(), false);
});

test('gun fire works independently and original HIT distinguishes stage kills from weighted total', () => {
  const g = new FlightGame().start();
  target(g, { x: 500, baseX: 500 });
  run(g, 1, { gun: true });
  assert.equal(g.state.kills, 0);
  for (let i = 0; i < 15; i++) {
    target(g, { id: 900 + i, phase: -0.2 });
    run(g, 0.6, { gun: true });
  }
  assert.equal(g.state.kills, 15);
  assert.equal(g.state.hit, 15);
  assert.equal(g.state.totalHit, 15);
  assert.equal(g.state.xp, undefined, 'original rules have no XP or weapon unlocks');
  assert.equal(g.state.combo, 10);
  assert.equal(g.state.multiplier, 2.5);
  assert.ok(g.state.hits > 0 && g.state.accuracy > 0);
  g.enemies = [];
  run(g, 5.2);
  assert.equal(g.state.combo, 0);
  assert.equal(g.state.multiplier, 1);
});

test('continuous collision catches a bullet that crosses the entire enemy between ticks', () => {
  const g = new FlightGame().start();
  const e = target(g, { z: -110, pz: -110, phase: 0, health: 12 });
  g.projectiles.push({ id: 1000, owner: 'player', type: 'gun', x: 0, y: 230, z: -10,
    vx: 0, vy: 0, vz: -24000, life: 1, age: 0, radius: 2, damage: 18 });
  g.update(1 / 120);
  assert.equal(e.dead, true);
  assert.equal(g.state.kills, 1);
});

test('an incoming missile gives warning, damages an idle jet, and a flare diverts the same threat', () => {
  const make = () => {
    const g = new FlightGame().start();
    g.enemies = [];
    g.projectiles.push({ id: 990, owner: 'enemy', type: 'missile', x: 0, y: 230, z: -450,
      vx: 0, vy: 0, vz: 330, life: 5, age: 0, damage: 14, radius: 4,
      targetId: 'player', turnRate: 0.56, maxSpeed: 550 });
    return g;
  };
  const idle = make();
  run(idle, 0.1);
  assert.equal(idle.state.threat, 1);
  assert.equal(idle.state.warning, 'MISSILE INBOUND');
  run(idle, 1.4);
  assert.equal(idle.state.health, 86);
  const defended = make();
  assert.equal(defended.deployFlares(), true);
  assert.equal(defended.state.flares, 3);
  assert.equal(defended.deployFlares(), false);
  run(defended, 2);
  assert.equal(defended.state.health, 100);
  assert.equal(defended.state.threat, 0);
});

test('threats can be dodged by steering without spending a flare', () => {
  const g = new FlightGame().start();
  g.enemies = [];
  g.projectiles.push({ id: 990, owner: 'enemy', type: 'missile', x: 0, y: 230, z: -500,
    vx: 0, vy: 0, vz: 330, life: 5, age: 0, damage: 14, radius: 4,
    targetId: 'player', turnRate: 0.56, maxSpeed: 550 });
  run(g, 1.1, { x: 1, y: 1 });
  run(g, 1, { x: -1, y: -1 });
  assert.equal(g.state.health, 100);
  assert.equal(g.state.flares, 4);
});

test('23 numbered stages include verified supplies and landing phases, ending with carrier return', () => {
  const events = [];
  const g = new FlightGame({ onEvent: e => events.push(e), stageDuration: 1 }).start();
  // Remove enemies each tick to isolate the mission clock from combat damage.
  const safeRun = seconds => {
    for (let i = 0; i < seconds * 60; i++) { g.enemies = []; g.projectiles = []; g.update(1 / 60); }
  };
  g.state.missiles = 2; g.state.flares = 1; g.state.health = 60;
  safeRun(1);
  assert.equal(g.state.stage, 2);
  assert.equal(g.state.missiles, 2, 'ordinary stage changes do not magically refill weapons');
  assert.equal(g.state.flares, 1);
  assert.equal(g.state.health, 60);
  safeRun(1);
  assert.equal(g.state.stage, 3);
  assert.equal(g.state.stageKind, 'resupply');
  assert.ok(g.tanker);
  safeRun(0.5);
  assert.equal(g.state.missiles, 50);
  assert.equal(g.state.reloading, false);
  safeRun(20.5);
  assert.equal(g.state.status, 'victory');
  assert.equal(g.state.stage, 23);
  assert.match(g.state.resultReason, /Carrier/);
  assert.equal(events.filter(e => e.type === 'complete').length, 1);
  const stages = events.filter(e => e.type === 'stage');
  assert.equal(stages.length, 23);
  assert.deepEqual(stages.filter(e => e.kind === 'resupply').map(e => e.stage), [3, 9, 11, 16, 19, 21]);
  assert.deepEqual(stages.filter(e => e.kind === 'landing').map(e => e.stage), [5, 13]);
  assert.deepEqual(stages.filter(e => e.kind === 'canyon').map(e => e.stage), [8, 17]);
  assert.equal(stages[22].kind, 'return');
  const finalTime = g.state.time;
  run(g, 3, { gun: true });
  assert.equal(g.state.time, finalTime);
  g.start();
  assert.equal(g.state.status, 'playing');
  assert.equal(g.state.time, 0);
  assert.equal(g.state.health, 100);
  assert.equal(g.state.stage, 1);
  assert.equal(g.state.missiles, 50);
  assert.equal(g.projectiles.length, 0);
});

test('missile kills award two total HIT while the stage HUD increments one, then resets', () => {
  const events = [];
  const g = new FlightGame({ onEvent: e => events.push(e), stageDuration: 3 }).start();
  target(g);
  run(g, 0.8);
  assert.equal(g.fireMissile(), true);
  run(g, 1.2);
  assert.equal(g.state.hit, 1);
  assert.equal(g.state.totalHit, 2);
  run(g, 1);
  assert.equal(g.state.stage, 2);
  assert.equal(g.state.hit, 0);
  assert.equal(g.state.totalHit, 2);
  assert.equal(g.state.lastStageSummary.hit, 1);
  assert.equal(events.filter(e => e.type === 'stageComplete').length, 1);
});

test('fatal damage clamps health at zero and prevents further shooting', () => {
  const g = new FlightGame().start();
  g.enemies = [];
  g.state.health = 5;
  g.state.lives = 1;
  g.projectiles.push({ id: 990, owner: 'enemy', type: 'missile', x: 0, y: 230, z: -18,
    vx: 0, vy: 0, vz: 330, life: 5, age: 0, damage: 14, radius: 4,
    targetId: 'player', turnRate: 0.56, maxSpeed: 550 });
  g.update(1 / 60);
  assert.equal(g.state.status, 'defeat');
  assert.equal(g.state.health, 0);
  assert.equal(g.fireGun(), false);
  assert.equal(g.deployFlares(), false);
});

test('three aircraft are available, losses respawn safely without XP or ammunition reset', () => {
  const g = new FlightGame().start();
  g.enemies = [];
  g.state.missiles = 17;
  g.state.health = 5;
  const incoming = id => ({ id, owner: 'enemy', type: 'missile', x: 0, y: 230, z: -18,
    vx: 0, vy: 0, vz: 330, life: 5, age: 0, damage: 100, radius: 4,
    targetId: 'player', turnRate: 0.56, maxSpeed: 550 });
  g.projectiles.push(incoming(1000));
  g.update(1 / 60);
  assert.equal(g.state.status, 'playing');
  assert.equal(g.state.lives, 2);
  assert.equal(g.state.health, 100);
  assert.equal(g.state.missiles, 17);
  assert.ok(g.state.invulnerable > 2);
  g.projectiles.push(incoming(1001));
  g.update(1 / 60);
  assert.equal(g.state.lives, 2, 'respawn protection prevents an unavoidable second loss');
  for (let i = 0; i < 2; i++) {
    g.enemies = []; g.projectiles = [];
    run(g, 3.2);
    g.projectiles.push(incoming(1002 + i));
    g.update(1 / 60);
  }
  assert.equal(g.state.lives, 0);
  assert.equal(g.state.status, 'defeat');
});

test('up to four aligned targets can be locked and sequential missile fire avoids duplicate targets', () => {
  const g = new FlightGame().start();
  const base = target(g);
  g.enemies = Array.from({ length: 5 }, (_, i) => ({ ...base, id: 900 + i,
    x: (i - 2) * 30, baseX: (i - 2) * 30, attackTimer: 100 }));
  run(g, 0.8);
  assert.equal(g.state.lockIds.length, 4);
  assert.equal(g.fireMissile(), true);
  run(g, 0.3);
  assert.equal(g.fireMissile(), true);
  const targets = g.projectiles.filter(e => e.owner === 'player' && e.type === 'missile').map(e => e.targetId);
  assert.equal(new Set(targets).size, 2);
  assert.equal(g.state.missiles, 48);
});

test('rookie mode reduces missile damage and tracking while preserving original progression', () => {
  const standard = new FlightGame().start();
  const rookie = new FlightGame({ difficulty: 'rookie' }).start();
  run(standard, 1.6);
  run(rookie, 1.6);
  const a = standard.projectiles.find(q => q.owner === 'enemy');
  const b = rookie.projectiles.find(q => q.owner === 'enemy');
  assert.ok(a && b);
  assert.ok(b.damage < a.damage && b.turnRate < a.turnRate && b.maxSpeed < a.maxSpeed);
  assert.equal(rookie.state.stage, standard.state.stage);
  assert.equal(rookie.state.lives, 3);
});

test('service autopilot descends to the deck, holds, then climbs; final recovery stays landed', () => {
  const g = new FlightGame().start();
  const safeRun = seconds => {
    for (let i = 0; i < seconds * 60; i++) { g.enemies = []; g.projectiles = []; g.update(1 / 60, { y: 1, boost: true, gun: true }); }
  };
  for (let i = 1; i < 5; i++) { g.state.stageTime = g.state.stageDuration - 1 / 120; safeRun(1 / 60); }
  assert.equal(g.state.stageKind, 'landing');
  safeRun(9);
  assert.ok(Math.abs(g.player.y - 82) < 0.01);
  assert.ok(g.player.speed < 260);
  assert.equal(g.fireGun(), false);
  assert.equal(g.fireMissile(), false);
  safeRun(4);
  assert.equal(g.player.y, 82);
  assert.ok(g.player.speed < 130);
  safeRun(5.9);
  assert.ok(g.player.y > 229, 'airfield departure climbs back to cruise altitude');
  safeRun(0.1);
  assert.equal(g.state.stage, 6);
  for (let i = 6; i < 23; i++) { g.state.stageTime = g.state.stageDuration - 1 / 120; safeRun(1 / 60); }
  assert.equal(g.state.stageKind, 'return');
  safeRun(19);
  assert.equal(g.state.status, 'victory');
  assert.equal(g.player.y, 22, 'carrier recovery bypasses normal playable altitude to reach its 20m deck');
  assert.ok(g.player.speed < 125);
});

test('stage score bonus preserves the observed two-HIT / 40,000-points case', () => {
  const events = [];
  const g = new FlightGame({ onEvent: e => events.push(e), stageDuration: 3 }).start();
  for (let i = 0; i < 2; i++) { target(g, { id: 900 + i, phase: -0.2 }); run(g, 0.6, { gun: true }); }
  assert.equal(g.state.hit, 2);
  g.enemies = [];
  run(g, 1.8);
  assert.equal(g.state.lastStageSummary.bonus, 40000);
  assert.equal(g.state.score, 42000, 'adapted per-kill score is separate from the observed stage bonus');
  assert.equal(events.find(e => e.type === 'stageComplete').bonus, 40000);
  assert.equal(g.state.highScore, 42000);
});

test('stage bonus matches the additional verified three-HIT and five-HIT video count-up frames', () => {
  for (const [kills, observedBonus] of [[3, 60000], [5, 100000]]) {
    const g = new FlightGame({ stageDuration: 5 }).start();
    for (let i = 0; i < kills; i++) { target(g, { id: 900 + i, phase: -0.2 }); run(g, 0.6, { gun: true }); }
    assert.equal(g.state.hit, kills);
    g.enemies = [];
    run(g, 5 - kills * 0.6);
    assert.equal(g.state.lastStageSummary.bonus, observedBonus);
  }
});

test('HI throttle remains available continuously and LOW still overrides it', () => {
  const g = new FlightGame().start();
  run(g, 10, { boost: true });
  assert.equal(g.state.status, 'playing');
  assert.ok(g.player.speed > 1599.99);
  assert.equal(g.state.boostEnergy, 100, 'there is no invented exhaustion mechanic');
  run(g, 3, { boost: true, brake: true });
  assert.ok(g.player.speed < 880);
});

test('the unaccelerated reference-length campaign reaches carrier recovery at exactly 14:35', () => {
  const stages = [];
  const g = new FlightGame({ onEvent: e => { if (e.type === 'stage') stages.push(e); } }).start();
  // Remove combatants to isolate mission timing and original scripted service phases.
  // One-second update chunks also exercise catch-up without reducing game time.
  for (let second = 0; second < 900 && g.state.status === 'playing'; second++) {
    g.enemies = []; g.projectiles = [];
    g.update(1);
  }
  assert.equal(g.state.status, 'victory');
  assert.equal(g.state.stage, 23);
  assert.ok(Math.abs(g.state.time - 875) < 1e-6);
  assert.equal(stages.length, 23);
  assert.deepEqual(stages.map(e => e.stage), Array.from({ length: 23 }, (_, i) => i + 1));
  assert.equal(g.player.y, 22);
  assert.equal(g.state.lives, 3);
});

test('manual left and right rolls complete a full turn; a held button cannot chain rolls', () => {
  for (const [button, direction] of [['rollLeft', 1], ['rollRight', -1]]) {
    const events = [];
    const g = new FlightGame({ onEvent: e => events.push(e) }).start();
    run(g, 0.55, { [button]: true });
    assert.equal(g.state.rolling, true);
    assert.ok(Math.abs(g.player.rollAngle - direction * Math.PI) < 1e-8);
    run(g, 0.55, { [button]: true });
    assert.equal(g.state.rolling, false);
    assert.equal(g.player.rollAngle, 0);
    assert.ok(g.state.rollCooldown > 0);
    assert.equal(g.startRoll(-direction), false, 'recovery prevents an immediate opposite roll');
    run(g, 1, { [button]: true });
    const completed = events.filter(e => e.type === 'roll' && e.phase === 'complete');
    assert.equal(completed.length, 1, 'held controls do not repeat after the cooldown expires');
    assert.equal(completed[0].angle, direction * Math.PI * 2);
    g.update(1 / 60, {});
    g.update(1 / 60, { [button]: true });
    assert.equal(g.state.rolling, true, 'a new press starts another roll');
  }
});

test('rolls are available in combat and canyon runs, but blocked during reload and scripted recovery', () => {
  for (const stage of [1, 3, 8, 17]) {
    const g = new FlightGame().start();
    g._enterStage(stage);
    if (stage === 3) {
      assert.equal(g.startRoll(1), false, 'tanker docking is not a combat phase');
      run(g, 7.1);
      assert.equal(g.state.reloading, false);
    }
    assert.equal(g.startRoll(1), true, `stage ${stage} combat supports rolls`);
  }
  for (const stage of [5, 13, 23]) {
    const g = new FlightGame().start();
    g.startRoll(1); run(g, 0.3);
    g._enterStage(stage);
    assert.equal(g.player.rollAngle, 0, 'scripted approach begins upright');
    assert.equal(g.state.rolling, false);
    assert.equal(g.startRoll(-1), false);
    run(g, 0.3, { rollRight: true });
    assert.equal(g.player.rollAngle, 0);
  }
  const g = new FlightGame().start();
  run(g, 0.2, { rollLeft: true, rollRight: true });
  assert.equal(g.state.rolling, false, 'simultaneous opposite buttons are ignored');
});

test('roll progress pauses and resets, and identical controls agree at 30, 60 and 144 Hz', () => {
  const g = new FlightGame().start();
  run(g, 0.4, { rollLeft: true });
  g.setPaused(true);
  const frozen = structuredClone({ player: g.player, state: g.state });
  run(g, 4, { rollRight: true, gun: true });
  assert.deepEqual({ player: g.player, state: g.state }, frozen);
  assert.equal(g.startRoll(-1), false);
  g.start();
  assert.equal(g.player.rollAngle, 0);
  assert.equal(g.state.rollProgress, 0);
  assert.equal(g.state.rollCooldown, 0);
  assert.equal(g.state.rolling, false);

  const games = [30, 60, 144].map(fps => {
    const game = new FlightGame({ seed: 72 }).start();
    run(game, 1, { rollLeft: true, x: 0.2 }, fps);
    run(game, 1, {}, fps);
    run(game, 1, { rollRight: true, x: -0.3 }, fps);
    run(game, 1, {}, fps);
    return game;
  });
  for (const game of games.slice(1)) {
    assert.deepEqual(game.player, games[0].player);
    assert.deepEqual(game.state, games[0].state);
    assert.deepEqual(game.projectiles, games[0].projectiles);
  }
});

test('rolling preserves gun and missile combat, costs no ammunition itself, and grants no invulnerability', () => {
  const games = [false, true].map(rolling => {
    const g = new FlightGame().start(); target(g);
    run(g, 0.8);
    if (rolling) assert.equal(g.startRoll(1), true);
    g.projectiles.push({ id: 990, owner: 'enemy', type: 'missile', x: 0, y: 230, z: -18,
      vx: 0, vy: 0, vz: 330, life: 5, age: 0, damage: 14, radius: 4,
      targetId: 'player', turnRate: 0.56, maxSpeed: 550 });
    run(g, 1.5, { gun: true, missile: true });
    return g;
  });
  for (const g of games) {
    assert.equal(g.state.health, 86, 'the incoming missile still hits during a roll');
    assert.equal(g.state.invulnerable, 0);
    assert.ok(g.state.shots > 10 && g.state.kills > 0);
    assert.equal(g.state.missiles, 49);
  }
  for (const field of ['health', 'score', 'missiles', 'kills', 'shots', 'hits', 'hit', 'totalHit', 'lives']) {
    assert.equal(games[1].state[field], games[0].state[field], `roll does not alter ${field}`);
  }
});
