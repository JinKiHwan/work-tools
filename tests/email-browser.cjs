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
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../index.html')).href+'#email'});
 await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('#email-reset')?.onclick){clearInterval(t);resolve();}else if(++n>200){clearInterval(t);reject(Error('Loading timed out'));}},30)})`);
 await evaluate(`window.confirm=()=>true;document.querySelector('#email-reset').click();window.emailPreviewDoc=()=>document.querySelector('#email-preview').contentDocument;`);
 const waitPreview=()=>evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const doc=emailPreviewDoc();if(doc?.querySelector('.email-insert-toggle')&&doc.querySelectorAll('[data-email-block]').length===document.querySelectorAll('#email-block-list button').length){clearInterval(t);resolve();}else if(++n>200){clearInterval(t);reject(Error('Preview timed out'));}},30)})`);
 await waitPreview();
 assert.equal(await evaluate(`emailPreviewDoc().querySelectorAll('[data-email-block]').length`),0);
 assert.equal(await evaluate(`emailPreviewDoc().querySelector('.email-insert-choices').hidden`),true);
 assert.equal(await evaluate(`document.querySelectorAll('.email-sidebar>details').length`),1);
 await evaluate(`emailPreviewDoc().querySelector('.email-insert-toggle').click()`);
 assert.equal(await evaluate(`emailPreviewDoc().querySelector('.email-insert-choices').hidden`),false);
 assert.equal(await evaluate(`emailPreviewDoc().querySelectorAll('[data-block-type]').length`),6);
 if(process.env.EMAIL_SCREENSHOT){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(process.env.EMAIL_SCREENSHOT,Buffer.from(shot.data,'base64'));}
 const types=['image','text','button','divider','columns','spacer'];
 for(let i=0;i<types.length;i++){
 await evaluate(`(()=>{const p=emailPreviewDoc().querySelector('.email-preview-insert.last');if(p.querySelector('.email-insert-choices').hidden)p.querySelector('.email-insert-toggle').click();p.querySelector('[data-block-type="${types[i]}"]').click();})()`);await waitPreview();
 assert.equal(await evaluate(`emailPreviewDoc().querySelectorAll('[data-email-block]').length`),i+1);
 assert.ok(await evaluate(`document.querySelector('#email-inspector-title').textContent.includes('${({image:'이미지',text:'텍스트',button:'버튼',divider:'구분선',columns:'2단 텍스트',spacer:'여백'})[types[i]]}')`));
 }
 // In-place text editing is reflected in MJML and kept as plain text.
 await evaluate(`(()=>{const el=emailPreviewDoc().querySelector('[data-email-block="1"] [contenteditable="plaintext-only"]');el.focus();el.innerText='직접 수정한 제목';el.dispatchEvent(new InputEvent('input',{bubbles:true}));})()`);
 assert.ok(await evaluate(`document.querySelector('#email-code').textContent.includes('직접 수정한 제목')`));
 await evaluate(`(()=>{const weight=[...document.querySelectorAll('#email-inspector select')].find(el=>el.options.length===9);weight.value='700';weight.dispatchEvent(new Event('input'));weight.dispatchEvent(new Event('change'));})()`);await waitPreview();
 assert.ok(await evaluate(`document.querySelector('#email-code').textContent.includes('font-weight="700"')`));
 assert.equal(await evaluate(`emailPreviewDoc().querySelector('[data-email-block="1"] [contenteditable="plaintext-only"]').style.fontWeight`),'700');
 // Exercise real mouse input rather than synthetic DragEvent dispatch.
 await evaluate(`document.querySelector('#email-preview').scrollIntoView({block:'center'});emailPreviewDoc().querySelector('[data-email-block="0"]').click();`);
 const dragPoints=await evaluate(`(()=>{const frame=document.querySelector('#email-preview').getBoundingClientRect(),doc=emailPreviewDoc(),handle=doc.querySelector('[data-email-block="0"] .email-preview-drag').getBoundingClientRect(),target=doc.querySelector('[data-email-block="2"]').getBoundingClientRect();return {x:frame.left+handle.left+handle.width/2,y:frame.top+handle.top+handle.height/2,toX:frame.left+target.left+target.width/2,toY:frame.top+target.bottom-2};})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragPoints.x,y:dragPoints.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:dragPoints.x,y:dragPoints.y,button:'left',buttons:1,clickCount:1});
 for(let step=1;step<=8;step++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragPoints.x+(dragPoints.toX-dragPoints.x)*step/8,y:dragPoints.y+(dragPoints.toY-dragPoints.y)*step/8,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragPoints.toX,y:dragPoints.toY,button:'left',buttons:0,clickCount:1});await waitPreview();
 assert.ok(await evaluate(`document.querySelectorAll('#email-block-list button')[2].textContent.includes('이미지')`));
 // Selecting an image exposes URL/alt/width controls, then a button exposes its link.
 await evaluate(`emailPreviewDoc().querySelector('[data-email-block="2"]').click()`);
 assert.ok(await evaluate(`document.querySelector('#email-inspector').textContent.includes('이미지 URL')`));
 await evaluate(`emailPreviewDoc().querySelector('[data-email-block="1"]').click()`);
 assert.ok(await evaluate(`document.querySelector('#email-inspector').textContent.includes('이동할 주소')`));
 await evaluate(`emailPreviewDoc().querySelector('[data-email-block="1"] button[aria-label="블록 복제"]').click()`);await waitPreview();
 assert.equal(await evaluate(`emailPreviewDoc().querySelectorAll('[data-email-block]').length`),7);
 await evaluate(`emailPreviewDoc().querySelector('[data-email-block="2"] button[aria-label="블록 삭제"]').click()`);await waitPreview();
 assert.equal(await evaluate(`emailPreviewDoc().querySelectorAll('[data-email-block]').length`),6);
 await evaluate(`document.querySelector('#email-tab-html').click()`);
 assert.equal(await evaluate(`/email-inline-tools|contenteditable|data-email-block|email-preview-block-|email-insert/.test(document.querySelector('#email-code').textContent)`),false);
 await evaluate(`window.emailTestDownloads=[];window.download=(blob,name)=>emailTestDownloads.push({blob,name});document.querySelector('#email-save-html').click();document.querySelector('#email-save-mjml').click();document.querySelector('#email-project-save').click();`);
 assert.equal(await evaluate(`emailTestDownloads.length`),3);
 assert.ok(await evaluate(`emailTestDownloads[0].blob.text().then(t=>t.includes('직접 수정한 제목')&&!t.includes('email-insert'))`));
 assert.equal(await evaluate(`emailTestDownloads[2].blob.text().then(t=>JSON.parse(t).state.blocks.length)`),6);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
 // Empty state recovers after deleting everything using preview controls.
 await waitPreview();for(let i=0;i<6;i++){await evaluate(`emailPreviewDoc().querySelector('[data-email-block="0"] button[aria-label="블록 삭제"]').click()`);await waitPreview();}
 assert.equal(await evaluate(`emailPreviewDoc().querySelectorAll('[data-email-block]').length`),0);
 assert.equal(await evaluate(`emailPreviewDoc().querySelector('.email-insert-choices').hidden`),true);
 assert.deepEqual(errors,[]);console.log('PASS: empty canvas, six-type palette, direct editing, preview drag/drop, type-specific settings, duplicate/delete, clean exports, mobile and empty-state recovery.');
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
