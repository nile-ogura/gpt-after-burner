import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Keep silhouette and recessed dark fittings while dropping maps and draw calls
// once an interceptor occupies only a few dozen pixels on the screen.
export function createEnemyLOD(detailed) {
  detailed.updateMatrixWorld(true);
  const pieces = [];
  detailed.traverse(object => {
    if (!object.isMesh) return;
    // Translucent exhaust is a close-range effect. Baking it into the opaque
    // medium mesh would turn the plume into a solid blue cone.
    if (object.material.userData.flightSoftPlume) return;
    for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return;
    const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(object.matrixWorld);
    for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
    geometry.clearGroups();
    const color = object.material.color || new THREE.Color(0x8c9b9e);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < geometry.attributes.position.count; i++) colors.set([color.r, color.g, color.b], i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); pieces.push(geometry);
  });
  const merged = mergeGeometries(pieces); pieces.forEach(geometry => geometry.dispose());
  const medium = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .2, roughness: .66 }));
  medium.name = 'Batched interceptor';

  const farPieces = [];
  farPieces.push(new THREE.CylinderGeometry(.52, 1.05, 15.8, 8, 1).rotateX(Math.PI / 2));
  farPieces.push(new THREE.ConeGeometry(.52, 2.8, 8).rotateX(-Math.PI / 2).translate(0, 0, -9.3));
  for (const side of [-1, 1]) {
    const wing = new THREE.Shape(); wing.moveTo(side * .9, -3.2); wing.lineTo(side * 8.4, 2.1); wing.lineTo(side * 8.2, 3.5); wing.lineTo(side * 1.1, 2.5); wing.closePath();
    farPieces.push(new THREE.ExtrudeGeometry(wing, { depth: .13, bevelEnabled: false }).rotateX(Math.PI / 2));
    const fin = new THREE.Shape(); fin.moveTo(-1.4, 0); fin.lineTo(1.8, 0); fin.lineTo(1.4, 3.4); fin.lineTo(.35, 3.2); fin.closePath();
    farPieces.push(new THREE.ExtrudeGeometry(fin, { depth: .10, bevelEnabled: false }).rotateY(Math.PI / 2).rotateZ(-side * .22).translate(side * 1.7, .5, 4.7));
    farPieces.push(new THREE.BoxGeometry(3.8, .10, 2.5).rotateY(side * -.28).translate(side * 2.8, -.22, 6.2));
  }
  const normalized = farPieces.map(geometry => geometry.index ? geometry.toNonIndexed() : geometry);
  const lowGeometry = mergeGeometries(normalized); new Set([...farPieces, ...normalized]).forEach(geometry => geometry.dispose());
  const far = new THREE.Mesh(lowGeometry, new THREE.MeshLambertMaterial({ color: 0x83949d })); far.name = 'Distant interceptor';
  const lod = new THREE.LOD(); lod.name = 'Orion interceptor LOD';
  lod.addLevel(detailed, 0); lod.addLevel(medium, 240, .12); lod.addLevel(far, 850, .10);
  return lod;
}
