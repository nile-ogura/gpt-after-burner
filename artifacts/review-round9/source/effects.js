import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const random = (min, max) => min + Math.random() * (max - min);
const fract = n => n - Math.floor(n);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let u = x - ix, v = y - iy;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}

export function createGlowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.12, 'rgba(255,255,255,.8)');
  gradient.addColorStop(.32, 'rgba(255,255,255,.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

// Irregular density silhouettes avoid a stack of identical glowing circles.
function cloudletTexture(fire = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = (x - 64) / 64, v = (y - 64) / 64;
    const density = noise(x * .056, y * .056) * .58 + noise(x * .13 + 7, y * .13) * .27 + noise(x * .32, y * .32) * .15;
    const radius=Math.hypot(u,v);
    const edge = THREE.MathUtils.smoothstep(1 - radius + (density - .5) * .35, 0, .6);
    // A fully transparent perimeter prevents the noisy density field from
    // reaching a square texture edge when a close explosion fills the view.
    const padding=1-THREE.MathUtils.smoothstep(radius,.78,.98);
    const alpha = edge * padding * THREE.MathUtils.smoothstep(density, .18, .68);
    const i = (y * 128 + x) * 4;
    if (fire) {
      const heat = THREE.MathUtils.clamp((density - .45) * 1.7 + Math.max(0, .55 - Math.hypot(u, v)) * .6, 0, 1);
      image.data[i] = 255;
      image.data[i + 1] = 65 + heat * 190;
      image.data[i + 2] = 12 + Math.pow(heat, 3) * 235;
    } else {
      const light = 165 + density * 62 - v * 18;
      image.data[i] = light; image.data[i + 1] = light + 4; image.data[i + 2] = light + 6;
    }
    image.data[i + 3] = alpha * 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

class BillboardPool {
  constructor(scene, map, capacity, { color, additive = false, order = 1 }) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geometry.setAttribute('particleAlpha', this.alpha);
    const material = new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    material.forceSinglePass = true;
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float particleAlpha; varying float vParticleAlpha;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvParticleAlpha = particleAlpha;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vParticleAlpha;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vParticleAlpha;');
    };
    material.customProgramCacheKey = () => 'horizon-particle-alpha-v1';
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = additive ? 'Instanced fire' : 'Instanced vapor';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
    this.capacity = capacity; this.particles = [];
    this.matrix = new THREE.Matrix4(); this.quaternion = new THREE.Quaternion();
    this.spin = new THREE.Quaternion(); this.scale = new THREE.Vector3(); this.axis = new THREE.Vector3(0, 0, 1);
    this.forward=new THREE.Vector3();this.offset=new THREE.Vector3();
    scene.add(this.mesh);
  }
  sync(camera) {
    if (camera) this.particles.sort((a, b) => b.position.distanceToSquared(camera.position) - a.position.distanceToSquared(camera.position));
    if(camera)camera.getWorldDirection(this.forward);
    this.mesh.count = this.particles.length;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i], remaining = p.life / p.max, age = 1 - remaining;
      const expansion = p.type === 'fire' ? 1 + age * .65 : 1 + age * 2.3;
      this.quaternion.copy(camera?.quaternion || new THREE.Quaternion());
      this.spin.setFromAxisAngle(this.axis, p.rotation + age * p.spin); this.quaternion.multiply(this.spin);
      this.scale.set(p.size * expansion, p.size * expansion * p.aspect, 1);
      this.matrix.compose(p.position, this.quaternion, this.scale); this.mesh.setMatrixAt(i, this.matrix);
      const envelope = p.type === 'fire' ? Math.pow(remaining, 1.5) : Math.min(1, age * 12) * remaining;
      const depth=camera?this.offset.subVectors(p.position,camera.position).dot(this.forward):Infinity;
      const nearFade=THREE.MathUtils.smoothstep(depth,2,8+p.size*expansion*.35);
      // A hit on the chase aircraft can pass through the camera. Limit the
      // angular coverage of that local fire without dimming distant kills.
      const coverage=p.nearPlayer&&camera?p.size*expansion/(Math.max(depth,1)*2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))):0;
      const coverageFade=p.nearPlayer?1-THREE.MathUtils.smoothstep(coverage,.18,.48)*.9:1;
      this.alpha.setX(i, envelope * p.opacity * nearFade * coverageFade);
    }
    if (this.particles.length) { this.mesh.instanceMatrix.needsUpdate = true; this.alpha.needsUpdate = true; }
  }
}

