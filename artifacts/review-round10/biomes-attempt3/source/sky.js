import * as THREE from 'three';

function makeCirrusTexture() {
  const size=256,data=new Uint8Array(size*size*4);
  const fract=x=>x-Math.floor(x);
  const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
  const noise=(x,y,period)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const at=(a,b)=>hash(((a%period)+period)%period,((b%period)+period)%period);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix,iy),at(ix+1,iy),sx),THREE.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),sx),sy);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let sum=0,amplitude=.5;
    for(let octave=0;octave<5;octave++){
      const period=8*2**octave;
      sum+=noise(x/size*period,y/size*period,period)*amplitude;amplitude*=.5;
    }
    const i=(y*size+x)*4,v=Math.round(sum*255);
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);
  texture.colorSpace=THREE.NoColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  texture.userData={revision:'periodic-cirrus-lut-v1',size,octaves:5,generatedAtStartup:true};
  return texture;
}

export function createSky() {
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{time:{value:0},sunDirection:{value:new THREE.Vector3(-.62,.16,-.76).normalize()},cirrusTexture:{value:makeCirrusTexture()}},
    vertexShader:'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 vDirection; uniform float time; uniform vec3 sunDirection; uniform sampler2D cirrusTexture;
      void main(){
        vec3 d=normalize(vDirection); float h=max(0.0,d.y); float sun=max(0.0,dot(d,sunDirection));
        vec3 color=mix(vec3(.40,.58,.72),vec3(.035,.16,.34),pow(h,.38));
        color=mix(color,vec3(.88,.74,.58),pow(1.0-h,8.0)*pow(max(0.0,dot(normalize(d.xz),normalize(sunDirection.xz))),4.0)*.62);
        color+=vec3(1.0,.64,.27)*pow(sun,28.0)*.25+vec3(1.0,.82,.52)*pow(sun,900.0)*1.5;
        if(d.y>.018){
          vec2 p=d.xz/(d.y+.095)*1.65+vec2(time*.002,0.0);
          // Five noise octaves are generated once on the CPU. The fragment
          // shader samples one periodic mipmapped field for faint high cirrus.
          float wisps=smoothstep(.57,.73,texture2D(cirrusTexture,(p*vec2(.6,3.1)+25.0)/8.0).r);
          color=mix(color,vec3(.75,.83,.90),wisps*.08*smoothstep(.18,.4,d.y));
        }
        if(d.y<0.0)color=mix(vec3(.31,.45,.50),color,exp(d.y*18.0));
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(27000,32,20),material);
  mesh.name='Atmosphere dome';mesh.renderOrder=-100;
  mesh.userData.sky={revision:'cirrus-lut-v1',cirrusTextureSamples:1,fragmentNoiseOctaves:0};
  return mesh;
}
