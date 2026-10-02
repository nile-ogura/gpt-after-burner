import * as THREE from 'three';
import { createSky } from './sky.js';

const fract = x => x - Math.floor(x);
function hash(x, z) { return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123); }
function noise(x, z) {
  const a = Math.floor(x), b = Math.floor(z), u = x - a, v = z - b;
  const s = u * u * (3 - 2 * u), t = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a, b), hash(a + 1, b), s), THREE.MathUtils.lerp(hash(a, b + 1), hash(a + 1, b + 1), s), t);
}
function periodicNoise(x,z,period){
  const a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b;
  const s=u*u*(3-2*u),t=v*v*(3-2*v);
  const at=(i,j)=>hash(((i%period)+period)%period,((j%period)+period)%period);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(a,b),at(a+1,b),s),THREE.MathUtils.lerp(at(a,b+1),at(a+1,b+1),s),t);
}
function fbm(x, z) { let sum = 0, amp = .5; for (let i = 0; i < 6; i++) { sum += noise(x, z) * amp; x = x * 2.04 + 17.2; z = z * 2.04 + 7.1; amp *= .5; } return sum; }

function makeWaterNoiseTexture(){
  const size=256,heights=new Float32Array(size*size),data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)heights[y*size+x]=
    periodicNoise(x/size*8,y/size*8,8)*.44+periodicNoise(x/size*16,y/size*16,16)*.35+periodicNoise(x/size*32,y/size*32,32)*.21;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size])*7;
    const dy=(heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x])*7;
    const i=(y*size+x)*4;
    data[i]=Math.round(THREE.MathUtils.clamp(.5+dx*.5,0,1)*255);
    data[i+1]=Math.round(THREE.MathUtils.clamp(.5+dy*.5,0,1)*255);
    data[i+2]=Math.round(heights[y*size+x]*255);data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;
  texture.colorSpace=THREE.NoColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
  return texture;
}

