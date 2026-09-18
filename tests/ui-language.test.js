import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as engine from '../dist/engine.js';
import * as i18n from '../dist/i18n.js';

// Run the real UI event handlers with a small host stub, without WebGL or a browser.
async function boot({saved=null,blockedStorage=false,languages=['ko-KR']}={}){
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const elements=[],ids=new Map(),registered=new Map(),storage=new Map(saved?[['dead-air.locale',saved]]:[]);
  const document={documentElement:{lang:'ko'},activeElement:null,addEventListener(){},getElementById:id=>ids.get(id),
    querySelectorAll:selector=>elements.filter(e=>e.hasAttribute(selector.slice(1,-1))),
    modelContext:{registerTool:tool=>registered.set(tool.name,tool)}};
  for(const match of html.matchAll(/<([a-z][\w-]*)(\s[^>]*?)?>/g)){
    const attrs=Object.fromEntries([...String(match[2]??'').matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])),events=new Map();
    const element={dataset:{},style:{},hidden:/\bhidden\b/.test(match[2]??''),textContent:'',value:'',
      getAttribute:key=>attrs[key],hasAttribute:key=>Object.hasOwn(attrs,key),setAttribute:(key,value)=>attrs[key]=value,
      classList:{toggle(){}},querySelector:()=>({textContent:''}),
      addEventListener(name,fn){events.set(name,[...(events.get(name)??[]),fn])},
      async emit(name){for(const fn of events.get(name)??[])await fn({target:this})},
      focus(){document.activeElement=this;for(const fn of events.get('focus')??[])fn({target:this})},
    };
    for(const [key,value] of Object.entries(attrs))if(key.startsWith('data-'))element.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
    elements.push(element);if(attrs.id)ids.set(attrs.id,element);
  }
  const audio={unlock:async()=>true,setEnabled(){},suspend(){},update(){},impact(){},passBy(){},destroy(){}};
  let frame;
  const context={...engine,...i18n,document,navigator:{languages},performance:{now:()=>0},console,AbortController,
    localStorage:{getItem(key){if(blockedStorage)throw Error('Storage blocked');return storage.get(key)},setItem(key,value){if(blockedStorage)throw Error('Storage blocked');storage.set(key,value)}},
    matchMedia:()=>({matches:false}),createAudio:()=>audio,rendererModule:{createRenderer:()=>({render(){},destroy(){}})},
    requestAnimationFrame:fn=>{frame=fn;return 1},cancelAnimationFrame(){},addEventListener(){},location:{reload(){}},
  };
  context.window=context;
  let source=await readFile(new URL('../dist/game.js',import.meta.url),'utf8');
  source=source.replace(/^import .*;\n/gm,'').replace("await import('./render.js')",'rendererModule');
  await vm.runInNewContext(`(async()=>{${source}\n})()`,context);
  return {document,ids,storage,status:()=>registered.get('read_simulation_status').execute(),tick:time=>frame(time),
    async language(value){ids.get('language-select').value=value;ids.get('language-select').focus();await ids.get('language-select').emit('change')},
    async click(id){await ids.get(id).emit('click')},elements};
}

test('language selection persists and updates the running UI without resetting a run',async()=>{
  const ui=await boot();
  assert.equal(ui.document.documentElement.lang,'ko');
  await ui.click('start-button');ui.tick(200);
  const before=ui.status();assert.equal(before.status,'playing');assert.ok(before.elapsed>0);
  await ui.language('en');
  const after=ui.status();assert.equal(after.status,'paused');assert.equal(after.elapsed,before.elapsed);
  assert.equal(after.mode,before.mode);assert.equal(after.health,before.health);assert.equal(after.locale,'en');
  assert.equal(ui.ids.get('mode-label').textContent,'On foot');
  assert.equal(ui.ids.get('language-select'),ui.document.activeElement,'language menu must retain keyboard focus');
  assert.equal(ui.ids.get('pause-screen').hidden,false);
  assert.equal(ui.storage.get('dead-air.locale'),'en');
  await ui.click('audio-button');await ui.language('ko');
  assert.equal(ui.ids.get('audio-button').textContent,'소리 꺼짐');
  assert.equal(ui.ids.get('audio-button').getAttribute('aria-label'),'소리 켜기');
  assert.equal(ui.status().elapsed,before.elapsed);
  const next=await boot({saved:ui.storage.get('dead-air.locale'),languages:['en-US']});
  assert.equal(next.document.documentElement.lang,'ko');
});

test('language switching works when browser storage is unavailable',async()=>{
  const ui=await boot({blockedStorage:true,languages:['en-US']});
  assert.equal(ui.document.documentElement.lang,'en');
  await ui.language('ko');assert.equal(ui.document.documentElement.lang,'ko');
  assert.equal(ui.ids.get('entry-note').textContent,i18n.messages.ko['controls.foot']);
  assert.equal(ui.ids.get('start-button').disabled,undefined);
});

test('finished results translate in place while preserving stats and retry settings',async()=>{
  const ui=await boot();
  await ui.elements.find(e=>e.dataset.mode==='bike').emit('click');
  await ui.click('start-button');
  for(let time=250;time<=10000&&ui.status().status==='playing';time+=250)ui.tick(time);
  assert.equal(ui.status().status,'lost');
  assert.equal(ui.ids.get('result-title').textContent,'드론에 맞았습니다.');
  const time=ui.ids.get('result-time').innerHTML;
  await ui.language('en');
  assert.equal(ui.ids.get('result-title').textContent,'You were hit by a drone.');
  assert.match(ui.ids.get('result-description').textContent,/Motorcycle · Normal/);
  assert.equal(ui.ids.get('result-time').innerHTML,time);
  assert.equal(ui.ids.get('result-screen').hidden,false);
  await ui.click('retry-button');
  assert.equal(ui.status().status,'playing');assert.equal(ui.status().mode,'bike');assert.equal(ui.status().locale,'en');
});
