import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const DECK_TOP = 20;

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function canvas(width, height) {
  if (typeof document === 'undefined') return null;
  const result = document.createElement('canvas');
  result.width = width; result.height = height;
  return result;
}

function texture(source, color = true) {
  if (!source) return null;
  const result = new THREE.CanvasTexture(source);
  result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  result.anisotropy = 8;
  return result;
}

function randomGenerator(seed) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}

function loft(rings, segments = 48) {
  const positions = [], uvs = [], indices = [];
  const first = rings[0][0], last = rings[rings.length - 1][0];
  for (const [z, width, height, center = 0] of rings) {
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * TAU;
      positions.push(Math.sin(angle) * width, center + Math.cos(angle) * height, z);
      uvs.push(i / segments, (z - first) / (last - first));
    }
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// Rounded airfoil section: the silhouette stays thin while reflected light
// reveals a continuous upper surface and a bevelled trailing edge.
function foil(points, thickness = .12, bounds = [0, 25, -8, 26]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    area += points[i][0] * next[2] - next[0] * points[i][2];
  }
  if (area > 0) points = [...points].reverse();
  const positions = [], uvs = [], indices = [], count = points.length;
  let cx = 0, cy = 0, cz = 0;
  for (const p of points) { cx += p[0] / count; cy += p[1] / count; cz += p[2] / count; }
  const add = (x, y, z) => {
    positions.push(x, y, z);
    uvs.push((Math.abs(x) - bounds[0]) / (bounds[1] - bounds[0]), (z - bounds[2]) / (bounds[3] - bounds[2]));
  };
  for (let side = 0; side < 2; side++) {
    const sign = side ? -1 : 1;
    add(cx, cy + sign * thickness * .65, cz);
    for (const [x, y, z] of points) add(cx + (x - cx) * .66, y + sign * thickness * .44, cz + (z - cz) * .66);
    for (const [x, y, z] of points) add(x, y + sign * thickness * .08, z);
    const base = side * (2 * count + 1);
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const a = base + 1 + i, b = base + 1 + next;
      const c = base + count + 1 + i, d = base + count + 1 + next;
      if (!side) indices.push(base, a, b, a, c, d, a, d, b);
      else indices.push(base, b, a, a, d, c, a, b, d);
    }
  }
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count, a = count + 1 + i, b = count + 1 + next;
    const c = 3 * count + 2 + i, d = 3 * count + 2 + next;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function line(parent, points, radius, material, segments = 16) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const object = mesh(new THREE.TubeGeometry(curve, segments, radius, 6, false), material);
  parent.add(object); return object;
}

function rod(parent, a, b, radius, material, sides = 6) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
  const object = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), sides), material);
  object.position.copy(start.add(end).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(object); return object;
}

// A planar polygon has authored X/Z UVs and a separate upper material. Keeping
// this deck as one named mesh preserves the simulation/QA contact contract.
function prism(points, low, high, bounds = [-48, 48, -180, 180], grouped = false) {
  const positions = [], uvs = [], indices = [];
  const add = (x, y, z) => {
    positions.push(x, y, z);
    uvs.push((x - bounds[0]) / (bounds[1] - bounds[0]), (z - bounds[2]) / (bounds[3] - bounds[2]));
  };
  for (const p of points) add(p[0], high, p[1]);
  const triangles = THREE.ShapeUtils.triangulateShape(points.map(p => new THREE.Vector2(...p)), []);
  for (let [a, b, c] of triangles) {
    const pa = points[a], pb = points[b], pc = points[c];
    const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
    if (area > 0) [b, c] = [c, b];
    indices.push(a, b, c);
  }
  const topCount = indices.length, count = points.length;
  for (const p of points) add(p[0], low, p[1]);
  for (let i = 0; i < topCount; i += 3) indices.push(indices[i] + count, indices[i + 2] + count, indices[i + 1] + count);
  let area = 0;
  for (let i = 0; i < count; i++) {
    const a = points[i], b = points[(i + 1) % count]; area += a[0] * b[1] - b[0] * a[1];
  }
  for (let i = 0; i < count; i++) {
    const a = points[i], b = points[(i + 1) % count], base = positions.length / 3;
    add(a[0], low, a[1]); add(b[0], low, b[1]); add(b[0], high, b[1]); add(a[0], high, a[1]);
    if (area > 0) indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  if (grouped) { geometry.addGroup(0, topCount, 0); geometry.addGroup(topCount, indices.length - topCount, 1); }
  return geometry;
}

function batchStatic(group) {
  group.updateMatrixWorld(true);
  const bins = new Map(), originals = [];
  group.traverse(object => {
    if (!object.isMesh || Array.isArray(object.material) || object.material.transparent) return;
    const key = object.material.uuid + ':' + object.castShadow + ':' + object.receiveShadow;
    if (!bins.has(key)) bins.set(key, { material: object.material, cast: object.castShadow, receive: object.receiveShadow, geometries: [] });
    bins.get(key).geometries.push(object.geometry.clone().applyMatrix4(object.matrixWorld));
    originals.push(object);
  });
  for (const object of originals) { object.removeFromParent(); object.geometry.dispose(); }
  for (const bin of bins.values()) {
    const geometry = mergeGeometries(bin.geometries);
    for (const source of bin.geometries) source.dispose();
    const object = mesh(geometry, bin.material); object.name = 'Batched support fittings';
    object.castShadow = bin.cast; object.receiveShadow = bin.receive; group.add(object);
  }
}

function tankerMaps() {
  const color = canvas(1024, 2048), rough = canvas(1024, 2048), bump = canvas(1024, 2048);
  if (!color) return {};
  const ctx = color.getContext('2d'), r = rough.getContext('2d'), b = bump.getContext('2d');
  ctx.fillStyle = '#778a94'; ctx.fillRect(0, 0, 1024, 2048);
  r.fillStyle = '#aaacad'; r.fillRect(0, 0, 1024, 2048);
  b.fillStyle = '#808080'; b.fillRect(0, 0, 1024, 2048);
  const random = randomGenerator(4104);
  for (let i = 0; i < 24000; i++) {
    const x = random() * 1024, y = random() * 2048, gray = random() > .5 ? '225,234,237' : '24,44,54';
    ctx.fillStyle = 'rgba(' + gray + ',' + (.01 + random() * .025) + ')'; ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 4);
    r.fillStyle = 'rgba(0,0,0,' + random() * .025 + ')'; r.fillRect(x, y, 2, 4);
  }
  // Transport fuselage joins, irregularly spaced and substantially quieter
  // than the servicing marks. No rectangular weathering/checkerboard atlas.
  for (const y of [94, 186, 370, 672, 954, 1272, 1517, 1768, 1922]) {
    ctx.strokeStyle = 'rgba(30,46,53,.22)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
    b.fillStyle = '#727272'; b.fillRect(0, y, 1024, 1);
    for (let x = 8; x < 1024; x += 16) { ctx.fillStyle = 'rgba(34,48,53,.19)'; ctx.fillRect(x, y + 4, 1, 1); }
  }
  for (let i = 0; i < 13; i++) {
    const x = 120 + random() * 770, y = 460 + random() * 1170, w = 20 + random() * 28, h = 22 + random() * 54;
    ctx.fillStyle = 'rgba(179,192,196,.025)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(30,47,53,.2)'; ctx.strokeRect(x, y, w, h);
    r.fillStyle = '#969fa2'; r.fillRect(x, y, w, h);
  }
  return { map: texture(color), roughnessMap: texture(rough, false), bumpMap: texture(bump, false), bumpScale: .012 };
}