function makeOcean() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {time:{value:0}, scroll:{value:0}, windTexture:{value:makeWaterNoiseTexture()}, sunDirection:{value:new THREE.Vector3(-.62,.16,-.76).normalize()}},
    vertexShader: `uniform float time; varying vec3 vWorld; void main(){vec3 p=position; p.z+=sin(p.x*.0008+time*.28)*.35+sin(p.y*.0016+time*.33)*.23; vec4 world=modelMatrix*vec4(p,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform float time; uniform float scroll; uniform sampler2D windTexture; uniform vec3 sunDirection; varying vec3 vWorld;
      void main(){vec2 world=vec2(vWorld.x,vWorld.z-scroll);
        float distance=length(cameraPosition-vWorld);
        float detailFade=1.0-smoothstep(1500.0,8000.0,distance);
        // World distances set wave size. Different scales/directions avoid the
        // regular sine rings that previously extended all the way to the horizon.
        vec2 uv=mat2(.94,-.34,.34,.94)*(world*vec2(.0037,.0043))+vec2(time*.0032,-time*.0041);
        vec3 wind=texture2D(windTexture,uv).rgb;
        vec2 fineUV=mat2(.8,-.6,.6,.8)*(world*vec2(.012,.016))+vec2(-time*.008,time*.011);
        vec2 fineWind=texture2D(windTexture,fineUV).rg*2.0-1.0;
        // Shorter wind waves dominate the middle distance. The broad sample is
        // restrained and rotated, avoiding long horizontal reflection bands.
        vec2 ripples=(wind.rg*2.0-1.0)*.32+fineWind*.78*detailFade;
        vec3 n=normalize(vec3(ripples.x*.62,1.0,ripples.y*.62));
        vec3 v=normalize(cameraPosition-vWorld); float fres=pow(1.0-max(0.0,dot(n,v)),4.0);
        vec3 base=mix(vec3(.018,.095,.115),vec3(.13,.28,.33),fres*.85);
        vec3 halfVec=normalize(v+sunDirection); float spec=pow(max(0.0,dot(n,halfVec)),180.0);
        base+=vec3(1.0,.69,.35)*spec*1.25;
        float shimmer=pow(max(0.0,dot(reflect(-sunDirection,n),v)),32.0); base+=vec3(.42,.33,.19)*shimmer*.25;
        base+=vec3(.08,.13,.15)*smoothstep(.78,.95,wind.b)*.17;
        float fog=1.0-exp(-pow(distance/10000.0,1.4));
        base=mix(base,vec3(.48,.60,.64),fog);
        gl_FragColor=vec4(base,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(48000,48000,64,64),mat);
  ocean.rotation.x=-Math.PI/2; ocean.position.z=-10000;
  return ocean;
}

function makeTerrainField(side,seed){
  const period=36000,nx=100,nz=424,cols=nx+1,minX=-10000/3;
  const dx=200/3,dz=period/nz,count=cols*nz;
  const heights=new Float32Array(count),base=new Float32Array(count);
  const erosion=new Float32Array(count),deposits=new Float32Array(count);
  const at=(x,z)=>(((z%nz)+nz)%nz)*cols+Math.max(0,Math.min(nx,x));
  const coastAt=a=>-1940+Math.sin(a*3+seed)*360+Math.sin(a*9+seed*.6)*100;
  for(let row=0;row<nz;row++)for(let col=0;col<=nx;col++){
    const x=minX+col*dx,a=row*Math.PI*2/nz;
    const coastDistance=x*side-coastAt(a);
    const i=at(col,row);
    if(coastDistance<=0){base[i]=heights[i]=-10;continue;}
    // Warped, unequal mountain shoulders replace the regularly spaced gullies
    // and one broad Gaussian ridge. All longitudinal inputs remain periodic.
    const c=Math.cos(a),s=Math.sin(a);
    const warp=(noise(c*4.3+seed,s*4.3+seed*.37)-.5)*760;
    const p=(coastDistance+warp)*.00055;
    const mass=noise(p+c*3.2+seed,s*3.2+seed*.73);
    const n=noise(p*2.1+c*7.6+seed,s*7.6+seed*.31);
    const ridge=1-Math.sqrt(Math.pow(n*2-1,2)+.0225);
    const secondary=noise(p*4.2+c*13.7+seed,s*13.7+seed*.52);
    const foot=220+noise(c*5.2+seed,s*5.2+seed*.41)*720;
    const faceWidth=330+noise(c*3.7+seed*.33,s*3.7+seed)*700;
    const face=THREE.MathUtils.smoothstep(coastDistance,foot,foot+faceWidth);
    const shore=THREE.MathUtils.smoothstep(coastDistance,0,450);
    const foothill=THREE.MathUtils.smoothstep(coastDistance,0,900)*(60+mass*125+secondary*80);
    const rockMass=(ridge*.70+mass*.30)*(850+mass*620)+secondary*150;
    base[i]=heights[i]=-10+shore*(foothill+face*rockMass);
  }
  const sample=(data,x,z,result)=>{
    const col=Math.max(0,Math.min(nx-1,Math.floor(x))),row=Math.floor(z);
    const u=THREE.MathUtils.clamp(x-col,0,1),v=z-row;
    const a=data[at(col,row)],b=data[at(col+1,row)],c=data[at(col,row+1)],d=data[at(col+1,row+1)];
    const value=(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
    if(result){result.h=value;result.gx=(b-a)*(1-v)+(d-c)*v;result.gz=(c-a)*(1-u)+(d-b)*u;}
    return value;
  };
  const addDeposit=(x,z,amount)=>{
    const col=Math.floor(x),row=Math.floor(z),u=x-col,v=z-row;
    for(const [cx,cz,weight] of [[col,row,(1-u)*(1-v)],[col+1,row,u*(1-v)],[col,row+1,(1-u)*v],[col+1,row+1,u*v]]){
      const i=at(cx,cz);
      if(base[i]<=0)continue;
      const moved=Math.min(amount*weight,Math.max(0,90-deposits[i]));
      heights[i]+=moved;deposits[i]+=moved;
    }
  };
  const brush=[];
  let totalWeight=0;
  for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++){
    const weight=Math.max(0,2.6-Math.hypot(x,z));
    if(weight){brush.push({x,z,weight});totalWeight+=weight;}
  }
  for(const point of brush)point.weight/=totalWeight;
  const state={h:0,gx:0,gz:0};
  // Finite startup-only sediment transport. Continuous downhill motion gives
  // unequal, curved tributaries; there is no repeated 3km drainage cell.
  for(let drop=0;drop<10000;drop++){
    let x=1+hash(drop+17,seed*11)*(nx-2),z=hash(drop+71,seed*7)*nz;
    if(sample(base,x,z)<120)continue;
    let directionX=0,directionZ=0,water=1,speed=1,sediment=0;
    for(let life=0;life<90;life++){
      sample(heights,x,z,state);
      directionX=directionX*.18-state.gx/dx*.82;
      directionZ=directionZ*.18-state.gz/dz*.82;
      const length=Math.hypot(directionX,directionZ);
      if(length<1e-5)break;
      directionX/=length;directionZ/=length;
      const nextX=x+directionX,nextZ=((z+directionZ*dx/dz)%nz+nz)%nz;
      if(nextX<1||nextX>=nx-1||sample(base,nextX,nextZ)<=0)break;
      const nextHeight=sample(heights,nextX,nextZ),delta=nextHeight-state.h;
      const capacity=Math.max(-delta,.8)*speed*water*.8;
      if(delta>0||sediment>capacity){
        const amount=delta>0?Math.min(delta,sediment):(sediment-capacity)*.18;
        addDeposit(x,z,amount);sediment-=amount;
      }else{
        const amount=Math.min((capacity-sediment)*.16,-delta*.5,7);
        const col=Math.floor(x),row=Math.floor(z);
        for(const point of brush){
          const i=at(col+point.x,row+point.z);
          if(base[i]<30)continue;
          const limit=Math.min(340,base[i]*.43);
          const removed=Math.min(amount*point.weight,Math.max(0,limit-erosion[i]));
          heights[i]-=removed;erosion[i]+=removed;sediment+=removed;
        }
      }
      speed=Math.sqrt(Math.max(.2,speed*speed-delta*.002));water*=.975;
      x=nextX;z=nextZ;
    }
  }
  // A restrained talus relaxation prevents narrow grid peaks and transports
  // material into adjacent depressions without quantized rock terraces.
  for(let pass=0;pass<4;pass++){
    const change=new Float32Array(count);
    for(let row=0;row<nz;row++)for(let col=1;col<nx;col++){
      const i=at(col,row);
      if(base[i]<30)continue;
      for(const [cx,cz,distance] of [[col+1,row,dx],[col,row+1,dz]]){
        const j=at(cx,cz);
        if(base[j]<30)continue;
        const difference=heights[i]-heights[j],excess=Math.abs(difference)-distance*1.35;
        if(excess>0){const amount=Math.min(excess*.12,18)*Math.sign(difference);change[i]-=amount;change[j]+=amount;}
      }
    }
    for(let i=0;i<count;i++)if(base[i]>0){heights[i]+=change[i];if(change[i]>0)deposits[i]+=change[i];}
  }
  // Resolve shapes at this mesh's physical cell scale. This weak, periodic
  // smoothing keeps narrow erosion features from becoming isolated spikes or
  // large high/low index-buffer silhouette differences; broad cliffs remain.
  for(let pass=0;pass<3;pass++){
    const next=new Float32Array(count);
    for(let row=0;row<nz;row++)for(let col=0;col<=nx;col++){
      const i=at(col,row);
      if(base[i]<=0){next[i]=-10;continue;}
      next[i]=heights[i]*.5
        +(heights[at(col-1,row)]+heights[at(col+1,row)]+heights[at(col,row-1)]+heights[at(col,row+1)])*.1
        +(heights[at(col-1,row-1)]+heights[at(col+1,row-1)]+heights[at(col-1,row+1)]+heights[at(col+1,row+1)])*.025;
    }
    heights.set(next);
  }
  return (x,z,details)=>{
    const along=((z%period)+period)%period,a=along*Math.PI*2/period;
    const coast=-1940+Math.sin(a*3+seed)*360+Math.sin(a*9+seed*.6)*100;
    const coastDistance=x*side-coast;
    if(details){details.channel=0;details.sediment=0;details.coastDistance=coastDistance;}
    if(coastDistance<=0)return -10;
    const u=(x-minX)/dx,v=along/dz,height=Math.max(-10,sample(heights,u,v));
    if(details){
      details.channel=THREE.MathUtils.smoothstep(sample(erosion,u,v),3,70);
      details.sediment=THREE.MathUtils.smoothstep(sample(deposits,u,v),2,35);
    }
    return height;
  };
}

function terrain(side, offset, seed, rockTexture, heightAt=makeTerrainField(side,seed)) {
  const width=6400, depth=18000, nx=96, nz=212;
  const geo=new THREE.PlaneGeometry(width,depth,nx,nz); geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,colors=new Float32Array(pos.count*3),exposure=new Float32Array(pos.count);
  const channels=new Float32Array(pos.count),sediments=new Float32Array(pos.count),reliefs=new Float32Array(pos.count);
  const details={channel:0,sediment:0,coastDistance:0},c=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i)+offset;
    pos.setY(i,heightAt(x,z,details));channels[i]=details.channel;sediments[i]=details.sediment;
  }
  const normal=geo.attributes.normal;
  const cols=nx+1,normalVector=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    const col=i%cols,row=Math.floor(i/cols),x=pos.getX(i),z=pos.getZ(i);
    const leftX=col?pos.getX(i-1):2*x-pos.getX(i+1);
    const rightX=col<nx?pos.getX(i+1):2*x-pos.getX(i-1);
    const beforeZ=row?pos.getZ(i-cols):2*z-pos.getZ(i+cols);
    const afterZ=row<nz?pos.getZ(i+cols):2*z-pos.getZ(i-cols);
    const left=col?pos.getY(i-1):Math.fround(heightAt(leftX,z+offset));
    const right=col<nx?pos.getY(i+1):Math.fround(heightAt(rightX,z+offset));
    const before=row?pos.getY(i-cols):Math.fround(heightAt(x,beforeZ+offset));
    const after=row<nz?pos.getY(i+cols):Math.fround(heightAt(x,afterZ+offset));
    // Central differences use ghost samples across tile edges, so each tile
    // has the same normals instead of an independent one-sided triangle seam.
    normalVector.set(-(right-left)/(rightX-leftX),1,-(after-before)/(afterZ-beforeZ)).normalize();
    normal.setXYZ(i,normalVector.x,normalVector.y,normalVector.z);
    reliefs[i]=THREE.MathUtils.smoothstep(Math.abs(pos.getY(i)-(left+right+before+after)*.25),1.5,18);
  }
  pos.needsUpdate=true;normal.needsUpdate=true;
  const vegetationColor=new THREE.Color(.065,.21,.088);
  const dryStone=new THREE.Color(.42,.43,.40);
  const screeColor=new THREE.Color(.31,.27,.20);
  const valleySoil=new THREE.Color(.052,.12,.052);
  const sand=new THREE.Color(.46,.425,.33);
  const wetShore=new THREE.Color(.12,.175,.16);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i)+offset,height=pos.getY(i);
    const a=(((z%36000)+36000)%36000)*Math.PI*2/36000;
    const patch=noise(x*.0018+Math.cos(a)*13+seed,Math.sin(a)*13+seed*.3);
    const broad=noise(x*.00065+Math.cos(a)*4,Math.sin(a)*4+seed);
    const slope=1-normal.getY(i);
    const localRelief=reliefs[i];
    const drainage=THREE.MathUtils.smoothstep(channels[i],.12,.65);
    const heightSupport=THREE.MathUtils.smoothstep(height,30,110)
      *(1-THREE.MathUtils.smoothstep(height,1000,1500));
    const patchWoods=THREE.MathUtils.smoothstep(patch,.38,.65)
      *(1-THREE.MathUtils.smoothstep(slope,.22,.48));
    const valleyWoods=drainage*(1-THREE.MathUtils.smoothstep(slope,.31,.58));
    const vegetation=heightSupport*Math.max(patchWoods*.70,valleyWoods*.95);
    const exposedRock=Math.max(THREE.MathUtils.smoothstep(slope,.08,.36)*(.30+localRelief*.55+broad*.15),
      THREE.MathUtils.smoothstep(height,1000,1450)*localRelief*.55)*(1-vegetation);
    const scree=Math.max(sediments[i]*.85,THREE.MathUtils.smoothstep(height,80,200)
      *(1-THREE.MathUtils.smoothstep(height,700,1100))
      *THREE.MathUtils.smoothstep(slope,.07,.21)
      *(1-THREE.MathUtils.smoothstep(slope,.28,.52))*(.3+broad*.4));
    // Macro colors are terrain materials, not baked lighting. Darker soil and
    // vegetated drainage contrast with pale exposed faces and warm talus fans.
    c.setRGB(.20+patch*.055,.17+patch*.055,.11+patch*.05);
    c.lerp(screeColor,scree*(1-vegetation)*.7);
    c.lerp(dryStone,exposedRock);
    c.lerp(vegetationColor,vegetation);
    c.lerp(valleySoil,drainage*vegetation*.17);
    if(height<60)c.lerp(sand,1-THREE.MathUtils.smoothstep(height,15,60));
    if(height<14)c.lerp(wetShore,1-THREE.MathUtils.smoothstep(height,-1,14));
    c.addScalar((noise(height*.006+patch*3,Math.cos(a)*11+seed)-.5)*.028*(1-vegetation));
    colors.set([c.r,c.g,c.b],i*3);
    exposure[i]=THREE.MathUtils.clamp(exposedRock*(1-vegetation*.8),0,1);
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.setAttribute('rockExposure',new THREE.BufferAttribute(exposure,1));
  geo.computeBoundingBox();geo.computeBoundingSphere();
  // Lower resolution reuses the exact same vertex attributes. Only the index
  // buffer changes: no cloned height field, added meshes or LOD scene objects.
  const lowGeo=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(geo.attributes))lowGeo.setAttribute(name,attribute);
  const lowIndices=[];
  for(let row=0;row<nz;row+=2)for(let col=0;col<nx;col+=2){
    const a=row*cols+col,b=a+2,c=a+cols*2,d=c+2;
    lowIndices.push(a,c,b,b,c,d);
  }
  lowGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(lowIndices),1));
  lowGeo.boundingBox=geo.boundingBox;lowGeo.boundingSphere=geo.boundingSphere;
  // Rough rock is predominantly diffuse. Removing the repeated bump pattern and
  // unnecessary environment BRDF/shadow taps also reduces software-GPU work.
  const mat=new THREE.MeshLambertMaterial({vertexColors:true,map:rockTexture});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=`attribute float rockExposure; varying float vRockExposure;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvRockExposure=rockExposure;');
    const mapChunk=THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`
      float mineralLuma=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));
      vec3 mineralDetail=vec3(clamp(mineralLuma/.29,.45,1.6));
      // Preserve the original map. Exposed rock uses its mineral contrast;
      // soil and vegetation retain its original dark color multiplication.
      sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,mineralDetail,vRockExposure*.65);
      diffuseColor *= sampledDiffuseColor;`);
    shader.fragmentShader=`varying float vRockExposure;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>',mapChunk);
  };
  mat.customProgramCacheKey=()=> 'coastal-geology-contrast-v2';
  mat.userData.landscape={macroVertexMaterials:true,rockPhotoSamples:1,localExposureAttribute:'rockExposure'};
  const mesh=new THREE.Mesh(geo,mat); mesh.position.set(side*4700,0,offset);
  mesh.name=`Coast terrain ${side} ${offset}`;
  mesh.terrainHighGeometry=geo;mesh.terrainLowGeometry=lowGeo;
  mesh.userData.terrain={side,sourceOffset:offset,width,depth,columns:cols,rows:nz+1,
    highIndexCount:geo.index.count,lowIndexCount:lowGeo.index.count,lod:'high',materialRevision:'geology-contrast-v2',macroRevision:'eroded-coast-v3'};
  return mesh;
}

function biomeGroundHeight(x,z){
  const a=(((z%36000)+36000)%36000)*Math.PI*2/36000;
  return 4+noise(x*.00012+Math.cos(a)*3,Math.sin(a)*3+19)*8
    +noise(x*.00020+Math.cos(a)*5+7,Math.sin(a)*5)*4;
}

function biomeGround(offset,rockTexture){
  const width=48000,depth=18000,nx=16,nz=64,cols=nx+1;
  const high=new THREE.PlaneGeometry(width,depth,nx,nz);high.rotateX(-Math.PI/2);
  const pos=high.attributes.position,normal=high.attributes.normal,uv=high.attributes.uv;
  const canyonColors=new Float32Array(pos.count*3),canyon17Colors=new Float32Array(pos.count*3),forestColors=new Float32Array(pos.count*3);
  const direction=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i)+offset;
    pos.setY(i,biomeGroundHeight(x,z));
    // The shared rock map repeats over 6.4km on the coast. Expanded UVs keep
    // its same 120m physical scale over this complete 48km land floor.
    uv.setX(i,uv.getX(i)*width/6400);
    const a=(((z%36000)+36000)%36000)*Math.PI*2/36000;
    const patch=noise(x*.0004+Math.cos(a)*8,Math.sin(a)*8+31);
    canyonColors.set([.52+patch*.10,.36+patch*.07,.17+patch*.045],i*3);
    canyon17Colors.set([.25+patch*.06,.30+patch*.065,.11+patch*.04],i*3);
    forestColors.set([.085+patch*.035,.16+patch*.055,.045+patch*.035],i*3);
  }
  for(let i=0;i<pos.count;i++){
    const col=i%cols,row=Math.floor(i/cols),x=pos.getX(i),z=pos.getZ(i);
    const leftX=col?pos.getX(i-1):x-width/nx,rightX=col<nx?pos.getX(i+1):x+width/nx;
    const beforeZ=row?pos.getZ(i-cols):z-depth/nz,afterZ=row<nz?pos.getZ(i+cols):z+depth/nz;
    const left=col?pos.getY(i-1):Math.fround(biomeGroundHeight(leftX,z+offset));
    const right=col<nx?pos.getY(i+1):Math.fround(biomeGroundHeight(rightX,z+offset));
    const before=row?pos.getY(i-cols):Math.fround(biomeGroundHeight(x,beforeZ+offset));
    const after=row<nz?pos.getY(i+cols):Math.fround(biomeGroundHeight(x,afterZ+offset));
    direction.set(-(right-left)/(rightX-leftX),1,-(after-before)/(afterZ-beforeZ)).normalize();
    normal.setXYZ(i,direction.x,direction.y,direction.z);
  }
  const canyonAttribute=new THREE.BufferAttribute(canyonColors,3),canyon17Attribute=new THREE.BufferAttribute(canyon17Colors,3),forestAttribute=new THREE.BufferAttribute(forestColors,3);
  high.setAttribute('color',canyonAttribute);high.computeBoundingBox();high.computeBoundingSphere();
  const low=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(high.attributes))low.setAttribute(name,attribute);
  const indices=[];
  for(let row=0;row<nz;row+=2)for(let col=0;col<nx;col+=2){const a=row*cols+col,b=a+2,c=a+cols*2,d=c+2;indices.push(a,c,b,b,c,d);}
  low.setIndex(new THREE.BufferAttribute(new Uint16Array(indices),1));low.boundingBox=high.boundingBox;low.boundingSphere=high.boundingSphere;
  const mesh=new THREE.Mesh(high,new THREE.MeshLambertMaterial({vertexColors:true,map:rockTexture}));
  mesh.name=`Biome ground ${offset}`;mesh.position.z=offset;mesh.visible=false;
  mesh.biomeGroundHighGeometry=high;mesh.biomeGroundLowGeometry=low;
  mesh.biomeGroundColors={canyon:canyonAttribute,canyon17:canyon17Attribute,forest:forestAttribute};
  mesh.userData.biomeGround={sourceOffset:offset,width,depth,columns:cols,rows:nz+1,period:36000,
    highIndexCount:high.index.count,lowIndexCount:low.index.count,lod:'high',biome:'canyon',
    heightMapping:'triangle-xz-u+v',minimumHeight:high.boundingBox.min.y,maximumHeight:high.boundingBox.max.y,
    horizontalCoverage:[-width/2,width/2],worldCoverage:{xMin:-width/2,xMax:width/2,zMin:offset-depth/2,zMax:offset+depth/2},dryFloor:true};
  return mesh;
}

function sampleGroundTriangle(ground,x,z,low=false){
  const {width,depth,columns,rows}=ground.userData.biomeGround;
  const nx=columns-1,nz=rows-1,step=low?2:1;
  const gx=THREE.MathUtils.clamp((x+width/2)/(width/nx),0,nx),gz=THREE.MathUtils.clamp((z+depth/2)/(depth/nz),0,nz);
  const col=Math.min(nx-step,Math.floor(gx/step)*step),row=Math.min(nz-step,Math.floor(gz/step)*step);
  const u=(gx-col)/step,v=(gz-row)/step,p=ground.biomeGroundHighGeometry.attributes.position;
  const a=row*columns+col,b=a+step,c=a+columns*step,d=c+step;
  return u+v<=1?p.getY(a)+(p.getY(b)-p.getY(a))*u+(p.getY(c)-p.getY(a))*v
    :p.getY(d)+(p.getY(c)-p.getY(d))*(1-u)+(p.getY(b)-p.getY(d))*(1-v);
}

function makeForestGeometry(){
  const lower=new THREE.IcosahedronGeometry(1,0),upper=new THREE.IcosahedronGeometry(1,0);
  lower.scale(.32,.26,.31);lower.translate(-.04,.57,.025);
  upper.scale(.235,.29,.24);upper.translate(.025,.76,-.015);
  const positions=[],normals=[];
  for(const geometry of [lower,upper]){positions.push(...geometry.attributes.position.array);normals.push(...geometry.attributes.normal.array);geometry.dispose();}
  const canopy=new THREE.BufferGeometry();canopy.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));canopy.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  canopy.computeBoundingBox();canopy.scale(1,1/canopy.boundingBox.max.y,1);canopy.computeBoundingBox();canopy.computeBoundingSphere();
  const trunk=new THREE.CylinderGeometry(.018,.024,.58,5,1,true);trunk.translate(0,.29,0);trunk.computeBoundingBox();trunk.computeBoundingSphere();
  return {canopy,trunk};
}

function createForest(grounds){
  const geometry=makeForestGeometry(),canopyMaterial=new THREE.MeshLambertMaterial({color:0xffffff}),trunkMaterial=new THREE.MeshLambertMaterial({color:0xffffff});
  const groups=[];
  for(const ground of grounds){
    const offset=ground.userData.biomeGround.sourceOffset,seed=offset===-5800?29:61,count=192;
    const canopy=new THREE.InstancedMesh(geometry.canopy,canopyMaterial,count),trunks=new THREE.InstancedMesh(geometry.trunk,trunkMaterial,count);
    canopy.name=`Forest canopy ${offset}`;trunks.name=`Forest trunks ${offset}`;canopy.visible=trunks.visible=false;
    const records=[],color=new THREE.Color(),matrix=new THREE.Object3D();
    // Interleaving sixteen unequal clusters leaves every cluster represented
    // when the low profile selects half the instances; no planted grid.
    for(let i=0;i<count;i++){
      const cluster=i%16,side=cluster%2?1:-1;
      const centerX=side*(600+hash(cluster+13,seed)*1450),centerZ=-7900+hash(cluster+27,seed*2)*15800;
      const x=side*THREE.MathUtils.clamp(Math.abs(centerX)+(hash(i+39,seed*3)-.5)*380,365,2200);
      const z=THREE.MathUtils.clamp(centerZ+(hash(i+71,seed*5)-.5)*1000,-8500,8500);
      const height=16+hash(i+83,seed*7)*22;
      const record={x,z,height,scaleX:.80+hash(i+91,seed)*.48,scaleZ:.80+hash(i+93,seed)*.48,rotation:hash(i+97,seed)*Math.PI*2,
        highY:sampleGroundTriangle(ground,x,z),lowY:sampleGroundTriangle(ground,x,z,true)};
      records.push(record);
      const variation=hash(i+101,seed*11);
      color.setRGB(.035+variation*.03,.105+variation*.055,.11+variation*.035);canopy.setColorAt(i,color);
      color.setRGB(.11+variation*.045,.071+variation*.025,.036+variation*.015);trunks.setColorAt(i,color);
    }
    const group={ground,canopy,trunks,records,low:null};
    group.setLow=low=>{
      if(group.low===low)return;group.low=low;
      let maxTop=0,minAbsX=Infinity,minFootError=0;
      const canopyBox=geometry.canopy.boundingBox;
      for(let i=0;i<records.length;i++){
        const r=records[i],y=low?r.lowY:r.highY;
        matrix.position.set(r.x,y,r.z);matrix.rotation.set(0,r.rotation,0);matrix.scale.set(r.height*r.scaleX,r.height,r.height*r.scaleZ);matrix.updateMatrix();
        canopy.setMatrixAt(i,matrix.matrix);trunks.setMatrixAt(i,matrix.matrix);
        maxTop=Math.max(maxTop,y+r.height);
        const extent=Math.max(Math.abs(canopyBox.min.x),Math.abs(canopyBox.max.x))*r.height*r.scaleX*Math.abs(Math.cos(r.rotation))
          +Math.max(Math.abs(canopyBox.min.z),Math.abs(canopyBox.max.z))*r.height*r.scaleZ*Math.abs(Math.sin(r.rotation));
        minAbsX=Math.min(minAbsX,Math.abs(r.x)-extent);
        const packed=trunks.instanceMatrix.array,at=i*16;
        minFootError=Math.max(minFootError,Math.abs(packed[at+13]-sampleGroundTriangle(ground,packed[at+12],packed[at+14],low)));
      }
      canopy.count=trunks.count=low?count/2:count;
      canopy.instanceMatrix.needsUpdate=trunks.instanceMatrix.needsUpdate=true;
      canopy.computeBoundingBox();canopy.computeBoundingSphere();trunks.computeBoundingBox();trunks.computeBoundingSphere();
      const metadata={sourceOffset:offset,highCount:count,lowCount:count/2,count:canopy.count,lod:low?'low':'high',maxTop,minAbsX,footError:minFootError,groundingTolerance:1e-5,grounded:true};
      canopy.userData.forest={...metadata,part:'canopy'};trunks.userData.forest={...metadata,part:'trunks'};
    };
    group.setLow(false);groups.push(group);
  }
  return {groups,geometry,canopyMaterial,trunkMaterial};
}

function makeRockTexture(){
  const size=512,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    const broad=periodicNoise(u*8,v*8,8);
    const warp=(broad-.5)*1.3;
    const rock=periodicNoise(u*16+warp,v*16-warp,16);
    const fine=periodicNoise(u*32,v*32,32),grain=periodicNoise(u*64,v*64,64);
    // This no-network fallback has mineral variation and sparse lichen only.
    // Thresholding a noise isoline produced huge smooth closed contour loops;
    // that fissure calculation has been removed completely.
    const lichen=THREE.MathUtils.smoothstep(periodicNoise(u*8+2.4,v*8+4.1,8),.65,.83)*.13;
    const value=166+broad*40+rock*24+(fine-.5)*30+(grain-.5)*8;
    const i=(y*size+x)*4;
    data[i]=Math.round(value*(1-lichen*.23));
    data[i+1]=Math.round(value*(1-lichen*.12));
    data[i+2]=Math.round(value*(1-lichen*.26));data[i+3]=255;
  }
  const tex=new THREE.DataTexture(data,size,size);tex.name='Neutral mineral albedo fallback';
  configureRockTexture(tex,size,size);tex.userData.fallback=true;tex.userData.ready=true;
  tex.userData.assetStatus='native-fallback';tex.needsUpdate=true;
  return tex;
}

function configureRockTexture(texture,width,height){
  const aspect=width/height;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  // 120m down each tile gives exactly 150 repeats at the shared 18km edge.
  // Its horizontal metric follows the image aspect ratio, not screen size.
  texture.repeat.set(6400/(120*aspect),18000/120);
  texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.userData.rockAlbedo={width,height,aspect,tileWidth:120*aspect,tileDepth:120};
}

function loadRockTexture(onLoad,onError){
  const sourceUrl=`${import.meta.env.BASE_URL}assets/terrain/coastal-rock-albedo-v1.png`;
  return new THREE.TextureLoader().load(sourceUrl,texture=>{
    texture.name='Original photographic coastal rock albedo';
    configureRockTexture(texture,texture.image.width,texture.image.height);
    Object.assign(texture.userData,{ready:true,assetStatus:'ready',fallback:false,sourceUrl,
      assetPath:'public/assets/terrain/coastal-rock-albedo-v1.png',
      originalPath:'/home/ogura/.codex/generated_images/01a0f828-c984-7da3-a8bc-6664390a77f3/exec-fc179bf0-c088-475f-91ba-88fd1691965d.png',
      generatedBy:'image_gen'});
    onLoad(texture);
  },undefined,onError);
}

function makeVaporTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128; const ctx=canvas.getContext('2d');
  const g=ctx.createRadialGradient(64,64,2,64,64,64); g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.4,'rgba(255,255,255,.17)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(canvas);
}

// The density and sunlight field are baked on a coarse CPU grid once, never in
// a full-screen fragment shader. Rendering samples one static RGBA texture.
// Canvas images can be exported to PNG and reused without changing placement.
function makeCloudTexture(seed){
  const nx=192,ny=128,nz=36,stride=nx*ny,size=stride*nz;
  const field=new Float32Array(size),formField=new Float32Array(size),lighting=new Float32Array(size);
  lighting.fill(.95);
  const prototypes=[
    [.25,.34,.22,.18,.20],[.49,.33,.25,.19,.23],[.74,.34,.22,.18,.20],
    [.14,.48,.11,.14,.15],[.32,.54,.18,.23,.21],[.52,.63,.20,.29,.24],
    [.72,.55,.18,.22,.21],[.85,.45,.10,.14,.15],
    [.39,.72,.10,.17,.14],[.64,.71,.12,.17,.15],[.23,.64,.10,.17,.14],
  ];
  const lobes=prototypes.map((s,i)=>({
    x:s[0]+(hash(i,seed)-.5)*.035,y:s[1]+(hash(i+13,seed)-.5)*.07,
    z:(hash(i+31,seed)-.5)*.16,rx:s[2],ry:s[3],rz:s[4],
  }));
  for(let iz=0;iz<nz;iz++)for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
    const x=ix/(nx-1),y=iy/(ny-1),z=iz/(nz-1)-.5;
    let d=-1;
    for(const s of lobes){
      const dx=(x-s.x)/s.rx,dy=(y-s.y)/s.ry,dz=(z-s.z)/s.rz;
      d=Math.max(d,1-dx*dx-dy*dy-dz*dz);
    }
    if(d<-.3)continue;
    const broad=(noise(x*12+z*5+seed,y*10-z*4)-.5)*.20;
    const shell=1-THREE.MathUtils.smoothstep(Math.abs(d),.10,.35);
    const edgeBreakup=(noise(x*32-z*7,y*29+z*8+seed)-.5)*.045*shell;
    const base=THREE.MathUtils.smoothstep(y,.12,.21);
    const i=iz*stride+iy*nx+ix;
    formField[i]=Math.max(0,d+broad)*4*base;
    field[i]=Math.max(0,d+broad+edgeBreakup)*4*base;
  }
  const sample=(data,x,y,z)=>{
    const gx=x*(nx-1),gy=y*(ny-1),gz=(z+.5)*(nz-1);
    if(gx<0||gx>=nx-1||gy<0||gy>=ny-1||gz<0||gz>=nz-1)return 0;
    const ix=Math.floor(gx),iy=Math.floor(gy),iz=Math.floor(gz),u=gx-ix,v=gy-iy,w=gz-iz;
    const i=iz*stride+iy*nx+ix;
    const a=(data[i]*(1-u)+data[i+1]*u)*(1-v)+(data[i+nx]*(1-u)+data[i+nx+1]*u)*v;
    const j=i+stride;
    const b=(data[j]*(1-u)+data[j+1]*u)*(1-v)+(data[j+nx]*(1-u)+data[j+nx+1]*u)*v;
    return a*(1-w)+b*w;
  };
  for(let iz=1;iz<nz-1;iz++)for(let iy=1;iy<ny-1;iy++)for(let ix=1;ix<nx-1;ix++){
    const i=iz*stride+iy*nx+ix;
    if(!field[i])continue;
    const x=ix/(nx-1),y=iy/(ny-1),z=iz/(nz-1)-.5;
    // Light follows the broad density form. Using the fine breakup's gradient
    // here turned every cloud surface into uniform embossed foam.
    const dx=(formField[i-1]-formField[i+1])*nx,dy=(formField[i-nx]-formField[i+nx])*ny,dz=(formField[i-stride]-formField[i+stride])*nz;
    const normalLength=Math.hypot(dx,dy,dz)||1;
    const direct=Math.max(0,(-dx*.58+dy*.75+dz*.31)/normalLength);
    let extinction=0;
    for(let step=1;step<=4;step++)extinction+=sample(field,x-step*.045,y+step*.058,z+step*.024)*.24;
    const transmission=Math.exp(-extinction);
    lighting[i]=THREE.MathUtils.clamp(.14+y*.12+(.16+direct*.70)*transmission,.17,1);
  }
  const w=768,h=512,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(w,h);
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
    const x=px/(w-1),y=1-py/(h-1);
    let alpha=0,r=0,g=0,b=0;
    for(let k=0;k<28;k++){
      const z=.49-k*.036,d=sample(field,x,y,z);
      if(d<.006)continue;
      const a=1-Math.exp(-d*.30),lit=sample(lighting,x,y,z),weight=(1-alpha)*a;
      r+=weight*(.30+lit*.70);g+=weight*(.37+lit*.61);b+=weight*(.47+lit*.47);alpha+=weight;
      if(alpha>.997)break;
    }
    const edge=THREE.MathUtils.smoothstep(x,0,.045)*THREE.MathUtils.smoothstep(1-x,0,.045);
    const i=(py*w+px)*4;
    if(alpha>0){
      // Restrained, low-frequency detail is confined to the translucent lit
      // upper fringe; the opaque interior retains coherent volume lighting.
      const fringe=(1-THREE.MathUtils.smoothstep(alpha,.50,.94))*THREE.MathUtils.smoothstep(y,.38,.80);
      const detail=(noise(x*32+seed,y*36)-.5)*.012*fringe;
      pixels.data[i]=Math.round(THREE.MathUtils.clamp(r/alpha+detail,0,1)*255);
      pixels.data[i+1]=Math.round(THREE.MathUtils.clamp(g/alpha+detail,0,1)*255);
      pixels.data[i+2]=Math.round(THREE.MathUtils.clamp(b/alpha+detail,0,1)*255);
      pixels.data[i+3]=Math.round(alpha*edge*255);
    }else{
      // Transparent texels retain a bright fringe color; mip/linear filtering
      // must not bleed black into the illuminated cloud silhouette.
      pixels.data[i]=240;pixels.data[i+1]=247;pixels.data[i+2]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.userData.seed=seed;tex.userData.ready=true;
  return tex;
}

function loadCloudTexture(seed){
  const texture=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/clouds/${seed}.png`,
    loaded=>{loaded.userData.ready=true;});
  texture.colorSpace=THREE.SRGBColorSpace;texture.userData.seed=seed;texture.userData.ready=false;
  return texture;
}

