import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { createAircraft, updateAircraft } from './aircraft.js';
import { createEnvironment } from './environment.js';
import { FlightGame } from './gameplay.js';
import { CombatEffects, createProjectileMesh, recycleProjectileMesh } from './effects.js';
import { FlightAudio } from './audio.js';
import { createSupport } from './support.js';
import { createEnemyLOD } from './enemies.js';
import './styles.css';

const planeIcon=`<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="m16 2 2.5 10 10 8-.5 2.5-10-3v7l4 3-6-1-6 1 4-3v-7l-10 3-.5-2.5 10-8Z"/></svg>`;
const arrow=`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>`;
const app=document.querySelector('#app');
app.innerHTML=`
  <canvas id="flight-canvas" aria-label="3D空中戦のゲーム画面"></canvas><div class="shade"></div>
  <div class="chrome">
    <header class="topbar"><div class="brand">${planeIcon}<div class="brand-type">AFTERBURNER<small>H O R I Z O N</small></div></div>
    <div class="top-status"><i></i> FLIGHT SYSTEMS ONLINE</div>
    <nav class="nav" aria-label="メニュー"><button class="brief-help" data-action="help">操作方法</button><button data-action="settings">設定</button><button class="sound-button" data-action="sound" aria-label="音声を切り替える"><i class="sound-dot"></i><span id="sound-label">SOUND ON</span></button></nav></header>
    <section class="briefing" aria-label="出撃ブリーフィング"><div class="eyebrow">ARCADE FLIGHT COMBAT · REIMAGINED</div><h1>AFTERBURNER</h1><div class="title-sub">HORIZON</div><p class="tagline">あの空の、その先へ。<br>海岸線を突破し、23の戦場を駆け抜けろ。</p><div class="mission-line"><div class="mission-index">01</div><div class="mission-meta">COASTAL INTERCEPT<span>MERIDIAN COAST / 敵編隊を迎撃せよ</span></div></div><div class="launch-actions"><button class="primary" data-action="launch">出撃する ${arrow}</button><button class="secondary" data-action="help">操作方法</button></div><div class="brief-note"><span><i></i>23 STAGES</span><span><i></i>REAR CHASE VIEW</span><span><i></i>KEYBOARD / GAMEPAD</span></div></section>
    <div class="aircraft-label">AR–29 KESTREL<span>TWIN-ENGINE / ALL-WEATHER FIGHTER</span></div>
    <aside class="mission-card"><div class="card-head">OPERATION HORIZON <b>ACTIVE</b></div><svg viewBox="0 0 200 80" fill="none" aria-hidden="true"><path d="M0 13 17 15 26 8 35 17 30 25 46 33 45 43 55 48 70 44 81 55 75 64 83 80M117 0l-1 11 14 8-5 13 17 7-2 17 17 4 5 20" stroke="#7594a2" stroke-opacity=".4"/><path d="m36 68 19-9 27-24 36 9 38-25" stroke="#ecb565" stroke-dasharray="3 4" stroke-width="1"/><circle cx="36" cy="68" r="3" stroke="#ecb565"/><circle cx="82" cy="35" r="4" stroke="#ecb565"/><circle cx="118" cy="44" r="2" fill="#ecb565"/><circle cx="156" cy="19" r="3" stroke="#ecb565"/><path d="M88 35h17M82 29V14" stroke="#ecb565" stroke-opacity=".35"/><text x="6" y="77" fill="#86a8b8" font-size="6" font-family="monospace">N 34° 28′</text><text x="125" y="73" fill="#86a8b8" font-size="6" font-family="monospace">E 139° 44′</text></svg><div class="card-caption">MERIDIAN COAST</div><div class="card-detail"><span>海上迎撃 / 23 STAGES</span><span>06:42 LOCAL</span></div></aside>
    <footer class="bottom-bar"><span class="coordinates">N 34° 28′ 16″ <b>/</b> E 139° 44′ 09″</span><span>AN ORIGINAL ARCADE FLIGHT EXPERIENCE <b> · </b> 2026</span></footer>
    <button class="pause-pill" data-action="pause" aria-label="ゲームを一時停止">Ⅱ PAUSE <span>ESC</span></button>
  </div>
  <div class="hud" aria-label="飛行計器"><div class="hud-top"><div><div class="stat-label">SCORE</div><div class="score-number" id="score">00000000</div><div class="hit-row">HIT <b id="hits">0</b> <span id="high-score"></span></div></div><div class="stage-block"><div class="stage-number" id="stage-number">STAGE 01 / 23</div><div class="stage-title" id="stage-title">COASTAL INTERCEPT</div><div class="timer" id="timer">00:00</div></div></div>
    <div class="heading"><span>330</span><span>345</span><span class="heading-active" id="heading">N 000</span><span>015</span><span>030</span></div>
    <div class="speed-readout"><div class="telemetry-main"><span>SPEED</span><strong id="speed">1180</strong><small>KM/H</small></div><div class="tape"></div></div><div class="alt-readout"><div class="tape"></div><div class="telemetry-main"><span>ALT</span><strong id="altitude">230</strong><small>METRES</small></div></div>
    <div class="pitch-ladder"><span>10</span><span>−10</span></div><div class="reticle" id="reticle"><i></i><i></i><i></i><i></i></div><div id="target-markers"></div>
    <div class="radar"><div class="radar-grid"></div><div class="radar-sweep"></div><div class="radar-north">N</div><div class="radar-player"></div><div id="radar-blips"></div></div><div class="radar-coordinates">MERIDIAN SECTOR<br><span id="radar-range">RANGE 2.4 KM</span></div>
    <div class="weapons"><div class="weapon-row active"><span>MSL <small>ロックオン</small></span><strong id="missiles">50</strong></div><div class="weapon-row"><span>GUN <small>機銃</small></span><strong>∞</strong></div><div class="weapon-row" id="flare-row"><span>FLR <small>フレア</small></span><strong id="flares">4</strong></div><div class="life-row"><span>AIRCRAFT</span><span id="lives">${planeIcon.repeat(3)}</span></div><div class="health" aria-label="機体の耐久度"><span id="health-bar"></span></div></div>
    <div class="radio" id="radio"><b>AWACS / OVERLORD</b><span id="radio-text"></span></div><div class="warning" id="warning">⚠ MISSILE APPROACHING</div><div class="stage-toast" id="stage-toast"><small id="toast-eyebrow">OPERATION HORIZON</small><strong id="toast-title">STAGE 01</strong><span id="toast-subtitle">COASTAL INTERCEPT</span><div class="stage-bonus" id="stage-bonus" hidden></div></div><div class="game-hints"><kbd>W A S D</kbd> 操縦 &nbsp; <kbd>SPACE</kbd> 機銃 &nbsp; <kbd>J</kbd> ミサイル &nbsp; <kbd>SHIFT</kbd> 加速 &nbsp; <kbd>K</kbd> 減速 &nbsp; <kbd>Q / E</kbd> ロール &nbsp; <kbd>ESC</kbd> 一時停止</div>
    <div class="touch-controls"><div class="touch-stick" id="touch-stick" aria-label="仮想操縦桿"></div><div class="touch-buttons"><button data-hold="missile">MSL</button><button data-hold="gun">GUN</button><button data-hold="boost">BOOST</button><div class="touch-rolls"><button data-hold="brake" aria-label="LOWスロットルで減速">LOW</button><button data-hold="rollLeft" aria-label="左へ360度ロール">↶ ROLL</button><button data-hold="rollRight" aria-label="右へ360度ロール">ROLL ↷</button></div></div></div>
  </div><div class="modal-backdrop" id="modal" hidden></div><div class="loading" id="loading">INITIALIZING FLIGHT SYSTEMS</div>`;

