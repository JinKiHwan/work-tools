// Run against a dedicated Chromium browser with --remote-debugging-port=9226.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
 const target = await (await fetch('http://127.0.0.1:9226/json/new?about:blank', { method: 'PUT' })).json();
 const ws = new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const data=JSON.parse(e.data);if(data.id){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text+' '+(data.params.exceptionDetails.exception?.description||''));};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
 try{
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../index.html')).href+'#translations'});
 await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('#paste-load')?.onclick){clearInterval(t);resolve();}else if(++n>200){clearInterval(t);reject(Error('Load timeout'));}},30)})`);
 const table='EN\tKO\tJA\nHello\t안녕하세요\tこんにちは\nHello\t반가워요\t\nStart\t시작\t開始';
 await evaluate(`window.translationDownloads=[];window.download=(blob,name)=>translationDownloads.push({blob,name});document.querySelector('#paste-text').value=${JSON.stringify(table)};document.querySelector('#paste-load').click();document.querySelector('#save-json').click();`);
 assert.equal(await evaluate(`translationDownloads.at(-1).name`),'translations.json');
 assert.deepEqual(await evaluate(`translationDownloads.at(-1).blob.text().then(t=>JSON.parse(t)['hello'])`),{ko:'안녕하세요',en:'Hello',ja:'こんにちは'});
 await evaluate(`document.querySelector('#translation-type').value='i18n';document.querySelector('#translation-type').dispatchEvent(new Event('change'));document.querySelector('#save-json').click();`);
 assert.equal(await evaluate(`translationDownloads.at(-1).name`),'i18n-json.zip');
 const translations=await evaluate(`translationDownloads.at(-1).blob.arrayBuffer().then(b=>Object.fromEntries(Object.entries(fflate.unzipSync(new Uint8Array(b))).map(([k,v])=>[k,JSON.parse(new TextDecoder().decode(v))])))`);
 assert.deepEqual(Object.keys(translations),['ko.json','en.json','ja.json']);
 assert.deepEqual(translations['ko.json'],{hello:'안녕하세요','hello-2':'반가워요',start:'시작'});
 assert.equal(translations['ja.json']['hello-2'],'');
 await evaluate(`document.querySelector('#translation-language').value='ja';document.querySelector('#translation-language').dispatchEvent(new Event('change'));document.querySelector('#save-language-json').click();`);
 assert.equal(await evaluate(`translationDownloads.at(-1).name`),'ja.json');
 assert.deepEqual(await evaluate(`JSON.parse(document.querySelector('#json-preview').textContent)`),translations['ja.json']);
 await evaluate(`document.querySelector('#save-js').click()`);
 assert.equal(await evaluate(`translationDownloads.at(-1).name`),'i18n-js.zip');
 assert.ok(await evaluate(`translationDownloads.at(-1).blob.arrayBuffer().then(b=>new TextDecoder().decode(fflate.unzipSync(new Uint8Array(b))['en.js']).startsWith('export default '))`));
 await evaluate(`document.querySelector('#translation-type').value='gamedex';document.querySelector('#translation-type').dispatchEvent(new Event('change'));document.querySelector('#save-json').click();`);
 assert.deepEqual(await evaluate(`translationDownloads.at(-1).blob.text().then(t=>JSON.parse(t)['hello'])`),{ko:'안녕하세요',en:'Hello',ja:'こんにちは'});
 await evaluate(`document.querySelector('#translation-type').value='i18n-ts';document.querySelector('#translation-type').dispatchEvent(new Event('change'));document.querySelector('#save-json').click();`);
 assert.equal(await evaluate(`translationDownloads.at(-1).name`),'i18n-locales-ts.zip');
 const modules=await evaluate(`translationDownloads.at(-1).blob.arrayBuffer().then(b=>Object.fromEntries(Object.entries(fflate.unzipSync(new Uint8Array(b))).map(([k,v])=>[k,new TextDecoder().decode(v)])))`);
 assert.deepEqual(Object.keys(modules),['i18n/locales/ko.ts','i18n/locales/en.ts','i18n/locales/ja.ts']);
 assert.deepEqual(JSON.parse(modules['i18n/locales/ko.ts'].replace(/^export default /,'').replace(/;\s*$/,'')),translations['ko.json']);
 await evaluate(`document.querySelector('#translation-language').value='en';document.querySelector('#translation-language').dispatchEvent(new Event('change'));document.querySelector('#save-language-json').click();`);
 assert.equal(await evaluate(`translationDownloads.at(-1).name`),'en.ts');
 assert.ok(await evaluate(`document.querySelector('#json-preview').textContent.startsWith('export default ')`));
 // Invalid duplicate keys must prevent downloads in both export modes.
 await evaluate(`document.querySelector('#translation-type').value='i18n';document.querySelector('#translation-type').dispatchEvent(new Event('change'));const cells=document.querySelectorAll('#translation-table tbody tr');cells[1].cells[0].innerText='hello';cells[1].cells[0].dispatchEvent(new Event('input'));window.beforeInvalid=translationDownloads.length;document.querySelector('#save-json').click();`);
 assert.equal(await evaluate(`translationDownloads.length===beforeInvalid`),true);
 assert.deepEqual(errors,[]);console.log('PASS: unchanged GAMEDEX output, per-language JSON/JS ZIP, individual JSON, language preview, empty values, duplicate keys and mode switching.');
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