function tankerMark() {
  const source = canvas(1024, 256); if (!source) return null;
  const ctx = source.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256); ctx.fillStyle = 'rgba(39,64,77,.74)';
  ctx.font = '600 71px Arial'; ctx.textAlign = 'left'; ctx.fillText('M-41  MERIDIAN', 84, 127);
  ctx.font = '27px Arial'; ctx.fillText('REFUEL OPERATIONS   041', 87, 182);
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(39,64,77,.74)';
  ctx.beginPath(); ctx.moveTo(15, 130); ctx.lineTo(43, 78); ctx.lineTo(72, 130); ctx.stroke();
  return texture(source);
}

function cockpitPane(points, material, parent) {
  const position = [], uv = [], index = [0, 2, 1, 0, 3, 2];
  for (let i = 0; i < points.length; i++) { position.push(...points[i]); uv.push(i === 0 || i === 3 ? 0 : 1, i < 2 ? 0 : 1); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index); geometry.computeVertexNormals();
  const pane = mesh(geometry, material); parent.add(pane);
}

function createTanker() {
  const group = new THREE.Group(); group.name = 'M-41 Meridian tanker';
  const paint = new THREE.MeshStandardMaterial({ color: 0xa3acb1, roughness: .68, metalness: .28, ...tankerMaps() });
  const wingPaint = new THREE.MeshStandardMaterial({ color: 0x82939b, roughness: .63, metalness: .34 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x71828a, roughness: .36, metalness: .78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x172229, roughness: .62, metalness: .35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x10262e, roughness: .14, metalness: .36, clearcoat: 1, clearcoatRoughness: .12, side: THREE.DoubleSide });
  const rings = [[-24.6, .03, .06, -.3], [-23.8, .55, .5, -.15], [-22.8, 1.25, 1.15], [-21.2, 1.95, 1.72], [-19.2, 2.31, 2.08], [-16.4, 2.45, 2.28], [-10, 2.45, 2.35], [-2, 2.45, 2.35], [6, 2.4, 2.25], [13, 2.15, 2], [18, 1.55, 1.6, .3], [22, .72, .89, .6], [24.2, .035, .08, .65]];
  group.add(mesh(loft(rings, 64), paint));
  const surface = (z, angle) => {
    let a = rings[0], b = rings[1];
    for (let i = 1; i < rings.length; i++) if (z <= rings[i][0]) { a = rings[i - 1]; b = rings[i]; break; }
    const f = (z - a[0]) / (b[0] - a[0]);
    const width = THREE.MathUtils.lerp(a[1], b[1], f) + .016, height = THREE.MathUtils.lerp(a[2], b[2], f) + .016;
    return [Math.sin(angle) * width, (THREE.MathUtils.lerp(a[3] || 0, b[3] || 0, f)) + Math.cos(angle) * height, z];
  };
  for (const side of [-1, 1]) for (const [z0, z1, low, high] of [[-21.55, -20.08, .16, .65], [-20.0, -18.9, .27, .85], [-18.82, -17.68, .55, 1.02]]) {
    const p = [surface(z0, side * low), surface(z1, side * low), surface(z1, side * high), surface(z0, side * high)];
    cockpitPane(p, glass, group);
    line(group, [...p, p[0]], .026, metal, 16);
  }
  for (const side of [-1, 1]) {
    const wing = [[2, -.7, -5.6], [8.4, -.23, -1.45], [18.5, .53, 5.25], [25, 1.08, 8.65], [24.65, 1.1, 10.52], [15.5, .38, 9.26], [2.1, -.68, 7.3]].map(p => [p[0] * side, p[1], p[2]]);
    group.add(mesh(foil(wing, .48), wingPaint));
    line(group, wing.slice(0, 4).map(p => [p[0], p[1] + .026, p[2] + .045]), .034, metal, 28);
    const tail = [[.8, 1.04, 16.4], [9.2, 1.67, 22.3], [9.0, 1.69, 24.1], [.65, 1.04, 22.1]].map(p => [p[0] * side, p[1], p[2]]);
    group.add(mesh(foil(tail, .21), wingPaint));
    line(group, [[side * 3.9, -.52, 6.1], [side * 15.4, .52, 8.8], [side * 23.3, 1.14, 9.73]], .015, dark, 24);
    for (const x of [8, 17]) {
      const leading = -5.6 + (x - 2) / 23 * 14.25, engineZ = leading + 1.5, engineY = -.7 + (x - 2) * .075 - 1.5;
      const engine = new THREE.Group(); engine.position.set(side * x, engineY, engineZ); group.add(engine);
      engine.add(mesh(loft([[-3.55, .86, .86], [-3.3, .95, .95], [-2.5, 1.02, 1.02], [-.4, .99, .99], [1.75, .86, .86], [3.05, .65, .65], [3.4, .62, .62]], 40), wingPaint));
      engine.add(mesh(new THREE.TorusGeometry(.846, .092, 8, 40), metal, 0, 0, -3.55));
      const inner = mesh(loft([[-3.56, .751, .751], [-3.25, .727, .727], [-2.54, .66, .66]], 40), dark);
      inner.material = dark.clone(); inner.material.side = THREE.DoubleSide; engine.add(inner);
      const fan = mesh(new THREE.CircleGeometry(.66, 40), dark, 0, 0, -2.54); fan.rotation.y = Math.PI; engine.add(fan);
      for (let i = 0; i < 12; i++) {
        const angle = i / 12 * TAU;
        const blade = mesh(new THREE.BoxGeometry(.065, .42, .035), metal, Math.sin(angle) * .405, Math.cos(angle) * .405, -2.56);
        blade.rotation.z = -angle + .38; engine.add(blade);
      }
      const hub = mesh(new THREE.ConeGeometry(.18, .38, 20), metal, 0, 0, -2.76); hub.rotation.x = -Math.PI / 2; engine.add(hub);
      engine.add(mesh(new THREE.TorusGeometry(.58, .051, 6, 36), metal, 0, 0, 3.41));
      const exhaust = mesh(loft([[2.52, .45, .45], [3.41, .53, .53]], 32), dark);
      exhaust.material = dark.clone(); exhaust.material.side = THREE.DoubleSide; engine.add(exhaust);
      engine.add(mesh(new THREE.CircleGeometry(.45, 32), dark, 0, 0, 2.51));
      const pylon = mesh(foil([[0, 0, -2.0], [.94, 0, -.8], [.94, 0, 1.75], [0, 0, 2.3]], .17, [0, 2, -3, 3]), wingPaint);
      pylon.rotation.z = Math.PI / 2; pylon.position.set(side * x, engineY + .75, engineZ); group.add(pylon);
    }
  }
  const fin = mesh(foil([[0, 0, -2], [5.7, 0, 1.1], [6.6, 0, 4.1], [6.3, 0, 5.4], [0, 0, 6]], .16, [0, 7, -3, 7]), wingPaint);
  fin.rotation.z = Math.PI / 2; fin.position.set(0, 1.6, 17); group.add(fin);
  line(group, [[0, 2.9, 22.5], [0, 7.6, 21.8]], .017, dark, 12);
  const boomCover = mesh(loft([[12, .13, .15], [14.3, .63, .42], [17.8, .48, .34], [20.3, .12, .12]], 24), wingPaint, 0, -1.61, 0); group.add(boomCover);
  // The unchanged formation offset places the tanker 13m above / 40m ahead
  // of the fighter. This endpoint reaches its dorsal refuelling receptacle.
  line(group, [[0, -1.8, 16], [0, -4.9, 22.5], [0, -7.6, 29], [0, -10.55, 36.2]], .175, metal, 36);
  rod(group, [0, -10.55, 36.2], [0, -11.65, 38.1], .108, metal, 12);
  rod(group, [0, -11.65, 38.1], [0, -11.9, 38.6], .19, dark, 12);
  for (const side of [-1, 1]) group.add(mesh(foil([[0, -7.765, 29.4], [side * 1.8, -8.34, 31.4], [side * 1.75, -8.70, 32.25], [0, -8.542, 31.3]], .085, [0, 2, 28, 33]), wingPaint));
  const mark = tankerMark();
  if (mark) for (const side of [-1, 1]) {
    const decal = mesh(new THREE.PlaneGeometry(9.6, 2.4), new THREE.MeshStandardMaterial({ map: mark, transparent: true, depthWrite: false, roughness: .78, metalness: .2, polygonOffset: true, polygonOffsetFactor: -1 }), side * 2.45, .1, -9.4);
    decal.rotation.y = side * Math.PI / 2; decal.castShadow = false; group.add(decal);
  }
  batchStatic(group);
  return group;
}

