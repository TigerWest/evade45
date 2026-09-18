export const DURATION = 45;
export const WORLD_LIMIT = 78;
export const PHYSICS_STEP = 1 / 120;
export const JUMP = {speed:5.1,gravity:13.5,cost:18,cooldown:.95};
export const MODES = {
  foot: { name:'도보', label:'ON FOOT', speed:4.9, boost:8.2, response:12, radius:.38, health:1, eye:1.68 },
  bike: { name:'오토바이', label:'MOTORCYCLE', speed:13, boost:23, response:1.8, radius:.85, health:1, eye:1.48 },
  armor: { name:'경장갑차', label:'LIGHT ARMOR', speed:8.6, boost:13.6, response:1.15, radius:1.4, health:2, eye:2.25 },
};
// Only top speeds reference published civilian specifications. Steering, spawn,
// player movement, collision volumes, and commitment distances are game assumptions.
export const DIFFICULTIES = {
  easy:{name:'연습',speed:16,acceleration:10,turnAcceleration:18,commitDistance:14,interval:8,max:2,source:'Avata 2 / Sport'},
  normal:{name:'실전 압박',speed:27,acceleration:14,turnAcceleration:32,commitDistance:11,interval:5.6,max:3,source:'Avata 2 / Manual'},
  hard:{name:'극한',speed:140/3.6,acceleration:14,turnAcceleration:42,commitDistance:8,interval:4.2,max:4,source:'DJI FPV / max'},
};
export const BUILDINGS = [
  {x:-19,z:-12,w:13,d:10,h:7,kind:'house'},
  {x:18,z:-26,w:12,d:12,h:9,kind:'ruin'},
  {x:-22,z:-45,w:16,d:10,h:5,kind:'shed'},
  {x:25,z:15,w:13,d:9,h:5,kind:'ruin'},
  {x:-24,z:36,w:11,d:13,h:7,kind:'house'},
  {x:43,z:-56,w:16,d:12,h:6,kind:'shed'},
  {x:-50,z:-23,w:12,d:12,h:9,kind:'ruin'},
  {x:46,z:45,w:17,d:10,h:6,kind:'house'},
];
export const OBSTACLES = [
  ...BUILDINGS,
  {x:12,z:-4,w:1.2,d:10,h:1.5,kind:'wall'},
  {x:-13,z:17,w:7,d:1.2,h:1.25,kind:'wall'},
  {x:7.5,z:-39,w:2.4,d:5,h:1.55,kind:'car'},
  {x:-10,z:44,w:2.5,d:5.5,h:1.65,kind:'car'},
  {x:36,z:-9,w:9,d:1.2,h:1.6,kind:'wall'},
  {x:-40,z:13,w:1.2,d:10,h:1.5,kind:'wall'},
];
export function seededRandom(seed=73){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
export function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
export function angleDifference(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
export function circleHitsRect(x,z,r,b){const cx=clamp(x,b.x-b.w/2,b.x+b.w/2),cz=clamp(z,b.z-b.d/2,b.z+b.d/2);return Math.hypot(x-cx,z-cz)<r}
export function createGame(mode='foot',difficulty='normal',seed=Date.now()){
  if(!MODES[mode]||!DIFFICULTIES[difficulty])throw new Error('Invalid configuration');
  return {mode,difficulty,status:'ready',elapsed:0,distance:0,dodges:0,nearMisses:0,random:seededRandom(seed),nextDrone:2.8,nextId:1,drones:[],explosions:[],nearest:Infinity,threat:0,damageCount:0,lastHit:'',collision:0,boundary:false,passCount:0,lastPass:null,peakDroneSpeed:0,
    player:{x:0,z:24,y:MODES[mode].eye,vx:0,vz:0,speed:0,yaw:0,bodyYaw:0,pitch:0,energy:100,health:MODES[mode].health,invulnerable:0,boosting:false,exhausted:false,altitude:0,verticalSpeed:0,jumpHeld:false,jumpCooldown:0,landing:0,dodgeX:0,dodgeZ:0}};
}
function hit(game,reason){
  if(game.player.invulnerable>0||game.status!=='playing')return;
  game.player.health--;game.damageCount++;game.player.invulnerable=2;game.lastHit=reason;
  if(game.player.health<=0)game.status='lost';
}
function clearApproach(x,y,z,tx,ty,tz){
  // Segment versus padded boxes, including roof height. Only used to choose a
  // game spawn corridor; airborne drones retain their normal physical collisions.
  return !OBSTACLES.some(b=>{
    let enter=0,leave=1;
    const axes=[[x,tx-x,b.x-b.w/2-.28,b.x+b.w/2+.28],
      [y,ty-y,-.28,b.h+.28],[z,tz-z,b.z-b.d/2-.28,b.z+b.d/2+.28]];
    for(const [origin,delta,min,max] of axes){
      if(Math.abs(delta)<1e-9){if(origin<min||origin>max)return false;continue}
      const a=(min-origin)/delta,c=(max-origin)/delta;
      enter=Math.max(enter,Math.min(a,c));leave=Math.min(leave,Math.max(a,c));
      if(enter>leave)return false;
    }
    return true;
  });
}
function spawnDrone(g){
  const p=g.player,diff=DIFFICULTIES[g.difficulty],first=g.nextId===1;
  const angle=first?p.yaw+.16:p.yaw+(g.random()-.5)*Math.PI*2;
  const range=first?76:70+g.random()*24;
  const y=5+g.random()*4,ty=p.altitude+(g.mode==='armor'?1.35:.85);
  // Search nearby directions first; keep range, altitude and speed unchanged.
  // If no corridor exists, retry later rather than spawn inside scenery.
  for(let i=0;i<48;i++){
    const offset=Math.ceil(i/2)*(i%2?1:-1)*Math.PI/24;
    const x=p.x-Math.sin(angle+offset)*range,z=p.z-Math.cos(angle+offset)*range;
    if(!clearApproach(x,y,z,p.x,ty,p.z)||!clearApproach(x,y,z,p.x+p.vx*.25,ty,p.z+p.vz*.25))continue;
    const dx=p.x-x,dy=ty-y,dz=p.z-z,length=Math.hypot(dx,dy,dz),speed=diff.speed*.82;
    g.drones.push({id:g.nextId++,x,y,z,vx:dx/length*speed,vy:dy/length*speed,vz:dz/length*speed,age:0,phase:'approach',roll:0,pitch:0,closest:Infinity,passed:false});
    return true;
  }
  return false;
}
function explode(g,d,hitPlayer){
  g.explosions.push({x:d.x,y:Math.max(.3,d.y),z:d.z,age:0,seed:d.id});d.phase='dead';
  if(hitPlayer)hit(g,'drone');else g.dodges++;
}
function steerDrone(d,tx,ty,tz,diff,dt){
  const speed=Math.hypot(d.vx,d.vy,d.vz),nextSpeed=Math.min(diff.speed,speed+diff.acceleration*dt);
  const desiredLength=Math.max(.001,Math.hypot(tx-d.x,ty-d.y,tz-d.z));
  const ax=d.vx/speed,ay=d.vy/speed,az=d.vz/speed;
  const bx=(tx-d.x)/desiredLength,by=(ty-d.y)/desiredLength,bz=(tz-d.z)/desiredLength;
  const angle=Math.acos(clamp(ax*bx+ay*by+az*bz,-1,1));
  const maxTurn=diff.turnAcceleration/Math.max(speed,1)*dt;
  let nx=ax,ny=ay,nz=az;
  if(angle<1e-6){nx=bx;ny=by;nz=bz}
  else {
    // Bounded spherical steering preserves speed through turns. This is an
    // arcade flight model, not a flight-controller or pilot-performance model.
    const turn=Math.min(angle,maxTurn),projection=ax*bx+ay*by+az*bz;
    let px=bx-ax*projection,py=by-ay*projection,pz=bz-az*projection;
    let plen=Math.hypot(px,py,pz);
    if(plen<1e-6){px=-az;py=0;pz=ax;plen=Math.hypot(px,pz);if(plen<1e-6){px=1;plen=1}}
    nx=ax*Math.cos(turn)+px/plen*Math.sin(turn);ny=ay*Math.cos(turn)+py/plen*Math.sin(turn);nz=az*Math.cos(turn)+pz/plen*Math.sin(turn);
  }
  const oldYaw=Math.atan2(-d.vx,-d.vz),newYaw=Math.atan2(-nx,-nz);
  const bank=clamp(-Math.atan2(angleDifference(newYaw,oldYaw)*nextSpeed/dt,9.81),-.95,.95);
  d.roll+=(bank-d.roll)*(1-Math.exp(-dt*9));
  d.vx=nx*nextSpeed;d.vy=ny*nextSpeed;d.vz=nz*nextSpeed;
}
function simulate(g,input,dt){
  const p=g.player,cfg=MODES[g.mode],diff=DIFFICULTIES[g.difficulty];
  g.elapsed=Math.min(DURATION,g.elapsed+dt);p.invulnerable=Math.max(0,p.invulnerable-dt);g.collision=Math.max(0,g.collision-dt*2);
  p.jumpCooldown=Math.max(0,p.jumpCooldown-dt);p.landing=Math.max(0,p.landing-dt*3);
  let forward=clamp(Number(input.forward)||0,-1,1),right=clamp(Number(input.right)||0,-1,1);
  const jump=!!input.jump;
  if(g.mode==='foot'&&jump&&!p.jumpHeld&&p.altitude===0&&p.jumpCooldown===0&&p.energy>=JUMP.cost){
    p.verticalSpeed=JUMP.speed;p.jumpCooldown=JUMP.cooldown;p.energy-=JUMP.cost;
    const length=Math.max(1,Math.hypot(forward,right));
    p.dodgeX=(-Math.sin(p.yaw)*forward+Math.cos(p.yaw)*right)/length*1.8;
    p.dodgeZ=(-Math.cos(p.yaw)*forward-Math.sin(p.yaw)*right)/length*1.8;
  }
  p.jumpHeld=jump;
  if(p.verticalSpeed!==0||p.altitude>0){
    p.altitude+=p.verticalSpeed*dt-.5*JUMP.gravity*dt*dt;p.verticalSpeed-=JUMP.gravity*dt;
    if(p.altitude<=0){p.altitude=0;p.verticalSpeed=0;p.landing=.22}
  }
  p.y=cfg.eye+p.altitude;
  if(p.energy>22)p.exhausted=false;
  p.boosting=!!input.boost&&(Math.abs(forward)+Math.abs(right)>.05)&&!p.exhausted&&p.energy>0;
  p.energy=clamp(p.energy+(p.boosting?-24:13)*dt,0,100);if(p.energy<=0)p.exhausted=true;
  const topSpeed=p.boosting?cfg.boost:cfg.speed;
  const oldX=p.x,oldZ=p.z;
  if(g.mode==='foot'){
    const len=Math.max(1,Math.hypot(forward,right));forward/=len;right/=len;
    const tx=(-Math.sin(p.yaw)*forward+Math.cos(p.yaw)*right)*topSpeed+p.dodgeX;
    const tz=(-Math.cos(p.yaw)*forward-Math.sin(p.yaw)*right)*topSpeed+p.dodgeZ;
    const damping=1-Math.exp(-(p.altitude>0?5:cfg.response)*dt);p.vx+=(tx-p.vx)*damping;p.vz+=(tz-p.vz)*damping;p.bodyYaw=p.yaw;
    p.dodgeX*=Math.exp(-dt*3);p.dodgeZ*=Math.exp(-dt*3);
  }else{
    const steer=-right*(g.mode==='bike'?1.35:.78)*clamp(Math.abs(p.speed)/2,.12,1)*dt*(p.speed<-.1?-1:1);
    p.bodyYaw+=steer;p.yaw+=steer;
    const desired=forward*(forward<0?topSpeed*.35:topSpeed);
    p.speed+=(desired-p.speed)*(1-Math.exp(-cfg.response*dt));
    p.vx=-Math.sin(p.bodyYaw)*p.speed;p.vz=-Math.cos(p.bodyYaw)*p.speed;
  }
  const blocks=b=>p.altitude<b.h;
  const nextX=clamp(p.x+p.vx*dt,-WORLD_LIMIT+cfg.radius,WORLD_LIMIT-cfg.radius);
  if(!OBSTACLES.some(b=>blocks(b)&&circleHitsRect(nextX,p.z,cfg.radius,b)))p.x=nextX;else{p.vx=0;g.collision=.4;if(g.mode!=='foot')p.speed*=Math.exp(-dt*20)}
  const nextZ=clamp(p.z+p.vz*dt,-WORLD_LIMIT+cfg.radius,WORLD_LIMIT-cfg.radius);
  if(!OBSTACLES.some(b=>blocks(b)&&circleHitsRect(p.x,nextZ,cfg.radius,b)))p.z=nextZ;else{p.vz=0;g.collision=.4;if(g.mode!=='foot')p.speed*=Math.exp(-dt*20)}
  const moved=Math.hypot(p.x-oldX,p.z-oldZ);g.distance+=moved;
  if(g.mode==='foot')p.speed=moved/dt;
  g.boundary=Math.abs(p.x)>WORLD_LIMIT-4||Math.abs(p.z)>WORLD_LIMIT-4;
  if(g.elapsed>=g.nextDrone){
    const blocked=g.drones.length<diff.max&&!spawnDrone(g);
    g.nextDrone=blocked?g.elapsed+.5:g.nextDrone+diff.interval*(1-g.elapsed/DURATION*.25);
  }
  g.nearest=Infinity;g.threat=0;
  for(const d of g.drones){
    d.age+=dt;
    let dx=p.x-d.x,dz=p.z-d.z;
    const distance=Math.hypot(dx,p.y*.5+p.altitude*.5-d.y,dz);
    g.nearest=Math.min(g.nearest,distance);d.closest=Math.min(d.closest,distance);
    if(d.phase==='approach'){
      // A small fictional look-ahead makes running straight insufficient while
      // keeping this a readable arcade challenge. No hardware-specific guidance.
      const tx=p.x+p.vx*.25,ty=p.altitude+(g.mode==='armor'?1.35:.85),tz=p.z+p.vz*.25;
      steerDrone(d,tx,ty,tz,diff,dt);
      if(distance<diff.commitDistance)d.phase='commit';
    }
    const speed=Math.hypot(d.vx,d.vy,d.vz);g.peakDroneSpeed=Math.max(g.peakDroneSpeed,speed);
    const slices=Math.max(1,Math.ceil(speed*dt/.12));
    for(let j=0;j<slices&&d.phase!=='dead';j++){
      d.x+=d.vx*dt/slices;d.y+=d.vy*dt/slices;d.z+=d.vz*dt/slices;
      const bodyY=clamp(d.y,p.altitude+.18,p.altitude+cfg.eye-.1);
      const close=Math.hypot(d.x-p.x,d.y-bodyY,d.z-p.z)<cfg.radius+.24;
      const obstacle=OBSTACLES.some(b=>d.y<b.h+.12&&d.y>-.12&&circleHitsRect(d.x,d.z,.22,b));
      if(close)explode(g,d,true);else if(d.y<.12||obstacle)explode(g,d,false);
    }
    dx=p.x-d.x;dz=p.z-d.z;
    const departing=d.vx*dx+d.vy*(p.y-d.y)+d.vz*dz<0;
    if(d.phase==='commit'&&departing&&!d.passed){
      d.passed=true;d.phase='pass';
      if(d.closest<4){g.nearMisses++;g.passCount++;g.lastPass={time:g.elapsed,side:clamp((d.x-p.x)*Math.cos(p.yaw)-(d.z-p.z)*Math.sin(p.yaw),-1,1),gap:d.closest,speed};}
    }
    if(d.phase!=='dead'&&(d.age>13||(d.phase==='pass'&&Math.hypot(dx,dz)>35))){d.phase='dead';g.dodges++}
    if(d.phase==='commit')g.threat=1;else if(d.phase==='approach'&&distance<40)g.threat=Math.max(g.threat,.6);
  }
  g.drones=g.drones.filter(d=>d.phase!=='dead');g.explosions=g.explosions.filter(e=>(e.age+=dt)<1.2);
  if(g.elapsed>=DURATION&&g.status==='playing')g.status='won';
}
export function stepGame(g,input,delta){
  if(g.status!=='playing'||!Number.isFinite(delta)||delta<=0)return;
  let remaining=Math.min(delta,.25);
  while(remaining>1e-9&&g.status==='playing'){const dt=Math.min(remaining,PHYSICS_STEP,DURATION-g.elapsed);if(dt<=1e-9){g.elapsed=DURATION;g.status='won';break}simulate(g,input,dt);remaining-=dt;}
}