export function createEnvironment(scene, renderer) {
  const sky=createSky();const ocean=makeOcean(); scene.add(sky,ocean);
  const rockTexture=makeRockTexture();
  const fields=new Map([-1,1].map(side=>[side,makeTerrainField(side,side*5+11)]));
  const shore=[];for(let i=0;i<2;i++)for(const side of [-1,1]){const m=terrain(side,-5800-i*18000,side*5+11,rockTexture,fields.get(side));scene.add(m);shore.push(m);}
  const grounds=[-5800,-23800].map(offset=>biomeGround(offset,rockTexture));for(const ground of grounds)scene.add(ground);
  const forest=createForest(grounds);for(const group of forest.groups)scene.add(group.canopy,group.trunks);
  let environmentDisposed=false;
  rockTexture.userData.ready=false;rockTexture.userData.assetStatus='photo-loading';
  const photoRockTexture=loadRockTexture(texture=>{
    if(environmentDisposed){texture.dispose();return;}
    for(const mesh of [...shore,...grounds])mesh.material.map=texture;
  },()=>{rockTexture.userData.loadFailed=true;rockTexture.userData.ready=true;rockTexture.userData.assetStatus='photo-failed-native-fallback';});
  scene.fog=new THREE.FogExp2(0x829faf,.000068);
  const sun=new THREE.DirectionalLight(0xffe1bc,2.3);sun.position.set(-600,900,-900);scene.add(sun);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-26;sun.shadow.camera.right=26;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=10;sun.shadow.camera.far=320;sun.shadow.bias=-.00015;sun.shadow.normalBias=.03;scene.add(sun.target);
  const fill=new THREE.HemisphereLight(0xb2d6f4,0x253e35,.85);scene.add(fill);
  const bounce=new THREE.DirectionalLight(0x88b7d0,.38);bounce.position.set(500,200,500);scene.add(bounce);
  // Real sky illumination for the physical aircraft materials.
  const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileCubemapShader();
  const envScene=new THREE.Scene();envScene.add(sky.clone());
  const skyTarget=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType});
  const cubeCamera=new THREE.CubeCamera(1,30000,skyTarget);cubeCamera.update(renderer,envScene);
  let env=pmrem.fromCubemap(skyTarget.texture);scene.environment=env.texture;scene.environmentIntensity=.65;scene.background=skyTarget.texture;sky.visible=false;pmrem.dispose();
  const cloudLayers=[];
  // Ordinary startup uses the independently reviewed photographic banks.
  // Procedural regeneration and seed comparison remain development QA options.
  const params=new URLSearchParams(window.location.search);
  const seedClouds=import.meta.env.DEV&&params.has('qa')&&(params.has('seedClouds')||params.has('bakeClouds'));
  const rebake=seedClouds&&params.has('bakeClouds');
  const cloudTextures=seedClouds?[31,73,107].map(seed=>rebake?makeCloudTexture(seed):loadCloudTexture(seed)):[];
  // The existing ?qa&cloudPhoto capture URL remains valid with this default.
  const cloudPhoto=!seedClouds;
  const photoTextures=cloudPhoto?['cumulus-photo-v2','cumulus-congestus-v1','cumulus-wispy-v1'].map(loadCloudTexture):[];
  const banks=[
    [-3400,1800,-6500,4900,3200,0], [4400,2200,-8700,6200,3800,1],
    [500,3400,-5600,6500,4000,2], [-5100,2800,-11600,7000,4100,1],
    [2200,1700,-14700,8000,3300,0], [8300,2900,-15800,7100,4000,2],
    [-9600,2900,-20100,8300,3900,2], [1200,2450,-22100,10500,4200,1],
    [9200,3500,-23900,9200,4700,0],
  ];
  const cloudGeometry=cloudPhoto?new THREE.PlaneGeometry(1,1):null;
  const cloudFacing=new THREE.Vector3(0,230,0);
  for(let i=0;i<banks.length;i++){
    const [x,y,z,width,height,texture]=banks[i];
    const usePhoto=cloudPhoto;
    const map=usePhoto?photoTextures[texture]:cloudTextures[texture];
    const properties={map,color:0xffffff,transparent:true,opacity:.98,alphaTest:.016,depthWrite:false,fog:true};
    const bank=usePhoto?new THREE.Mesh(cloudGeometry,new THREE.MeshBasicMaterial({...properties,side:THREE.DoubleSide,forceSinglePass:true}))
      :new THREE.Sprite(new THREE.SpriteMaterial(properties));
    bank.name=`Cloud bank ${i+1}`;
    bank.visible=map.userData.ready;
    bank.position.set(x,y,z);bank.scale.set(width,usePhoto?width*.5:height,1);
    // World-up cards roll with the horizon rather than staying upright on screen.
    if(usePhoto)bank.lookAt(cloudFacing);
    scene.add(bank);cloudLayers.push(bank);
  }
  let cloudEnvironmentBaked=false;
  const bakeCloudEnvironment=()=>{
    const bakeScene=new THREE.Scene();
    bakeScene.fog=scene.fog.clone();
    const bakeSky=sky.clone();bakeSky.visible=true;bakeScene.add(bakeSky);
    const target=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType});
    const camera=new THREE.CubeCamera(1,30000,target);camera.position.set(0,230,0);
    const quadGeometry=new THREE.PlaneGeometry(1,1),quadMaterials=[];
    for(const sprite of cloudLayers){
      const material=new THREE.MeshBasicMaterial({map:sprite.material.map,color:sprite.material.color.clone(),transparent:true,
        opacity:sprite.material.opacity,alphaTest:sprite.material.alphaTest,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,fog:true});
      quadMaterials.push(material);
      const quad=new THREE.Mesh(quadGeometry,material);
      quad.position.copy(sprite.position);quad.scale.copy(sprite.scale);quad.lookAt(camera.position);
      bakeScene.add(quad);
    }
    // Fixed quads give all six cube faces one coherent cloud orientation.
    // Camera-facing Sprites would turn independently for each cube face.
    const generator=new THREE.PMREMGenerator(renderer);
    try{
      camera.update(renderer,bakeScene);
      const nextEnvironment=generator.fromCubemap(target.texture);
      nextEnvironment.texture.userData.cloudEnvironmentBaked=true;
      nextEnvironment.texture.userData.cloudBanks=cloudLayers.length;
      nextEnvironment.texture.userData.reflectionStatic=true;
      scene.environment=nextEnvironment.texture;
      env.dispose();env=nextEnvironment;
      cloudEnvironmentBaked=true;
    }finally{
      generator.dispose();target.dispose();quadGeometry.dispose();for(const material of quadMaterials)material.dispose();
      bakeScene.clear();
    }
  };
  let scroll=0;
  return {
    update(dt,{time=0,speed=950,stage=1,biome='coast',player={x:0,y:230,z:0}}={}){
      const advance=speed/3.6*dt;scroll+=advance;
      sky.material.uniforms.time.value=time; ocean.material.uniforms.time.value=time;ocean.material.uniforms.scroll.value=scroll;
      const lowTerrain=renderer.getPixelRatio()<=.8;
      const dryGround=biome==='canyon'||biome==='forest',groundVariant=biome==='forest'?'forest':stage===17?'canyon17':'canyon';
      ocean.visible=!dryGround;
      for(const m of shore){
        m.geometry=lowTerrain?m.terrainLowGeometry:m.terrainHighGeometry;
        m.userData.terrain.lod=lowTerrain?'low':'high';
        m.position.z+=advance;if(m.position.z>12200)m.position.z-=36000;
        const side=Math.sign(m.position.x),targetX=side*(biome==='canyon'?3200:4700);
        m.position.x=THREE.MathUtils.damp(m.position.x,targetX,1.8,dt);
        m.material.color.set(biome==='forest'?0x9fbea3:biome==='dusk'?0xc3aba4:biome==='canyon'?(stage===17?0x789987:0xc9b598):0xffffff);
      }
      for(const ground of grounds){
        ground.position.z+=advance;if(ground.position.z>12200)ground.position.z-=36000;
        ground.visible=dryGround;ground.geometry=lowTerrain?ground.biomeGroundLowGeometry:ground.biomeGroundHighGeometry;
        const color=ground.biomeGroundColors[groundVariant];
        if(ground.biomeGroundHighGeometry.attributes.color!==color){ground.biomeGroundHighGeometry.setAttribute('color',color);ground.biomeGroundLowGeometry.setAttribute('color',color);}
        Object.assign(ground.userData.biomeGround,{lod:lowTerrain?'low':'high',biome:groundVariant,active:dryGround});
        ground.userData.biomeGround.worldCoverage.zMin=ground.position.z-9000;ground.userData.biomeGround.worldCoverage.zMax=ground.position.z+9000;
      }
      for(const group of forest.groups){
        group.setLow(lowTerrain);group.canopy.position.copy(group.ground.position);group.trunks.position.copy(group.ground.position);
        group.canopy.visible=group.trunks.visible=biome==='forest';
      }
      for(const m of cloudLayers){m.visible=!!m.material.map.userData.ready;m.position.z+=advance*.20;if(m.position.z>-1800)m.position.z-=26000;m.material.opacity=.98*THREE.MathUtils.smoothstep(-m.position.z,1800,3600);}
      // One startup bake after the selected PNG maps have loaded. The visible
      // sky background remains separate, avoiding a duplicate static cloud sky.
      if(!cloudEnvironmentBaked&&cloudLayers.every(m=>m.material.map.userData.ready))bakeCloudEnvironment();
      scene.fog.density=biome==='canyon'?.000083:.000068;
      scene.backgroundRotation.y=time*.00018;
      sun.color.set(biome==='dusk'?0xffb57f:0xffe1bc);
      sun.position.set(player.x-110,player.y+40,player.z-150);sun.target.position.set(player.x,player.y,player.z);sun.target.updateMatrixWorld();
    },
    dispose(){environmentDisposed=true;env.dispose();skyTarget.dispose();sky.geometry.dispose();sky.material.uniforms.cirrusTexture.value.dispose();sky.material.dispose();ocean.geometry.dispose();ocean.material.uniforms.windTexture.value.dispose();ocean.material.dispose();rockTexture.dispose();photoRockTexture.dispose();for(const m of shore){m.terrainHighGeometry.dispose();m.terrainLowGeometry.dispose();m.material.dispose();}for(const ground of grounds){ground.biomeGroundHighGeometry.dispose();ground.biomeGroundLowGeometry.dispose();ground.material.dispose();}for(const group of forest.groups){group.canopy.dispose();group.trunks.dispose();}forest.geometry.canopy.dispose();forest.geometry.trunk.dispose();forest.canopyMaterial.dispose();forest.trunkMaterial.dispose();for(const m of cloudLayers)m.material.dispose();cloudGeometry?.dispose();for(const t of cloudTextures)t.dispose();for(const t of photoTextures)t.dispose();}
  };
}
