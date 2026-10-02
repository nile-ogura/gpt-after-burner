import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// AR-29 Kestrel: an original twin-engine fighter. Local forward is -Z.
const materialCache = new Map();
const TAU = Math.PI * 2;
const seamMaterial = new THREE.LineBasicMaterial({ color: 0x263c43, transparent: true, opacity: .28, depthWrite: false });

function canvas(size = 1024) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = size; return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
  return null;
}

function rng(seed) {
  let n = seed;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}

function texture(c, color = true) {
  if (!c) return null;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function skinMaps(enemy) {
  const c = canvas(2048), r = canvas(2048), b = canvas(2048);
  if (!c) return {};
  const p = c.getContext('2d'), q = r.getContext('2d'), h = b.getContext('2d');
  const rand = rng(enemy ? 712 : 1934);
  p.fillStyle = enemy ? '#737c80' : '#9daaa6'; p.fillRect(0, 0, 2048, 2048);
  q.fillStyle = '#a8a8a8'; q.fillRect(0, 0, 2048, 2048);
  h.fillStyle = '#808080'; h.fillRect(0, 0, 2048, 2048);
  // The UV islands are deliberately subdued. Panel seams remain readable in sun,
  // without turning the airframe into a grid when the camera pulls back.
  const row = [0, 162, 418, 655, 934, 1152, 1477, 1710, 2048];
  for (let y = 0; y < row.length - 1; y++) {
    let xx = -75 - rand() * 145;
    while (xx < 2048) {
      const ww = 185 + rand() * 300, yy = row[y], hh = row[y + 1] - yy;
      const cut = 9 + rand() * 24;
      const drawPanel = (ctx, inset = 0) => {
        ctx.beginPath(); ctx.moveTo(xx + cut, yy + inset); ctx.lineTo(xx + ww - inset, yy + inset);
        ctx.lineTo(xx + ww - inset, yy + hh - cut); ctx.lineTo(xx + ww - cut, yy + hh - inset);
        ctx.lineTo(xx + inset, yy + hh - inset); ctx.lineTo(xx + inset, yy + cut); ctx.closePath();
      };
      const shade = Math.floor(119 + rand() * 44);
      drawPanel(p, 2);
      p.fillStyle = enemy ? `rgba(20,32,40,${rand() * 0.14})` : `rgba(${shade},${shade + 8},${shade + 7},${0.09 + rand() * .17})`;
      p.fill(); p.strokeStyle = 'rgba(29,43,49,.38)'; p.lineWidth = 2.2; p.stroke();
      drawPanel(p, 4); p.strokeStyle = 'rgba(221,231,231,.17)'; p.lineWidth = 1; p.stroke();
      drawPanel(h, 2); h.strokeStyle = '#525252'; h.lineWidth = 2; h.stroke();
      drawPanel(q, 3); const rough = 147 + Math.floor(rand() * 46); q.fillStyle = `rgb(${rough},${rough},${rough})`; q.fill();
      p.fillStyle = 'rgba(28,39,44,.36)'; h.fillStyle = '#676767';
      for (let i = cut + 9; i < ww - cut - 9; i += 27) {
        p.fillRect(xx + i, yy + 7, 2, 2); p.fillRect(xx + i, yy + hh - 8, 2, 2);
        h.fillRect(xx + i, yy + 7, 2, 2);
      }
      xx += ww;
    }
  }
  for (let i = 0; i < 14000; i++) {
    const x = rand() * 2048, y = rand() * 2048, a = .02 + rand() * .055;
    p.fillStyle = rand() > .5 ? `rgba(255,255,255,${a})` : `rgba(8,23,29,${a})`;
    p.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 5);
  }
  // Fine rain/salt streaks and servicing marks. Texture is shared by all aircraft.
  for (let i = 0; i < 95; i++) {
    const x = rand() * 2048, y = rand() * 2048;
    const g = p.createLinearGradient(x, y, x, y + 110);
    g.addColorStop(0, 'rgba(20,33,39,.055)'); g.addColorStop(1, 'rgba(20,33,39,0)');
    p.fillStyle = g; p.fillRect(x, y, 2 + rand() * 5, 110);
  }
  p.font = '11px monospace'; p.fillStyle = 'rgba(35,47,53,.68)';
  for (let i = 0; i < 8; i++) {
    const x = 70 + (i % 3) * 662 + rand() * 90, y = 290 + Math.floor(i / 3) * 640 + rand() * 35;
    p.fillText('NO STEP', x, y); p.fillText('AR-29 / ACCESS', x, y + 17);
    p.strokeStyle = 'rgba(161,120,58,.48)'; p.lineWidth = 3; p.strokeRect(x - 8, y - 22, 112, 46);
  }
  return { map: texture(c), roughnessMap: texture(r, false), bumpMap: texture(b, false), bumpScale: .013 };
}

