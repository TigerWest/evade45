// The procedural scene remains imperative behind an R3F lifecycle.
import * as THREE from 'three';
import type {GameState,Obstacle} from './types';
import {createCockpit} from './cockpit.js';
import {BUILDINGS,OBSTACLES,seededRandom,clamp} from './engine.js';

const rand=seededRandom(923);
type TextureKind='ground'|'road'|'wall'|'rust';
function noiseLayer(size:number):(x:number,y:number)=>number{const values=Float32Array.from({length:size*size},()=>rand()-.5);return(x:number,y:number)=>{const xx=x/512*(size-1),yy=y/512*(size-1),ix=Math.floor(xx),iy=Math.floor(yy),fx=xx-ix,fy=yy-iy;const a=values[iy*size+ix]*(1-fx)+values[iy*size+ix+1]*fx;const b=values[(iy+1)*size+ix]*(1-fx)+values[(iy+1)*size+ix+1]*fx;return a*(1-fy)+b*fy}}
function texture(kind:TextureKind):THREE.CanvasTexture{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;
  const palettes:Record<TextureKind,readonly [number,number,number]>={ground:[94,89,66],road:[103,96,79],wall:[141,139,119],rust:[89,68,47]};const base=palettes[kind];
  const data=c.createImageData(512,512),broad=noiseLayer(8),medium=noiseLayer(32),fine=noiseLayer(128);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;const n=(rand()-.5)*27+broad(x,y)*36+medium(x,y)*25+fine(x,y)*19;for(let k=0;k<3;k++)data.data[i+k]=clamp(base[k]+n,0,255);data.data[i+3]=255}c.putImageData(data,0,0);
  if(kind==='road'){for(let i=0;i<7000;i++){c.fillStyle=rand()>.5?'#201e1744':'#d1c7a033';c.fillRect(rand()*512,rand()*512,rand()*2+1,rand()*2+1)}for(let x of [135,166,348,379]){c.strokeStyle='#322d2129';c.lineWidth=5;c.beginPath();c.moveTo(x,0);c.lineTo(x+3,512);c.stroke()}}
  if(kind==='wall'){for(let i=0;i<60;i++){const x=rand()*512,y=rand()*512;c.fillStyle='#4a493d36';c.fillRect(x,y,rand()*50+2,rand()*3+1)}for(let i=0;i<12;i++){c.beginPath();let x=rand()*512,y=rand()*512;c.moveTo(x,y);for(let s=0;s<5;s++){x+=rand()*25-12;y+=rand()*30;c.lineTo(x,y)}c.strokeStyle='#33372d44';c.lineWidth=rand()*2;c.stroke()}}
  const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function smokeTexture():THREE.CanvasTexture{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d')!,g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.65)');g.addColorStop(.35,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}