const $=id=>document.getElementById(id);
const safeGet=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Local storage is optional. */}};
const settings={quality:'auto',sound:true,invert:false,modern:false,...safeGet('horizon-settings',{})};
const best={score:0,hits:0,...safeGet('horizon-best',{})};
const audio=new FlightAudio();audio.enabled=settings.sound;
let renderer,scene,camera,composer,environment,support,effects,aircraft,enemyTemplate,game;
let elapsed=0,last=performance.now(),radioUntil=0,toastUntil=0,shake=0,currentStatus='attract',modalKind=null,frames=0,meanFrame=0;
let cameraInitialized=false;const keys=new Set(),held={},touch={x:0,y:0};
const enemyMeshes=new Map(),projectileMeshes=new Map(),targetEls=new Map(),radarEls=new Map(),attractJets=[];
const enemyPool=[];const viewPosition=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),aim=new THREE.Vector3();
const devMode=new URLSearchParams(location.search).has('qa');
const hudSafeAreaElements=Array.from(document.querySelectorAll('.brand,.pause-pill,.hud-top>div,.heading,.speed-readout,.alt-readout,.radar,.radar-coordinates,.weapons,.radio,.warning,.stage-toast,.touch-stick,.touch-buttons'));
let hudSafeAreaCache=null;
if(window.ResizeObserver){
  const hudResizeObserver=new ResizeObserver(()=>{hudSafeAreaCache=null;});
  for(const el of [...hudSafeAreaElements,$('flight-canvas')])hudResizeObserver.observe(el);
}

