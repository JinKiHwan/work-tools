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
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../index.html')).href+'#background'});
 await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('#bg-run')?.onclick){clearInterval(t);resolve();}else if(++n>200){clearInterval(t);reject(Error('Load timeout'));}},50)})`);
 const photo=fs.readFileSync('C:/Windows/Web/Wallpaper/Windows/img0.jpg').toString('base64');
 await evaluate(`(async()=>{window.bgDownloads=[];window.download=(blob,name)=>bgDownloads.push({blob,name});const im=new Image();im.src='data:image/jpeg;base64,${photo}';await im.decode();const c=document.createElement('canvas');c.width=320;c.height=200;c.getContext('2d').drawImage(im,0,0,320,200);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();window.bgTestFile=new File([blob],'test.png',{type:'image/png'});dt.items.add(bgTestFile);document.querySelector('#bg-file').files=dt.files;document.querySelector('#bg-file').dispatchEvent(new Event('change'));})()`);
 assert.equal(await evaluate(`document.querySelectorAll('.bg-card').length`),1);
 await evaluate(`document.querySelector('#bg-run').click()`);
 await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('#bg-stop').hidden){clearInterval(t);resolve();}else if(++n>900){clearInterval(t);reject(Error('Inference timeout'));}},200)})`);
 console.log(await evaluate(`document.querySelector('.bg-card-status').textContent`));
 assert.equal(await evaluate(`document.querySelectorAll('.bg-card-actions button').length`),1);
 await evaluate(`document.querySelector('.bg-card-actions button').click()`);
 assert.equal(await evaluate(`bgDownloads[0].blob.type`),'image/png');
 assert.ok(await evaluate(`bgDownloads[0].blob.arrayBuffer().then(b=>b.byteLength>0)`));
 assert.equal(await evaluate(`bgDownloads[0].blob.arrayBuffer().then(async b=>{const bitmap=await createImageBitmap(new Blob([b],{type:'image/png'}));const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;return data.some((v,i)=>i%4===3&&v<255);})`),true);
 await evaluate(`document.querySelector('#bg-clear').click();document.querySelector('#bg-format').value='webp';var dt=new DataTransfer();dt.items.add(bgTestFile);document.querySelector('#bg-file').files=dt.files;document.querySelector('#bg-file').dispatchEvent(new Event('change'));document.querySelector('#bg-run').click();`);
 await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('#bg-stop').hidden){clearInterval(t);resolve();}else if(++n>450){clearInterval(t);reject(Error('Inference timeout'));}},200)})`);
 await evaluate(`document.querySelector('.bg-card-actions button').click();`);
 assert.equal(await evaluate(`bgDownloads.at(-1).blob.type`),'image/webp');
 await evaluate(`document.querySelector('#bg-zip').click();new Promise(r=>setTimeout(r,300));`);
 assert.equal(await evaluate(`bgDownloads.at(-1).name`),'background-removed.zip');
 await evaluate(`(async()=>{document.querySelector('#bg-clear').click();document.querySelector('#bg-format').value='png';const c=document.createElement('canvas');c.width=2;c.height=1;const ctx=c.getContext('2d'),p=ctx.createImageData(2,1);p.data.set([100,100,100,20,100,100,100,255]);ctx.putImageData(p,0,0);window.alphaTestBlob=await new Promise(r=>c.toBlob(r,'image/png'));BackgroundRemoval.removeBackground=async()=>alphaTestBlob;var dt=new DataTransfer();dt.items.add(new File([alphaTestBlob],'alpha.png',{type:'image/png'}));document.querySelector('#bg-file').files=dt.files;document.querySelector('#bg-file').dispatchEvent(new Event('change'));document.querySelector('#bg-run').click();})()`);
 await evaluate(`new Promise(r=>{const t=setInterval(()=>{if(document.querySelector('#bg-stop').hidden){clearInterval(t);r();}},50);})`);
 await evaluate(`document.querySelector('.bg-card-actions button').click();window.readAlphas=async()=>{const b=await createImageBitmap(bgDownloads.at(-1).blob),c=document.createElement('canvas');c.width=2;c.height=1;const ctx=c.getContext('2d');ctx.drawImage(b,0,0);const p=ctx.getImageData(0,0,2,1).data;return [p[3],p[7]];};`);
 assert.deepEqual(await evaluate('readAlphas()'),[0,255]);
 await evaluate(`document.querySelector('#bg-cleanup').value=0;document.querySelector('#bg-apply').click();new Promise(r=>setTimeout(r,100));`);
 await evaluate(`document.querySelector('.bg-card-actions button').click();`);
 assert.deepEqual(await evaluate('readAlphas()'),[20,255]);
 console.log('PASS: actual AI, PNG/WEBP/ZIP, faint alpha cleanup, opaque preservation, non-destructive restore.');
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
