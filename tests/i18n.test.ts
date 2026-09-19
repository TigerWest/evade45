import {test} from 'vitest';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {messages,resolveLocale,translate,applyLocale} from '../src/i18n';
import {MODES,DIFFICULTIES} from '../src/game/engine';

const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();

test('all locales have the same keys and interpolation values',()=>{
  for(const locale of Object.keys(messages)){
    assert.deepEqual(Object.keys(messages[locale]).sort(),Object.keys(messages.ko).sort());
    for(const [key,value] of Object.entries(messages[locale])){
      assert.ok(value.trim(),`${locale}.${key}`);
      assert.deepEqual(placeholders(value),placeholders(messages.ko[key]),`${locale}.${key}`);
      if(locale==='en')assert.doesNotMatch(value,/[가-힣]/,key);
    }
  }
});

test('saved selection wins; browser regional languages resolve with a supported fallback',()=>{
  assert.equal(resolveLocale('en',['ko-KR']),'en');
  assert.equal(resolveLocale('ko',['en-US']),'ko');
  assert.equal(resolveLocale(null,['en-US','ko-KR']),'en');
  assert.equal(resolveLocale(null,['ja-JP','ko-KR','en-US']),'ko');
  assert.equal(resolveLocale('invalid',['EN_gb']),'en');
  assert.equal(resolveLocale(undefined,['fr-FR']),'en');
  assert.equal(resolveLocale('toString',[]),'en');
});

test('dynamic results and specs use translated mode names, difficulty and values',()=>{
  for(const locale of Object.keys(messages))for(const mode of Object.keys(MODES))for(const difficulty of Object.keys(DIFFICULTIES)){
    const values={mode:translate(locale,`mode.${mode}`),difficulty:translate(locale,`difficulty.${difficulty}`),time:'12.5'};
    for(const key of ['result.wonDescription','result.lostDescription','result.lostKicker']){
      const result=translate(locale,key,values);assert.doesNotMatch(result,/\{\w+\}/);assert.ok(result.includes(values.mode));
    }
    assert.ok(translate(locale,'spec.summary',{speed:97,source:'Avata 2 / Manual'}).includes('97 km/h'));
  }
  assert.equal(translate('en','hud.armor',{health:1}),'Armor remaining 1 / 2');
  assert.equal(translate('unknown','start'),messages.ko.start);
  assert.throws(()=>translate('en','missing.key'),/Unknown translation/);
});

test('every static React translation reference exists in both locales',async()=>{
  const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
  const keys=[...app.matchAll(/\bt\('([^']+)'/g)].map(m=>m[1]);
  assert.ok(keys.length>35);
  for(const key of keys)for(const locale of Object.keys(messages))assert.equal(typeof messages[locale][key],'string',`${locale}.${key}`);
  assert.doesNotMatch(app,/화면 너머|소리가 멈췄습니다|실전 압박/);
});

test('switching locale replaces content and accessibility labels without removing markup',()=>{
  function element(attributes){return {attributes,textContent:'',getAttribute(key){return this.attributes[key]},setAttribute(key,value){this.attributes[key]=value}}}
  const title=element({'data-i18n':'page.title'}),label=element({'data-i18n':'start'}),button=element({'data-i18n-aria':'help.openLabel'}),meta=element({'data-i18n-content':'page.description'});
  const root={documentElement:{lang:'ko'},querySelectorAll(selector){const attribute=selector.slice(1,-1);return [title,label,button,meta].filter(e=>attribute in e.attributes)}};
  for(const locale of ['en','ko','en']){
    applyLocale(root,locale);
    assert.equal(root.documentElement.lang,locale);
    assert.equal(title.textContent,messages[locale]['page.title']);
    assert.equal(label.textContent,messages[locale].start);
    assert.equal(button.attributes['aria-label'],messages[locale]['help.openLabel']);
    assert.equal(meta.attributes.content,messages[locale]['page.description']);
    assert.equal(label.attributes['data-i18n'],'start');
  }
});