class MissileWake {
  constructor(scene) {
    const segments = 1024, vertices = segments * 4;
    this.geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.BufferAttribute(new Float32Array(vertices), 1).setUsage(THREE.DynamicDrawUsage);
    const uv = new Float32Array(vertices * 2), indices = new Uint16Array(segments * 6);
    for (let i = 0; i < segments; i++) {
      uv.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8);
      const n = i * 4; indices.set([n, n + 1, n + 2, n + 1, n + 3, n + 2], i * 6);
    }
    this.geometry.setAttribute('position', this.position); this.geometry.setAttribute('wakeAlpha', this.alpha);
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.setDrawRange(0, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0xd4e2e5, transparent: true, opacity: .48, depthWrite: false, side: THREE.DoubleSide, fog: true });
    material.forceSinglePass = true;
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float wakeAlpha; varying float vWakeAlpha; varying vec2 vWakeUv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWakeAlpha=wakeAlpha; vWakeUv=uv;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWakeAlpha; varying vec2 vWakeUv;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vWakeAlpha * pow(sin(clamp(vWakeUv.x,0.0,1.0)*3.14159265),2.5);');
    };
    material.customProgramCacheKey = () => 'horizon-continuous-wake-v1';
    this.mesh = new THREE.Mesh(this.geometry, material); this.mesh.name = 'Continuous missile wakes';
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; scene.add(this.mesh);
    this.direction = new THREE.Vector3(); this.view = new THREE.Vector3(); this.width = new THREE.Vector3();
    this.capacity = segments;
  }
  sync(trails, time, camera) {
    let count = 0;
    for (const trail of trails.values()) for (let i = 1; i < trail.points.length && count < this.capacity; i++) {
      const a = trail.points[i - 1], b = trail.points[i];
      this.direction.subVectors(b.position, a.position);
      if (this.direction.lengthSq() < .01) continue;
      this.view.copy(camera.position).sub(a.position);
      this.width.crossVectors(this.direction, this.view).normalize();
      const ageA = Math.min(1, (time - a.born) / 1.8), ageB = Math.min(1, (time - b.born) / 1.8);
      const tailA = THREE.MathUtils.smoothstep(i - 1, 0, 3), tailB = THREE.MathUtils.smoothstep(i, 0, 3);
      const headA = THREE.MathUtils.smoothstep(trail.points.length - i, 0, 2), headB = THREE.MathUtils.smoothstep(trail.points.length - i - 1, 0, 2);
      const wa = (.18 + ageA * .75) * (.15 + .85 * Math.min(tailA, headA));
      const wb = (.18 + ageB * .75) * (.15 + .85 * Math.min(tailB, headB));
      for (let corner = 0; corner < 4; corner++) {
        const p = corner < 2 ? a.position : b.position;
        const w = (corner < 2 ? wa : wb) * (corner % 2 ? 1 : -1), index = count * 4 + corner;
        this.position.setXYZ(index, p.x + this.width.x * w, p.y + this.width.y * w, p.z + this.width.z * w);
        this.alpha.setX(index, Math.pow(1 - (corner < 2 ? ageA : ageB), 1.5) * (corner < 2 ? tailA * headA : tailB * headB));
      }
      count++;
    }
    this.geometry.setDrawRange(0, count * 6); this.position.needsUpdate = true; this.alpha.needsUpdate = true;
  }
}

