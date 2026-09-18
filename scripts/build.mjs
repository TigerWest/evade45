import { copyFile, mkdir, readFile } from 'node:fs/promises';
await mkdir(new URL('../dist/vendor/', import.meta.url), {recursive:true});
for (const file of ['three.module.js','three.core.js']) {
  await copyFile(new URL(`../node_modules/three/build/${file}`, import.meta.url),new URL(`../dist/vendor/${file}`, import.meta.url));
}
await copyFile(new URL('../node_modules/three/LICENSE',import.meta.url),new URL('../dist/vendor/THREE-LICENSE.txt',import.meta.url));
for (const file of ['index.html','style.css','engine.js','render.js','game.js','audio.js']) {
  const source=await readFile(new URL(`../dist/${file}`,import.meta.url),'utf8');
  if(!source.trim())throw new Error(`Missing source: ${file}`);
}
console.log('3D game ready in dist/ (Three.js bundled locally).');
