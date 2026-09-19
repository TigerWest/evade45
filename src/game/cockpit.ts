// The procedural model remains imperative while R3F owns its lifecycle.
import * as THREE from 'three';
import type {GameState} from './types';
import {clamp,angleDifference,seededRandom} from './engine.js';

// Hands follow the camera on foot; vehicles belong to the world and follow the chassis.
type Point3=readonly [number,number,number]|number[];
type ViewMode='foot'|'bike'|'armor';
interface Gauge {needle:THREE.Group;max:number}

export function createCockpit(camera:THREE.PerspectiveCamera){
  const root=new THREE.Group();camera.add(root);
  const vehicle=new THREE.Group();if(!camera.parent)throw new Error('Cockpit camera must belong to a scene');camera.parent.add(vehicle);
  const views=Object.fromEntries((['foot','bike','armor'] as ViewMode[]).map(mode=>{const g=new THREE.Group();(mode==='foot'?root:vehicle).add(g);return [mode,g]})) as Record<ViewMode,THREE.Group>;
  const random=seededRandom(412),textures:THREE.CanvasTexture[]=[];
  function surface(base:string,fabric=false):THREE.CanvasTexture{
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;
    ctx.fillStyle=base;ctx.fillRect(0,0,128,128);
    for(let i=0;i<1900;i++){ctx.fillStyle=random()>.5?'#ffffff12':'#00000018';ctx.fillRect(random()*128,random()*128,fabric?1:random()*5+1,1)}
    if(fabric){ctx.strokeStyle='#00000012';ctx.lineWidth=.7;for(let i=0;i<128;i+=3){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke()}}
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);return map;
  }
  const mat=(color:THREE.ColorRepresentation,roughness=.8,metalness=0,map:THREE.Texture|null=null)=>new THREE.MeshStandardMaterial({color,roughness,metalness,map});
  const paint=mat(0xffffff,.72,.35,surface('#485341'));
  const edge=mat(0x77816c,.66,.5),steel=mat(0x9a9d90,.4,.75),black=mat(0x171e1c,.8,.15);
  const rubber=mat(0x242622,.96),cloth=mat(0xffffff,1,0,surface('#505742',true));
  const seam=mat(0x737760,1),leather=mat(0xffffff,.93,0,surface('#484536',true));
  const skin=mat(0xb88e70,.92),nail=mat(0xc4a28b,.72),crease=mat(0x80604a,1);
  const amber=new THREE.MeshStandardMaterial({color:0xd5a55e,emissive:0x986223,emissiveIntensity:.4});
  const red=mat(0x9e493b),glass=mat(0x91a8a1,.2,.65);
  const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,16,12);
  const rods=new Map<string,THREE.CylinderGeometry>(),rings=new Map<string,THREE.TorusGeometry>();
  function mesh(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0):THREE.Mesh{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m}
  function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material):THREE.Mesh{const m=mesh(parent,cube,material,x,y,z);m.scale.set(w,h,d);return m}
  function oval(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material):THREE.Mesh{const m=mesh(parent,sphere,material,x,y,z);m.scale.set(w,h,d);return m}
  function rod(parent:THREE.Object3D,a:Point3,b:Point3,r:number,material:THREE.Material,r2=r):THREE.Mesh{
    const key=`${r}:${r2}`;if(!rods.has(key))rods.set(key,new THREE.CylinderGeometry(r2,r,1,16));
    const start=new THREE.Vector3(a[0],a[1],a[2]),end=new THREE.Vector3(b[0],b[1],b[2]),delta=end.clone().sub(start);
    const m=mesh(parent,rods.get(key)!,material);m.position.copy(start.add(end).multiplyScalar(.5));m.scale.y=delta.length();m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
  }
  function ring(parent:THREE.Object3D,x:number,y:number,z:number,r:number,t:number,material:THREE.Material):THREE.Mesh{const key=`${r}:${t}`;if(!rings.has(key))rings.set(key,new THREE.TorusGeometry(r,t,8,40));return mesh(parent,rings.get(key)!,material,x,y,z)}
  function cable(parent:THREE.Object3D,points:Point3[],r=.006,material:THREE.Material=black):THREE.Mesh{return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2]))),16,r,5,false),material)}
  function bolt(parent:THREE.Object3D,x:number,y:number,z:number,r=.009):THREE.Group{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);rod(g,[0,0,-.005],[0,0,.005],r,steel);box(g,0,0,.0055,r*1.05,.002,.0015,black);return g}
  function plate(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number){box(parent,x,y,z,w,h,.018,black);for(const sx of [-1,1])for(const sy of [-1,1])bolt(parent,x+sx*(w/2-.02),y+sy*(h/2-.02),z+.014,.006)}
  function label(parent:THREE.Object3D,text:string,x:number,y:number,z:number,w:number,h:number,color='#b6bba1'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 30px monospace';ctx.fillText(text,256,32);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);
    return mesh(parent,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false}),x,y,z);
  }
  function hand(parent:THREE.Object3D,side:number,x:number,y:number,z:number,grip=false):THREE.Group{
    const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
    const wrist=[0,-.018,.095],elbow=[side*.14,-.34,.43];
    rod(g,elbow,wrist,.083,cloth,.049);
    // Raised cloth folds, cuff binding, stitching, and a small wrist closure.
    for(const t of [.25,.48,.72,.9]){
      const a=new THREE.Vector3(...elbow).lerp(new THREE.Vector3(...wrist),t),b=a.clone().add(new THREE.Vector3(-side*.004,.012,-.018));
      rod(g,a.toArray(),b.toArray(),.083-(.034*t)+.003,cloth,.083-(.034*t));
    }
    rod(g,[0,-.024,.115],[0,-.015,.071],.053,leather,.049);
    rod(g,[side*.042,.002,.103],[side*.095,-.15,.27],.002,seam);
    box(g,side*.024,.03,.09,.038,.012,.032,black);box(g,side*.024,.037,.09,.025,.003,.015,edge);
    const wristJoint=new THREE.Group(),palm=new THREE.Group();g.add(wristJoint);wristJoint.add(palm);
    wristJoint.position.set(0,-.015,.071);palm.position.set(0,.015,-.071);g.userData.wrist=wristJoint;
    oval(palm,0,0,.006,.064,.032,.07,leather);
    oval(palm,0,.023,-.004,.049,.015,.045,leather);
    // Four separately bent fingers, exposed knuckles, nail beds and flexion lines.
    for(let i=0;i<4;i++){
      const fx=(i-1.5)*.028,len=[.064,.076,.07,.052][i],r=[.014,.015,.014,.012][i];
      const pts:[number,number,number][]=grip?[[fx,.006,-.04],[fx,.006,-.04-len*.55],[fx,-.032,-.047-len*.6],[fx,-.05,-.039]]:
        [[fx,.01,-.04],[fx,.004,-.04-len*.65],[fx,-.022,-.043-len],[fx,-.045,-.036-len*.72]];
      for(let j=0;j<3;j++){rod(palm,pts[j],pts[j+1],r,skin,r*.92);oval(palm,...pts[j],r,r*.95,r,skin)}
      oval(palm,...pts[3],r*.91,r*.86,r*.92,skin);
      const knuckle=pts[1];rod(palm,[fx-r*.6,knuckle[1]+r*.9,knuckle[2]],[fx+r*.6,knuckle[1]+r*.9,knuckle[2]],.0014,crease);
      const tip=pts[3];oval(palm,fx,tip[1]+r*.55,tip[2]-.004,r*.57,.0025,.009,nail);
      oval(palm,fx,.03,-.03,.012,.008,.017,edge);
    }
    const thumb:[number,number,number][]=[[-side*.05,-.009,.02],[-side*.078,-.026,-.012],[-side*.072,-.05,-.04],[-side*.041,-.054,-.056]];
    for(let i=0;i<3;i++){rod(palm,thumb[i],thumb[i+1],.018-i*.001,skin);oval(palm,...thumb[i],.019,.018,.019,skin)}
    oval(palm,...thumb[3],.015,.014,.017,skin);
    for(const sideX of [-1,1])rod(palm,[sideX*.047,.026,.035],[sideX*.047,.028,-.014],.0017,seam);
    return g;
  }
  // Anchor each arm at the shoulder and elbow; the wrist adds a small delayed
  // rotation. Moving the joints keeps the sleeve attached instead of sliding a fist.
  const footArms=[-1,1].map(side=>{
    const shoulder=new THREE.Group(),elbow=new THREE.Group();views.foot.add(shoulder);shoulder.add(elbow);
    shoulder.position.set(side*.43,-.22,.09);elbow.position.set(0,-.28,0);
    rod(shoulder,[0,0,0],[0,-.28,0],.087,cloth,.078);
    oval(shoulder,0,-.28,0,.08,.084,.08,cloth);
    const fist=hand(elbow,side,-side*.14,.34,-.43);
    elbow.rotation.x=-.74;
    fist.userData.wrist.rotation.z=-side*.5;
    return {side,shoulder,elbow,wrist:fist.userData.wrist};
  });
  const motion={bob:0,roll:0};
  let gaitPhase=0,gaitWeight=0,sprintWeight=0,airWeight=0,strafe=0,lookLag=0,lastLook=0,animationGame:GameState|null=null;

  // Dials use one static face texture; only the needle moves at runtime.
  function gauge(parent:THREE.Object3D,x:number,y:number,z:number,r:number,max:number,unit:string):Gauge{
    const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
    rod(g,[0,0,-.035],[0,0,0],r*1.1,black);ring(g,0,0,.005,r,.007,steel);
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;
    ctx.fillStyle='#172320';ctx.fillRect(0,0,256,256);ctx.translate(128,128);
    for(let i=0;i<=40;i++){
      const a=(-225+i/40*270)*Math.PI/180,major=i%5===0;
      ctx.strokeStyle=i>32?'#b7684d':'#d4d9bc';ctx.lineWidth=major?3:1.5;
      ctx.beginPath();ctx.moveTo(Math.cos(a)*(major?87:94),Math.sin(a)*(major?87:94));ctx.lineTo(Math.cos(a)*105,Math.sin(a)*105);ctx.stroke();
      if(major){ctx.fillStyle='#d4d9bc';ctx.font='17px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(Math.round(i/40*max)),Math.cos(a)*70,Math.sin(a)*70)}
    }
    ctx.font='14px monospace';ctx.fillStyle='#a3b69d';ctx.fillText(unit,0,42);
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);
    mesh(g,new THREE.CircleGeometry(r*.96,40),new THREE.MeshBasicMaterial({map}),0,0,.008);
    const needle=new THREE.Group();needle.position.z=.016;g.add(needle);
    box(needle,r*.31,0,0,r*.76,.005,.004,amber);oval(g,0,0,.02,.012,.012,.006,steel);
    needle.rotation.z=Math.PI*1.25;return {needle,max};
  }
  const bike=views.bike,bar=new THREE.Group();bike.add(bar);bar.name='handlebars';bar.position.set(0,-.39,-.66);
  // Sculpted fuel tank and cap, with a center seam and knee panels.
  oval(bike,0,-.78,-.48,.22,.2,.42,paint);
  oval(bike,0,-.625,-.57,.16,.065,.27,paint);
  for(const s of [-1,1])oval(bike,s*.18,-.78,-.44,.048,.13,.26,rubber);
  rod(bike,[0,-.56,-.56],[0,-.545,-.56],.056,steel);
  const cap=ring(bike,0,-.54,-.56,.043,.005,black);cap.rotation.x=-Math.PI/2;
  box(bike,0,-.533,-.56,.041,.008,.013,steel);
  cable(bar,[[-.48,0,.04],[-.27,0,0],[-.18,-.048,-.04],[.18,-.048,-.04],[.27,0,0],[.48,0,.04]],.02,steel);
  box(bar,0,-.056,-.025,.25,.035,.09,paint);
  for(const s of [-1,1]){
    box(bar,s*.075,-.032,-.02,.043,.025,.066,black);bolt(bar,s*.075,-.017,.017);
    rod(bar,[s*.29,0,.015],[s*.49,0,.045],.03,rubber);
    for(let i=0;i<11;i++){const x=s*(.315+i*.015);rod(bar,[x,0,.02],[x+s*.004,0,.02],.032,black)}
    box(bar,s*.275,.002,.01,.058,.066,.059,black);box(bar,s*.275,.036,.012,.019,.009,.027,s>0?red:edge);
    rod(bar,[s*.28,-.027,-.04],[s*.48,-.027,-.045],.008,steel);oval(bar,s*.48,-.027,-.045,.013,.012,.012,steel);
    cable(bar,[[s*.255,-.01,-.03],[s*.24,-.1,-.1],[s*.12,-.18,-.03],[s*.1,-.3,.05]],.007);
    rod(bar,[s*.27,.02,-.02],[s*.46,.24,-.13],.009,black);
    const mirror=new THREE.Group();mirror.position.set(s*.47,.25,-.13);mirror.rotation.y=-s*.18;bar.add(mirror);
    oval(mirror,0,0,0,.105,.059,.018,black);oval(mirror,0,0,.014,.093,.048,.007,glass);
    // A subtle horizon highlight suggests glass without a second scene render.
    rod(mirror,[-.067,.018,.019],[.053,.025,.019],.0025,edge);
    hand(bar,s,s*.383,.027,.052,true);
  }
  const bikeCluster=new THREE.Group();bikeCluster.position.set(0,.026,-.105);bikeCluster.rotation.x=-.3;bar.add(bikeCluster);
  const bikeSpeed=gauge(bikeCluster,0,0,0,.085,100,'km/h');
  plate(bikeCluster,.14,-.025,-.007,.09,.09);const neutral=label(bikeCluster,'N',.14,-.015,.013,.035,.023,'#98bf8f');
  for(let i=0;i<3;i++)oval(bikeCluster,.112+i*.027,-.054,.009,.006,.005,.003,i===0?amber:edge);

  const armor=views.armor;
  // Sloped hood, welded panel seams and fasteners remain below the sight line.
  box(armor,0,-.79,-1.55,3.2,.3,2.6,paint);
  const hood=box(armor,0,-.54,-2.02,2.8,.085,1.3,paint);hood.rotation.x=.09;
  for(const s of [-1,1]){
    box(armor,s*.68,-.472,-2.08,.012,.008,1.08,black);
    for(let i=0;i<5;i++){const b=bolt(armor,s*.68,-.463,-2.5+i*.22);b.rotation.x=-Math.PI/2}
    box(armor,s*1.02,.015,-1.25,.13,1.37,.2,paint);
    box(armor,s*.952,.012,-1.135,.018,1.15,.018,rubber);
    for(const y of [-.43,-.12,.19,.5])bolt(armor,s*1.02,y,-1.14,.014);
    box(armor,s*1.25,-.4,-1.55,.22,.24,1.55,paint);
    rod(armor,[s*.78,-.46,-2.44],[s*.78,-.38,-2.44],.015,steel);rod(armor,[s*.78,-.38,-2.44],[s*.78,-.38,-2.16],.015,steel);rod(armor,[s*.78,-.38,-2.16],[s*.78,-.46,-2.16],.015,steel);
    // Window latch and lower-edge wiper, kept out of the central view.
    box(armor,s*.92,-.17,-1.13,.08,.035,.05,black);
    rod(armor,[s*.82,-.39,-1.25],[s*.4,-.31,-1.27],.009,black);
    rod(armor,[s*.53,-.335,-1.275],[s*.2,-.29,-1.275],.012,rubber);
  }
  box(armor,0,.66,-1.25,2.16,.18,.22,paint);box(armor,0,.555,-1.13,1.91,.018,.03,rubber);
  for(let i=0;i<9;i++)box(armor,.78+i*.06,-.49,-2.01,.025,.014,.36,black);
  const dash=new THREE.Group();dash.position.set(0,-.48,-1.02);dash.rotation.x=-.12;armor.add(dash);
  box(dash,0,0,0,1.9,.3,.19,paint);box(dash,0,.15,.075,1.96,.047,.14,rubber);
  plate(dash,-.27,.01,.109,.67,.235);
  const armorSpeed=gauge(dash,-.43,.025,.133,.082,60,'km/h');
  const armorPower=gauge(dash,-.22,.025,.133,.067,100,'%');
  label(dash,'01 / DRIVE',-.3,-.086,.125,.26,.023);
  plate(dash,.38,.01,.108,.5,.23);
  for(let i=0;i<4;i++){
    const x=.215+i*.106;ring(dash,x,-.027,.13,.024,.004,steel);
    rod(dash,[x,-.027,.127],[x,-.007,.17],.006,steel);
    oval(dash,x,.059,.125,.013,.008,.006,i===0?amber:edge);
  }
  label(dash,'AUX / LIGHT / VENT',.38,-.076,.127,.4,.021);
  for(const s of [-1,1])for(let i=0;i<5;i++)box(dash,s*.8,.087-i*.034,.111,.16,.011,.009,black);
  const wheel=new THREE.Group();wheel.position.set(0,-.34,-.72);wheel.rotation.x=-.25;armor.add(wheel);
  const wheelTurn=new THREE.Group();wheel.add(wheelTurn);wheelTurn.name='steering-wheel';
  ring(wheelTurn,0,0,0,.215,.021,rubber);ring(wheelTurn,0,0,-.009,.215,.005,edge);
  for(const a of [0,Math.PI,Math.PI*1.5])rod(wheelTurn,[0,0,-.01],[Math.cos(a)*.2,Math.sin(a)*.2,-.003],.014,steel);
  oval(wheelTurn,0,0,.009,.063,.047,.03,black);bolt(wheelTurn,0,0,.04,.013);
  for(const s of [-1,1])hand(wheelTurn,s,s*.203,.018,.052,true);
  rod(armor,[.52,-.85,-.59],[.48,-.52,-.72],.015,steel);oval(armor,.48,-.51,-.72,.038,.033,.032,black);

  // A continuous cabin surrounds the eye point. Window apertures remain open
  // for visibility; doors, roof and rear bulkhead are real, two-sided volumes.
  const lining=mat(0x59604e,.95),seat=mat(0x303a30,1),windowMat=new THREE.MeshStandardMaterial({color:0xa5b5a6,roughness:.15,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide});
  box(armor,0,-1.33,.2,2.22,.14,3.08,paint);
  box(armor,0,.69,.2,2.22,.12,3.08,paint);
  box(armor,0,.619,.3,1.97,.025,2.7,lining);
  for(const s of [-1,1]){
    // Lower door, padded inner panel, window sill, and rear quarter panel.
    box(armor,s*1.05,-.68,-.23,.15,1.24,1.98,paint);
    box(armor,s*.965,-.62,-.22,.025,.91,1.65,lining);
    box(armor,s*.942,-.19,-.25,.085,.085,1.75,rubber);
    box(armor,s*1.05,.59,.13,.15,.13,2.96,paint);
    box(armor,s*1.05,.28,.68,.15,.62,.14,paint);
    box(armor,s*1.05,-.33,1.24,.15,1.91,1.03,paint);
    box(armor,s*.962,.25,1.12,.026,.49,.61,lining);
    for(const z of [-1.09,.58])box(armor,s*.953,.27,z,.018,.55,.027,rubber);
    const pane=mesh(armor,new THREE.PlaneGeometry(1.65,.51),windowMat,s*1.012,.27,-.255);pane.rotation.y=Math.PI/2;
    // Armrest, latch, pull handle and hinges face inward, toward the driver.
    box(armor,s*.86,-.51,-.3,.19,.1,.63,black);
    box(armor,s*.916,-.31,-.79,.06,.11,.2,black);
    rod(armor,[s*.873,-.29,-.85],[s*.873,-.29,-.72],.014,steel);
    rod(armor,[s*.91,-.7,.19],[s*.81,-.7,.19],.017,steel);
    rod(armor,[s*.81,-.7,.19],[s*.81,-.4,.19],.017,steel);
    rod(armor,[s*.81,-.4,.19],[s*.91,-.4,.19],.017,steel);
    for(const z of [-.97,.49])for(const y of [-1.05,-.22]){const b=bolt(armor,s*.943,y,z,.012);b.rotation.y=-s*Math.PI/2}
    for(const y of [-.86,-.29])box(armor,s*.953,y,.56,.055,.15,.08,steel);
    // Roof crossmembers and wiring give side/upward glances a continuous structure.
    rod(armor,[s*.93,.49,-1.12],[s*.93,.49,1.54],.016,black);
    box(armor,s*.93,.59,.68,.16,.12,.18,edge);
    const rearSeat=box(armor,s*.66,-1.02,1.07,.48,.17,.81,seat);
    rearSeat.rotation.z=-s*.035;
    box(armor,s*.91,-.67,1.08,.11,.63,.85,seat);
    for(let i=0;i<4;i++)box(armor,s*.66,-.929,.8+i*.18,.43,.008,.008,black);
    rod(armor,[s*.92,-1.23,.8],[s*.92,-1.23,1.4],.027,steel);
  }
  // Rear wall with an inset inspection window and a latched equipment locker.
  box(armor,0,-.59,1.73,2.22,1.48,.13,paint);
  box(armor,0,.54,1.73,2.22,.3,.13,paint);
  for(const s of [-1,1])box(armor,s*.735,.265,1.73,.75,.25,.13,paint);
  box(armor,0,.13,1.64,.76,.035,.055,rubber);box(armor,0,.4,1.64,.76,.035,.055,rubber);
  for(const s of [-1,1])box(armor,s*.38,.265,1.64,.035,.3,.055,rubber);
  mesh(armor,new THREE.PlaneGeometry(.72,.23),windowMat,0,.265,1.715);
  const locker=new THREE.Group();locker.position.set(0,-.66,1.6);locker.rotation.y=Math.PI;armor.add(locker);
  plate(locker,0,0,0,.67,.57);label(locker,'STOWAGE',0,.16,.014,.37,.038);
  box(locker,0,-.04,.035,.16,.045,.05,steel);
  for(const x of [-.25,.25])box(locker,x,0,.018,.022,.46,.016,edge);
  // Driver seat behind/below the camera, with a headrest, belt and seat rails.
  box(armor,0,-1.03,.13,.57,.16,.72,seat);
  const backrest=box(armor,0,-.56,.53,.59,.88,.16,seat);backrest.rotation.x=.07;
  for(const x of [-.13,.13])rod(armor,[x,-.16,.53],[x,.12,.55],.012,steel);
  box(armor,0,.16,.55,.36,.2,.13,seat);
  for(const x of [-.2,.2])rod(armor,[x,-1.24,-.13],[x,-1.24,.59],.023,steel);
  rod(armor,[-.27,-.16,.425],[.24,-.91,.45],.021,black);
  box(armor,.25,-.94,.05,.06,.1,.055,red);
  // Roof hatch rim, latch, braces and a restrained interior lamp.
  for(const x of [-.4,.4])box(armor,x,.584,.25,.045,.045,.95,black);
  for(const z of [-.225,.725])box(armor,0,.584,z,.84,.045,.045,black);
  box(armor,0,.59,.25,.72,.025,.85,paint);
  rod(armor,[-.13,.554,.52],[.13,.554,.52],.014,steel);
  for(const z of [-.92,1.33])box(armor,0,.56,z,2.04,.1,.085,edge);
  box(armor,.65,.56,.98,.24,.075,.15,black);
  const lampMat=new THREE.MeshStandardMaterial({color:0xd8cda7,emissive:0xd8cda7,emissiveIntensity:.6});
  box(armor,.65,.516,.98,.18,.018,.1,lampMat);
  const cabinLight=new THREE.PointLight(0xffe2b4,.55,2.8,2);cabinLight.position.set(.65,.45,.98);armor.add(cabinLight);

  let active='',lastYaw:number|null=null,steer=0;
  function update(game:GameState,time:number,dt:number,reduced:boolean){
    const p=game.player;
    if(active!==game.mode||animationGame!==game){for(const [mode,g] of Object.entries(views))g.visible=mode===game.mode;active=game.mode;lastYaw=null;steer=0;animationGame=game;gaitPhase=gaitWeight=sprintWeight=airWeight=strafe=lookLag=0;lastLook=p.yaw;motion.bob=motion.roll=0}
    root.visible=vehicle.visible=game.status!=='ready';
    vehicle.position.set(p.x,p.y,p.z);vehicle.rotation.set(0,p.bodyYaw,0);
    const moving=clamp(Math.abs(p.speed)/4,0,1);
    const yawRate=lastYaw===null||dt<=0||game.status!=='playing'?0:angleDifference(p.bodyYaw,lastYaw)/dt;
    // Positive yaw is a left turn; reversing flips chassis yaw, not the handle.
    const handleRate=yawRate*(p.speed<-.1?-1:1);
    lastYaw=p.bodyYaw;steer+=(clamp(handleRate*.23,-.3,.3)-steer)*Math.min(dt*9,1);
    if(game.mode==='foot'&&game.status==='playing'){
      const step=clamp(dt,0,.1),blend=1-Math.exp(-step*10),speed=Math.abs(p.speed);
      gaitWeight+=(clamp(speed/4.9,0,1)-gaitWeight)*blend;
      sprintWeight+=(clamp((speed-4.9)/3.3,0,1)-sprintWeight)*blend;
      airWeight+=((p.altitude>.03?1:0)-airWeight)*blend;
      const lateral=p.vx*Math.cos(p.yaw)-p.vz*Math.sin(p.yaw);
      strafe+=(clamp(lateral/8.2,-1,1)-strafe)*blend;
      const yawRate=step>0?angleDifference(lastLook,p.yaw)/step:0;lastLook=p.yaw;
      lookLag+=(clamp(yawRate*.025,-.045,.045)-lookLag)*blend;
      // Continuous phase: changing speed never jumps to a different wall-clock sine.
      gaitPhase=(gaitPhase+step*(5.6+sprintWeight*2.6)*gaitWeight*(1-airWeight))%(Math.PI*2);
      const movement=reduced?0:gaitWeight*(1-airWeight*.85);
      for(const {side,shoulder,elbow,wrist} of footArms){
        const phase=gaitPhase+(side>0?Math.PI:0),swing=Math.sin(phase),follow=Math.sin(phase-.45);
        shoulder.rotation.set(swing*(.14+sprintWeight*.1)*movement,side*.06+(reduced?0:lookLag),-side*(.025+sprintWeight*.07));
        shoulder.position.x=side*(.43-sprintWeight*.035)-(reduced?0:strafe*.014);
        shoulder.position.y=-.22+airWeight*.025-(reduced?0:p.landing*.012);
        elbow.rotation.x=-.74+gaitWeight*.2+sprintWeight*.2+airWeight*.15+Math.max(0,follow)*.065*movement;
        wrist.rotation.set(-.07+follow*.035*movement,side*.12,-side*(.5+sprintWeight*.12)+follow*.025*movement);
      }
      motion.bob=reduced?0:(Math.cos(gaitPhase*2)-1)*(.004+sprintWeight*.003)*movement;
      motion.roll=reduced?0:Math.sin(gaitPhase)*.0018*movement;
    }
    bar.rotation.y=steer;bike.rotation.z=reduced?0:steer*.18;
    bike.position.y=reduced?0:Math.sin(time*28)*moving*.003;
    wheelTurn.rotation.z=steer*1.8;neutral.visible=Math.abs(p.speed)<.15;
    const readings:[Gauge,number][]=[[bikeSpeed,Math.abs(p.speed)*3.6],[armorSpeed,Math.abs(p.speed)*3.6],[armorPower,p.energy]];
    for(const [dial,value] of readings)dial.needle.rotation.z=Math.PI*1.25-clamp(value/dial.max,0,1)*Math.PI*1.5;
  }
  return {update,motion,destroy(){
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();for(const group of [root,vehicle])group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material)}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.removeFromParent();vehicle.removeFromParent();
  }};
}