function hudSafeAreas(){
  const visibilityKey=[innerWidth,innerHeight,app.classList.contains('playing'),settings.modern,$('radio').classList.contains('visible'),$('warning').classList.contains('visible'),$('stage-toast').classList.contains('visible')].join(':');
  if(!hudSafeAreaCache||hudSafeAreaCache.key!==visibilityKey){
    const regions=[];
    for(const el of hudSafeAreaElements){
      if(el.hidden||!el.getClientRects().length)continue;
      if(el.matches('.radio,.warning,.stage-toast')&&!el.classList.contains('visible'))continue;
      const r=el.getBoundingClientRect();
      if(r.width&&r.height)regions.push({left:r.left-6,top:r.top-6,right:r.right+6,bottom:r.bottom+6});
    }
    hudSafeAreaCache={key:visibilityKey,regions,viewport:$('flight-canvas').getBoundingClientRect()};
  }
  return hudSafeAreaCache;
}

function radio(text,duration=5){$('radio-text').textContent=text;radioUntil=elapsed+duration;$('radio').classList.add('visible');}
function stageToast(stage,name){$('toast-eyebrow').textContent=stage===23?'RETURN TO BASE':'OPERATION HORIZON';$('toast-title').textContent=`STAGE ${String(stage).padStart(2,'0')}`;$('toast-subtitle').textContent=name;const summary=game?.state.lastStageSummary,showBonus=summary?.stage===stage-1;$('stage-bonus').hidden=!showBonus;if(showBonus)$('stage-bonus').textContent=`HIT COUNTS ${summary.hit} · +${summary.bonus.toLocaleString()} POINTS`;toastUntil=elapsed+3.2;}
function handleEvent(e){
  if(e.type==='explosion')effects?.explode(e.x,e.y,e.z,e.source==='player'?.55:(e.scale??1),{nearPlayer:e.source==='player'||(e.source==='missile'&&e.owner==='enemy')});
  if(e.type==='flare')effects?.flare(game.player.x,game.player.y,game.player.z);
  if(e.type==='damage'){shake=.6;radio('被弾。回避軌道を取れ。',2.5);}
  if(e.type==='stage'){stageToast(e.stage,e.stageName||e.name||game.state.stageName);radio(e.objective||game.state.objective,4);}
  if(e.type==='lock'&&e.locked)radio('目標捕捉。ミサイル発射準備。',1.7);
  if(e.type==='resupply')radio('補給完了。ミサイルを再装填。',3.5);
  if(e.type==='life')radio('機体を失った。予備機で戦闘を継続。',3);
  if(e.type==='complete')setTimeout(()=>showDebrief(),900);
  audio.event(e.type,e);
}