function wingMaps(enemy) {
  const c = canvas(1024), bump = canvas(1024), rough = canvas(1024);
  if (!c) return {};
  const p = c.getContext('2d'), h = bump.getContext('2d'), q = rough.getContext('2d');
  p.fillStyle = enemy ? '#788387' : '#a2ada9'; p.fillRect(0, 0, 1024, 1024);
  h.fillStyle = '#808080'; h.fillRect(0, 0, 1024, 1024);
  q.fillStyle = '#aaaaaa'; q.fillRect(0, 0, 1024, 1024);
  // Broad authored coating changes survive mipmapping at the 26m camera.
  // The inboard repair coat and control-surface strip are neither a grid nor
  // high-contrast camouflage; both retain sparse panel and fastener detail.
  const repairCoat = ctx => {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(392, 0); ctx.lineTo(356, 241);
    ctx.bezierCurveTo(344, 410, 261, 422, 243, 584); ctx.lineTo(171, 907);
    ctx.lineTo(0, 983); ctx.closePath(); ctx.fill();
  };
  p.fillStyle = enemy ? '#63777c' : '#909e9b'; repairCoat(p);
  q.fillStyle = '#c2c2c2'; repairCoat(q);
  p.fillStyle = enemy ? 'rgba(46,66,74,.19)' : 'rgba(41,61,62,.14)';
  p.beginPath(); p.moveTo(0, 18); p.lineTo(1024, 31); p.lineTo(1024, 111);
  p.lineTo(670, 95); p.lineTo(354, 62); p.lineTo(0, 88); p.closePath(); p.fill();
  // Physical trailing-control zone: canvas Y runs opposite to UV V.
  // Match the hinge in world-scale x/z rather than applying a generic stripe.
  const controlZone = ctx => {
    const points = [[4.02, 3.70], [7.94, 3.80], [7.83, 4.18], [4.01, 4.39]];
    ctx.beginPath(); points.forEach(([x, z], i) => {
      const px = x / 9 * 1024, py = (1 - (z + 2) / 7.5) * 1024;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }); ctx.closePath(); ctx.fill();
  };
  p.fillStyle = enemy ? '#667777' : '#879b95'; controlZone(p);
  q.fillStyle = '#989898'; controlZone(q);
  const rand = rng(458);
  for (let i = 0; i < 10000; i++) {
    p.fillStyle = rand() > .5 ? 'rgba(255,255,255,.028)' : 'rgba(0,22,32,.028)';
    p.fillRect(rand() * 1024, rand() * 1024, 1.5, 3);
  }
  const paths = [
    [[75, 80], [245, 190], [410, 405], [650, 645], [930, 820]],
    [[80, 345], [380, 560], [625, 720], [940, 935]],
    [[150, 65], [180, 400], [240, 890]],
    [[310, 270], [345, 630], [370, 950]],
    [[515, 490], [550, 805], [570, 1024]],
    [[745, 690], [760, 1024]],
    [[0, 820], [350, 850], [630, 905], [940, 985]],
  ];
  for (const pts of paths) {
    for (const [ctx, col, width] of [[p, 'rgba(30,44,49,.34)', 1.4], [h, '#4d4d4d', 1.6]]) {
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.stroke();
    }
  }
  p.fillStyle = 'rgba(39,54,60,.65)'; p.font = '11px monospace';
  p.fillText('NO STEP', 285, 625); p.fillText('AR-29 / 017', 500, 765);
  // An original low-visibility insignia; a broken ring and chevron.
  p.save(); p.translate(535, 690); p.strokeStyle = '#5e757e'; p.lineWidth = 9;
  p.beginPath(); p.arc(0, 0, 54, .35, TAU - .35); p.stroke();
  p.beginPath(); p.moveTo(-25, 16); p.lineTo(0, -28); p.lineTo(25, 16); p.stroke(); p.restore();
  p.strokeStyle = 'rgba(49,61,65,.32)'; p.lineWidth = 1;
  for (let y = 430; y < 980; y += 40) {
    for (let x = 125; x < 830; x += 36) { p.fillStyle = 'rgba(30,43,50,.26)'; p.fillRect(x, y, 1.5, 1.5); }
  }
  return { map: texture(c), roughnessMap: texture(rough, false), bumpMap: texture(bump, false), bumpScale: .008 };
}

function nozzleMaps() {
  const c = canvas(1024), r = canvas(1024), b = canvas(1024); if (!c) return {};
  const p = c.getContext('2d'), q = r.getContext('2d'), h = b.getContext('2d'), rand = rng(987);
  const heat = p.createLinearGradient(0, 0, 0, 1024);
  heat.addColorStop(0, '#666360'); heat.addColorStop(.26, '#81766e');
  heat.addColorStop(.47, '#84838b'); heat.addColorStop(.68, '#a0a5a5'); heat.addColorStop(1, '#929795');
  p.fillStyle = heat; p.fillRect(0, 0, 1024, 1024);
  q.fillStyle = '#898989'; q.fillRect(0, 0, 1024, 1024);
  h.fillStyle = '#808080'; h.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 18; i++) {
    const x = i * 1024 / 18;
    p.fillStyle = `rgba(17,22,26,${.08 + rand() * .08})`; p.fillRect(x, 0, 1024 / 18 - 2, 1024);
    p.fillStyle = 'rgba(14,18,21,.7)'; p.fillRect(x, 0, 2, 1024);
    p.fillStyle = 'rgba(191,195,192,.24)'; p.fillRect(x + 3, 0, 1.5, 1024);
    h.fillStyle = '#494949'; h.fillRect(x, 0, 2.5, 1024);
    q.fillStyle = `rgb(${125 + i % 4 * 9},${125 + i % 4 * 9},${125 + i % 4 * 9})`; q.fillRect(x + 3, 0, 1024 / 18 - 6, 1024);
  }
  for (let i = 0; i < 8000; i++) {
    p.fillStyle = 'rgba(9,16,23,.05)'; p.fillRect(rand() * 1024, rand() * 1024, .9, 3 + rand() * 17);
  }
  return { map: texture(c), roughnessMap: texture(r, false), bumpMap: texture(b, false), bumpScale: .008 };
}

function finMaps(enemy) {
  const c = canvas(1024), r = canvas(1024), b = canvas(1024); if (!c) return {};
  const p = c.getContext('2d'), q = r.getContext('2d'), h = b.getContext('2d'), rand = rng(2219);
  p.fillStyle = enemy ? '#78878d' : '#95a39f'; p.fillRect(0, 0, 1024, 1024);
  q.fillStyle = '#b4b4b4'; q.fillRect(0, 0, 1024, 1024);
  h.fillStyle = '#808080'; h.fillRect(0, 0, 1024, 1024);
  const paths = [
    [[25, 197], [950, 197]], // The single continuous rudder hinge.
    [[92, 230], [106, 820], [176, 856], [176, 948]],
    [[325, 439], [506, 439], [531, 602], [339, 622], [325, 439]],
    [[654, 249], [776, 249], [776, 345], [654, 345], [654, 249]],
  ];
  for (const points of paths) {
    for (const [ctx, stroke, width] of [[p, 'rgba(27,44,54,.30)', 1.7], [h, '#575757', 1.8]]) {
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke();
    }
  }
  p.fillStyle = 'rgba(67,88,102,.05)'; p.fillRect(25, 15, 950, 180);
  q.fillStyle = '#a5a5a5'; q.fillRect(25, 15, 950, 180);
  p.fillStyle = 'rgba(224,234,236,.045)'; p.fillRect(340, 449, 165, 150);
  q.fillStyle = '#c3c3c3'; q.fillRect(340, 449, 165, 150);
  p.fillStyle = enemy ? '#697a80' : '#7f918f';
  p.beginPath(); p.moveTo(880, 0); p.lineTo(1024, 0); p.lineTo(1024, 1024);
  p.lineTo(866, 1024); p.lineTo(874, 680); p.lineTo(850, 358); p.closePath(); p.fill();
  q.fillStyle = '#bdbdbd'; q.fillRect(888, 0, 136, 1024);
  p.fillStyle = 'rgba(28,43,52,.33)';
  for (let x = 36; x < 930; x += 30) p.fillRect(x, 204, 1.6, 1.6);
  p.font = '12px monospace'; p.fillText('AR-29 / STABILIZER', 329, 650);
  for (let i = 0; i < 6500; i++) {
    p.fillStyle = rand() > .5 ? 'rgba(250,253,255,.023)' : 'rgba(7,24,34,.025)';
    p.fillRect(rand() * 1024, rand() * 1024, 1, 1 + rand() * 5);
  }
  return { map: texture(c), roughnessMap: texture(r, false), bumpMap: texture(b, false), bumpScale: .010 };
}

