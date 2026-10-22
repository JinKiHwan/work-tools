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
 await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(window.DocumentConverter&&document.querySelector('#file-category')?.onchange){clearInterval(t);resolve();}else if(++n>200){clearInterval(t);reject(Error('Load timeout'));}},30)})`);
 await evaluate(`window.docDownloads=[];window.download=(blob,name)=>docDownloads.push({blob,name});window.xmlText=b=>new TextDecoder().decode(b);window.encode=s=>new TextEncoder().encode(s);window.pack=files=>new Blob([fflate.zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,typeof v==='string'?encode(v):v])))],{type:'application/zip'});`);
 const fixture=`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:i/><w:u w:val="single"/><w:sz w:val="32"/><w:color w:val="2266AA"/></w:rPr><w:t>안녕하세요 &amp; Hello 日本語</w:t><w:br/><w:t>둘째 줄</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>셀 A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>셀 B</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>끝</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;
 await evaluate(`(async()=>{window.wordFixture=${JSON.stringify(fixture)};window.inputDocx=new File([pack({'word/document.xml':wordFixture})],'sample.docx');window.hwpxResult=await DocumentConverter.convert(inputDocx,'hwpx');})()`);
 assert.equal(await evaluate(`hwpxResult.warnings.length`),0);
 assert.equal(await evaluate(`hwpxResult.blob.arrayBuffer().then(b=>{const f=fflate.unzipSync(new Uint8Array(b));return xmlText(f.mimetype).trim();})`),'application/hwp+zip');
 await evaluate(`(async()=>{window.backDocx=await DocumentConverter.convert(new File([hwpxResult.blob],'sample.hwpx'),'docx');window.resultWordFiles=fflate.unzipSync(new Uint8Array(await backDocx.blob.arrayBuffer()));window.resultWordXml=xmlText(resultWordFiles['word/document.xml']);})()`);
 assert.ok(await evaluate(`resultWordXml.includes('안녕하세요 &amp; Hello 日本語')&&resultWordXml.includes('셀 A')&&resultWordXml.includes('셀 B')&&resultWordXml.includes('둘째 줄')`));
 assert.ok(await evaluate(`resultWordXml.includes('<w:b/>')&&resultWordXml.includes('<w:i/>')&&resultWordXml.includes('w:val="32"')&&resultWordXml.includes('w:val="2266AA"')`));
 assert.equal(await evaluate(`new DOMParser().parseFromString(resultWordXml,'application/xml').getElementsByTagNameNS('*','tbl').length`),1);
 // Independently sourced HWPX blank fixture also decodes.
 await evaluate(`(async()=>{window.blankFile=new File([Uint8Array.from(atob(DocumentHwpxTemplate),c=>c.charCodeAt(0))],'blank.hwpx');await DocumentConverter.convert(blankFile,'docx');})()`);
 assert.ok(await evaluate(`(async()=>{try{await DocumentConverter.convert(new File(['bad'],'bad.docx'),'hwpx');return false;}catch{return true;}})()`));
 assert.ok(await evaluate(`(async()=>{const file=new File([pack({'word/document.xml':wordFixture.replace('<w:sectPr>','<w:p><w:r><w:drawing/></w:r></w:p><w:sectPr>')})],'drawing.docx');window.lossFile=file;try{await DocumentConverter.convert(file,'hwpx');return false;}catch(e){return e.message.includes('이미지');}})()`));
 assert.ok(await evaluate(`(async()=>(await DocumentConverter.convert(lossFile,'hwpx',{allowLoss:true})).warnings.includes('이미지·도형'))()`));
 // Use the actual converter UI in both directions.
 await evaluate(`document.querySelector('#file-category').value='document';document.querySelector('#file-category').dispatchEvent(new Event('change'));document.querySelector('#file-format').value='hwpx';document.querySelector('#file-format').dispatchEvent(new Event('change'));var dt=new DataTransfer();dt.items.add(inputDocx);document.querySelector('#image-file').files=dt.files;document.querySelector('#image-file').dispatchEvent(new Event('change'));document.querySelector('#convert-images').click();`);
 const wait=()=>evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(!document.querySelector('#convert-images').disabled){clearInterval(t);resolve();}else if(++n>300){clearInterval(t);reject(Error('Conversion timeout'));}},30)})`);await wait();
 assert.ok(await evaluate(`document.querySelector('#image-count').textContent.includes('1개 변환 완료')`));
 assert.equal(await evaluate(`document.querySelector('#file-width-setting').hidden&&document.querySelector('#file-quality-setting').hidden`),true);
 await evaluate(`document.querySelector('.image-row button').click()`);
 assert.equal(await evaluate(`docDownloads.at(-1).name`),'sample.hwpx');
 await evaluate(`document.querySelector('#clear-images').click();document.querySelector('#file-format').value='docx';document.querySelector('#file-format').dispatchEvent(new Event('change'));var dt=new DataTransfer();dt.items.add(new File([hwpxResult.blob],'sample.hwpx'));document.querySelector('#image-file').files=dt.files;document.querySelector('#image-file').dispatchEvent(new Event('change'));document.querySelector('#convert-images').click();`);await wait();await evaluate(`document.querySelector('.image-row button').click()`);
 assert.equal(await evaluate(`docDownloads.at(-1).name`),'sample.docx');
 for(const file of await evaluate(`Object.entries(resultWordFiles).filter(([k])=>k.endsWith('.xml')||k.endsWith('.rels')).map(([k,v])=>[k,new DOMParser().parseFromString(xmlText(v),'application/xml').getElementsByTagName('parsererror').length])`))assert.equal(file[1],0,file[0]);
 assert.deepEqual(errors,[]);console.log('PASS: Unicode, paragraphs, run formatting, simple tables, DOCX/HWPX roundtrip, external HWPX fixture, invalid files, unsupported-object guard, explicit lossy mode, and UI downloads.');
 if(process.env.DOCUMENT_TEST_OUTPUT){fs.mkdirSync(process.env.DOCUMENT_TEST_OUTPUT,{recursive:true});for(const [name,expr] of [['converted.hwpx','hwpxResult.blob'],['converted.docx','backDocx.blob']]){const data=await evaluate(`${expr}.arrayBuffer().then(b=>Array.from(new Uint8Array(b)))`);fs.writeFileSync(path.join(process.env.DOCUMENT_TEST_OUTPUT,name),Buffer.from(data));}}
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