function initialize(){
  try{
    renderer=new THREE.WebGLRenderer({canvas:$('flight-canvas'),antialias:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,settings.quality==='balanced'?.75:settings.quality==='high'?1.5:1));
    renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=settings.quality!=='balanced';renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.info.autoReset=false;
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(54,innerWidth/innerHeight,1,35000);
    environment=createEnvironment(scene,renderer);support=createSupport(scene);effects=new CombatEffects(scene);
    aircraft=createAircraft();scene.add(aircraft);aircraft.position.y=230;
    enemyTemplate=createEnemyLOD(createAircraft({enemy:true}));
    for(let i=0;i<3;i++){const m=enemyTemplate.clone(true);m.position.set((i-1)*65,265+i*12,-650-i*90);m.rotation.z=(i-1)*.06;scene.add(m);attractJets.push(m);}
    composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
    const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.13,.35,1.4);bloom.enabled=settings.quality!=='balanced';composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);fxaa.uniforms.resolution.value.set(1/(innerWidth*renderer.getPixelRatio()),1/(innerHeight*renderer.getPixelRatio()));
    const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform float time;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float vig=1.0-dot(vUv-.5,vUv-.5)*.28;c*=vig;float grain=fract(sin(dot(vUv*vec2(1400.0,900.0)+time,vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.007;gl_FragColor=vec4(c,1.0);}`});composer.addPass(grade);
    game=new FlightGame({onEvent:handleEvent});game.bestScore=best.score;
    window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();composer.setSize(innerWidth,innerHeight);fxaa.uniforms.resolution.value.set(1/(innerWidth*renderer.getPixelRatio()),1/(innerHeight*renderer.getPixelRatio()));hudSafeAreaCache=null;});
    initializeControls();updateSoundButton();$('loading').remove();
    if(devMode)window.__flight={game,renderer,composer,scene,camera,settings,effects,environment,launch,showDebrief,updateAircraft,freezePresentation:false,setPresentationTime:time=>{if(Number.isFinite(time))elapsed=time;},captureState:()=>({state:{...game.state},player:{...game.player},enemies:game.enemies.map(e=>({...e})),presentationTime:elapsed,fps:Math.round(1/meanFrame),pixelRatio:renderer.getPixelRatio(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryBuffers:renderer.info.memory.geometries,textures:renderer.info.memory.textures,particles:Object.fromEntries(Object.entries(effects.pools).map(([k,p])=>[k,p.particles.length])),wakeSegments:effects.wake.geometry.drawRange.count/6})};
    const qaOutput=devMode?document.createElement('output'):null;
    if(qaOutput){
      const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
      qaOutput.id='qa-renderer';qaOutput.dataset.renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'Unavailable';qaOutput.hidden=true;
      document.body.append(qaOutput);
    }
    last=performance.now();
    const tick=now=>{const rawDt=(now-last)/1000;last=now;const dt=Math.min(rawDt,.1);
      // QA can hold transient presentation for a screenshot; simulation and
      // rendering still advance, and production never consults this hook.
      if(!devMode||!window.__flight?.freezePresentation)elapsed+=Math.min(rawDt,1);
      meanFrame=meanFrame*.9+rawDt*.1;
      const active=game.state.status==='playing';
      if(active)game.update(rawDt,getInput());
      const p=game.player,s=game.state;
      if(s.status==='attract'){
        p.bank=Math.sin(elapsed*.28)*.065;p.pitch=Math.sin(elapsed*.2)*.012;p.y=230+Math.sin(elapsed*.35)*2;
      }
      environment.update(s.status==='paused'?0:dt,{time:elapsed,speed:active?p.speed:600,stage:s.stage,biome:s.biome,player:p});
      const roll=p.rollAngle??0;
      aircraft.position.set(p.x,p.y+(s.autopilot?.18:0),p.z);aircraft.rotation.set(p.pitch,0,p.bank+roll,'YXZ');
      aircraft.visible=s.status!=='defeat'||elapsed%1<.8;
      updateAircraft(aircraft,s.status==='paused'?0:dt,{time:elapsed,throttle:p.throttle,bank:s.rolling?s.rollDirection*.75:p.bank,pitch:p.pitch,gear:s.autopilot?Math.min(1,s.landingProgress*5):0});
      if (!devMode || !window.__flight?.photo) {
      const portrait=innerWidth<700&&innerHeight>innerWidth;
      const camHeight=innerWidth<700?13:5;const camDistance=portrait?90:innerWidth<700?68:26;
      desiredCamera.set(p.x-Math.sin(roll)*camHeight,p.y+Math.cos(roll)*camHeight,p.z+camDistance+(p.throttle>.9?4:0));
      if(!cameraInitialized){camera.position.copy(desiredCamera);cameraInitialized=true;}
      camera.position.lerp(desiredCamera,1-Math.exp(-dt*12));
      camera.position.x=THREE.MathUtils.clamp(camera.position.x,desiredCamera.x-5,desiredCamera.x+5);camera.position.y=THREE.MathUtils.clamp(camera.position.y,desiredCamera.y-4,desiredCamera.y+4);
      aim.set(p.x-Math.sin(roll)*11,p.y+Math.cos(roll)*11,p.z-220);camera.lookAt(aim);camera.rotateZ(roll-p.bank*.10);
      camera.fov=THREE.MathUtils.damp(camera.fov,p.throttle>.9?59:54,3,dt);camera.updateProjectionMatrix();
      } else {
        const photo=window.__flight.photo;camera.position.set(photo.position.x,photo.position.y,photo.position.z);camera.lookAt(photo.target.x,photo.target.y,photo.target.z);camera.fov=45;camera.updateProjectionMatrix();
      }
      if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt*1.2);}
      // QA-only matched effect captures hold the recorded pose, including FOV.
      const heldCamera=devMode&&window.__flight?.heldCamera;
      if(heldCamera){camera.position.fromArray(heldCamera.position);camera.quaternion.fromArray(heldCamera.quaternion);camera.fov=heldCamera.fov;camera.updateProjectionMatrix();}
      // HUD projection must use the final pose for the frame that is rendered.
      // RenderPass refreshes these matrices later, after DOM target placement.
      camera.updateMatrixWorld(true);
      for(const m of attractJets)m.visible=s.status==='attract';
      synchronizeModels(dt);support.update(game);effects.update(s.status==='paused'?0:dt,p.speed,camera);
      if(currentStatus!==s.status){currentStatus=s.status;app.classList.toggle('playing',s.status!=='attract');app.classList.toggle('paused',s.status==='paused');}
      $('radio').classList.toggle('visible',elapsed<radioUntil);$('stage-toast').classList.toggle('visible',elapsed<toastUntil&&s.status==='playing');
      frames++;updateHud();
      audio.update(p.throttle,active,{threat:s.threat,bank:p.bank,speed:p.speed});
      grade.uniforms.time.value=elapsed;
      if(settings.quality==='auto'&&frames%10===0&&meanFrame>.045&&renderer.getPixelRatio()>.52){const ratio=Math.max(.5,renderer.getPixelRatio()-.15);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);fxaa.uniforms.resolution.value.set(1/(innerWidth*ratio),1/(innerHeight*ratio));bloom.enabled=ratio>.8;renderer.shadowMap.enabled=ratio>.8;}
      renderer.info.reset();composer.render();
      if(qaOutput){qaOutput.dataset.fps=(1/meanFrame).toFixed(2);qaOutput.dataset.pixelRatio=String(renderer.getPixelRatio());qaOutput.dataset.drawCalls=String(renderer.info.render.calls);qaOutput.dataset.triangles=String(renderer.info.render.triangles);}
      requestAnimationFrame(tick);
    };requestAnimationFrame(tick);
  }catch(error){console.error(error);$('loading')?.remove();app.innerHTML=`<div class="error-screen"><div><div class="eyebrow">FLIGHT SYSTEMS OFFLINE</div><h2>3D描画を開始できませんでした</h2><p>WebGL 2に対応したブラウザで、ハードウェアアクセラレーションを有効にしてください。</p><button class="primary" onclick="location.reload()">再読み込み ${arrow}</button></div></div>`;}
}

function synchronizeModels(dt){
  const ids=new Set();
  for(const e of game.enemies){if(e.dead)continue;ids.add(e.id);let mesh=enemyMeshes.get(e.id);if(!mesh){mesh=enemyPool.pop()||enemyTemplate.clone(true);scene.add(mesh);enemyMeshes.set(e.id,mesh);}mesh.position.set(e.x,e.y,e.z);mesh.rotation.set(e.pitch||0,e.heading||0,e.bank||Math.sin(elapsed+e.id)*.05);mesh.visible=true;
    const detailed=mesh.levels[0].object;
    if(mesh.getObjectForDistance(mesh.position.distanceTo(camera.position))===detailed)updateAircraft(detailed,game.state.status==='paused'?0:dt,{time:elapsed,throttle:.72,bank:e.bank||0,pitch:e.pitch||0,gear:0});
  }
  for(const [id,mesh]of enemyMeshes)if(!ids.has(id)){scene.remove(mesh);enemyMeshes.delete(id);enemyPool.push(mesh);}
  const pids=new Set();
  for(const p of game.projectiles){if(p.dead||p.type==='flare')continue;pids.add(p.id);let m=projectileMeshes.get(p.id);if(!m){m=createProjectileMesh(p);scene.add(m);projectileMeshes.set(p.id,m);}m.position.set(p.x,p.y,p.z);aim.set(p.x+(p.vx||0)*.01,p.y+(p.vy||0)*.01,p.z+(p.vz||-100)*.01);m.lookAt(aim);m.rotateY(Math.PI);
    if(p.type==='missile'&&game.state.status==='playing')effects.trail(p.id,p.x,p.y,p.z);
  }
  for(const [id,m]of projectileMeshes)if(!pids.has(id)){recycleProjectileMesh(m);projectileMeshes.delete(id);}
}

function updateHud(){
  const s=game.state,p=game.player;
  // Readout strings can update at half rate; spatial cues follow every frame.
  if(frames%2===0){
  $('score').textContent=String(s.score).padStart(8,'0');$('hits').textContent=s.hit;
  $('high-score').textContent=best.score?` / BEST ${best.score.toLocaleString()}`:'';
  $('stage-number').textContent=`STAGE ${String(s.stage).padStart(2,'0')} / 23`;$('stage-title').textContent=s.stageName;
  const t=Math.floor(s.missionTime??s.time);$('timer').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
  $('speed').textContent=Math.round(p.speed);$('altitude').textContent=Math.round(p.y);$('missiles').textContent=s.missiles;$('flares').textContent=s.flares;
  $('flare-row').hidden=!settings.modern;$('lives').innerHTML=planeIcon.repeat(Math.max(0,Math.min(5,s.lives??3)));$('health-bar').style.width=`${s.health}%`;
  $('reticle').classList.toggle('locked',s.locked);
  $('heading').textContent=`N ${String((360+Math.round(p.x*.08))%360).padStart(3,'0')}`;
  }
  $('warning').classList.toggle('visible',s.threat>0&&s.status==='playing'&&elapsed>toastUntil);
  const heldHud=devMode&&window.__flight?.heldHUD;
  if(heldHud){$('stage-toast').classList.toggle('visible',Boolean(heldHud.toast));$('warning').classList.toggle('visible',Boolean(heldHud.warning));$('radio').classList.toggle('visible',Boolean(heldHud.radio));}
  const {regions,viewport}=hudSafeAreas(),halfMarker=innerWidth<=700?17:22;
  const visibleIds=new Set();
  for(const e of game.enemies){if(e.dead)continue;viewPosition.set(e.x,e.y,e.z).project(camera);if(!Number.isFinite(viewPosition.x)||!Number.isFinite(viewPosition.y)||!Number.isFinite(viewPosition.z)||viewPosition.z<-1||viewPosition.z>1||Math.abs(viewPosition.x)>1||Math.abs(viewPosition.y)>1)continue;
    const selected=s.lockId===e.id;
    const markerX=viewport.left+(viewPosition.x*.5+.5)*viewport.width,markerY=viewport.top+(-viewPosition.y*.5+.5)*viewport.height;
    // Never move a cue away from its aircraft. Suppress secondary boxes when
    // their actual bounds collide with instruments or the edge of the viewport.
    if(!selected){
      const left=markerX-halfMarker,right=markerX+halfMarker,top=markerY-halfMarker-5,bottom=markerY+halfMarker+5;
      if(left<viewport.left||right>viewport.right||top<viewport.top||bottom>viewport.bottom||regions.some(r=>left<r.right&&right>r.left&&top<r.bottom&&bottom>r.top))continue;
    }
    visibleIds.add(e.id);let el=targetEls.get(e.id);if(!el){el=document.createElement('div');el.className='target-marker';el.dataset.enemyId=String(e.id);el.innerHTML='<span class="target-name"></span><span class="target-distance"></span><span class="lock-status"></span><i class="lock-progress"></i>';$('target-markers').append(el);targetEls.set(e.id,el);}
    el.style.left=`${markerX}px`;el.style.top=`${markerY}px`;
    el.classList.toggle('locked',Boolean(e.locked));
    el.classList.toggle('label-left',selected&&innerWidth<700&&innerHeight>innerWidth&&markerX>viewport.right-110);
    const name=el.querySelector('.target-name'),distance=el.querySelector('.target-distance'),status=el.querySelector('.lock-status'),progress=el.querySelector('.lock-progress');
    name.hidden=distance.hidden=status.hidden=progress.hidden=!selected;
    name.textContent=selected?'BANDIT':'';distance.textContent=selected?`${(Math.hypot(e.x-p.x,e.y-p.y,e.z)/1000).toFixed(2)} KM`:'';status.textContent=selected?(e.locked?'FIRE':'ACQUIRING'):'';progress.style.width=`${(e.lockProgress??0)*100}%`;
  }
  for(const [id,el]of targetEls)if(!visibleIds.has(id)){el.remove();targetEls.delete(id);}
  const radarIds=new Set();
  for(const e of game.enemies){if(e.dead)continue;const rx=50+(e.x-p.x)/18,ry=71+e.z/24;if(rx<4||rx>96||ry<4||ry>96)continue;radarIds.add(e.id);let el=radarEls.get(e.id);if(!el){el=document.createElement('i');el.className='radar-blip';$('radar-blips').append(el);radarEls.set(e.id,el);}el.style.left=`${rx}%`;el.style.top=`${ry}%`;}
  for(const [id,el]of radarEls)if(!radarIds.has(id)){el.remove();radarEls.delete(id);}
}

function getInput(){
  const input={x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.x,y:(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+touch.y,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')||held.boost,brake:keys.has('KeyK')||held.brake,gun:keys.has('Space')||held.gun,missile:keys.has('KeyJ')||held.missile,rollLeft:keys.has('KeyQ')||held.rollLeft,rollRight:keys.has('KeyE')||held.rollRight,flare:settings.modern&&(keys.has('KeyF')||held.flare)};
  const pads=navigator.getGamepads?.();const pad=pads&&Array.from(pads).find(Boolean);if(pad){input.x+=Math.abs(pad.axes[0])>.15?pad.axes[0]:0;input.y+=Math.abs(pad.axes[1])>.15?-pad.axes[1]:0;input.gun||=pad.buttons[0]?.pressed;input.missile||=pad.buttons[1]?.pressed;input.boost||=pad.buttons[7]?.pressed;input.brake||=pad.buttons[6]?.pressed;input.rollLeft||=pad.buttons[4]?.pressed;input.rollRight||=pad.buttons[5]?.pressed;input.flare||=settings.modern&&pad.buttons[2]?.pressed;}
  input.x=THREE.MathUtils.clamp(input.x,-1,1);input.y=THREE.MathUtils.clamp(input.y,-1,1)*(settings.invert?-1:1);return input;
}

function initializeControls(){
  app.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='launch')launch();if(action==='help')showHelp();if(action==='settings')showSettings();if(action==='sound'){settings.sound=!settings.sound;audio.setEnabled(settings.sound);saveSettings();updateSoundButton();}if(action==='pause')pause();if(action==='resume')closeModal(true);if(action==='home')home();if(action==='close')closeModal(true);});
  document.addEventListener('keydown',e=>{if(e.code==='Tab'&&modalKind){const list=Array.from($('modal').querySelectorAll('button,select,input'));const index=list.indexOf(document.activeElement);const next=(index+(e.shiftKey?-1:1)+list.length)%list.length;e.preventDefault();list[next]?.focus();return;}if(e.code==='Escape'){e.preventDefault();if(modalKind)closeModal(true);else if(game.state.status==='playing')pause();return;}if(e.code==='Enter'&&game.state.status==='attract'&&!modalKind){launch();return;}if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&game.state.status==='playing')e.preventDefault();if(e.code==='Tab'&&game.state.status==='playing')game.cycleTarget();keys.add(e.code);});
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();touch.x=touch.y=0;for(const k of Object.keys(held))held[k]=false;if(game.state.status==='playing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.state.status==='playing')pause();});
  for(const button of document.querySelectorAll('[data-hold]')){button.addEventListener('pointerdown',e=>{e.preventDefault();held[button.dataset.hold]=true;button.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>held[button.dataset.hold]=false);}
  const stick=$('touch-stick');const move=e=>{const rect=stick.getBoundingClientRect();touch.x=THREE.MathUtils.clamp((e.clientX-rect.left-rect.width/2)/(rect.width*.4),-1,1);touch.y=THREE.MathUtils.clamp(-(e.clientY-rect.top-rect.height/2)/(rect.height*.4),-1,1);};stick.addEventListener('pointerdown',e=>{stick.setPointerCapture(e.pointerId);move(e);});stick.addEventListener('pointermove',e=>{if(stick.hasPointerCapture(e.pointerId))move(e);});for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,()=>touch.x=touch.y=0);
}

function clearModels(){for(const [id,m]of enemyMeshes){scene.remove(m);enemyPool.push(m);}enemyMeshes.clear();for(const m of projectileMeshes.values())recycleProjectileMesh(m);projectileMeshes.clear();effects.clear();}
function launch(){closeModal(false);clearModels();keys.clear();game.start();cameraInitialized=false;app.classList.add('playing');currentStatus='playing';audio.start();radio('敵編隊が接近中。照準を合わせ、ロック後に J で発射。',6);stageToast(1,game.state.stageName);}
function home(){closeModal(false);clearModels();game.reset();app.classList.remove('playing','paused');currentStatus='attract';radioUntil=toastUntil=0;cameraInitialized=false;}
function pause(){game.setPaused(true);keys.clear();modalKind='pause';showModal(`<div class="eyebrow">FLIGHT ON HOLD</div><h2>PAUSED</h2><p class="modal-copy">戦場は、あなたの帰還を待っている。</p><button class="primary" data-action="resume">飛行を再開 ${arrow}</button><button class="secondary" data-action="settings">設定</button><button class="secondary" data-action="help">操作方法</button><button class="secondary" data-action="home">タイトルに戻る</button>`);}
function showModal(html){$('modal').innerHTML=`<section class="modal" role="dialog" aria-modal="true" tabindex="-1"><button class="modal-close" data-action="close" aria-label="閉じる">×</button>${html}</section>`;$('modal').hidden=false;$('modal').querySelector('.modal').focus();}
function closeModal(resume){keys.clear();$('modal').hidden=true;const previous=modalKind;modalKind=null;if(resume&&game?.state.status==='paused')game.setPaused(false);if((previous==='debrief')&&resume)home();}
function showHelp(){if(game.state.status==='playing')game.setPaused(true);modalKind='help';showModal(`<div class="eyebrow">FLIGHT MANUAL</div><h2>TAKE CONTROL</h2><p class="modal-copy">敵の前に照準を重ねると自動ロック。FIREが点灯したらミサイルを発射。迫る攻撃は大きな旋回と速度調整で回避しよう。</p><div class="controls-grid"><span>操縦 / 移動</span><kbd>W A S D / ↑ ← ↓ →</kbd><span>機銃（弾数無制限）</span><kbd>SPACE / A</kbd><span>ミサイル（ロック後）</span><kbd>J / B</kbd><span>アフターバーナー</span><kbd>SHIFT / RT</kbd><span>減速</span><kbd>K / LT</kbd><span>360度ロール（左 / 右）</span><kbd>Q / E · LB / RB</kbd><span>目標切り替え</span><kbd>TAB</kbd><span>一時停止</span><kbd>ESC</kbd></div><p class="status-note">原作のステージ進行を参考にした23ステージ。ミサイルと機体を補給しながら最終ステージで帰還。画面のHITはステージごとの撃墜数。総HITは機銃で1、ミサイルで2。ゲームパッドでは左スティックで操縦。</p><button class="primary" data-action="close">了解 ${arrow}</button>`);}
function saveSettings(){save('horizon-settings',settings);}
function updateSoundButton(){$('sound-label').textContent=settings.sound?'SOUND ON':'SOUND OFF';document.querySelector('.sound-button').classList.toggle('off',!settings.sound);}
function showSettings(){if(game.state.status==='playing')game.setPaused(true);modalKind='settings';showModal(`<div class="eyebrow">FLIGHT SYSTEMS</div><h2>SETTINGS</h2><div class="setting-row"><label for="quality">描画品質<small>解像度と描画負荷を調整</small></label><select id="quality"><option value="auto">自動調整</option><option value="high">高品質</option><option value="balanced">バランス</option></select></div><div class="setting-row"><label for="audio-enabled">効果音<small>エンジン・警報・戦闘音</small></label><input id="audio-enabled" type="checkbox" ${settings.sound?'checked':''}></div><div class="setting-row"><label for="invert">上下反転<small>操縦桿の上下操作を反転</small></label><input id="invert" type="checkbox" ${settings.invert?'checked':''}></div><div class="setting-row"><label for="modern">追加フレア<small>Fで敵ミサイルを誘導妨害（現代拡張）</small></label><input id="modern" type="checkbox" ${settings.modern?'checked':''}></div><p class="status-note">ハイスコアはこのブラウザに保存されます。<br>BEST SCORE &nbsp; ${best.score.toLocaleString()}</p><button class="primary" data-action="close">設定を適用 ${arrow}</button>`);$('quality').value=settings.quality;
  $('quality').addEventListener('change',e=>{settings.quality=e.target.value;const ratio=Math.min(devicePixelRatio,settings.quality==='balanced'?.75:settings.quality==='high'?1.5:1);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);renderer.shadowMap.enabled=settings.quality!=='balanced';const bloom=composer.passes.find(p=>p instanceof UnrealBloomPass);if(bloom)bloom.enabled=settings.quality!=='balanced';const fxaa=composer.passes.find(p=>p.material?.uniforms?.resolution);fxaa?.uniforms.resolution.value.set(1/(innerWidth*ratio),1/(innerHeight*ratio));saveSettings();});$('audio-enabled').addEventListener('change',e=>{settings.sound=e.target.checked;audio.setEnabled(settings.sound);updateSoundButton();saveSettings();});$('invert').addEventListener('change',e=>{settings.invert=e.target.checked;saveSettings();});$('modern').addEventListener('change',e=>{settings.modern=e.target.checked;saveSettings();});
}
function showDebrief(){if(!['victory','defeat'].includes(game.state.status))return;const s=game.state;best.score=Math.max(best.score,s.score);best.hits=Math.max(best.hits,s.totalHit);save('horizon-best',best);game.bestScore=best.score;modalKind='debrief';showModal(`<div class="eyebrow">${s.status==='victory'?'CARRIER RECOVERY COMPLETE':'FLIGHT RECORD'}</div><h2>${s.status==='victory'?'MISSION COMPLETE':'GAME OVER'}</h2><p class="modal-copy">${s.status==='victory'?'全23ステージを突破。機体は無事帰還した。':'機体を失った。次の出撃に、この経験を。'}</p><div class="debrief-stats"><div class="debrief-stat"><small>SCORE</small><strong>${s.score.toLocaleString()}</strong></div><div class="debrief-stat"><small>TOTAL HIT</small><strong>${s.totalHit}</strong></div><div class="debrief-stat"><small>STAGE REACHED</small><strong>${String(s.stage).padStart(2,'0')} / 23</strong></div><div class="debrief-stat"><small>BEST SCORE</small><strong>${best.score.toLocaleString()}</strong></div></div><button class="primary" data-action="launch">もう一度出撃 ${arrow}</button><button class="secondary" data-action="home">タイトルに戻る</button>`);}

requestAnimationFrame(()=>requestAnimationFrame(initialize));