function materials(enemy) {
  if (materialCache.has(enemy)) return materialCache.get(enemy);
  const skin = skinMaps(enemy), wing = wingMaps(enemy), fin = finMaps(enemy);
  const m = {
    skin: new THREE.MeshStandardMaterial({ color: 0xbdc6c3, metalness: .12, roughness: .82, ...skin }),
    shoulder: new THREE.MeshStandardMaterial({ color: 0xafbfbc, metalness: .16, roughness: .59, ...skin }),
    wing: new THREE.MeshStandardMaterial({ color: 0xb1beba, metalness: .12, roughness: .78, ...wing }),
    control: new THREE.MeshStandardMaterial({ color: 0x9baba6, metalness: .14, roughness: .63, side: THREE.DoubleSide, ...wing }),
    fin: new THREE.MeshStandardMaterial({ color: 0x9faba8, metalness: .12, roughness: .83, ...fin }),
    structure: new THREE.MeshStandardMaterial({ color: 0x586c67, metalness: .14, roughness: .76, roughnessMap: skin.roughnessMap ?? null }),
    dark: new THREE.MeshStandardMaterial({ color: 0x14232b, metalness: .58, roughness: .52 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x53616a, metalness: .84, roughness: .36 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .78, roughness: .54, ...nozzleMaps() }),
    hotMetal: new THREE.MeshStandardMaterial({ color: 0x81756a, metalness: .68, roughness: .45 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xa0a09a, metalness: .84, roughness: .31 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x080e14, metalness: .2, roughness: .86 }),
    canopy: new THREE.MeshPhysicalMaterial({ color: 0x122935, metalness: .43, roughness: .12, clearcoat: 1, clearcoatRoughness: .07, ior: 1.52, reflectivity: .92 }),
    nose: new THREE.MeshStandardMaterial({ color: enemy ? 0x465258 : 0x627984, metalness: .16, roughness: .6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xd4d8d4, metalness: .24, roughness: .46 }),
    red: new THREE.MeshStandardMaterial({ color: 0xad362b, metalness: .25, roughness: .45 }),
  };
  materialCache.set(enemy, m); return m;
}

function mesh(g, m, parent) {
  const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true;
  if (parent) parent.add(o); return o;
}

// Ring loft: center z, half-width, half-height, vertical center; soft ellipse.
function loft(rings, segments = 48, exponent = 1) {
  const vertices = [], uv = [], indices = [];
  const z0 = rings[0][0], z1 = rings[rings.length - 1][0];
  for (let j = 0; j < rings.length; j++) {
    const [z, w, h, cy = 0, sectionExponent = exponent] = rings[j];
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * TAU;
      const sin = Math.sin(a), cos = Math.cos(a);
      vertices.push(Math.sign(sin) * Math.pow(Math.abs(sin), sectionExponent) * w, cy + Math.sign(cos) * Math.pow(Math.abs(cos), sectionExponent) * h, z);
      uv.push(i / segments, (z - z0) / (z1 - z0));
    }
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

function layeredLoft(rings, segments, exponent, materials, zone, parent) {
  // Split surface indices, not coplanar overlays. Every zone keeps the normals
  // of the complete curved shell, so paint boundaries do not invent ridges.
  const surface = loft(rings, segments, exponent), buckets = materials.map(() => []);
  const indices = surface.index.array;
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
    const material = zone((i + .5) / segments * TAU, (rings[j][0] + rings[j + 1][0]) * .5);
    const start = (j * segments + i) * 6;
    buckets[material].push(...indices.slice(start, start + 6));
  }
  const group = new THREE.Group(); parent.add(group);
  buckets.forEach((indices, i) => {
    if (!indices.length) return;
    const geometry = surface.clone(); geometry.setIndex(indices);
    mesh(geometry, materials[i], group);
  });
  surface.dispose(); return group;
}

