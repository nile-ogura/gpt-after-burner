import { chromium } from '/home/ogura/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
async function compare(){
  const reference='https://enso-order.acecombat.jp/assets/img/gameplay/concept/img_3-2.webp';
  const local='http://localhost:5173/artifacts/comparison-local.png';
  const sources=crypto.randomInt(2)?[reference,local]:[local,reference];
  const panels=sources.map((src,i)=>`<section><div>${i?'B':'A'}</div><img src="${src}"></section>`).join('');
  const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0b1015;color:white;font:18px sans-serif;display:flex;gap:16px;padding:16px}section{width:776px}section>div{height:32px}img{width:776px;height:436.5px;object-fit:contain;display:block}.crop{height:336.5px;overflow:hidden}.crop img{margin-top:-50px}</style></head><body>${panels}</body></html>`;
  await fs.writeFile('artifacts/quality-comparison.html',html);
  const comparison=await browser.newPage({viewport:{width:1600,height:502},deviceScaleFactor:1,ignoreHTTPSErrors:true});
  comparison.on('requestfailed',request=>console.log(JSON.stringify({comparisonRequestFailed:request.url(),reason:request.failure()?.errorText})));
  await comparison.goto('http://localhost:5173/artifacts/quality-comparison.html',{waitUntil:'domcontentloaded'});
  await comparison.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0),null,{timeout:30000,polling:100});
  await comparison.screenshot({path:'artifacts/comparison-latest.png'});
  await fs.writeFile('artifacts/comparison-latest-key.json',JSON.stringify({A:sources[0]===reference?'official':'local',B:sources[1]===reference?'official':'local',method:'live official 3840x2160 image and actual local1280x720 browser capture, each displayed776x436.5, randomized labels; same50px crop top/bottom for masked variant',reference,capturedAt:new Date().toISOString()},null,2));
  await comparison.evaluate(()=>{for(const img of document.images){const box=document.createElement('div');box.className='crop';img.before(box);box.append(img);}});
  await comparison.setViewportSize({width:1600,height:402});
  await comparison.screenshot({path:'artifacts/comparison-masked.png'});
  console.log(JSON.stringify({comparison:'PASS',method:'live official image; equal display dimensions; equal top/bottom crop masked variant'}));
  await comparison.close();
}
await fs.mkdir('artifacts',{recursive:true});
if(process.argv.includes('--compare-only')){await compare();await browser.close();process.exit(0);}
const touchMode=process.argv.includes('--touch');
let page=await browser.newPage({viewport:touchMode?{width:390,height:844}:{width:1440,height:900},hasTouch:touchMode,isMobile:touchMode,deviceScaleFactor:1,ignoreHTTPSErrors:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
async function setProfile(profile){await page.evaluate(profile=>{const f=window.__flight,ratio=profile==='high'?1:.65;f.settings.quality=profile;f.renderer.setPixelRatio(ratio);f.composer.setPixelRatio(ratio);f.renderer.shadowMap.enabled=profile==='high';for(const pass of f.composer.passes){if(pass.strength!==undefined)pass.enabled=profile==='high';if(pass.uniforms?.resolution)pass.uniforms.resolution.value.set(1/(innerWidth*ratio),1/(innerHeight*ratio));}},profile);}
async function settleFrames(count=5){await page.evaluate(count=>new Promise(resolve=>{const next=()=>--count?requestAnimationFrame(next):resolve();requestAnimationFrame(next);}),count);}
async function readyAssets(){await page.waitForFunction(()=>{const f=window.__flight;return f.scene.environment?.userData.cloudEnvironmentBaked&&f.scene.children.filter(m=>m.name.startsWith('Coast terrain')).every(m=>m.material.map.userData.ready)&&f.scene.children.filter(m=>m.name.startsWith('Cloud bank ')).every(m=>m.material.map.userData.ready);},null,{timeout:60000,polling:100});}
async function holdCurrentCamera(){await page.evaluate(()=>{const f=window.__flight;f.heldCamera={position:f.camera.position.toArray(),quaternion:f.camera.quaternion.toArray(),fov:f.camera.fov};});}
async function frameEvidence(name){return page.evaluate(name=>{const f=window.__flight;return{name,...f.captureState(),camera:{position:f.camera.position.toArray(),quaternion:f.camera.quaternion.toArray(),fov:f.camera.fov},viewport:[innerWidth,innerHeight],terrain:f.scene.children.filter(m=>m.userData.terrain).map(m=>({name:m.name,position:m.position.toArray(),...m.userData.terrain,map:m.material.map.userData,shaderKey:m.material.customProgramCacheKey()})),cloudReflection:f.scene.environment.userData,effectTime:f.effects.time};},name);}
async function writeEvidence(name,frames){const files=(await fs.readdir('src')).filter(file=>file.endsWith('.js'));const hashes={};for(const file of [...files.map(file=>`src/${file}`),'tools/capture.mjs'])hashes[file]=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');await fs.writeFile(`artifacts/${name}.json`,JSON.stringify({capturedAt:new Date().toISOString(),sourceHashes:hashes,frames,errors,condition:'paused simulation and frozen presentation; settled rendered frames; SwiftShader static diagnostics, not motion FPS'},null,2));}
async function captureTerrain(){
  await readyAssets();
  await page.waitForFunction(()=>window.__flight.scene.children.filter(m=>m.name.startsWith('Coast terrain')).every(m=>m.material.map.userData.ready),null,{timeout:30000,polling:100});
  await page.evaluate(()=>{window.__flight.freezePresentation=true;});
  const metadata=await page.evaluate(()=>window.__flight.scene.children.filter(m=>m.name.startsWith('Coast terrain')).map(m=>{const high=m.terrainHighGeometry,low=m.terrainLowGeometry;let nonFinite=0;for(const attribute of Object.values(high.attributes))for(const v of attribute.array)if(!Number.isFinite(v))nonFinite++;return{name:m.name,...m.userData.terrain,vertices:high.attributes.position.count,shared:Object.keys(high.attributes).every(name=>high.attributes[name]===low.attributes[name]),nonFinite};}));
  assert.equal(metadata.length,4);for(const m of metadata){assert.equal(m.nonFinite,0);assert.equal(m.shared,true);assert.equal(m.lowIndexCount,m.highIndexCount/4);}
  const asset=await page.evaluate(()=>{const map=window.__flight.scene.children.find(m=>m.name.startsWith('Coast terrain')).material.map,{data,width,height}=map.image;if(!data)return{width,height,...map.userData};const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),width,height),0,0);return{png:canvas.toDataURL('image/png'),width,height,...map.userData};});
  if(asset.png)await fs.writeFile('artifacts/terrain-neutral-albedo.png',Buffer.from(asset.png.split(',')[1],'base64'));
  else await fs.copyFile(asset.assetPath,'artifacts/terrain-neutral-albedo.png');
  assert.equal(asset.assetStatus,'ready','generated photo asset loaded rather than falling back');assert.equal(asset.fallback,false);assert.equal(asset.rockAlbedo.tileWidth,120);assert.equal(asset.rockAlbedo.tileDepth,120);
  const frames=[];
  await setProfile('high');await settleFrames();await holdCurrentCamera();frames.push(await frameEvidence('terrain-flight-high'));await page.screenshot({path:'artifacts/terrain-flight-high.png'});
  await setProfile('balanced');await settleFrames();frames.push(await frameEvidence('terrain-flight-balanced'));await page.screenshot({path:'artifacts/terrain-flight-balanced.png'});
  const lowMetadata=await page.evaluate(()=>window.__flight.scene.children.filter(m=>m.name.startsWith('Coast terrain')).map(m=>({lod:m.userData.terrain.lod,index:m.geometry.index.count})));assert.ok(lowMetadata.every(m=>m.lod==='low'&&m.index===30528));
  const phase=frames[0].presentationTime;await page.evaluate(time=>window.__flight.setPresentationTime(time),phase+4);await setProfile('high');await settleFrames();const secondPhase=await frameEvidence('terrain-water-phase-plus4');await page.screenshot({path:'artifacts/terrain-water-phase-plus4.png'});assert.deepEqual(secondPhase.camera,frames[0].camera);assert.equal(secondPhase.presentationTime,phase+4);await page.evaluate(time=>window.__flight.setPresentationTime(time),phase);
  await setProfile('high');await page.evaluate(()=>{const f=window.__flight,m=f.scene.children.find(m=>m.userData.terrain?.side===1&&m.userData.terrain.sourceOffset===-5800);f.heldCamera=null;f.photo={position:{x:m.position.x-1800,y:800,z:m.position.z+7300},target:{x:m.position.x+300,y:650,z:m.position.z+5500}};document.querySelector('.hud').style.display='none';document.querySelector('.chrome').style.display='none';});await settleFrames();await holdCurrentCamera();frames.push(await frameEvidence('terrain-close-high'));await page.screenshot({path:'artifacts/terrain-close-high.png'});
  await setProfile('balanced');await settleFrames();frames.push(await frameEvidence('terrain-close-balanced'));await page.screenshot({path:'artifacts/terrain-close-balanced.png'});
  for(const [a,b]of [[frames[0],frames[1]],[frames[2],frames[3]]]){assert.deepEqual(a.camera,b.camera);assert.equal(a.presentationTime,b.presentationTime);assert.deepEqual(a.player,b.player);}
  await writeEvidence('terrain-evidence',[...frames,secondPhase]);
  await setProfile('high');await page.evaluate(()=>{const f=window.__flight;f.photo=null;f.heldCamera=null;f.freezePresentation=false;document.querySelector('.hud').style.display='';document.querySelector('.chrome').style.display='';});
  console.log(JSON.stringify({terrain:metadata,lowMetadata,neutralAsset:{width:asset.width,height:asset.height},condition:'same paused seed, presentation clock fixed for high/low; balanced diagnostic DPR.65 without shadow/bloom; dedicated coast photo camera is outside the playable rail',errors}));
  assert.equal(errors.length,0);
}
async function captureDamage(){
  await readyAssets();await setProfile('high');
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.setPaused(true);f.effects.clear();f.freezePresentation=true;f.photo=null;f.heldCamera=null;const e=f.game.enemies[0];e.x=20;e.y=245;e.z=-440;e.locked=true;e.lockProgress=1;f.game.state.lockId=e.id;f.game.state.locked=true;});
  await settleFrames();await holdCurrentCamera();
  const frames=[await frameEvidence('damage-baseline')];await page.screenshot({path:'artifacts/damage-baseline.png'});
  const state=await page.evaluate(()=>{const f=window.__flight,p=f.game.player,events=[],forward=f.game.onEvent;f.game.onEvent=e=>{if(e.type==='explosion'||e.type==='damage')events.push({...e});forward(e);};try{f.game.setPaused(false);f.game.state.invulnerable=0;f.game._enemyMissile({x:p.x,y:p.y,z:p.z-12});const q=f.game.projectiles.at(-1);q.x=p.x;q.y=p.y;q.z=p.z-12;q.vx=0;q.vy=0;q.vz=120;f.game.update(1/120,{});f.game.setPaused(true);f.effects.update(0,0,f.camera);return{health:f.game.state.health,missiles:f.game.state.missiles,lives:f.game.state.lives,collision:q.dead,events};}finally{f.game.onEvent=forward;}});
  assert.ok(state.health>0&&state.health<100);assert.equal(state.missiles,50);assert.equal(state.lives,3);assert.equal(state.collision,true);assert.ok(state.events.some(e=>e.type==='explosion'&&e.source==='missile'&&e.owner==='enemy'));
  await settleFrames();frames.push(await frameEvidence('damage-impact-age0'));await page.screenshot({path:'artifacts/damage-impact.png'});
  const near=await page.evaluate(()=>{const f=window.__flight;f.effects.update(.08,f.game.player.speed,f.camera);return{fire:f.effects.pools.fire.mesh.count,smoke:f.effects.pools.smoke.mesh.count,nearFire:f.effects.pools.fire.particles.filter(p=>p.nearPlayer).length,maxFireAlpha:Math.max(...f.effects.pools.fire.alpha.array.slice(0,f.effects.pools.fire.mesh.count)),maxSmokeAlpha:Math.max(...f.effects.pools.smoke.alpha.array.slice(0,f.effects.pools.smoke.mesh.count))};});
  assert.ok(near.nearFire>0&&Number.isFinite(near.maxFireAlpha)&&Number.isFinite(near.maxSmokeAlpha));await settleFrames();frames.push(await frameEvidence('damage-camera-crossing-age.08'));await page.screenshot({path:'artifacts/damage-camera-crossing.png'});
  for(const frame of frames.slice(1)){assert.deepEqual(frame.camera,frames[0].camera);assert.equal(frame.presentationTime,frames[0].presentationTime);}
  assert.ok(Math.abs(frames[2].effectTime-frames[1].effectTime-.08)<1e-9);
  await page.evaluate(()=>{const f=window.__flight,e=f.game.enemies.find(e=>!e.dead&&e.id!==f.game.state.lockId);f.effects.clear();e.x=35;e.y=242;e.z=-180;f.game._damageEnemy(e,e.health,'missile');f.effects.update(.08,0,f.camera);});await settleFrames();frames.push(await frameEvidence('distant-destruction'));await page.screenshot({path:'artifacts/distant-destruction.png'});
  await writeEvidence('damage-evidence',frames);console.log(JSON.stringify({state,near,condition:'QA real missile collision, held camera and presentation, age0 and.08 effects snapshots; distant enemy forced killed through simulation for separate feedback check; camera shake deliberately excluded; does not prove all combat hits',errors}));assert.equal(errors.length,0);
  await page.evaluate(()=>{window.__flight.heldCamera=null;});
}
await fs.mkdir('artifacts',{recursive:true});
await page.goto(`http://localhost:5173/?qa${process.argv.includes('--bake-clouds')?'&bakeClouds':''}${process.argv.includes('--cloud-photo')||process.argv.includes('--roll')?'&cloudPhoto':''}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.__flight),null,{timeout:60000});await page.waitForTimeout(1500);
await page.evaluate(()=>{const f=window.__flight;f.settings.quality='high';f.renderer.setPixelRatio(1);f.composer.setPixelRatio(1);for(const pass of f.composer.passes){if(pass.uniforms?.resolution)pass.uniforms.resolution.value.set(1/innerWidth,1/innerHeight);}});await page.waitForTimeout(900);
if(process.argv.includes('--bake-clouds')){
  const assets=await page.evaluate(()=>{const unique=new Map();for(const object of window.__flight.scene.children){const texture=object.isSprite&&object.material.map;if(texture?.image instanceof HTMLCanvasElement&&texture.userData.seed)unique.set(texture.userData.seed,texture.image.toDataURL('image/png'));}return [...unique].map(([seed,data])=>({seed,data}));});
  assert.equal(assets.length,3);await fs.mkdir('public/assets/clouds',{recursive:true});for(const asset of assets)await fs.writeFile(`public/assets/clouds/${asset.seed}.png`,Buffer.from(asset.data.split(',')[1],'base64'));
  console.log(JSON.stringify({baked:assets.map(a=>a.seed),errors}));assert.equal(errors.length,0);await browser.close();process.exit(0);
}
if(process.argv.includes('--cloud-photo')){
  await page.waitForFunction(()=>window.__flight.scene.environment?.userData.cloudEnvironmentBaked,null,{timeout:60000,polling:100});
  await page.getByRole('button',{name:'出撃する',exact:false}).click();await page.waitForTimeout(3500);
  await page.evaluate(()=>{const f=window.__flight;f.game.setPaused(true);f.game.player.bank=0;f.game.player.pitch=0;});await page.waitForTimeout(1000);
  await page.screenshot({path:'artifacts/cloud-photo-flight.png'});
  await page.evaluate(()=>{window.__flight.game.player.bank=-.55;});await page.waitForTimeout(1000);await page.screenshot({path:'artifacts/cloud-photo-bank.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1000);await page.screenshot({path:'artifacts/cloud-photo-mobile.png'});
  const maps=await page.evaluate(()=>window.__flight.scene.children.filter(o=>o.name.startsWith('Cloud bank ')).map(o=>({map:o.material.map.image?.currentSrc,scale:o.scale.toArray(),mesh:o.isMesh})));
  assert.equal(maps.length,9);assert.equal(new Set(maps.map(m=>m.map)).size,3);
  assert.ok(maps.every(m=>m.mesh));
  assert.equal(maps.filter(m=>m.map?.includes('cumulus-photo-v2')).length,3);
  assert.ok(maps.every(m=>m.scale[1]===m.scale[0]*.5));
  const geometry=await page.evaluate(()=>{const f=window.__flight;let nonFinite=0;f.scene.traverse(o=>{const position=o.geometry?.getAttribute('position');if(position)for(const value of position.array)if(!Number.isFinite(value))nonFinite++;});return{nonFinite,reflection:f.scene.environment.userData};});assert.equal(geometry.nonFinite,0);assert.equal(geometry.reflection.cloudBanks,9);
  console.log(JSON.stringify({maps,geometry,errors,condition:'same paused combat state; straight and bank QA poses; all nine banks photo variant, three distinct maps, static cloud reflection'}));assert.equal(errors.length,0);await browser.close();process.exit(0);
}
if(process.argv.includes('--roll')){
  await page.waitForFunction(()=>window.__flight.scene.environment?.userData.cloudEnvironmentBaked,null,{timeout:60000,polling:100});
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.setPaused(true);f.effects.clear();f.game.state.invulnerable=60;});
  await page.waitForTimeout(800);await page.screenshot({path:'artifacts/aircraft-rear-v6.png'});
  await page.evaluate(()=>{const f=window.__flight,p=f.game.player;f.photo={position:{x:p.x+21,y:p.y+12,z:p.z+24},target:{x:p.x,y:p.y,z:p.z}};document.querySelector('.hud').style.display='none';document.querySelector('.chrome').style.display='none';});await page.waitForTimeout(800);await page.screenshot({path:'artifacts/aircraft-close-v6.png'});
  await page.evaluate(()=>{const f=window.__flight;f.photo=null;document.querySelector('.hud').style.display='';document.querySelector('.chrome').style.display='';f.game.setPaused(false);f.game.startRoll(-1);f.game.setPaused(true);});
  for(const [label,target] of [['90',Math.PI*.5],['180',Math.PI],['270',Math.PI*1.5]]){
    const angle=await page.evaluate(target=>{const f=window.__flight;f.game.setPaused(false);let ticks=0;while(Math.abs(f.game.player.rollAngle)<target&&ticks++<240)f.game.update(1/120,{});f.game.setPaused(true);return f.game.player.rollAngle;},target);
    assert.ok(Math.abs(angle)>=target&&Math.abs(angle)<target+.12);
    await page.waitForTimeout(800);await page.screenshot({path:`artifacts/roll-${label}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);await page.screenshot({path:'artifacts/roll-mobile.png'});
  const finished=await page.evaluate(()=>{const f=window.__flight;f.game.setPaused(false);for(let i=0;i<240;i++)f.game.update(1/120,{});f.game.setPaused(true);return{angle:f.game.player.rollAngle,rolling:f.game.state.rolling,ammo:f.game.state.missiles};});assert.equal(finished.angle,0);assert.equal(finished.rolling,false);assert.equal(finished.ammo,50);
  console.log(JSON.stringify({finished,condition:'QA triggered roll, sampled paused90/180/270 degree poses; does not prove motion FPS',errors}));assert.equal(errors.length,0);await browser.close();process.exit(0);
}
if(process.argv.includes('--visual-matrix')){
  const frames=[];await readyAssets();await setProfile('high');
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.setPaused(true);f.freezePresentation=true;f.effects.clear();});
  async function shot(name){await settleFrames();frames.push(await frameEvidence(name));await page.screenshot({path:`artifacts/${name}.png`});}
  await settleFrames();await holdCurrentCamera();await shot('aircraft-rear-high');await setProfile('balanced');await shot('aircraft-rear-balanced');
  assert.deepEqual(frames[0].camera,frames[1].camera);assert.deepEqual(frames[0].player,frames[1].player);assert.equal(frames[0].presentationTime,frames[1].presentationTime);
  await setProfile('high');await page.evaluate(()=>{const f=window.__flight,p=f.game.player;f.heldCamera=null;f.photo={position:{x:p.x+21,y:p.y+12,z:p.z+24},target:{x:p.x,y:p.y,z:p.z}};document.querySelector('.hud').style.display='none';document.querySelector('.chrome').style.display='none';});await settleFrames();await holdCurrentCamera();await shot('aircraft-detail-high');await setProfile('balanced');await shot('aircraft-detail-balanced');
  assert.deepEqual(frames[2].camera,frames[3].camera);assert.equal(frames[2].presentationTime,frames[3].presentationTime);
  await setProfile('high');await page.evaluate(()=>{const f=window.__flight;f.heldCamera=null;f.photo=null;f.game.player.bank=-.55;f.game.player.throttle=1;document.querySelector('.hud').style.display='';document.querySelector('.chrome').style.display='';});await shot('aircraft-bank-boost');
  await page.evaluate(()=>{const f=window.__flight,e=f.game.enemies[0];e.x=30;e.y=250;e.z=-80;f.photo={position:{x:e.x+21,y:e.y+12,z:e.z+24},target:{x:e.x,y:e.y,z:e.z}};document.querySelector('.hud').style.display='none';document.querySelector('.chrome').style.display='none';});await shot('aircraft-enemy-detail');
  const enemyDetail=await page.evaluate(()=>{const lod=window.__flight.scene.children.find(m=>m.name==='Orion interceptor LOD'&&Math.abs(m.position.z+80)<.01),detailed=lod?.levels[0].object;let plumes=0,soft=0;detailed?.traverse(o=>{if(o.userData.flightEnginePlume!==undefined){plumes++;if(o.material.userData.flightSoftPlume&&o.material.customProgramCacheKey()==='kestrel-soft-plume-v1')soft++;}});return{active:detailed?.visible,plumes,soft};});assert.equal(enemyDetail.active,true);assert.equal(enemyDetail.plumes,2);assert.equal(enemyDetail.soft,2);
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.setPaused(true);f.freezePresentation=true;f.effects.clear();f.photo=null;document.querySelector('.hud').style.display='';document.querySelector('.chrome').style.display='';});await captureTerrain();
  if(process.argv.includes('--damage'))await captureDamage();
  await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.setPaused(true);f.freezePresentation=true;f.effects.clear();f.heldCamera=null;});await shot('comparison-local');
  if(!process.argv.includes('--no-compare'))await compare();
  await page.close();page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1,ignoreHTTPSErrors:true});page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.goto('http://localhost:5173/?qa',{waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.__flight),null,{timeout:60000,polling:100});await readyAssets();await setProfile('high');await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.setPaused(true);f.freezePresentation=true;f.effects.clear();});await settleFrames();
  const mobile=await page.evaluate(()=>{const f=window.__flight,points=[[42,844*.41+30],[195,445],[330,485]],enemies=f.game.enemies.slice(0,3);f.camera.updateMatrixWorld(true);for(const[i,e]of enemies.entries()){const[x,y]=points[i],p=f.camera.position.clone().set(x/innerWidth*2-1,1-y/innerHeight*2,0).unproject(f.camera);p.sub(f.camera.position).normalize().multiplyScalar(440).add(f.camera.position);Object.assign(e,{x:p.x,y:p.y,z:p.z,dead:false,locked:i===1,lockProgress:i===1?1:0});}f.game.enemies=enemies;f.game.state.lockId=enemies[1].id;f.game.state.locked=true;return{ids:enemies.map(e=>e.id),points};});await settleFrames();await holdCurrentCamera();await shot('aircraft-portrait-hud');
  const markerPositions=await page.evaluate(()=>[...document.querySelectorAll('.target-marker')].map(el=>({id:Number(el.dataset.enemyId),x:parseFloat(el.style.left),y:parseFloat(el.style.top),primary:el.classList.contains('locked')})));assert.ok(!markerPositions.some(m=>m.id===mobile.ids[0]));assert.ok(markerPositions.some(m=>m.id===mobile.ids[1]&&m.primary&&Math.hypot(m.x-195,m.y-445)<1.2));assert.ok(markerPositions.some(m=>m.id===mobile.ids[2]&&Math.hypot(m.x-330,m.y-485)<1.2));
  await writeEvidence('visual-matrix-evidence',frames);console.log(JSON.stringify({checks:['held high/low camera and clock','detailed enemy two compiled soft plumes','portrait primary/safe secondary retain true projection','portrait secondary near SPEED excluded'],enemyDetail,mobile,markerPositions,errors}));assert.equal(errors.length,0);await browser.close();process.exit(0);
}
if(process.argv.includes('--hud')){
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.setPaused(true);f.effects.clear();});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>{let frames=5;const next=()=>--frames?requestAnimationFrame(next):resolve();requestAnimationFrame(next);}));
  await settle();
  const freshUnlocked=await page.evaluate(()=>({lockId:window.__flight.game.state.lockId,flags:window.__flight.game.enemies.map(e=>Boolean(e.locked)),lockedMarkers:document.querySelectorAll('.target-marker.locked').length}));assert.equal(freshUnlocked.lockId,null);assert.ok(freshUnlocked.flags.every(locked=>!locked));assert.equal(freshUnlocked.lockedMarkers,0,'uninitialized enemy lock flag must force the class off');
  await settle();assert.equal(await page.locator('.target-marker.locked').count(),0,'unlocked class stays off over additional rendered frames');
  async function seedTargets(points){
    await settle();
    return page.evaluate(points=>{const f=window.__flight;f.camera.updateMatrixWorld(true);const enemies=f.game.enemies.slice(0,3);if(enemies.length<3)throw new Error('Three initial targets required');for(const [i,e]of enemies.entries()){const [x,y]=points[i],point=f.camera.position.clone().set(x/innerWidth*2-1,1-y/innerHeight*2,0).unproject(f.camera);point.sub(f.camera.position).normalize().multiplyScalar(440).add(f.camera.position);e.x=point.x;e.y=point.y;e.z=point.z;e.dead=false;e.locked=i===1;e.lockProgress=i===1?1:0;}f.game.state.lockId=enemies[1].id;f.game.state.locked=true;f.game.enemies=enemies;return enemies.map(e=>e.id);},points);
  }
  async function markerPositions(){return page.evaluate(()=>{const f=window.__flight;return{expected:f.game.enemies.map(e=>{const point=f.camera.position.clone().set(e.x,e.y,e.z).project(f.camera);return{id:e.id,x:(point.x*.5+.5)*innerWidth,y:(-point.y*.5+.5)*innerHeight,primary:e.id===f.game.state.lockId};}),actual:[...document.querySelectorAll('.target-marker')].map(el=>({id:Number(el.dataset.enemyId),x:parseFloat(el.style.left),y:parseFloat(el.style.top),primary:el.classList.contains('locked')}))};});}
  await seedTargets([[1440*.40,900*.30],[1440*.62,900*.45],[1440*.47,130]]);await settle();
  const desktop=await markerPositions();assert.equal(desktop.actual.length,3,'all three unobstructed diagnostic targets visible');
  for(const expected of desktop.expected)assert.ok(desktop.actual.some(actual=>actual.id===expected.id&&Math.hypot(actual.x-expected.x,actual.y-expected.y)<1.2),'desktop marker uses actual projected center');
  await page.screenshot({path:'artifacts/hud-desktop-sync.png'});
  if(process.argv.includes('--terrain'))await captureTerrain();
  await page.evaluate(()=>{const p=window.__flight.game.player;p.bank=-.55;p.rollAngle=.6;});await settle();
  const bank=await markerPositions(),bankPrimary=bank.expected.find(e=>e.primary);
  assert.ok(bank.actual.some(actual=>actual.id===bankPrimary.id&&Math.hypot(actual.x-bankPrimary.x,actual.y-bankPrimary.y)<1.2),'primary follows bank and roll camera projection');
  await page.screenshot({path:'artifacts/hud-bank-sync.png'});
  await page.evaluate(()=>{const p=window.__flight.game.player;p.bank=0;p.rollAngle=0;});
  await page.setViewportSize({width:390,height:844});
  await seedTargets([[42,844*.41+30],[195,445],[330,485]]);await settle();
  const mobile=await markerPositions(),hidden=mobile.expected[0],primary=mobile.expected[1];
  assert.ok(!mobile.actual.some(actual=>actual.id===hidden.id),'secondary over SPEED is hidden');
  assert.ok(mobile.actual.some(actual=>actual.id===primary.id&&actual.primary&&Math.hypot(actual.x-primary.x,actual.y-primary.y)<1.2),'primary remains at true projection');
  await page.screenshot({path:'artifacts/hud-mobile-safe.png'});
  console.log(JSON.stringify({desktop,bank,mobile,condition:'QA seeded paused targets and settled camera; geometric center measured against CSS center; mobile hidden secondary remains a visible aircraft',errors}));
  assert.equal(errors.length,0);
  if(!process.argv.includes('--stage-bonus')){await browser.close();process.exit(0);}
  await page.setViewportSize({width:1440,height:900});
}
if(touchMode){
  if(process.argv.includes('--hud')){await page.evaluate(()=>window.__flight.game.reset());await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('#app').classList.contains('playing'),null,{timeout:10000,polling:100});}
  await page.getByRole('button',{name:'出撃する',exact:false}).tap();
  await page.evaluate(()=>{window.__flight.game.state.invulnerable=60;});
  const client=await page.context().newCDPSession(page);
  const box=await page.locator('#touch-stick').boundingBox();assert.ok(box);
  const xBefore=await page.evaluate(()=>window.__flight.game.player.x);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.88,y:box.y+box.height*.5,id:1}]});
  await page.waitForFunction(before=>window.__flight.game.player.x>before+2,xBefore,{timeout:10000,polling:100});
  assert.ok((await page.evaluate(()=>window.__flight.game.player.x))>xBefore+2,'real touch pointer moves aircraft');
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const gun=await page.locator('[data-hold="gun"]').boundingBox();assert.ok(gun);
  const shotsBefore=await page.evaluate(()=>window.__flight.game.state.shots);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gun.x+gun.width*.5,y:gun.y+gun.height*.5,id:2}]});await page.waitForFunction(before=>window.__flight.game.state.shots>before,shotsBefore,{timeout:10000,polling:100});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
  const shotsReleased=await page.evaluate(()=>window.__flight.game.state.shots);assert.ok(shotsReleased>shotsBefore,'touch gun fires');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await page.evaluate(()=>window.__flight.game.state.shots),shotsReleased,'touch release stops fire');
  const brake=await page.locator('[data-hold="brake"]').boundingBox();assert.ok(brake);const normalSpeed=await page.evaluate(()=>window.__flight.game.player.speed);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:brake.x+brake.width*.5,y:brake.y+brake.height*.5,id:4}]});
  const braking=await page.waitForFunction(before=>{const speed=window.__flight.game.player.speed;return speed<before-30&&{speed};},normalSpeed,{timeout:10000,polling:100});const lowSpeed=(await braking.jsonValue()).speed;
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(low=>window.__flight.game.player.speed>low+25,lowSpeed,{timeout:10000,polling:100});
  const roll=await page.locator('[data-hold="rollLeft"]').boundingBox();assert.ok(roll);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:roll.x+roll.width*.5,y:roll.y+roll.height*.5,id:3}]});
  const startedRoll=await page.waitForFunction(()=>{const s=window.__flight.game.state;return s.rolling&&{direction:s.rollDirection};},null,{timeout:10000,polling:100});
  assert.equal((await startedRoll.jsonValue()).direction,1,'direction sampled in the same task as the active roll, before a later render can complete it');
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>!window.__flight.game.state.rolling,null,{timeout:10000,polling:100});
  assert.equal(await page.evaluate(()=>window.__flight.game.player.rollAngle),0);
  await page.screenshot({path:'artifacts/touch-flight.png'});
  await page.getByRole('button',{name:'ゲームを一時停止',exact:true}).tap();assert.equal(await page.evaluate(()=>window.__flight.game.state.status),'paused');
  await page.getByRole('button',{name:'飛行を再開',exact:false}).tap();assert.equal(await page.evaluate(()=>window.__flight.game.state.status),'playing');
  console.log(JSON.stringify({checks:['CDP touch pointer steers','touch gun adds shots','release stops fire','touch LOW reduces speed and release returns toward normal','touch roll starts correct direction and returns0','tap pause/resume'],condition:'mobile390x844,hasTouch true, QA invulnerability for input isolation',errors}));assert.equal(errors.length,0);
  if(!process.argv.includes('--stage-bonus')&&!process.argv.includes('--landing')){await browser.close();process.exit(0);}
  await page.setViewportSize({width:1440,height:900});
}
if(process.argv.includes('--stage-bonus')){
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.freezePresentation=true;f.game.state.invulnerable=60;f.game.state.hit=3;f.game.state.stageTime=f.game.state.stageDuration-.01;f.game.update(1/30,{});});
  assert.equal(await page.evaluate(()=>window.__flight.game.state.stage),2);
  await page.waitForFunction(()=>document.querySelector('#stage-toast').classList.contains('visible'),null,{timeout:10000,polling:100});assert.match(await page.locator('#stage-bonus').textContent(),/HIT COUNTS 3.*60,000 POINTS/);
  const beforeBonusPhoto=await page.evaluate(()=>window.__flight.captureState());
  await page.screenshot({path:'artifacts/stage-bonus.png'});
  const afterBonusPhoto=await page.evaluate(()=>window.__flight.captureState());assert.equal(afterBonusPhoto.presentationTime,beforeBonusPhoto.presentationTime);assert.ok(afterBonusPhoto.state.time>beforeBonusPhoto.state.time,'QA toast clock freeze preserves live simulation');
  await page.evaluate(()=>{window.__flight.freezePresentation=false;});
  console.log(JSON.stringify({checks:['stage1 to2 resets HIT','QA seeded HIT3 renders60,000 bonus toast'],condition:'QA presentation clock frozen to photograph transient toast; simulation score checked separately',errors}));assert.equal(errors.length,0);
  if(!process.argv.includes('--landing')){await browser.close();process.exit(0);}
}
if(process.argv.includes('--damage')){
  await captureDamage();await browser.close();process.exit(0);
}
if(process.argv.includes('--effects')){
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.setPaused(true);f.effects.explode(25,245,-180,3);for(let i=0;i<24;i++)f.effects.trail(900,18+i*1.4,225+i*.4,-25-i*13);f.effects.update(.2,0,f.camera);});await page.waitForTimeout(1200);await page.screenshot({path:'artifacts/combat-effects.png'});
  const stats=await page.evaluate(()=>{const f=window.__flight;return{pools:Object.fromEntries(Object.entries(f.effects.pools).map(([k,p])=>[k,{particles:p.particles.length,drawInstances:p.mesh.count}])),wakeSegments:f.effects.wake.geometry.drawRange.count/6};});assert.ok(stats.wakeSegments>10);assert.ok(stats.pools.fire.drawInstances>0);assert.ok(stats.pools.smoke.drawInstances>0);
  await page.evaluate(()=>window.__flight.effects.clear());assert.equal(await page.evaluate(()=>window.__flight.effects.wake.geometry.drawRange.count),0);console.log(JSON.stringify({stats,errors}));assert.equal(errors.length,0);await browser.close();process.exit(0);
}
if(process.argv.includes('--performance')){
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.game.update(2,{});f.game.setPaused(true);});
  const measurements=[];
  for(const profile of ['high','balanced']){
    await setProfile(profile);
    const intervals=await page.evaluate(()=>new Promise(resolve=>{const intervals=[];let previous=performance.now(),warmup=5;const next=now=>{if(warmup)warmup--;else intervals.push(now-previous);previous=now;if(intervals.length<24)requestAnimationFrame(next);else resolve(intervals);};requestAnimationFrame(next);}));
    const state=await page.evaluate(()=>window.__flight.captureState());const average=intervals.reduce((a,b)=>a+b,0)/intervals.length;const ordered=intervals.slice().sort((a,b)=>a-b);
    const terrain=await page.evaluate(()=>window.__flight.scene.children.filter(m=>m.name.startsWith('Coast terrain')).map(m=>({lod:m.userData.terrain.lod,index:m.geometry.index.count,assetStatus:m.material.map.userData.assetStatus})));
    assert.ok(terrain.every(m=>m.lod===(profile==='high'?'high':'low')&&m.assetStatus==='ready'));
    measurements.push({profile,pixelRatio:state.pixelRatio,fps:Number((1000/average).toFixed(2)),p95FrameMs:Number(ordered[Math.floor(ordered.length*.95)].toFixed(1)),drawCalls:state.drawCalls,triangles:state.triangles,terrain});
  }
  const gpu=await page.evaluate(()=>{const gl=window.__flight.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'Unavailable';});
  const result={capturedAt:new Date().toISOString(),version:'photographic rock / reduced terrain indices / wind-only ocean normals / synchronized HUD',viewport:'1440x900',condition:'paused stage1 combat frame, 24 rendered frames after5 warmup; no FPS guarantee for motion',gpu,measurements,errors};console.log(JSON.stringify(result));await fs.writeFile('artifacts/performance.json',JSON.stringify(result,null,2));assert.equal(errors.length,0);await browser.close();process.exit(0);
}
if(process.argv.includes('--landing')){
  await page.evaluate(()=>{const f=window.__flight;f.launch();f.game._enterStage(23);for(let i=0;i<620;i++)f.game.update(1/60,{});f.game.setPaused(true);const jet=f.scene.getObjectByName('AR-29 Kestrel');f.updateAircraft(jet,2,{time:10,throttle:.12,pitch:0,bank:0,gear:1});});await page.waitForTimeout(1000);
  const surface=await page.evaluate(()=>{const deck=window.__flight.scene.getObjectByName('Carrier flight deck');deck.geometry.computeBoundingBox();const top=deck.geometry.boundingBox.max.clone();deck.localToWorld(top);return{top:top.y,player:window.__flight.game.player.y};});assert.equal(surface.top,20);assert.equal(surface.player,22);
  await page.screenshot({path:'artifacts/carrier-fixed.png'});
  await page.evaluate(()=>{const f=window.__flight,p=f.game.player;f.photo={position:{x:p.x+17,y:p.y+8,z:p.z+20},target:{x:p.x,y:p.y-1,z:p.z}};document.querySelector('.hud').style.display='none';document.querySelector('.chrome').style.display='none';});await page.waitForTimeout(800);await page.screenshot({path:'artifacts/landing-contact.png'});
  await page.evaluate(()=>{const f=window.__flight,ship=f.scene.getObjectByName('CV-09 Resolute');f.photo={position:{x:ship.position.x+200,y:110,z:ship.position.z+380},target:{x:ship.position.x,y:18,z:ship.position.z}};});await page.waitForTimeout(800);await page.screenshot({path:'artifacts/carrier-exterior.png'});
  await page.evaluate(()=>{const f=window.__flight;f.photo=null;document.querySelector('.hud').style.display='';document.querySelector('.chrome').style.display='';f.game.setPaused(false);for(let i=0;i<600;i++)f.game.update(1/60,{});});assert.equal(await page.evaluate(()=>window.__flight.game.state.status),'victory');await page.waitForTimeout(1200);await page.screenshot({path:'artifacts/debrief.png'});
  await page.getByRole('button',{name:'もう一度出撃',exact:false}).click();assert.equal(await page.evaluate(()=>window.__flight.game.state.stage),1);assert.equal(await page.evaluate(()=>window.__flight.game.state.lives),3);
  await page.evaluate(()=>{const f=window.__flight;f.game._enterStage(3);f.game.update(.25,{});f.game.setPaused(true);f.photo=null;});await page.waitForTimeout(800);await page.screenshot({path:'artifacts/resupply.png'});
  await page.evaluate(()=>{const f=window.__flight,tanker=f.scene.getObjectByName('M-41 Meridian tanker');f.photo={position:{x:tanker.position.x+42,y:tanker.position.y+17,z:tanker.position.z+50},target:{x:tanker.position.x,y:tanker.position.y,z:tanker.position.z}};document.querySelector('.hud').style.display='none';document.querySelector('.chrome').style.display='none';});await page.waitForTimeout(800);await page.screenshot({path:'artifacts/tanker-close.png'});
  await page.evaluate(()=>{const f=window.__flight;f.photo=null;document.querySelector('.hud').style.display='';document.querySelector('.chrome').style.display='';f.game._enterStage(5);f.game.setPaused(false);for(let i=0;i<620;i++)f.game.update(1/60,{});f.game.setPaused(true);f.updateAircraft(f.scene.getObjectByName('AR-29 Kestrel'),2,{time:10,throttle:.12,gear:1});});await page.waitForTimeout(800);await page.screenshot({path:'artifacts/runway-service.png'});
  const runway=await page.evaluate(()=>{const strip=window.__flight.scene.getObjectByName('Airfield runway');strip.geometry.computeBoundingBox();return{top:strip.localToWorld(strip.geometry.boundingBox.max.clone()).y,player:window.__flight.game.player.y};});assert.equal(runway.top,80);assert.equal(runway.player,82);
  console.log(JSON.stringify({surface,errors,checks:['deck top20','touchdown height22','gear visible','carrier finite victory','debrief','restart stage1 lives3']}));assert.equal(errors.length,0);await browser.close();process.exit(0);
}
await page.screenshot({path:'artifacts/title-desktop.png'});
if(await page.evaluate(()=>Boolean(window.__flight))){
  await page.getByRole('button',{name:'出撃する',exact:false}).click();await page.waitForTimeout(4500);
  await page.screenshot({path:'artifacts/flight-desktop.png'});
  console.log(JSON.stringify(await page.evaluate(()=>window.__flight.captureState())));
  await page.keyboard.down('KeyJ');await page.waitForFunction(()=>window.__flight.game.state.missiles<50,null,{timeout:15000,polling:100});await page.keyboard.up('KeyJ');await page.waitForTimeout(500);
  const missiles=await page.evaluate(()=>window.__flight.game.state.missiles);assert.ok(missiles<50,'browser missile key fires after lock');
  const shotsBeforeGun=await page.evaluate(()=>window.__flight.game.state.shots);await page.keyboard.down('Space');await page.waitForFunction(before=>window.__flight.game.state.shots>before,shotsBeforeGun,{timeout:10000,polling:100});await page.keyboard.up('Space');assert.ok(await page.evaluate(()=>window.__flight.game.state.shots)>shotsBeforeGun,'browser gun key adds shots after missiles');
  await page.keyboard.down('KeyD');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(1300);await page.screenshot({path:'artifacts/flight-bank.png'});await page.keyboard.up('KeyD');await page.keyboard.up('ShiftLeft');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__flight.game.state.status),'paused');const pausedTime=await page.evaluate(()=>window.__flight.game.state.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__flight.game.state.time),pausedTime);await page.screenshot({path:'artifacts/pause.png'});await page.getByRole('button',{name:'飛行を再開',exact:false}).click();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:'artifacts/flight-mobile.png'});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'タイトルに戻る',exact:true}).click();assert.equal(await page.evaluate(()=>window.__flight.game.state.status),'attract');await page.screenshot({path:'artifacts/title-mobile.png'});
  await page.setViewportSize({width:1280,height:720});await page.getByRole('button',{name:'出撃する',exact:false}).click();await page.waitForTimeout(3600);await page.screenshot({path:'artifacts/comparison-local.png'});
  await page.evaluate(()=>window.__flight.game.setPaused(true));
  // Dedicated geometry/material view; does not replace the gameplay comparison.
  await page.evaluate(()=>{const {scene,game}=window.__flight;const p=game.player;window.__flight.photo={position:{x:p.x+21,y:p.y+12,z:p.z+24},target:{x:p.x,y:p.y,z:p.z}};document.querySelector('.hud').style.display='none';document.querySelector('.chrome').style.display='none';});
  await page.waitForTimeout(500);
  await page.screenshot({path:'artifacts/aircraft-close.png'});
  await page.evaluate(()=>{const f=window.__flight;f.game._enterStage(1);const e=f.game.enemies[0];e.x=30;e.y=250;e.z=-80;f.photo={position:{x:e.x+21,y:e.y+12,z:e.z+24},target:{x:e.x,y:e.y,z:e.z}};});await page.waitForTimeout(800);
  const enemyDetail=await page.evaluate(()=>{const lod=window.__flight.scene.children.find(m=>m.name==='Orion interceptor LOD'&&Math.abs(m.position.z+80)<.01),detailed=lod?.levels[0].object;let plumes=0,soft=0;detailed?.traverse(o=>{if(o.userData.flightEnginePlume!==undefined){plumes++;if(o.material.userData.flightSoftPlume&&o.material.customProgramCacheKey()==='kestrel-soft-plume-v1')soft++;}});return{active:detailed?.visible,plumes,soft};});assert.equal(enemyDetail.active,true);assert.equal(enemyDetail.plumes,2);assert.equal(enemyDetail.soft,2);await page.screenshot({path:'artifacts/enemy-close.png'});
  await page.evaluate(()=>{const f=window.__flight;f.game._enterStage(3);f.game.state.status='playing';f.game.update(.2,{});f.game.setPaused(true);f.photo=null;document.querySelector('.hud').style.display='';document.querySelector('.chrome').style.display='';});await page.waitForTimeout(650);await page.screenshot({path:'artifacts/resupply.png'});
  await page.evaluate(()=>{const f=window.__flight;f.game._enterStage(23);f.game.setPaused(false);for(let i=0;i<620;i++)f.game.update(1/60,{});f.game.setPaused(true);f.updateAircraft(f.scene.getObjectByName('AR-29 Kestrel'),2,{time:10,throttle:.12,gear:1});});assert.ok((await page.evaluate(()=>window.__flight.game.player.y))<30);await page.waitForTimeout(700);await page.screenshot({path:'artifacts/carrier.png'});
  if(!process.argv.includes('--no-compare'))await compare();
}
console.log(JSON.stringify({errors,browserChecks:'missile, gun, pause freezes time, resume, home, restart, mobile, resupply and carrier renders'}));assert.equal(errors.length,0,'zero browser/shader errors');await fs.writeFile('artifacts/browser-errors.json',JSON.stringify(errors,null,2));await browser.close();