export class CombatEffects {
  constructor(scene) {
    this.scene = scene; this.lights = []; this.trails = new Map(); this.time = 0;
    const vapor = cloudletTexture(), fire = cloudletTexture(true);
    this.pools = {
      fire: new BillboardPool(scene, fire, 160, { color: 0xffffff, additive: true, order: 3 }),
      smoke: new BillboardPool(scene, vapor, 180, { color: 0x647078, order: 2 }),
    };
    this.wake = new MissileWake(scene);
  }
  particle(x, y, z, size, life, type, vx = 0, vy = 0, vz = 0, opacity = .7, aspect = 1, nearPlayer = false) {
    const pool = this.pools[type]; if (pool.particles.length >= pool.capacity) return;
    pool.particles.push({ position: new THREE.Vector3(x, y, z), life, max: life, size, type, vx, vy, vz, opacity, aspect, nearPlayer, rotation: random(-Math.PI, Math.PI), spin: random(-.4, .4) });
  }
  explode(x, y, z, scale = 1, { nearPlayer = false } = {}) {
    const sizeScale=nearPlayer?.72:1,fireOpacity=nearPlayer?.26:1;
    this.particle(x, y, z, 7 * scale * sizeScale, .22, 'fire', 0, 0, 0, fireOpacity, 1, nearPlayer);
    for (let i = 0; i < (nearPlayer?8:16); i++) {
      const angle = random(0, Math.PI * 2), h = random(-.55, .7), velocity = random(12, 32) * scale;
      this.particle(x, y, z, random(5, 10) * scale * sizeScale, random(.24, .65), 'fire', Math.cos(angle) * velocity, h * velocity, Math.sin(angle) * velocity, .65 * fireOpacity, 1, nearPlayer);
    }
    for (let i = 0; i < (nearPlayer?6:12); i++) {
      this.particle(x + random(-5, 5) * scale, y + random(-4, 4) * scale, z + random(-5, 5) * scale, random(10, 19) * scale * sizeScale, random(1.5, 3.4), 'smoke', random(-7, 7), random(6, 15), random(-5, 5), nearPlayer?.32:.58, 1, nearPlayer);
    }
    for (let i = 0; i < (nearPlayer?6:10); i++) {
      const angle = random(0, Math.PI * 2), velocity = random(35, 65) * scale;
      this.particle(x, y, z, random(2, 5) * scale * sizeScale, random(.18, .48), 'fire', Math.cos(angle) * velocity, random(-.3, .45) * velocity, Math.sin(angle) * velocity, .75 * fireOpacity, .09, nearPlayer);
    }
    // Keep player-hit illumination local instead of flooding the aircraft orange.
    const intensity = 32 * scale * (nearPlayer?.25:1);
    const light = new THREE.PointLight(0xffad61, intensity, 90 * scale);
    light.position.set(x, y, z); this.scene.add(light);
    this.lights.push({ light, life: .22, max: .22, intensity });
  }
  flare(x, y, z) {
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      this.particle(x, y, z, 2.6, random(.7, 1.4), 'fire', side * (18 + i * 3), -8 - i * 2, 12 + i * 4, .8);
    }
  }
  trail(id, x, y, z) {
    let trail = this.trails.get(id);
    if (!trail) { trail = { points: [], seen: this.time }; this.trails.set(id, trail); }
    const previous = trail.points.at(-1);
    if (!previous || previous.position.distanceToSquared(new THREE.Vector3(x, y, z)) > 64) {
      trail.points.push({ position: new THREE.Vector3(x, y, z), born: this.time });
      if (trail.points.length > 80) trail.points.shift();
    }
    trail.seen = this.time;
  }
  update(dt, speed, camera) {
    this.time += dt; const drift = speed / 3.6;
    for (const pool of Object.values(this.pools)) {
      for (let i = pool.particles.length - 1; i >= 0; i--) {
        const p = pool.particles[i]; p.life -= dt;
        if (p.life <= 0) { pool.particles.splice(i, 1); continue; }
        p.position.x += p.vx * dt; p.position.y += p.vy * dt; p.position.z += (p.vz + drift) * dt;
      }
      pool.sync(camera);
    }
    for (const [id, trail] of this.trails) {
      for (const p of trail.points) p.position.z += drift * dt;
      while (trail.points.length && this.time - trail.points[0].born > 1.8) trail.points.shift();
      if (!trail.points.length && this.time - trail.seen > .3) this.trails.delete(id);
    }
    if (camera) this.wake.sync(this.trails, this.time, camera);
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const p = this.lights[i]; p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.light); this.lights.splice(i, 1); }
      else p.light.intensity = p.intensity * (p.life / p.max) ** 2;
    }
  }
  clear() {
    for (const pool of Object.values(this.pools)) { pool.particles.length = 0; pool.mesh.count = 0; }
    for (const p of this.lights) this.scene.remove(p.light);
    this.lights.length = 0; this.trails.clear(); this.wake.geometry.setDrawRange(0, 0);
  }
}

const projectilePools = new Map(), projectileTemplates = new Map();
function projectileTemplate(key) {
  if (projectileTemplates.has(key)) return projectileTemplates.get(key);
  const group = new THREE.Group(); group.userData.projectileKey = key;
  if (key === 'gun') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 9, 5), new THREE.MeshBasicMaterial({ color: 0xffd797 }));
    body.rotation.x = Math.PI / 2; group.add(body);
  } else {
    const parts = [];
    parts.push(new THREE.CylinderGeometry(.23, .23, 3.3, 8).rotateX(Math.PI / 2));
    parts.push(new THREE.ConeGeometry(.23, .7, 8).rotateX(-Math.PI / 2).translate(0, 0, -2));
    for (let i = 0; i < 4; i++) parts.push(new THREE.BoxGeometry(.05, .9, .6).rotateZ(i * Math.PI / 2).translate(0, 0, 1));
    const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose());
    group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xe1ded1, roughness: .5, metalness: .4 })));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: createGlowTexture(), color: key === 'enemy' ? 0xff7253 : 0xffcf86, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    glow.position.z = 2; glow.scale.set(2.5, 2.5, 1); group.add(glow);
  }
  projectileTemplates.set(key, group); return group;
}

export function createProjectileMesh(projectile) {
  const key = projectile.type === 'gun' ? 'gun' : projectile.owner === 'enemy' ? 'enemy' : 'player';
  const pool = projectilePools.get(key);
  const mesh = pool?.pop() || projectileTemplate(key).clone(true);
  mesh.visible = true; return mesh;
}

export function recycleProjectileMesh(mesh) {
  mesh.removeFromParent(); mesh.visible = false;
  const key = mesh.userData.projectileKey;
  if (!projectilePools.has(key)) projectilePools.set(key, []);
  const pool = projectilePools.get(key); if (pool.length < 96) pool.push(mesh);
}