function sweptWing(side) {
  // Authored span stations give the wing a tapered airfoil section. The two
  // short rear steps are the actual elevon cutout, with a narrow hinge gap.
  const stations = [
    [1.20, -2.35, 5.02, .17, .26], [1.33, -2.275, 5.05, .15, .25],
    [2.55, -1.575, 4.775, .12, .225], [3.95, -.677, 4.45, .08, .18],
    [4.015, -.628, 4.42, .078, .175], [4.035, -.61, 3.715, .078, .172],
    [5.50, .533, 3.750, .042, .135], [7.79, 2.236, 3.811, -.014, .080],
    [7.94, 2.348, 3.815, -.028, .073], [7.965, 2.367, 4.001, -.029, .071],
    [8.69, 2.893, 3.55, -.05, .045], [8.85, 3.01, 3.021, -.06, .012],
  ];
  const segments = 24, positions = [], uv = [], indices = [];
  for (const [span, leading, trailing, cy, thickness] of stations) {
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * TAU, t = (1 - Math.cos(a)) * .5;
      const z = THREE.MathUtils.lerp(leading, trailing, t);
      const sine = Math.sin(a);
      const y = cy + thickness * (.12 * Math.sin(Math.PI * t) + .64 * Math.sign(sine) * Math.pow(Math.abs(sine), .8));
      positions.push(side * span, y, z); uv.push(span / 9, (z + 2) / 7.5);
    }
  }
  for (let j = 0; j < stations.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    if (side > 0) indices.push(a, a + 1, b, b, a + 1, b + 1);
    else indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // Close root and tip with their own cap normals; the root is inside the
  // blended shoulder, while the tiny rounded tip remains a sealed volume.
  for (const j of [0, stations.length - 1]) {
    const base = j * (segments + 1), [span, leading, trailing, cy] = stations[j];
    const center = positions.length / 3;
    positions.push(side * span, cy, (leading + trailing) * .5);
    uv.push(span / 9, ((leading + trailing) * .5 + 2) / 7.5);
    const boundary = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      positions.push(...positions.slice((base + i) * 3, (base + i) * 3 + 3));
      uv.push(...uv.slice((base + i) * 2, (base + i) * 2 + 2));
    }
    const outward = j === 0 ? -side : side;
    for (let i = 0; i < segments; i++) {
      if (outward > 0) indices.push(center, boundary + i, boundary + i + 1);
      else indices.push(center, boundary + i + 1, boundary + i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

// Triangulated airfoil plate. Its curved section and bevelled, thin edges avoid
// the heavy extruded-plastic silhouette of a primitive-based aircraft.
function foil(points, thickness = .12, uvBounds = [0, 9, -2, 5.5], uvOffset = [0, 0]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length]; area += points[i][0] * next[2] - next[0] * points[i][2];
  }
  if (area > 0) points = [...points].reverse();
  const vertices = [], uvs = [], indices = [], n = points.length;
  let cx = 0, cz = 0, cy = 0;
  points.forEach(p => { cx += p[0] / n; cy += p[1] / n; cz += p[2] / n; });
  const add = (x, y, z) => {
    vertices.push(x, y, z);
    uvs.push((Math.abs(x + uvOffset[0]) - uvBounds[0]) / (uvBounds[1] - uvBounds[0]), (z + uvOffset[1] - uvBounds[2]) / (uvBounds[3] - uvBounds[2]));
  };
  for (let s = 0; s < 2; s++) {
    const sign = s ? -1 : 1;
    add(cx, cy + sign * thickness * .65, cz);
    for (const [x, y, z] of points) add(cx + (x - cx) * .66, y + sign * thickness * .44, cz + (z - cz) * .66);
    for (const [x, y, z] of points) add(x, y + sign * thickness * .08, z);
    const base = s * (2 * n + 1);
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const tri = [base, base + 1 + i, base + 1 + next];
      const quad = [base + 1 + i, base + n + 1 + i, base + n + 1 + next, base + 1 + next];
      if (s === 0) { indices.push(...tri, quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]); }
      else { indices.push(tri[0], tri[2], tri[1], quad[0], quad[2], quad[1], quad[0], quad[3], quad[2]); }
    }
  }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n, a = n + 1 + i, b = n + 1 + next, c = 3 * n + 2 + i, d = 3 * n + 2 + next;
    indices.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals();
  // Winding is based on x/z polygon order; both sides are physically present.
  return g;
}

function tube(points, radius, material, parent, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, segments, radius, 6, false), material, parent);
}

function ring(radius, width, mat, parent, x, y, z) {
  const o = mesh(new THREE.TorusGeometry(radius, width, 6, 48), mat, parent); o.position.set(x, y, z); return o;
}

