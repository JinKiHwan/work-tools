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
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../index.html')).href+'#images'});
 await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('#file-format')?.options.length){clearInterval(t);resolve();}else if(++n>200){clearInterval(t);reject(Error('Load timeout'));}},50)})`);
 await evaluate(`window.converterDownloads=[];window.download=(blob,name)=>converterDownloads.push({blob,name});window.testImage=async()=>{const c=document.createElement('canvas');c.width=80;c.height=40;const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,40,40);const blob=await new Promise(r=>c.toBlob(r,'image/png'));var dt=new DataTransfer();dt.items.add(new File([blob],'sample.png',{type:'image/png'}));dt.items.add(new File([blob],'sample.png',{type:'image/png'}));document.querySelector('#image-file').files=dt.files;document.querySelector('#image-file').dispatchEvent(new Event('change'));};window.waitConversion=()=>new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(!document.querySelector('#convert-images').disabled){clearInterval(t);resolve();}else if(++n>300){clearInterval(t);reject(Error('Conversion timeout'));}},20)});`);
 for(const format of ['webp','png','jpg']){
 await evaluate(`document.querySelector('#clear-images').click();testImage()`);
 await evaluate(`document.querySelector('#file-format').value='${format}';document.querySelector('#file-format').dispatchEvent(new Event('change'));document.querySelector('#convert-images').click();waitConversion()`);
 assert.ok(await evaluate(`document.querySelector('#image-count').textContent.includes('2개 변환 완료')`));
 await evaluate(`document.querySelector('.image-row button').click()`);
 assert.equal(await evaluate(`converterDownloads.at(-1).blob.type`),format==='jpg'?'image/jpeg':'image/'+format);
 if(format==='jpg')assert.deepEqual(await evaluate(`(async()=>{const image=await createImageBitmap(converterDownloads.at(-1).blob);const c=document.createElement('canvas');c.width=80;c.height=40;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(70,20,1,1).data];})()`),[255,255,255,255]);
 }
 await evaluate(`document.querySelector('#download-zip').click();new Promise(r=>setTimeout(r,200))`);
 assert.deepEqual(await evaluate(`converterDownloads.at(-1).blob.arrayBuffer().then(b=>Object.keys(fflate.unzipSync(new Uint8Array(b))))`),['sample.jpg','sample-2.jpg']);
 await evaluate(`document.querySelector('#file-category').value='icon';document.querySelector('#file-category').dispatchEvent(new Event('change'));testImage()`);
 await evaluate(`document.querySelector('#convert-images').click();waitConversion()`);await evaluate(`document.querySelector('.image-row button').click()`);
 assert.deepEqual(await evaluate(`converterDownloads.at(-1).blob.arrayBuffer().then(b=>{const v=new DataView(b);return [v.getUint16(2,true),v.getUint16(4,true),v.getUint8(6),v.getUint8(54)];})`),[1,4,16,0]);
 const font=fs.readFileSync('C:/Windows/Fonts/arial.ttf').toString('base64');
 await evaluate(`document.querySelector('#file-category').value='font';document.querySelector('#file-category').dispatchEvent(new Event('change'));window.testFont=Uint8Array.from(atob('${font}'),c=>c.charCodeAt(0));var dt=new DataTransfer();dt.items.add(new File([testFont],'test.ttf'));document.querySelector('#image-file').files=dt.files;document.querySelector('#image-file').dispatchEvent(new Event('change'));document.querySelector('#convert-images').click();waitConversion()`);
 assert.ok(await evaluate(`document.querySelector('#image-count').textContent.includes('1개 변환 완료')`));await evaluate(`document.querySelector('.image-row button').click()`);
 assert.equal(await evaluate(`converterDownloads.at(-1).blob.arrayBuffer().then(async b=>{window.testWoff=b;return (await new FontFace('ConvertedWoff',b).load()).status;})`),'loaded');
 await evaluate(`document.querySelector('#clear-images').click();document.querySelector('#file-format').value='ttf';document.querySelector('#file-format').dispatchEvent(new Event('change'));var dt=new DataTransfer();dt.items.add(new File([testWoff],'test.woff'));document.querySelector('#image-file').files=dt.files;document.querySelector('#image-file').dispatchEvent(new Event('change'));document.querySelector('#convert-images').click();waitConversion()`);
 await evaluate(`document.querySelector('.image-row button').click()`);
 assert.equal(await evaluate(`converterDownloads.at(-1).blob.arrayBuffer().then(async b=>(await new FontFace('ConvertedTtf',b).load()).status)`),'loaded');
 assert.deepEqual(errors,[]);console.log('PASS: PNG/JPG/WEBP, JPEG alpha fill, ZIP duplicate names, multi-size ICO, TTF/WOFF real font loading.');
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