export function createWorld(scene:THREE.Scene,camera:THREE.PerspectiveCamera){
  const mobile=matchMedia('(pointer:coarse)').matches;
  const originalChildren=new Set(scene.children);scene.background=new THREE.Color(0xadb3a5);scene.fog=new THREE.FogExp2(0xa5a99b,.0077);
  camera.fov=76;camera.near=.045;camera.far=360;camera.rotation.order='YXZ';camera.updateProjectionMatrix();if(!camera.parent)scene.add(camera);
  const hemisphere=new THREE.HemisphereLight(0xc3d3de,0x514936,2.2);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight(0xffdab0,3.2);sun.position.set(-65,48,-85);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sun.shadow.camera.left=-75;sun.shadow.camera.right=75;sun.shadow.camera.top=85;sun.shadow.camera.bottom=-85;sun.shadow.camera.near=1;sun.shadow.camera.far=240;sun.shadow.normalBias=.04;sun.shadow.bias=-.0001;scene.add(sun);scene.add(sun.target);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(290,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#7b929c')},bottom:{value:new THREE.Color('#d9c7a7')}},vertexShader:'varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vWorld;uniform vec3 top;uniform vec3 bottom;void main(){float h=normalize(vWorld).y;vec3 col=mix(bottom,top,smoothstep(-.08,.8,h));float cloud=sin(vWorld.x*.04+sin(vWorld.z*.05))*sin(vWorld.z*.018+vWorld.x*.012);col+=smoothstep(.15,.7,cloud)*.1*smoothstep(.08,.7,h);gl_FragColor=vec4(col,1.);}'}));scene.add(sky);
  const sunDisk=new THREE.Mesh(new THREE.SphereGeometry(3.6,24,12),new THREE.MeshBasicMaterial({color:0xffe8b2,fog:false}));sunDisk.position.set(-100,43,-160);scene.add(sunDisk);
  const dustMap=smokeTexture();const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:dustMap,color:0xffdfad,transparent:true,opacity:.27,depthWrite:false,fog:false}));halo.position.copy(sunDisk.position);halo.scale.set(55,55,1);scene.add(halo);
  const groundMap=texture('ground');groundMap.repeat.set(75,75);
  const groundMat=new THREE.MeshStandardMaterial({map:groundMap,color:0x9d9b7a,roughness:1});
  const groundGeo=new THREE.PlaneGeometry(530,530,90,90);groundGeo.rotateX(-Math.PI/2);
  const gp=groundGeo.attributes.position;for(let i=0;i<gp.count;i++){const x=gp.getX(i),z=gp.getZ(i),edge=Math.max(Math.abs(x),Math.abs(z));gp.setY(i,edge>83?(edge-83)*.06+Math.sin(x*.035)*Math.cos(z*.04)*Math.min(13,(edge-83)*.18):-.035)}groundGeo.computeVertexNormals();const ground=new THREE.Mesh(groundGeo,groundMat);ground.receiveShadow=true;scene.add(ground);
  const roadMap=texture('road');roadMap.repeat.set(1,33);const roadMaterial=new THREE.MeshStandardMaterial({map:roadMap,roughness:1,color:0xb9b59b});
  const road=new THREE.Mesh(new THREE.PlaneGeometry(10,240),roadMaterial);road.rotation.x=-Math.PI/2;road.position.y=.005;road.receiveShadow=true;scene.add(road);
  const crossRoad=new THREE.Mesh(new THREE.PlaneGeometry(180,7),roadMaterial);crossRoad.rotation.x=-Math.PI/2;crossRoad.position.set(0,.009,3);crossRoad.receiveShadow=true;scene.add(crossRoad);
  const wallMap=texture('wall');const wallMaterial=new THREE.MeshStandardMaterial({map:wallMap,roughness:1,color:0xb8b4a4});
  const rustMaterial=new THREE.MeshStandardMaterial({map:texture('rust'),roughness:.94,color:0x8c806b});
  const dark=new THREE.MeshStandardMaterial({color:0x222823,roughness:.95});const timber=new THREE.MeshStandardMaterial({color:0x4f4633,roughness:1});const metal=new THREE.MeshStandardMaterial({color:0x4a5149,roughness:.75,metalness:.45});
  const unitBox=new THREE.BoxGeometry(1,1,1);
  function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material,shadow=true):THREE.Mesh{const m=new THREE.Mesh(unitBox,material);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=shadow&&Math.max(w,h,d)>1.2;m.receiveShadow=true;parent.add(m);return m}
  function cylinder(parent:THREE.Object3D,a:[number,number,number],b:[number,number,number],r:number,material:THREE.Material,r2=r):THREE.Mesh{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,direction.length(),7),material);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());m.castShadow=true;parent.add(m);return m}
  function facade(g:THREE.Group,width:number,height:number,depth:number){
    box(g,0,.7,depth/2,width,1.4,.4,wallMaterial);
    box(g,0,height-.6,depth/2,width,1.2,.4,wallMaterial);
    const n=Math.max(2,Math.floor(width/3));const section=width/n;
    for(let i=0;i<n;i++){
      const x=-width/2+section*(i+.5);box(g,x-section/2+.2,height/2,depth/2,.45,height,.45,wallMaterial);
      box(g,x,2.2,depth/2-.24,section-.5,1.6,.1,dark,false);
      box(g,x,1.38,depth/2+.15,section-.25,.12,.6,wallMaterial);
      box(g,x,3.08,depth/2+.1,section-.25,.14,.5,wallMaterial);
      box(g,x,2.2,depth/2, .09,1.5,.13,timber);
      if(height>5){box(g,x,4.1,depth/2,section-.4,1.7,.4,wallMaterial);box(g,x,5.55,depth/2-.24,section-.5,1.2,.1,dark,false);box(g,x,5.1,depth/2+.1,section-.25,.15,.5,wallMaterial)}
    }
    box(g,width/2-.1,height/2,depth/2,.3,height,.45,wallMaterial);
  }
  for(const b of BUILDINGS){
    const g=new THREE.Group();g.position.set(b.x,0,b.z);scene.add(g);
    box(g,0,.14,0,b.w+.6,.28,b.d+.6,dark);
    box(g,-b.w/2,b.h/2,0,.5,b.h,b.d,wallMaterial);box(g,b.w/2,b.h/2,0,.5,b.h,b.d,wallMaterial);box(g,0,b.h/2,-b.d/2,b.w,b.h,.5,wallMaterial);
    box(g,0,b.h-.8,0,b.w,.18,b.d,dark);facade(g,b.w,b.h,b.d);
    if(b.kind==='house'){
      for(let side of [-1,1]){const roof=box(g,0,b.h+.85,side*b.d/4,b.w+1,.18,b.d*.59,rustMaterial);roof.rotation.x=side*.38;for(let k=-b.w/2;k<b.w/2;k+=.7){const strip=box(g,k,b.h+.91,side*b.d/4,.035,.04,b.d*.59,metal,false);strip.rotation.x=side*.38}}
      box(g,b.w*.25,b.h+1.6,-b.d*.15,.75,2,.85,wallMaterial);
    }else if(b.kind==='ruin'){
      for(let i=0;i<9;i++){const h=.4+rand()*1.8;box(g,-b.w/2+i*b.w/9,b.h+h/2,-b.d/2,b.w/10,h,.4,wallMaterial);cylinder(g,[-b.w/2+i*b.w/9,b.h,-b.d/2],[-b.w/2+i*b.w/9+.14,b.h+2.1,-b.d/2],.035,metal)}
      for(let i=0;i<10;i++){const slab=box(g,(rand()-.5)*b.w,.4,(rand()-.5)*b.d,1.4+rand()*2,.3,1.5,wallMaterial);slab.rotation.set(rand()*.5,rand()*6,rand()*.3)}
    }else{const roof=box(g,0,b.h+.15,0,b.w+1,.18,b.d+1,rustMaterial);roof.rotation.z=.05}
    // Weathering, exposed bricks, and a sagging drainpipe.
    for(let j=0;j<12;j++){const x=(rand()-.5)*b.w,y=.2+rand()*1.1;box(g,x,y,b.d/2+.215,.25+rand()*.6,.08,.045,rustMaterial,false)}
    cylinder(g,[b.w/2-.2,0,b.d/2+.3],[b.w/2-.2,b.h,b.d/2+.3],.065,metal);
  }
  function wreck(b:Obstacle){
    const g=new THREE.Group();g.position.set(b.x,0,b.z);scene.add(g);
    box(g,0,.64,0,b.w*.88,.68,b.d*.9,rustMaterial);box(g,0,1.2,-.2,b.w*.8,.55,b.d*.43,dark);box(g,0,1.54,-.2,b.w*.85,.13,b.d*.48,rustMaterial);
    for(const x of [-b.w*.48,b.w*.48])for(const z of [-b.d*.32,b.d*.32]){const tire=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.26,12),dark);tire.rotation.z=Math.PI/2;tire.position.set(x,.43,z);g.add(tire);tire.castShadow=true}
    for(const x of [-b.w*.35,b.w*.35])box(g,x,.8,b.d*.46,.32,.2,.08,new THREE.MeshStandardMaterial({color:0x918777,roughness:.6}));
    box(g,0,.5,b.d*.5,b.w,.2,.18,metal);
  }
  for(const b of OBSTACLES.slice(BUILDINGS.length))if(b.kind==='car')wreck(b);else{box(scene,b.x,b.h/2,b.z,b.w,b.h,b.d,wallMaterial);for(let i=0;i<4;i++)box(scene,b.x+(rand()-.5)*b.w,b.h+.1,b.z+(rand()-.5)*b.d,.6,.22,.6,wallMaterial)}
  // Debris uses one instanced draw call and stays below collision height.
  const rockGeometry=new THREE.DodecahedronGeometry(1,0),rockMaterial=new THREE.MeshStandardMaterial({color:0x827f6d,roughness:1});
  const rocks=new THREE.InstancedMesh(rockGeometry,rockMaterial,380),dummy=new THREE.Object3D();
  for(let i=0;i<380;i++){let x=(rand()-.5)*155,z=(rand()-.5)*155;if(Math.abs(x)<4)x+=6;const s=.07+rand()*.45;dummy.position.set(x,s*.23,z);dummy.rotation.set(rand()*3,rand()*6,rand()*2);dummy.scale.set(s,s*.55,s*.85);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix)}rocks.castShadow=true;rocks.receiveShadow=true;scene.add(rocks);
  // Mixed trees build a real 3D treeline, not a background image.
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.24,1,7),timber,180);
  const leafMaterial=new THREE.MeshStandardMaterial({color:0x4e5940,roughness:1});const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),leafMaterial,540);
  for(let i=0;i<180;i++){
    let x=(rand()-.5)*350,z=(rand()-.5)*350;if(Math.abs(x)<66&&Math.abs(z)<82)x=(x<0?-1:1)*(85+rand()*20);
    const h=5+rand()*9;dummy.position.set(x,h*.5,z);dummy.scale.set(1,h,1);dummy.rotation.set(0,rand()*6,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    for(let j=0;j<3;j++){dummy.position.set(x+(rand()-.5)*3,h*.65+j*h*.13,z+(rand()-.5)*3);const s=h*(.22+rand()*.1);dummy.scale.set(s,s*.85,s);dummy.rotation.set(rand(),rand()*6,rand());dummy.updateMatrix();crowns.setMatrixAt(i*3+j,dummy.matrix);crowns.setColorAt(i*3+j,new THREE.Color().setHSL(.21+rand()*.04,.14+rand()*.15,.16+rand()*.12))}
  }trunks.castShadow=true;crowns.castShadow=true;crowns.receiveShadow=true;scene.add(trunks,crowns);
  const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.025,0,0,.025,0,0,-.035,.35,0,0,0,-.025,0,0,.025,0,.28,.025],3));grassGeo.computeVertexNormals();
  const grass=new THREE.InstancedMesh(grassGeo,new THREE.MeshStandardMaterial({color:0x797957,roughness:1,side:THREE.DoubleSide}),2400);
  for(let i=0;i<2400;i++){let x=(rand()-.5)*160,z=(rand()-.5)*160;if(Math.abs(x)<6)x+=x<0?-7:7;if(Math.abs(z-3)<5)z+=7;dummy.position.set(x,.01,z);dummy.rotation.set(0,rand()*6.28,0);const s=.3+rand()*.85;dummy.scale.set(s,s,s);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix)}grass.receiveShadow=true;scene.add(grass);
  // Utility wires create strong parallax cues while moving along the road.
  for(let i=0;i<7;i++){
    const z=65-i*25;box(scene,8.5,4.5,z,.23,9,.23,timber);box(scene,8.5,8.4,z,2.6,.14,.14,timber);
    if(i<6)for(const dx of [-.9,.9]){const points=[];for(let t=0;t<=20;t++){const f=t/20;points.push(new THREE.Vector3(8.5+dx,8.45-Math.sin(f*Math.PI)*1.1,z-f*25))}scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x242e2d})))}
  }
  // Simple sandbags and supply crates give the street a human scale.
  const bagMat=new THREE.MeshStandardMaterial({color:0x888568,roughness:1});
  for(let i=0;i<15;i++){const row=Math.floor(i/5),col=i%5;const bag=box(scene,-8+col*.8+(row%2)*.3,.22+row*.35,-3,.83,.38,.62,bagMat);bag.rotation.y=.07*Math.sin(i)}
  for(const [x,z] of [[-8,10],[14,-15],[19,22]]){box(scene,x,.6,z,1.2,1.2,1.2,timber);for(let y of [.1,1.1])box(scene,x,y,z+.615,1.24,.1,.06,metal)}
  // Slow smoke columns and airborne dust sell distance without obscuring play.
  const smoke:{sprite:THREE.Sprite;x:number;z:number;phase:number;seed:number}[]=[];for(const [x,z] of [[-38,-36],[29,-53],[63,38]])for(let i=0;i<12;i++){const material=new THREE.SpriteMaterial({map:dustMap,color:0x444943,transparent:true,opacity:.22,depthWrite:false});const sprite=new THREE.Sprite(material);scene.add(sprite);smoke.push({sprite,x,z,phase:i/12,seed:rand()*8})}
  const dustGeometry=new THREE.BufferGeometry(),dustPositions=new Float32Array(450*3);for(let i=0;i<450;i++){dustPositions[i*3]=(rand()-.5)*140;dustPositions[i*3+1]=rand()*12;dustPositions[i*3+2]=(rand()-.5)*140}dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xe4d5ac,size:.05,transparent:true,opacity:.42,depthWrite:false}));scene.add(dust);

  const cockpit=createCockpit(camera);
  const droneMaterial=new THREE.MeshStandardMaterial({color:0x202925,metalness:.55,roughness:.55});const droneMeshes=new Map<number,{root:THREE.Group;g:THREE.Group;rotors:THREE.Group[]}>();
  function makeDrone(){
    const root=new THREE.Group();const g=new THREE.Group();root.add(g);const rotors:THREE.Group[]=[];
    box(g,0,0,0,.33,.14,.43,droneMaterial);box(g,0,-.1,-.22,.13,.1,.1,dark);
    const arm1=box(g,0,0,0,1.1,.055,.055,metal);arm1.rotation.y=Math.PI/4;const arm2=arm1.clone();arm2.rotation.y=-Math.PI/4;g.add(arm2);
    for(const x of [-.37,.37])for(const z of [-.37,.37]){
      const motor=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.13,10),metal);motor.position.set(x,.05,z);g.add(motor);
      const rotor=new THREE.Group();rotor.position.set(x,.13,z);g.add(rotor);box(rotor,0,0,0,.46,.008,.036,dark,false);box(rotor,0,0,0,.035,.008,.46,dark,false);rotors.push(rotor);
      const disc=new THREE.Mesh(new THREE.CircleGeometry(.24,20),new THREE.MeshBasicMaterial({color:0xadb4a7,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.x=-Math.PI/2;disc.position.set(x,.13,z);g.add(disc);
    }
    const led=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),new THREE.MeshBasicMaterial({color:0xff773e}));led.position.set(0,.07,-.23);g.add(led);
    const payload=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.4,9),dark);payload.rotation.x=Math.PI/2;payload.position.set(0,-.13,.04);g.add(payload);
    scene.add(root);return {root,g,rotors};
  }
  const showcase=makeDrone();showcase.root.scale.setScalar(1.65);
  const burstMeshes:THREE.Mesh[]=[];const sparkGeo=new THREE.IcosahedronGeometry(.1,0);const sparkMat=new THREE.MeshBasicMaterial({color:0xffbe72});
  for(let i=0;i<36;i++){const mesh=new THREE.Mesh(sparkGeo,sparkMat);mesh.visible=false;scene.add(mesh);burstMeshes.push(mesh)}
  const flash=new THREE.PointLight(0xffa04d,0,18,2);scene.add(flash);
  let fov=76,lastDamage=0,lastPass=0,shake=0;
  const flightQuaternion=new THREE.Quaternion(),flightEuler=new THREE.Euler(0,0,0,'YXZ');
  function update(game:GameState,time:number,dt=.016,reduced=false){
    const p=game.player;const menu=game.status==='ready';
    cockpit.update(game,time,dt,reduced);
    if(menu){
      camera.position.set(3.8+Math.sin(time*.07)*.5,2.3,26);camera.lookAt(-5,3.5,-20);
      showcase.root.visible=true;showcase.root.position.set(1.1+Math.sin(time*.6)*.7,6.9+Math.sin(time*1.3)*.14,12);showcase.g.rotation.set(.1,Math.PI*.65+Math.sin(time*.3)*.2,.05);showcase.rotors.forEach((r,i)=>r.rotation.y=time*(i%2?120:-120));
    }else{
      showcase.root.visible=false;
      const moving=Math.min(1,Math.abs(p.speed)/4),frequency=game.mode==='foot'?(p.boosting?15:10):22;
      const bob=reduced?0:game.mode==='foot'?cockpit.motion.bob:Math.sin(time*frequency)*.013*moving;
      if(game.damageCount!==lastDamage){shake=.22;lastDamage=game.damageCount}if(game.passCount!==lastPass){shake=Math.max(shake,.055);lastPass=game.passCount}shake=Math.max(0,shake-dt*.5);
      const fall=game.status==='lost'?.7:0;
      camera.position.set(p.x+(reduced?0:Math.sin(time*73)*shake),p.y+bob-fall-(reduced?0:p.landing*.2),p.z+(reduced?0:Math.cos(time*61)*shake));
      camera.rotation.set(p.pitch+(reduced?0:Math.sin(time*61)*shake*.12),p.yaw,game.status==='lost'?.3:reduced?0:game.mode==='foot'?cockpit.motion.roll:Math.sin(time*frequency*.5)*.007*moving,'YXZ');
      const targetFov=game.mode==='armor'?65:p.boosting?84:76;fov+=(targetFov-fov)*Math.min(dt*4,1);if(Math.abs(camera.fov-fov)>.05){camera.fov=fov;camera.updateProjectionMatrix()}

    }
    const live=new Set<number>();
    for(const d of game.drones){live.add(d.id);let model=droneMeshes.get(d.id);if(!model){model=makeDrone();droneMeshes.set(d.id,model)}model.root.position.set(d.x,d.y,d.z);const yaw=Math.atan2(-d.vx,-d.vz),speed=Math.hypot(d.vx,d.vy,d.vz),pitch=Math.atan2(d.vy,Math.hypot(d.vx,d.vz))-.18-speed*.006;flightEuler.set(pitch,yaw,d.roll||0,'YXZ');flightQuaternion.setFromEuler(flightEuler);model.g.quaternion.slerp(flightQuaternion,1-Math.exp(-dt*15));model.rotors.forEach((r,i)=>r.rotation.y=time*(i%2?1:-1)*(140+speed*3))}
    for(const [id,model] of droneMeshes)if(!live.has(id)){scene.remove(model.root);model.root.traverse(o=>{if(o instanceof THREE.Mesh){if(o.geometry!==unitBox)o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials)if(material!==droneMaterial&&material!==metal&&material!==dark)material.dispose()}});droneMeshes.delete(id)}
    burstMeshes.forEach(m=>m.visible=false);flash.intensity=0;
    for(const e of game.explosions.slice(-1)){
      flash.position.set(e.x,e.y+1,e.z);flash.intensity=Math.max(0,1-e.age*4)*150;
      for(let i=0;i<burstMeshes.length;i++){const m=burstMeshes[i],a=i*2.399+e.seed;const velocity=3+(i%7)*1.3;m.visible=e.age<.8;m.position.set(e.x+Math.sin(a)*velocity*e.age,e.y+Math.cos(a*2)*velocity*e.age+3*e.age-5*e.age*e.age,e.z+Math.cos(a)*velocity*e.age);m.scale.setScalar(Math.max(.1,1-e.age));}
    }
    for(const s of smoke){const phase=(time*.018+s.phase)%1;s.sprite.position.set(s.x+phase*7+Math.sin(time*.1+s.seed),1+phase*26,s.z+phase*3);const size=3+phase*14;s.sprite.scale.set(size,size*1.3,1);s.sprite.material.opacity=(1-phase)*.22*Math.min(phase*12,1)}
    dust.position.x=Math.sin(time*.015)*5;dust.position.z=Math.cos(time*.011)*5;
  }
  return {update,destroy(){
    cockpit.destroy();
    for(const child of [...scene.children])if(!originalChildren.has(child)){
      scene.remove(child);child.traverse(object=>{
        if(!(object instanceof THREE.Mesh||object instanceof THREE.Sprite||object instanceof THREE.Points||object instanceof THREE.Line))return;
        object.geometry?.dispose();
        const materials=Array.isArray(object.material)?object.material:[object.material];
        for(const material of materials)if(material){for(const value of Object.values(material))if(value instanceof THREE.Texture)value.dispose();material.dispose()}
      });
    }
    scene.fog=null;scene.background=null;
  }};
}