function nozzlePetal(angle, x) {
  const positions = [], uvs = [], indices = [];
  const profiles = [[6.84, .700, .610], [7.30, .667, .579], [7.91, .568, .497]];
  for (let j = 0; j < profiles.length; j++) {
    const [z, width, height] = profiles[j];
    for (let i = 0; i < 3; i++) {
      const a = angle + (i - 1) * TAU / 18 * .455;
      positions.push(x + Math.sin(a) * width, -.29 + Math.cos(a) * height, z + (j === 2 ? (i === 1 ? .011 : -.019) : 0));
      uvs.push((a / TAU + 1) % 1, (z - 6.71) / (7.94 - 6.71));
    }
  }
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const a = j * 3 + i, b = a + 3;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function decalTexture(enemy) {
  const c = canvas(512); if (!c) return null;
  const p = c.getContext('2d'); p.clearRect(0, 0, 512, 512);
  p.fillStyle = enemy ? '#304248' : '#354e5c'; p.font = 'bold 112px Arial'; p.textAlign = 'center';
  p.fillText(enemy ? '09' : '17', 256, 322);
  p.font = 'bold 46px Arial'; p.fillText(enemy ? 'ORION' : 'KESTREL', 256, 390);
  p.strokeStyle = enemy ? '#304248' : '#354e5c'; p.lineWidth = 16;
  p.beginPath(); p.moveTo(135, 162); p.lineTo(256, 87); p.lineTo(377, 162); p.lineTo(256, 142); p.closePath(); p.stroke();
  return texture(c);
}

function fin(side, m, group, enemy) {
  // Build in the x/z plane, then rotate the thin airfoil up into a canted fin.
  const o = new THREE.Group(); o.position.set(side * 1.65, .36, 4.3);
  o.rotation.z = side > 0 ? 1.30 : Math.PI - 1.30;
  const pts = [[0, 0, -.8], [2.5, 0, .5], [3.5, 0, 2.56], [0, 0, 2.728]];
  const material = m.fin.clone(); material.side = THREE.DoubleSide;
  mesh(foil(pts, .1, [0, 3.6, -.8, 3.6]), material, o);
  mesh(foil([[0, 0, 2.71], [.46, 0, 2.70], [.46, 0, 3.50], [.1, 0, 3.55]], .1, [0, 3.6, -.8, 3.6]), material, o);
  // Rudder is a separate, bevelled control surface, moving about its leading edge.
  const rudder = new THREE.Group(); rudder.position.set(2.05, 0, 2.82);
  const rudderMaterial = material.clone(); rudderMaterial.color.multiplyScalar(.87); rudderMaterial.roughness = .65;
  mesh(foil([[-1.55, 0, -.10], [1.35, 0, -.22], [1.12, 0, .6], [-1.55, 0, .67]], .055, [0, 3.6, -.8, 3.6], [2.05, 2.82]), rudderMaterial, rudder);
  o.add(rudder); group.add(o);
  const mark = decalTexture(enemy);
  if (mark) {
    const d = mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshStandardMaterial({ map: mark, transparent: true, roughness: .56, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), o);
    d.rotation.x = -Math.PI / 2; d.position.set(1.95, .077, 1.53);
    const other = d.clone(); other.position.y = -.077; o.add(other);
  }
  tube([[.1, .05, -.68], [2.48, .055, .58], [3.45, .05, 2.6]], .022, m.metal, o, 12);
  return rudder;
}

function missile(x, z, m, group) {
  const p = new THREE.Group(); p.position.set(x, -.68, z);
  mesh(loft([[-2.15, .02, .02], [-1.88, .075, .075], [-1.5, .14, .14], [1.1, .14, .14], [1.45, .115, .115]], 16), m.white, p);
  const band = mesh(new THREE.CylinderGeometry(.143, .143, .06, 16), m.nose, p); band.rotation.x = Math.PI / 2; band.position.z = -.65;
  for (let i = 0; i < 4; i++) {
    const f = mesh(foil([[.12, 0, .45], [.42, 0, 1.04], [.4, 0, 1.43], [.12, 0, 1.35]], .025, [0, 1, -2, 2]), m.white, p);
    f.rotation.z = i * Math.PI / 2;
  }
  const nozzle = mesh(new THREE.CylinderGeometry(.09, .09, .08, 12), m.dark, p);
  nozzle.rotation.x = Math.PI / 2; nozzle.position.z = 1.47;
  group.add(p);
}

function engravedPanels(surface, paths, parent) {
  // Project subtle incisions onto the actual curved surface. These sparse
  // servicing-panel edges remain legible when subpixel texture seams mip away.
  surface.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), downward = new THREE.Vector3(0, -1, 0), vertices = [];
  const sample = (x, z) => {
    ray.set(new THREE.Vector3(x, 10, z), downward);
    const hit = ray.intersectObject(surface, true)[0];
    if (!hit) return null;
    return hit.point.addScaledVector(hit.face.normal, .007);
  };
  for (const path of paths) for (let j = 0; j < path.length - 1; j++) {
    const start = path[j], end = path[j + 1], count = Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / .16);
    let previous = sample(start[0], start[1]);
    for (let i = 1; i <= count; i++) {
      const t = i / count, point = sample(THREE.MathUtils.lerp(start[0], end[0], t), THREE.MathUtils.lerp(start[1], end[1], t));
      if (previous && point) vertices.push(...previous.toArray(), ...point.toArray()); previous = point;
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const edges = new THREE.LineSegments(geometry, seamMaterial);
  edges.name = 'Incised access-panel seams'; parent.add(edges);
}

function batchEngravings(group) {
  group.updateMatrixWorld(true);
  const originals = [], geometries = [];
  group.traverse(object => {
    if (!object.isLineSegments || object.name !== 'Incised access-panel seams') return;
    geometries.push(object.geometry.clone().applyMatrix4(object.matrixWorld)); originals.push(object);
  });
  if (!geometries.length) return;
  const geometry = mergeGeometries(geometries);
  for (const original of originals) { original.removeFromParent(); original.geometry.dispose(); }
  geometries.forEach(g => g.dispose());
  const lines = new THREE.LineSegments(geometry, seamMaterial); lines.name = 'Incised access-panel seams'; group.add(lines);
}

function batchStaticAirframe(group, moving) {
  // Bake static fittings into material batches. The detail budget is geometric,
  // not 150 individual draw calls per fighter in a multi-aircraft battle.
  group.updateMatrixWorld(true);
  const batches = new Map(), originals = [];
  group.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== group; p = p.parent) if (moving.has(p)) return;
    if (o.material.transparent) return;
    const key = `${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;
    if (!batches.has(key)) batches.set(key, { material: o.material, castShadow: o.castShadow, receiveShadow: o.receiveShadow, geometries: [] });
    batches.get(key).geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); originals.push(o);
  });
  for (const o of originals) { o.parent.remove(o); o.geometry.dispose(); }
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries);
    batch.geometries.forEach(g => g.dispose());
    const o = mesh(geometry, batch.material, group); o.name = 'Batched airframe detail';
    o.castShadow = batch.castShadow; o.receiveShadow = batch.receiveShadow;
  }
}

function setAircraftRuntime(group, runtime) {
  // THREE.Object3D.clone JSON-copies userData. Runtime mesh references must not
  // serialize the entire control-surface geometry and all canvas textures.
  Object.defineProperty(group.userData, 'aircraft', { value: runtime, writable: true, configurable: true, enumerable: false });
}

function softenPlumeMaterial(material) {
  material.forceSinglePass = true;
  material.userData.flightSoftPlume = true;
  material.onBeforeCompile = shader => {
    const varyings = '\nvarying vec2 vFlightPlumeUv;\nvarying vec3 vFlightPlumeNormal;\nvarying vec3 vFlightPlumeView;\n';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>' + varyings)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vFlightPlumeUv = uv;
        vFlightPlumeNormal = normalize(normalMatrix * normal);
        vFlightPlumeView = -mvPosition.xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>' + varyings)
      .replace('#include <opaque_fragment>', `
        float plumeTail = 1.0 - smoothstep(0.08, 0.91, vFlightPlumeUv.y);
        float plumeFacing = abs(dot(normalize(vFlightPlumeNormal), normalize(vFlightPlumeView)));
        float plumeEdge = smoothstep(0.015, 0.30, plumeFacing);
        diffuseColor.a *= plumeTail * plumeTail * plumeEdge;
        #include <opaque_fragment>`);
  };
  // Material.clone does not copy shader callbacks. The lazy clone path below
  // always reapplies this helper, retaining its separate animated opacity.
  material.customProgramCacheKey = () => 'kestrel-soft-plume-v1';
  material.needsUpdate = true;
  return material;
}