function surfaceTexture(carrier = false) {
  const source = canvas(1024, 4096), rough = canvas(1024, 4096), bump = canvas(1024, 4096);
  if (!source) return {};
  const ctx = source.getContext('2d'), r = rough.getContext('2d'), b = bump.getContext('2d');
  ctx.fillStyle = carrier ? '#3b4447' : '#454c4e'; ctx.fillRect(0, 0, 1024, 4096);
  r.fillStyle = '#d8d8d8'; r.fillRect(0, 0, 1024, 4096);
  b.fillStyle = '#808080'; b.fillRect(0, 0, 1024, 4096);
  const random = randomGenerator(carrier ? 90419 : 2883);
  for (let i = 0; i < 42000; i++) {
    const x = random() * 1024, y = random() * 4096;
    ctx.fillStyle = 'rgba(' + (random() > .5 ? '174,182,181' : '5,14,19') + ',' + random() * .075 + ')';
    ctx.fillRect(x, y, 1 + random() * 1.5, 1 + random() * 2);
    b.fillStyle = random() > .5 ? '#858585' : '#7a7a7a'; b.fillRect(x, y, 1, 1);
  }
  // Irregular albedo-only oil marks. A hard region in the roughness map makes
  // low-angle specular light expose circular disks even at very low opacity.
  for (let i = 0; i < 145; i++) {
    const x = random() * 1024, y = random() * 4096, radius = 7 + random() * 39;
    ctx.save(); ctx.translate(x, y); ctx.rotate(random() * TAU);
    ctx.scale(.4 + random() * 1.2, .3 + random() * .8); ctx.filter = 'blur(9px)';
    ctx.fillStyle = 'rgba(5,17,22,' + (.025 + random() * .065) + ')';
    ctx.beginPath();
    for (let j = 0; j < 14; j++) {
      const angle = j / 14 * TAU, distance = radius * (.48 + random() * .52);
      const dx = Math.cos(angle) * distance, dy = Math.sin(angle) * distance;
      if (!j) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  const px = x => carrier ? (x + 48) / 96 * 1024 : (x + 39) / 78 * 1024;
  const py = z => carrier ? (180 - z) / 360 * 4096 : (1250 - z) / 2500 * 4096;
  const path = (points, color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width / (carrier ? 96 : 78) * 1024;
    ctx.beginPath(); points.forEach((p, i) => { if (i) ctx.lineTo(px(p[0]), py(p[1])); else ctx.moveTo(px(p[0]), py(p[1])); }); ctx.stroke();
  };
  const white = 'rgba(211,211,195,.86)', yellow = 'rgba(196,175,113,.79)';
  if (carrier) {
    const center = z => -.15 * (z + 70);
    for (const side of [-1, 1]) path([[center(-150) + side * 11.7, -150], [center(152) + side * 11.7, 152]], white, .27);
    for (let z = -139; z < 150; z += 17) path([[center(z), z], [center(z + 7), z + 7]], white, .28);
    path([[24, -149], [25.4, 153]], yellow, .24);
    path([[15, -142], [20, -126], [20, -69], [16, -51]], yellow, .19);
    for (const z of [7, 26, 45, 64]) path([[center(z) - 17, z - 2.5], [center(z) + 17, z + 2.5]], 'rgba(12,21,25,.86)', .095);
    for (const track of [-7, 8]) {
      path([[track - .38, -150], [track - .38, -38]], 'rgba(12,22,26,.84)', .16);
      path([[track + .38, -150], [track + .38, -38]], 'rgba(12,22,26,.84)', .16);
      path([[track - 3.5, -31], [track + 3.5, -31]], yellow, .18);
    }
    for (let x = -10; x <= 10; x += 2.5) path([[center(143) + x, 143], [center(151) + x, 151]], white, 1.1);
    path([[center(-22) - 11.5, -22], [center(-22) + 11.5, -22]], yellow, .4);
    // Tie-down points are small deck hardware, never a surface-color grid.
    ctx.strokeStyle = 'rgba(141,153,150,.27)'; ctx.lineWidth = 1.0;
    for (let z = -158, row = 0; z < 160; z += 5, row++) for (let x = -40 + (row % 2) * 2.5; x < 39; x += 5) {
      ctx.beginPath(); ctx.arc(px(x), py(z), 1.4, 0, TAU); ctx.stroke();
    }
    for (let i = 0; i < 80; i++) {
      const z = -35 + random() * 167, x = center(z) + (random() > .5 ? 2.7 : -2.7) + (random() - .5) * .9;
      path([[x, z], [x - .15 * (2 + random() * 12), z + 2 + random() * 12]], 'rgba(7,17,20,' + (.04 + random() * .09) + ')', .06 + random() * .13);
    }
    ctx.save(); ctx.translate(px(13), py(-113)); ctx.rotate(Math.PI);
    ctx.fillStyle = white; ctx.font = '600 102px Arial'; ctx.textAlign = 'center'; ctx.fillText('09', 0, 0); ctx.restore();
  } else {
    for (const side of [-1, 1]) path([[side * 29, -1110], [side * 29, 1110]], white, .24);
    for (let z = -1100; z < 1110; z += 165) path([[0, z], [0, z + 70]], white, .8);
    for (const z of [-1140, 1110]) for (let x = -24; x <= 24; x += 6) path([[x, z], [x, z + 65]], white, 3.1);
    ctx.fillStyle = white; ctx.font = '600 96px Arial'; ctx.textAlign = 'center'; ctx.fillText('28', 512, 620);
  }
  return { map: texture(source), roughnessMap: texture(rough, false), bumpMap: texture(bump, false), bumpScale: carrier ? .018 : .014 };
}

function carrierHull() {
  const stations = [[-173, .16, 5], [-164, 10, -1], [-143, 23, -5.5], [-116, 30, -7.5], [-60, 31.6, -8], [0, 31.7, -8], [90, 30.8, -7.6], [143, 28, -5.5], [161, 22.7, -2.2], [166, 19, -.3]];
  const section = [-1, -.97, -.88, -.68, -.4, 0, .4, .68, .88, .97, 1];
  const positions = [], uvs = [], colors = [], indices = [];
  const waterPaint = new THREE.Color(0x718287), upperPaint = new THREE.Color(0xb0b7b5);
  for (const [z, width, bottom] of stations) for (const u of section) {
    const y = bottom + (17.5 - bottom) * Math.pow(Math.abs(u), 2.6);
    positions.push(width * u, y, z); uvs.push((u + 1) / 2, (z + 173) / 339);
    const color = waterPaint.clone().lerp(upperPaint, THREE.MathUtils.smoothstep(y, -1.5, 12)); colors.push(color.r, color.g, color.b);
  }
  const count = section.length;
  for (let j = 0; j < stations.length - 1; j++) for (let i = 0; i < count - 1; i++) {
    const a = j * count + i, b = a + count;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  // A flat, physically closed stern/transom retains crisp waterline shading.
  for (const stationIndex of [0, stations.length - 1]) {
    const [z, width] = stations[stationIndex], base = positions.length / 3;
    positions.push(0, 17.5, z); uvs.push(.5, .5); colors.push(upperPaint.r, upperPaint.g, upperPaint.b);
    for (let i = 0; i < count; i++) {
      const index = stationIndex * count + i;
      positions.push(...positions.slice(index * 3, index * 3 + 3)); uvs.push(i / (count - 1), 0);
      colors.push(...colors.slice(index * 3, index * 3 + 3));
    }
    for (let i = 0; i < count - 1; i++) {
      if (!stationIndex) indices.push(base, base + i + 2, base + i + 1);
      else indices.push(base, base + i + 1, base + i + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function wallWindows(parent, a, b, y, height, glass, metal) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), count = Math.floor(length / 1.5);
  const angle = -Math.atan2(dz, dx);
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count;
    const pane = mesh(new THREE.BoxGeometry(length / count - .17, height, .1), glass, a[0] + dx * t, y, a[1] + dz * t);
    pane.rotation.y = angle; parent.add(pane);
  }
  const sill = mesh(new THREE.BoxGeometry(length + .12, .12, .19), metal, (a[0] + b[0]) / 2, y - height / 2 - .09, (a[1] + b[1]) / 2);
  sill.rotation.y = angle; parent.add(sill);
}

function createCarrier() {
  const group = new THREE.Group(); group.name = 'CV-09 Resolute';
  const steel = new THREE.MeshStandardMaterial({ color: 0x62747c, roughness: .69, metalness: .34 });
  const lightSteel = new THREE.MeshStandardMaterial({ color: 0x7c8d94, roughness: .66, metalness: .31 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4c626c, roughness: .5, metalness: .66 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x182d37, roughness: .76, metalness: .3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x162f3b, roughness: .2, metalness: .45, clearcoat: .78, clearcoatRoughness: .12 });
  const deckPanel = new THREE.MeshStandardMaterial({ color: 0x283336, roughness: .91, metalness: .1 });
  const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x70858d, roughness: .71, metalness: .28, vertexColors: true, side: THREE.DoubleSide });
  group.add(mesh(carrierHull(), hullMaterial));
  const outline = [[0, -174], [24, -160], [31, -132], [32, -70], [40, -25], [42, 45], [38, 150], [27, 169], [-26, 169], [-42, 150], [-45, 45], [-38, -15], [-36, -75], [-26, -155]];
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0xb4bcbc, roughness: .9, metalness: .09, ...surfaceTexture(true) });
  const deck = mesh(prism(outline, 0, 2.5, [-48, 48, -180, 180], true), [deckMaterial, steel], 0, DECK_TOP - 2.5, 0);
  deck.name = 'Carrier flight deck'; group.add(deck);
  const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xbca56b, emissive: 0x776030, emissiveIntensity: .6, roughness: .38, metalness: .2 });
  // Thin continuous walkways follow the ship's actual perimeter. Rails are
  // nautical handrails with 4.6m post spacing rather than floating wall slabs.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), nx = dz / length, nz = -dx / length;
    const offset = .57, angle = Math.atan2(dx, dz), x = (a[0] + b[0]) / 2 + nx * offset, z = (a[1] + b[1]) / 2 + nz * offset;
    const walk = mesh(new THREE.BoxGeometry(1.16, .2, length + .09), metal, x, 18.65, z); walk.rotation.y = angle; group.add(walk);
    const start = [a[0] + nx * 1.13, 19.79, a[1] + nz * 1.13], end = [b[0] + nx * 1.13, 19.79, b[1] + nz * 1.13];
    rod(group, start, end, .036, lightSteel);
    rod(group, [start[0], 19.23, start[2]], [end[0], 19.23, end[2]], .025, lightSteel);
    const count = Math.ceil(length / 4.6);
    for (let j = 0; j <= count; j++) {
      const t = j / count, px = a[0] + dx * t + nx * 1.13, pz = a[1] + dz * t + nz * 1.13;
      rod(group, [px, 18.72, pz], [px, 19.83, pz], .039, lightSteel);
      if (j % 3 === 0) {
        const bulb = mesh(new THREE.SphereGeometry(.11, 8, 6), bulbMaterial, px - nx * .38, 19.92, pz - nz * .38); bulb.castShadow = false; group.add(bulb);
        rod(group, [px - nx * 1.12, 15.7, pz - nz * 1.12], [px, 18.55, pz], .095, metal);
      }
    }
  }
  // Faceted, offset island plate work and overhanging bridge roofs create a
  // readable naval silhouette without toy-like stacks of perfect boxes.
  group.add(mesh(prism([[23, -52], [34, -50], [35, -17], [26, -13], [23, -19]], 20, 28.7), steel));
  group.add(mesh(prism([[24.9, -46], [34.1, -44], [34.2, -21], [26.1, -19]], 28.7, 33.1), lightSteel));
  const bridge = [[23.3, -49], [34.8, -47], [35.3, -34], [24.1, -33]];
  group.add(mesh(prism(bridge, 33, 36.9), steel));
  group.add(mesh(prism([[22.95, -49.4], [35.15, -47.35], [35.65, -33.67], [23.8, -32.64]], 36.9, 37.18), lightSteel));
  wallWindows(group, [23.24, -49.05], [34.83, -47.06], 35.0, 1.18, glass, metal);
  wallWindows(group, [34.86, -46.9], [35.37, -34.1], 35.0, 1.18, glass, metal);
  wallWindows(group, [23.21, -48.7], [24.01, -33.2], 35.0, 1.18, glass, metal);
  wallWindows(group, [24.07, -32.94], [35.24, -33.95], 35.0, 1.35, glass, metal);
  group.add(mesh(prism([[26, -39], [32.8, -38], [33, -24], [27, -22]], 37.1, 42), steel));
  wallWindows(group, [25.96, -38.6], [26.91, -22.4], 40.15, 1.1, glass, metal);
  wallWindows(group, [27.06, -21.94], [32.98, -23.94], 40.15, 1.12, glass, metal);
  for (let i = 0; i < 9; i++) group.add(mesh(new THREE.BoxGeometry(.075, .095, 5.4), dark, 22.99, 25.2 + i * .22, -31));
  group.add(mesh(new THREE.BoxGeometry(.12, 2.1, 1.05), dark, 23.01, 23.74, -22));
  for (let i = 0; i < 14; i++) group.add(mesh(new THREE.BoxGeometry(1.4, .19, .29), metal, 21.65, 20.095 + i * .19, -17.7 - i * .29));
  for (const side of [-1, 1]) {
    const x = 21.65 + side * .62;
    rod(group, [x, 21.08, -17.65], [x, 23.54, -21.61], .04, lightSteel);
    for (const j of [0, 6, 13]) rod(group, [x, 20.15 + j * .19, -17.7 - j * .29], [x, 21.08 + j * .19, -17.7 - j * .29], .035, lightSteel);
  }
  const mastLegs = [[26.7, -29.8], [30.9, -29.8], [28.8, -34.3]];
  for (const p of mastLegs) rod(group, [p[0], 42, p[1]], [28.8 + (p[0] - 28.8) * .28, 59.8, -31.5 + (p[1] + 31.5) * .28], .105, metal);
  for (let level = 42.6; level < 58; level += 2.4) for (let i = 0; i < 3; i++) {
    const a = mastLegs[i], b = mastLegs[(i + 1) % 3], f = (level - 42) / 18;
    const ax = THREE.MathUtils.lerp(a[0], 28.8, f * .72), az = THREE.MathUtils.lerp(a[1], -31.5, f * .72);
    const bx = THREE.MathUtils.lerp(b[0], 28.8, (f + .13) * .72), bz = THREE.MathUtils.lerp(b[1], -31.5, (f + .13) * .72);
    rod(group, [ax, level, az], [bx, level + 2.3, bz], .055, metal);
  }
  group.add(mesh(new THREE.BoxGeometry(6.2, 2.5, .32), dark, 28.8, 56.1, -31.5));
  group.add(mesh(new THREE.BoxGeometry(6.5, .11, .53), metal, 28.8, 57.42, -31.5));
  rod(group, [28.8, 59.6, -31.5], [28.8, 65.5, -31.5], .046, metal, 8);
  const dishPoints = [new THREE.Vector2(0, 0), new THREE.Vector2(.45, .09), new THREE.Vector2(.9, .31), new THREE.Vector2(1.18, .58)];
  const dish = mesh(new THREE.LatheGeometry(dishPoints, 28), lightSteel, 30.8, 45.8, -25.4); dish.rotation.x = .9; group.add(dish);
  rod(group, [30.8, 42, -25.4], [30.8, 45.8, -25.4], .11, metal);
  for (let i = 0; i < 4; i++) rod(group, [26.5 + i * 1.5, 37.2, -42], [26.5 + i * 1.5, 41.2 + (i % 2), -42], .036, metal);
  // Rails and wires sit flush to the collision plane. They never force a
  // second landing height or protrude through the aircraft's wheels.
  for (const track of [-7, 8]) {
    for (const side of [-1, 1]) group.add(mesh(new THREE.BoxGeometry(.085, .014, 112), metal, track + side * .34, DECK_TOP + .013, -94));
    const deflector = mesh(new THREE.BoxGeometry(8.5, .02, 4.2), deckPanel, track, DECK_TOP + .008, -31.8);
    deflector.castShadow = false; group.add(deflector);
    rod(group, [track - 4.1, DECK_TOP + .023, -29.85], [track + 4.1, DECK_TOP + .023, -29.85], .013, dark);
  }
  for (const z of [7, 26, 45, 64]) {
    const center = -.15 * (z + 70);
    line(group, [[center - 16.8, DECK_TOP + .04, z - 2.45], [center, DECK_TOP + .04, z], [center + 16.8, DECK_TOP + .04, z + 2.45]], .031, dark, 18);
  }
  batchStatic(group); return group;
}

