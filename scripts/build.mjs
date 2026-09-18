import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import {translate} from '../dist/i18n.js';
// Keep useful Korean HTML before JavaScript loads, from the same copy catalog.
const htmlPath=new URL('../dist/index.html',import.meta.url);
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let html=await readFile(htmlPath,'utf8');
html=html.replace(/<([a-z][\w-]*)([^>]*\bdata-i18n="([^"]+)"[^>]*)>[^<]*<\/\1>/g,
  (_,tag,attributes,key)=>`<${tag}${attributes}>${escape(translate('ko',key))}</${tag}>`);
for(const [attribute,target] of [['data-i18n-aria','aria-label'],['data-i18n-content','content']]){
  html=html.replace(new RegExp(`<([a-z][\\w-]*)([^>]*\\b${attribute}="([^"]+)"[^>]*)>`,'g'),(_,tag,attributes,key)=>{
    const clean=attributes.replace(new RegExp(`\\s${target}="[^"]*"`,'g'),'');
    return `<${tag}${clean} ${target}="${escape(translate('ko',key))}">`;
  });
}
await writeFile(htmlPath,html);
await mkdir(new URL('../dist/vendor/', import.meta.url), {recursive:true});
for (const file of ['three.module.js','three.core.js']) {
  await copyFile(new URL(`../node_modules/three/build/${file}`, import.meta.url),new URL(`../dist/vendor/${file}`, import.meta.url));
}
await copyFile(new URL('../node_modules/three/LICENSE',import.meta.url),new URL('../dist/vendor/THREE-LICENSE.txt',import.meta.url));
for (const file of ['index.html','style.css','engine.js','render.js','game.js','audio.js','i18n.js']) {
  const source=await readFile(new URL(`../dist/${file}`,import.meta.url),'utf8');
  if(!source.trim())throw new Error(`Missing source: ${file}`);
}
console.log('3D game ready in dist/ (Three.js bundled locally).');