function buildLandingGear(m, parent) {
  const controls = [];
  const wheel = (group, x, y, z, radius, width) => {
    const tire = mesh(new THREE.TorusGeometry(radius * .77, radius * .23, 10, 28), m.rubber, group);
    tire.rotation.y = Math.PI / 2; tire.position.set(x, y, z);
    const hub = mesh(new THREE.CylinderGeometry(radius * .48, radius * .48, width, 20), m.metal, group);
    hub.rotation.z = Math.PI / 2; hub.position.set(x, y, z);
    const axle = mesh(new THREE.CylinderGeometry(radius * .13, radius * .13, width + .025, 12), m.rim, group);
    axle.rotation.z = Math.PI / 2; axle.position.set(x, y, z);
  };
  const strut = (group, top, bottom, radius, material) => tube([top, bottom], radius, material, group, 2);
  for (const side of [-1, 0, 1]) {
    const nose = side === 0, leg = new THREE.Group(); leg.name = nose ? 'Nose landing gear' : 'Main landing gear';
    if (nose) {
      strut(leg, [0, 0, 0], [0, -.70, .04], .073, m.metal);
      strut(leg, [0, -.63, .04], [0, -1.28, .10], .043, m.rim);
      strut(leg, [0, -1.23, .1], [0, -1.43, .12], .065, m.metal);
      strut(leg, [0, -.10, .43], [0, -1.05, .09], .032, m.metal);
      tube([[.09, -.62, .06], [.15, -.91, .10], [.07, -1.15, .10]], .025, m.rim, leg, 2);
      wheel(leg, -.155, -1.43, .12, .28, .105); wheel(leg, .155, -1.43, .12, .28, .105);
    } else {
      strut(leg, [0, 0, 0], [side * .08, -.44, .06], .086, m.metal);
      strut(leg, [side * .08, -.36, .06], [side * .10, -.82, .12], .048, m.rim);
      strut(leg, [side * .10, -.80, .12], [side * .10, -.91, .14], .076, m.metal);
      strut(leg, [side * -.30, .12, .46], [side * .08, -.75, .12], .041, m.metal);
      tube([[side * .12, -.30, .07], [side * .22, -.58, .10], [side * .10, -.79, .12]], .029, m.rim, leg, 2);
      wheel(leg, side * .17, -.91, .14, .37, .235);
    }
    batchStaticAirframe(leg, new Set());
    leg.position.set(nose ? 0 : side * 1.46, nose ? -.44 : -.90, nose ? -4.95 : 2.1);
    const tag = { kind: 'strut', axis: nose ? 'x' : 'z', foldSign: nose ? -1 : -side };
    leg.userData.flightGear = tag; leg.visible = false; parent.add(leg); controls.push({ mesh: leg, ...tag });
  }
  for (const side of [-1, 1]) {
    for (const nose of [true, false]) {
      const door = new THREE.Group(); door.name = nose ? 'Nose gear door' : 'Main gear door';
      const width = nose ? .23 : .64, length = nose ? 1.38 : 1.32;
      const skin = m.skin.clone(); skin.side = THREE.DoubleSide;
      mesh(foil([[0, 0, -length / 2], [-side * width, 0, -length / 2 + .10], [-side * width, 0, length / 2], [0, 0, length / 2]], .035), skin, door);
      door.position.set(nose ? side * .23 : side * 1.77, nose ? -.635 : -1.02, nose ? -4.73 : 2.12);
      const tag = { kind: 'door', axis: 'z', foldSign: side };
      door.userData.flightGear = tag; door.visible = false; parent.add(door); controls.push({ mesh: door, ...tag });
    }
  }
  return controls;
}