function barrelRoof(width, height, length) {
  const positions = [], uvs = [], indices = [], segments = 72;
  for (const z of [-length / 2, length / 2]) for (let i = 0; i <= segments; i++) {
    const angle = -Math.PI / 2 + i / segments * Math.PI;
    // Shallow standing seams keep the corrugation at architectural scale.
    const ridge = .055 * Math.cos(i / segments * Math.PI * 72);
    positions.push(Math.sin(angle) * (width / 2 + ridge), Math.cos(angle) * (height + ridge), z);
    uvs.push(i / segments, (z + length / 2) / length);
  }
  for (let i = 0; i < segments; i++) {
    const a = i, b = a + segments + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function createHangar(parent, x, z, materials) {
  const { wall, roof, door, frame, glass } = materials;
  const outline = [[-30, 0], [30, 0], [30, 8]];
  for (let i = 1; i <= 36; i++) {
    const angle = Math.PI / 2 - i / 36 * Math.PI;
    outline.push([Math.sin(angle) * 30, 8 + Math.cos(angle) * 20]);
  }
  for (const end of [-1, 1]) {
    const facade = mesh(prism(outline, 0, .35, [-30, 30, 0, 28]), wall, x, 80, z + end * 45);
    facade.rotation.x = -Math.PI / 2; parent.add(facade);
  }
  const roofMesh = mesh(barrelRoof(60, 20, 90), roof, x, 88, z); parent.add(roofMesh);
  for (const side of [-1, 1]) parent.add(mesh(new THREE.BoxGeometry(.35, 8, 90), wall, x + side * 30, 84, z));
  // A pair of rolling doors, inset personnel door and lintel establish scale.
  const front = z + 45.16;
  for (const side of [-1, 1]) parent.add(mesh(new THREE.BoxGeometry(22.45, 13.35, .16), door, x + side * 11.33, 86.78, front));
  for (let i = 1; i < 38; i++) {
    const seam = mesh(new THREE.BoxGeometry(45.3, .041, .075), frame, x, 80.27 + i * .35, front + .09);
    seam.castShadow = false; parent.add(seam);
  }
  for (const side of [-1, 1]) parent.add(mesh(new THREE.BoxGeometry(.26, 13.8, .28), frame, x + side * 22.76, 86.9, front));
  parent.add(mesh(new THREE.BoxGeometry(45.8, .28, .38), frame, x, 93.66, front));
  parent.add(mesh(new THREE.BoxGeometry(1.1, 2.1, .12), door, x + 26.7, 81.07, front));
  parent.add(mesh(new THREE.BoxGeometry(.78, .43, .135), glass, x + 26.7, 81.7, front + .03));
  for (let i = 0; i < 6; i++) parent.add(mesh(new THREE.BoxGeometry(2.2, .085, .17), door, x, 99.2 + i * .23, front));
  // Roof ribs are curved metal work, rather than a repeated row of cubes.
  for (const offset of [-39, -21, 0, 21, 39]) {
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + i / 20 * Math.PI;
      points.push([x + Math.sin(a) * 30.09, 88 + Math.cos(a) * 20.09, z + offset]);
    }
    line(parent, points, .072, frame, 32);
  }
}

function serviceWheels(parent, width, axles, radius, material, floor = 0) {
  for (const side of [-1, 1]) for (const z of axles) {
    const wheel = mesh(new THREE.CylinderGeometry(radius, radius, .27, 16), material, side * width, floor + radius, z);
    wheel.rotation.z = Math.PI / 2; parent.add(wheel);
  }
}

function createServiceVehicle(parent, x, z, fuel, materials) {
  const { frame, door, glass, tire, vest } = materials;
  const group = new THREE.Group(); group.position.set(x, 80, z); parent.add(group);
  const width = fuel ? 1.32 : 1.05, halfLength = fuel ? 4.4 : 2.25;
  const body = [[-width + .15, -halfLength], [width - .15, -halfLength], [width, -halfLength + .25], [width, halfLength - .35], [width - .25, halfLength], [-width + .25, halfLength], [-width, halfLength - .35], [-width, -halfLength + .25]];
  group.add(mesh(prism(body, fuel ? .74 : .53, fuel ? 1.17 : 1.03), frame));
  serviceWheels(group, width - .04, fuel ? [-2.7, -.8, 3.0] : [-1.5, 1.4], fuel ? .49 : .38, tire);
  if (fuel) {
    // A rounded reservoir and curved end caps distinguish the fuel bowser.
    group.add(mesh(loft([[-3.88, .06, .06], [-3.65, .91, .85], [-3.2, 1.16, 1.08], [.7, 1.16, 1.08], [1.15, .91, .85], [1.38, .06, .06]], 32), door, 0, 2.2, 0));
    group.add(mesh(prism([[-1.18, 2.0], [1.18, 2.0], [1.18, 3.96], [.95, 4.25], [-.95, 4.25], [-1.18, 3.96]], 1.16, 3.02), frame));
    group.add(mesh(new THREE.BoxGeometry(1.85, .83, .045), glass, 0, 2.45, 4.26));
    group.add(mesh(new THREE.BoxGeometry(.12, .95, 1.43), glass, -1.19, 2.39, 3.01));
    group.add(mesh(new THREE.BoxGeometry(.12, .95, 1.43), glass, 1.19, 2.39, 3.01));
    for (const side of [-1, 1]) rod(group, [side * .74, 2.98, -.1], [side * .74, 3.03, .25], .043, frame);
    line(group, [[-1.08, 1.24, -3.4], [-1.41, .84, -3.6], [-1.87, .16, -3.2], [-2.3, .1, -1.8], [-1.93, .11, -.2]], .05, tire, 22);
  } else {
    group.add(mesh(new THREE.BoxGeometry(.8, .22, .66), tire, 0, 1.1, .27));
    const back = mesh(new THREE.BoxGeometry(.82, .6, .14), tire, 0, 1.38, -.05); back.rotation.x = -.1; group.add(back);
    rod(group, [0, 1.06, 1.0], [0, 1.52, .67], .045, door);
    const steering = mesh(new THREE.TorusGeometry(.24, .024, 6, 20), tire, 0, 1.5, .67); steering.rotation.x = -.6; group.add(steering);
    for (const side of [-1, 1]) for (const end of [-1, 1]) rod(group, [side * .85, 1.02, .3 + end * .95], [side * .85, 2.17, .3 + end * .95], .038, frame);
    group.add(mesh(prism([[-.97, -.83], [.97, -.83], [1.02, 1.33], [-1.02, 1.33]], 2.17, 2.24), door));
    rod(group, [0, .69, -2.2], [0, .37, -4.3], .085, frame);
    group.add(mesh(new THREE.TorusGeometry(.13, .045, 6, 16), frame, 0, .37, -4.3));
  }
  for (const side of [-1, 1]) group.add(mesh(new THREE.SphereGeometry(.12, 8, 6), vest, side * width * .67, .95, halfLength + .015));
  return group;
}

function serviceCrew(parent, x, z, angle, materials) {
  const { uniform, vest, skin, tire } = materials;
  const group = new THREE.Group(); group.position.set(x, 80, z); group.rotation.y = angle; parent.add(group);
  group.add(mesh(new THREE.CapsuleGeometry(.19, .43, 4, 10), vest, 0, 1.02, 0));
  group.add(mesh(new THREE.SphereGeometry(.132, 10, 8), skin, 0, 1.53, 0));
  group.add(mesh(new THREE.SphereGeometry(.16, 10, 8, 0, TAU, 0, Math.PI / 2), vest, 0, 1.57, 0));
  for (const side of [-1, 1]) {
    rod(group, [side * .12, .83, 0], [side * .13, .49, .01], .10, uniform);
    rod(group, [side * .13, .49, .01], [side * .15, .15, -.01], .085, uniform);
    group.add(mesh(new THREE.BoxGeometry(.17, .14, .29), tire, side * .15, .08, .045));
    rod(group, [side * .23, 1.25, 0], [side * .3, .98, .03], .083, uniform);
    rod(group, [side * .3, .98, .03], [side * .26, .75, .05], .069, uniform);
    group.add(mesh(new THREE.SphereGeometry(.076, 8, 6), tire, side * .26, .74, .05));
  }
  return group;
}

export function createSupport(scene) {
  const tanker = createTanker(); scene.add(tanker); tanker.visible = false;
  const carrier = createCarrier(); scene.add(carrier); carrier.visible = false;
  const runway = new THREE.Group(); runway.name = 'Service airfield';
  const ground = mesh(new THREE.BoxGeometry(1500, 85.9, 4500), new THREE.MeshStandardMaterial({ color: 0x334339, roughness: 1 }), 0, 37, -1400); runway.add(ground);
  const strip = mesh(new THREE.BoxGeometry(78, 2, 2500), new THREE.MeshStandardMaterial({ color: 0xb8bcbc, roughness: .9, ...surfaceTexture(false) }), 0, 79, -750);
  runway.add(strip); strip.name = 'Airfield runway';
  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: 0x66767c, roughness: .84, metalness: .2 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x647a84, roughness: .64, metalness: .43 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x546972, roughness: .64, metalness: .43 }),
    door: new THREE.MeshStandardMaterial({ color: 0x3d535f, roughness: .76, metalness: .28 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x162b34, roughness: .19, metalness: .38, clearcoat: .8 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x141d23, roughness: .94, metalness: .03 }),
    uniform: new THREE.MeshStandardMaterial({ color: 0x2c4355, roughness: .91 }),
    vest: new THREE.MeshStandardMaterial({ color: 0xb7a065, roughness: .88, metalness: .04 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x947967, roughness: .93 })
  };
  const apron = mesh(new THREE.BoxGeometry(210, .04, 3200), new THREE.MeshStandardMaterial({ color: 0x49585b, roughness: .94, metalness: .06 }), 155, 79.99, -1450); runway.add(apron);
  for (let i = 0; i < 7; i++) createHangar(runway, 165, -150 - i * 230, materials);
  createServiceVehicle(runway, -29, -22, true, materials);
  createServiceVehicle(runway, 25, -16, false, materials);
  for (const [x, z, angle] of [[-15, -8, .65], [-18, -16, -.5], [14, -11, -.6], [19, -19, .3]]) serviceCrew(runway, x, z, angle, materials);
  // Keep the named runway contact mesh separate; batch all authored fittings.
  const fittings = new THREE.Group(); runway.add(fittings);
  for (const object of [...runway.children]) if (object !== strip && object !== ground && object !== apron && object !== fittings) fittings.add(object);
  batchStatic(fittings);
  scene.add(runway); runway.visible = false;
  return { update(game) {
    const state = game.state;
    tanker.visible = Boolean(game.tanker) && state.status !== 'attract';
    if (tanker.visible) { tanker.position.set(game.tanker.x, game.tanker.y - 35, game.tanker.z + 170); tanker.rotation.z = game.tanker.bank || 0; }
    carrier.visible = state.stageKind === 'return'; runway.visible = state.stageKind === 'landing';
    if (carrier.visible) carrier.position.z = -900 + Math.min(1, state.landingProgress / .58) * 970;
  } };
}
