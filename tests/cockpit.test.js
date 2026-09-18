import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createGame} from '../dist/engine.js';
import {createCockpit} from '../dist/cockpit.js';

function fixture(t){
  // Texture painting is irrelevant to transforms/raycasting; use real Three.js geometry.
  const previous=globalThis.document;
  const context={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},translate(){},fillText(){}};
  globalThis.document={createElement:()=>({getContext:()=>context})};
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.rotation.order='YXZ';scene.add(camera);
  let cockpit;try{cockpit=createCockpit(camera)}finally{globalThis.document=previous}
  t.after(()=>cockpit.destroy());
  const game=createGame('armor');game.status='playing';
  const update=()=>{const p=game.player;camera.position.set(p.x,p.y,p.z);camera.rotation.set(p.pitch,p.yaw,0);cockpit.update(game,0,1/60,true);scene.updateMatrixWorld(true)};
  update();return {scene,camera,cockpit,game,update};
}

test('vehicle hull stays fixed while the camera looks through a full yaw/pitch sweep',t=>{
  const {scene,game,update}=fixture(t);let hull;
  scene.traverse(o=>{if(o.isMesh&&o.scale.x===3.2&&o.scale.z===2.6)hull=o});assert.ok(hull);
  for(const bodyYaw of [0,1.1,3.1]){
    game.player.bodyYaw=bodyYaw;game.player.yaw=bodyYaw;game.player.pitch=0;update();
    const expected=hull.matrixWorld.clone();
    for(const yaw of [-Math.PI,-1.7,0,1.7,Math.PI])for(const pitch of [-1.18,0,1.3]){
      game.player.yaw=yaw;game.player.pitch=pitch;update();
      assert.ok(hull.matrixWorld.elements.every((n,i)=>Math.abs(n-expected.elements[i])<1e-8),`hull moved with gaze: body=${bodyYaw}, yaw=${yaw}, pitch=${pitch}`);
    }
  }
});

test('armored cabin encloses the driver on both sides, above, below and behind',t=>{
  const {scene,camera}=fixture(t);
  for(const [name,direction] of [['left door',[-1,-.4,0]],['right door',[1,-.4,0]],['ceiling',[0,1,0]],['floor',[0,-1,0]],['rear bulkhead',[0,0,1]]]){
    const ray=new THREE.Raycaster(camera.position,new THREE.Vector3(...direction).normalize(),.045,2.4);
    const hits=ray.intersectObjects(scene.children,true).filter(hit=>{let o=hit.object;while(o){if(!o.visible)return false;o=o.parent}return true});
    assert.ok(hits.length,`missing ${name}`);
  }
});

test('vehicles follow chassis position and heading, hide in menu, and dispose cleanly',t=>{
  const {scene,camera,cockpit,game,update}=fixture(t);let hull;
  scene.traverse(o=>{if(o.isMesh&&o.scale.x===3.2&&o.scale.z===2.6)hull=o});
  Object.assign(game.player,{x:12,z:-8,bodyYaw:1.4,yaw:-2,pitch:.9});update();
  const expected=new THREE.Vector3(0,-.79,-1.55).applyAxisAngle(new THREE.Vector3(0,1,0),1.4).add(new THREE.Vector3(12,game.player.y,-8));
  assert.ok(hull.getWorldPosition(new THREE.Vector3()).distanceTo(expected)<1e-8);
  game.status='ready';update();let node=hull,hidden=false;while(node){hidden||=!node.visible;node=node.parent}assert.ok(hidden);
  cockpit.destroy();assert.equal(scene.children.length,1);assert.equal(camera.children.length,0);
});