export function createAircraft({ enemy = false } = {}) {
  const g = new THREE.Group(); g.name = enemy ? 'Orion interceptor' : 'AR-29 Kestrel';
  const m = materials(enemy), controls = [], cores = [], plumes = [];
  const body = layeredLoft([
    [-9.65, .018, .018, -.09], [-9.25, .17, .16, -.05], [-8.5, .39, .30, 0],
    [-7.45, .64, .48, .04], [-6.1, .81, .59, .02], [-4.75, .93, .65, 0],
    [-3.2, 1.05, .68, 0, .90], [-1.6, 1.24, .63, -.03, .77],
    [0, 1.46, .58, -.03, .72], [1.8, 1.36, .51, -.02, .70],
    [2.8, 1.13, .435, -.015, .72], [3.8, .82, .37, -.01, .74],
    [5, .54, .30, -.01, .77], [6.3, .34, .245, -.01, .82],
    [7.55, .20, .125, -.01, .88], [8.45, .055, .035, -.01, .93],
  ], 56, .93, [m.skin, m.structure], (a, z) => z > -2.3 && z < 5.7 && Math.cos(a) > .8 && Math.abs(Math.sin(a)) < .35 ? 1 : 0, g);
  body.name = 'Smooth blended center fuselage';
  const accessPanels = [
    [[.48, -.68], [.83, -.46], [.86, .28], [.47, .28], [.48, -.68]],
    [[.42, 1.04], [.90, 1.14], [.87, 2.13], [.41, 2.21], [.42, 1.04]],
    [[-.36, 2.94], [-.75, 3.02], [-.61, 3.85], [-.34, 3.85], [-.36, 2.94]],
    [[.19, 4.78], [.47, 4.78], [.34, 5.49], [.19, 5.49], [.19, 4.78]],
    [[-.51, .09], [-.86, .09], [-.9, .78], [-.47, .85], [-.51, .09]],
  ];
  engravedPanels(body, accessPanels, g);
  mesh(loft([[-9.67, .019, .019, -.09], [-9.25, .175, .165, -.05], [-8.5, .396, .305], [-7.46, .647, .486, .04]], 48), m.nose, g);
  tube([[0, -.085, -9.6], [0, -.10, -10.35]], .019, m.metal, g, 2);

  // Canopy consists of a smooth dark glass bubble seated in a painted sill.
  mesh(loft([[-7.05, .045, .025, .43], [-6.65, .43, .25, .65], [-5.9, .68, .45, .83], [-4.95, .78, .54, .86], [-4, .72, .46, .84], [-3.2, .53, .31, .76], [-2.7, .09, .045, .61]], 40), m.canopy, g);
  for (const side of [-1, 1]) {
    tube([[side * .05, .47, -7.05], [side * .49, .60, -6.5], [side * .73, .66, -5.55], [side * .77, .64, -4.65], [side * .62, .64, -3.5], [side * .09, .63, -2.7]], .052, m.nose, g);
    tube([[side * .02, .74, -6.95], [side * .46, .97, -6.05], [side * .72, 1.22, -5.35]], .023, m.metal, g, 16);
  }
  tube([[-.76, .68, -4.55], [-.60, 1.18, -4.55], [0, 1.40, -4.55], [.60, 1.18, -4.55], [.76, .68, -4.55]], .035, m.nose, g);

  for (const side of [-1, 1]) {
    // Blended inlet shoulder and full nacelle. Interior is inset and capped, so
    // neither the air intake nor the exhaust reads as a dark flat sticker.
    const x = side * 1.46;
    const nacelle = layeredLoft([
      [-2.85, .72, .57, -.20, .84], [-2.2, .82, .64, -.25, .80],
      [-.8, .90, .77, -.28, .72], [1.2, .92, .80, -.28, .70],
      [2.6, .90, .79, -.28, .71], [3.8, .84, .76, -.28, .74],
      [5.1, .785, .69, -.28, .80], [5.98, .738, .628, -.29, .87],
    ], 44, .87, [m.skin, m.shoulder], (a, z) => z > -1.8 && z < 5.9 && Math.cos(a) > .26 ? 1 : 0, g);
    nacelle.position.x = x;
    engravedPanels(nacelle, [
      [[x - .34, 1.15], [x + .32, 1.24], [x + .35, 2.8], [x - .32, 2.96], [x - .34, 1.15]],
      [[x - .26, 3.32], [x + .30, 3.32], [x + .30, 5.20], [x - .26, 5.14]],
    ], g);
    const inlet = new THREE.Group(); inlet.position.set(x, -.18, -2.88);
    const inletSkin = mesh(loft([[-.025, .705, .555], [.08, .682, .532], [.55, .60, .48]], 40, .84), m.metal, inlet);
    inletSkin.material = m.metal.clone(); inletSkin.material.side = THREE.DoubleSide;
    const inletDark = mesh(loft([[.08, .666, .515], [.3, .57, .45], [.82, .44, .35]], 40, .88), m.dark, inlet);
    inletDark.material = m.dark.clone(); inletDark.material.side = THREE.DoubleSide;
    const fan = mesh(new THREE.CircleGeometry(.47, 32), m.rubber, inlet); fan.scale.y = .78; fan.position.z = .76; fan.rotation.y = Math.PI;
    const center = mesh(new THREE.ConeGeometry(.16, .33, 18), m.metal, inlet); center.rotation.x = -Math.PI / 2; center.position.z = .69;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU;
      tube([[Math.cos(a) * .2, Math.sin(a) * .16, .64], [Math.cos(a + .18) * .43, Math.sin(a + .18) * .34, .71]], .018, m.metal, inlet, 2);
    }
    g.add(inlet);
    // Inlet compression ramps follow the inlet lip rather than a box geometry.
    mesh(foil([[x - side * .65, .20, -3.45], [x + side * .71, .17, -3.20], [x + side * .8, .17, -1.65], [x - side * .66, .26, -1.62]], .055), m.skin, g).material.side = THREE.DoubleSide;

    // Paint stops at the engine service joint. A separate unpainted collar
    // exposes the heat-metal transition instead of hiding the nozzle root.
    const collar = mesh(loft([[5.94, .767, .652, -.29], [6.13, .753, .644, -.29], [6.48, .716, .619, -.29], [6.83, .691, .601, -.29]], 48), m.hotMetal, g); collar.position.x = x;
    for (const [z, radius] of [[5.98, .762], [6.17, .746], [6.71, .695]]) ring(radius, .018, m.metal, g, x, -.29, z).scale.y = .855;
    const nozzle = mesh(loft([[6.71, .687, .599, -.29], [7.1, .684, .595, -.29], [7.55, .613, .535, -.29], [7.94, .558, .489, -.29]], 48), m.nozzle, g); nozzle.position.x = x;
    const inner = mesh(loft([[6.38, .23, .20, -.29], [6.9, .36, .31, -.29], [7.4, .46, .395, -.29], [7.94, .515, .445, -.29]], 48), m.rubber, g); inner.position.x = x; inner.material = m.rubber.clone(); inner.material.side = THREE.DoubleSide;
    for (const [z, radius] of [[6.85, .699], [7.08, .688], [7.93, .555]]) {
      const o = ring(radius, .028, m.rim, g, x, -.29, z); o.scale.y = .86;
    }
    for (const [z, radius] of [[6.94, .354], [7.27, .416], [7.61, .475], [7.79, .493]]) ring(radius, .018, m.hotMetal, g, x, -.29, z).scale.y = .858;
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU;
      mesh(nozzlePetal(a, x), i % 3 === 0 ? m.hotMetal : m.nozzle, g);
      const c = Math.sin(a), s = Math.cos(a);
      tube([[x + c * .763, -.29 + s * .652, 6.04], [x + c * .733, -.29 + s * .633, 6.35], [x + c * .709, -.29 + s * .615, 6.65]], .019, m.metal, g, 3);
    }
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xaf501e, transparent: true, opacity: .38 });
    const core = mesh(new THREE.CircleGeometry(.205, 32), coreMat, g); core.position.set(x, -.29, 6.47); cores.push(core);
    ring(.185, .014, new THREE.MeshBasicMaterial({ color: 0x984015 }), g, x, -.29, 6.49).scale.y = .88;
    const flameMat = softenPlumeMaterial(new THREE.MeshBasicMaterial({ color: 0x93b9ff, transparent: true, opacity: .012, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const flame = mesh(loft([[0, .34, .30], [.53, .29, .26], [1.48, .15, .13], [2.38, .001, .001]], 28), flameMat, g); flame.position.set(x, -.29, 7.92); flame.castShadow = flame.receiveShadow = false; plumes.push(flame);

    const wingMat = m.wing.clone(); wingMat.side = THREE.DoubleSide;
    const wing = mesh(sweptWing(side), wingMat, g);
    engravedPanels(wing, [
      [[2.5, 0], [3.8, .2], [4.1, 2.8], [2.4, 3.3], [2.5, 0]],
      [[4.4, .9], [5.6, 1.5], [5.8, 3.5], [4.6, 3.7], [4.4, .9]],
      [[6.3, 2.4], [7.9, 3.25], [7.7, 3.76], [6.3, 3.7], [6.3, 2.4]],
    ].map(path => path.map(([x, z]) => [side * x, z])), g);
    tube([[side * 1.25, .18, -2.28], [side * 3.52, .15, -.97], [side * 6.15, .06, 1.09], [side * 8.8, -.025, 3.03]], .023, m.metal, g, 18);
    const elevon = new THREE.Group(); elevon.position.set(side * 5.5, .06, 3.88);
    mesh(foil([[side * -1.40, .016, -.13], [side * 2.38, -.082, -.04], [side * 2.28, -.082, .25], [side * -1.44, .016, .46]], .045, [0, 9, -2, 5.5], [side * 5.5, 3.88]), m.control, elevon); g.add(elevon);
    controls.push({ mesh: elevon, side, kind: 'roll' });
    // A swept horizontal stabilizer with a proper pivot and metal leading edge.
    const tail = new THREE.Group(); tail.position.set(side * 1.55, -.01, 5.5);
    mesh(foil([[0, 0, -.82], [side * 3.89, -.10, .63], [side * 4.14, -.12, 1.55], [side * 3.77, -.10, 2.12], [0, 0, 2.5]], .13, [0, 5.8, 4, 8.3], [side * 1.55, 5.5]), m.control, tail); g.add(tail);
    controls.push({ mesh: tail, side, kind: 'pitch' });
    controls.push({ mesh: fin(side, m, g, enemy), side, kind: 'rudder' });
    // The fin stands in a faired structural shoe, with a restrained service
    // joint. This joins the canted surface to the nacelle instead of a plate
    // appearing glued directly to a smooth tube.
    const root = mesh(loft([[3.48, .035, .025, .45], [3.98, .285, .16, .41], [4.68, .35, .235, .36], [5.55, .33, .23, .34], [6.64, .22, .18, .315], [7.78, .11, .155, .315], [7.90, .07, .15, .325], [8.03, .015, .03, .25]], 24, .75), m.structure, g);
    root.position.x = side * 1.64;
    engravedPanels(root, [
      [[side * 1.48, 3.98], [side * 1.42, 4.7], [side * 1.43, 5.55], [side * 1.52, 6.6], [side * 1.59, 7.65]],
      [[side * 1.49, 5.36], [side * 1.80, 5.36]],
    ], g);
    // Under-wing rails are narrow and angled; main aircraft carries 4 missiles.
    for (const wx of enemy ? [4.5] : [3.8, 6.5]) {
      const xx = side * wx;
      const rail = mesh(foil([[xx - .09, -.13, .9], [xx + .09, -.13, .9], [xx + .07, -.48, 2.55], [xx - .07, -.48, 2.55]], .075), m.nose, g); rail.material.side = THREE.DoubleSide;
      missile(xx, 1.45, m, g);
    }
    const navMat = new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff3927 : 0x63dbb2 });
    const nav = mesh(new THREE.SphereGeometry(.045, 8, 6), navMat, g); nav.position.set(side * 8.72, -.025, 3.43); nav.castShadow = false;
    // Small shoulder vents recessed into the top skin.
    for (let i = 0; i < 5; i++) {
      const vent = mesh(new THREE.PlaneGeometry(.40, .025), m.dark, g);
      vent.rotation.x = -Math.PI / 2; vent.position.set(side * 1.15, .585, .35 + i * .12);
    }
  }
  // Spine antennas and a blended dorsal fairing add detail to the chase view.
  const spine = mesh(loft([[-2.55, .12, .06, .66], [-1.6, .40, .085, .665], [0, .43, .12, .53], [2.2, .34, .095, .455], [4.15, .22, .085, .365], [5.45, .035, .035, .27]], 32, .59), m.structure, g);
  engravedPanels(spine, [
    [[-.17, -2.25], [-.32, -1.40], [-.34, .1], [-.26, 2.2], [-.15, 4.15]],
    [[.17, -2.25], [.32, -1.40], [.34, .1], [.26, 2.2], [.15, 4.15]],
    [[-.15, 4.05], [.15, 4.05]],
  ], g);
  engravedPanels(body, [[[-.66, 4.29], [.66, 4.29]]], g);
  const blade = mesh(foil([[0, 0, -.25], [.38, 0, .10], [.32, 0, .57], [0, 0, .66]], .03), m.nose, g); blade.rotation.z = Math.PI / 2; blade.position.set(0, .7, 1.38); blade.material.side = THREE.DoubleSide;
  tube([[0, .62, 2.6], [0, .80, 3.05]], .018, m.metal, g, 2);
  const gearControls = buildLandingGear(m, g);
  batchEngravings(g);
  batchStaticAirframe(g, new Set([...controls.map(c => c.mesh), ...gearControls.map(c => c.mesh), ...cores, ...plumes]));
  controls.forEach(c => { c.mesh.userData.flightControl = { side: c.side, kind: c.kind }; });
  cores.forEach((o, i) => { o.userData.flightEngineCore = i; });
  plumes.forEach((o, i) => { o.userData.flightEnginePlume = i; });
  setAircraftRuntime(g, { controls, cores, plumes, gearControls, gearAmount: 0, enemy });
  return g;
}

