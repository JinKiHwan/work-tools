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
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../index.html')).href+'#email'});
 await evaluate(`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(document.getElementById('email-status')?.textContent){clearInterval(timer);resolve(true);}else if(++n>200){clearInterval(timer);reject(Error('Page loading timed out'));}},50);})`);
 await evaluate(`window.confirm=()=>true;document.querySelector('#email-reset').click();`);
 assert.equal(await evaluate(`document.querySelector('#email').hidden`),false);
 assert.equal(await evaluate(`document.querySelector('#email-status').textContent`),'미리보기 업데이트 완료');
 assert.equal(await evaluate(`document.querySelectorAll('#email-block-list button').length`),6);
 // Drag first block after the third and ensure the selected block stays selected.
 await evaluate(`(()=>{const rows=document.querySelectorAll('#email-block-list button'),dt=new DataTransfer(),r=rows[2].getBoundingClientRect();rows[0].dispatchEvent(new DragEvent('dragstart',{dataTransfer:dt,bubbles:true}));rows[2].dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,clientY:r.bottom-1,bubbles:true,cancelable:true}));rows[2].dispatchEvent(new DragEvent('drop',{dataTransfer:dt,clientY:r.bottom-1,bubbles:true,cancelable:true}));})()`);
 assert.ok(await evaluate(`document.querySelectorAll('#email-block-list button')[2].textContent.includes('WORK TOOLS')`));
 assert.ok(await evaluate(`document.querySelector('#email-inspector textarea').value.includes('전하고 싶은 이야기')`));
 assert.ok(await evaluate(`document.querySelector('#email-code').textContent.indexOf('WORK TOOLS')>document.querySelector('#email-code').textContent.indexOf('전하고 싶은 이야기')`));
 await evaluate(`document.querySelectorAll('#email-block-list button')[2].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true,cancelable:true}));`);
 assert.ok(await evaluate(`document.querySelectorAll('#email-block-list button')[1].textContent.includes('WORK TOOLS')`));
 await evaluate(`document.querySelector('#email-reset').click();`);
 assert.equal(await evaluate(`document.querySelectorAll('#email .email-fold').length`),4);
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('#email .email-fold')).every(panel=>{const summary=panel.querySelector('summary');summary.click();const closed=!panel.open && getComputedStyle(panel.querySelector('.email-fold-body')).display==='none';summary.click();return closed&&panel.open;})`),true);
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('#email-block-list button')).every(button=>{const panel=button.closest('.panel').getBoundingClientRect(),rect=button.getBoundingClientRect();return rect.left>=panel.left&&rect.right<=panel.right;})`),true);
 await evaluate(`document.querySelectorAll('#email-inspector input[type=number]')[0].value=42;document.querySelectorAll('#email-inspector input[type=number]')[0].dispatchEvent(new Event('input'));document.querySelector('#email-tab-mjml').click();document.querySelector('#email-width').value=720;document.querySelector('#email-width').dispatchEvent(new Event('change'));`);
 // Change width via input, then blur, matching normal typing.
 await evaluate(`document.querySelector('#email-width').value=720;document.querySelector('#email-width').dispatchEvent(new Event('input'));document.querySelector('#email-width').dispatchEvent(new Event('change'));`);
 assert.ok(await evaluate(`document.querySelector('#email-code').textContent.includes('font-size="42px"') && document.querySelector('#email-code').textContent.includes('width="720px"')`));
 for(let i=0;i<6;i++)await evaluate(`document.querySelectorAll('#email-add-blocks button')[${i}].click()`);
 assert.equal(await evaluate(`document.querySelectorAll('#email-block-list button').length`),12);
 assert.equal(await evaluate(`document.querySelector('#email-status').textContent`),'미리보기 업데이트 완료');
 await evaluate(`document.querySelector('#email-duplicate').click();document.querySelector('#email-up').click();document.querySelector('#email-down').click();document.querySelector('#email-delete').click();`);
 assert.equal(await evaluate(`document.querySelectorAll('#email-block-list button').length`),12);
 await evaluate(`document.querySelector('#email-mobile').click();document.querySelector('#email-tab-html').click();`);
 assert.ok(await evaluate(`document.querySelector('#email-code').textContent.includes('<!doctype html>') && document.querySelector('#email-preview').classList.contains('mobile')`));
 assert.equal(await evaluate(`document.querySelector('#email-save-html').disabled`),false);
 // Confirm that rendered HTML, rather than a hand-built approximation, drives the preview.
 assert.equal(await evaluate(`document.querySelector('#email-preview').srcdoc===document.querySelector('#email-code').textContent`),true);
 await evaluate(`document.querySelector('#email-desktop').click();document.querySelector('#email-tab-mjml').click();`);
 if(process.env.EMAIL_SCREENSHOT){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(process.env.EMAIL_SCREENSHOT,Buffer.from(shot.data,'base64'));}
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`),true);
 await evaluate(`document.querySelectorAll('#email-block-list button')[0].click();document.querySelector('#email-inspector textarea').value='<script>alert(1)</script> & hello';document.querySelector('#email-inspector textarea').dispatchEvent(new Event('input'));document.querySelector('#email-inspector textarea').dispatchEvent(new Event('change'));`);
 assert.ok(await evaluate(`document.querySelector('#email-code').textContent.includes('&lt;script&gt;')`));
 // Delete every block, then recover by adding a new one.
 await evaluate(`while(document.querySelectorAll('#email-block-list button').length)document.querySelector('#email-delete').click();document.querySelector('#email-add-blocks button').click();`);
 assert.equal(await evaluate(`document.querySelectorAll('#email-block-list button').length`),1);
 assert.equal(await evaluate(`document.querySelector('#email-status').textContent`),'미리보기 업데이트 완료');
 await evaluate(`document.querySelector('#email-surface').value='#fef3dd';document.querySelector('#email-surface').dispatchEvent(new Event('input'));document.querySelector('#email-surface').dispatchEvent(new Event('change'));`);
 assert.ok(await evaluate(`document.querySelector('#email-code').textContent.includes('<mj-section background-color="#fef3dd"')`));
 // Capture exported blobs and verify the HTML download matches the compiled preview.
 await evaluate(`window.emailTestDownloads=[];window.download=(blob,name)=>window.emailTestDownloads.push({blob,name});document.querySelector('#email-save-html').click();document.querySelector('#email-save-mjml').click();document.querySelector('#email-project-save').click();`);
 assert.equal(await evaluate(`emailTestDownloads.length`),3);
 assert.equal(await evaluate(`emailTestDownloads[0].blob.text().then(t=>t===document.querySelector('#email-preview').srcdoc)`),true);
 assert.ok(await evaluate(`emailTestDownloads[1].blob.text().then(t=>t.startsWith('<mjml'))`));
 assert.equal(await evaluate(`emailTestDownloads[2].blob.text().then(t=>JSON.parse(t).state.blocks.length)`),1);
 assert.deepEqual(errors,[]);
 console.log('PASS: real browser compilation, six block types, typography/width changes, reorder/duplicate/delete, HTML preview, mobile layout, escaping and empty-state recovery.');
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