export function updateAircraft(group, dt, { time = 0, throttle = .7, bank = 0, pitch = 0, gear = 0 } = {}) {
  let a = group.userData.aircraft;
  if (!a) {
    // Cloned enemy meshes retain inexpensive tags; resolve their own controls
    // lazily and give their exhausts independent material state.
    a = { controls: [], cores: [], plumes: [], gearControls: [], gearAmount: 0 };
    group.traverse(o => {
      if (o.userData.flightControl) a.controls.push({ mesh: o, ...o.userData.flightControl });
      if (o.userData.flightGear) a.gearControls.push({ mesh: o, ...o.userData.flightGear });
      if (o.userData.flightEngineCore !== undefined) { o.material = o.material.clone(); a.cores[o.userData.flightEngineCore] = o; }
      if (o.userData.flightEnginePlume !== undefined) { o.material = softenPlumeMaterial(o.material.clone()); a.plumes[o.userData.flightEnginePlume] = o; }
    });
    setAircraftRuntime(group, a);
  }
  const t = THREE.MathUtils.clamp(throttle, 0, 1);
  a.gearAmount = THREE.MathUtils.damp(a.gearAmount || 0, THREE.MathUtils.clamp(gear, 0, 1), 6, dt);
  for (const c of a.gearControls) {
    c.mesh.visible = a.gearAmount > .025;
    c.mesh.rotation[c.axis] = c.foldSign * (c.kind === 'door' ? a.gearAmount * 1.08 : (1 - a.gearAmount) * Math.PI / 2);
  }
  for (const c of a.controls) {
    const target = c.kind === 'roll' ? -c.side * bank * .18 : c.kind === 'pitch' ? -pitch * .34 : -bank * .07;
    c.mesh.rotation.x = THREE.MathUtils.damp(c.mesh.rotation.x, target, 10, dt);
  }
  for (let i = 0; i < a.cores.length; i++) {
    a.cores[i].material.opacity = .24 + t * .28 + Math.sin(time * 27 + i * 4) * .018;
    a.cores[i].material.color.setRGB(.58 + t * .30, .13 + .10 * t, .025 + .03 * t);
    const highOutput = THREE.MathUtils.smoothstep(t, .82, 1);
    a.plumes[i].material.opacity = .006 + t * .008 + highOutput * .112;
    a.plumes[i].scale.z = .80 + t * .20 + Math.sin(time * 23 + i) * .015;
  }
}
