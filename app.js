'use strict';
const $ = s => document.querySelector(s);
const order = ['ko','en','ja','zh','zt','de','fr','es','it','pt'];
let rows = [], langs = [], workbook = null, images = [], busy = false;
let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,5000); }
function route() { const id=['home','translations','images','gradient','clip','email','background'].includes(location.hash.slice(1))?location.hash.slice(1):'home'; document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==id); }
addEventListener('hashchange',route); route();
function download(blob,name) { const a=document.createElement('a'); const url=URL.createObjectURL(blob); a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000); }
function parseRows(source) {
 const first=source.findIndex(r=>r.some(v=>String(v??'').trim())); if(first<0)throw Error('표에 데이터가 없습니다.'); source=source.slice(first);
 const header=[...source[0]];while(header.length&&!String(header.at(-1)??'').trim())header.pop();
 const headers=header.map(v=>String(v??'').trim().toLowerCase().replace(/^pt[-_]br$/,'pt'));
 if(!headers.includes('en'))throw Error('첫 행에 EN 언어 코드가 필요합니다.');
 if(new Set(headers).size!==headers.length)throw Error('중복된 언어 코드가 있습니다.');
 if(headers.some(h=>! /^[a-z][a-z0-9_-]*$/.test(h)||['key','__proto__','constructor','prototype'].includes(h)))throw Error('언어 코드 행에 빈 칸이나 올바르지 않은 코드가 있습니다.');
 const languageOrder=[...order.filter(l=>headers.includes(l)),...headers.filter(l=>!order.includes(l))]; const used=new Set();const result=[];
 source.slice(1).forEach((r,i)=>{if(!r.some(v=>String(v??'').trim()))return;if(r.slice(headers.length).some(v=>String(v??'').trim()))throw Error(`${i+2}행에 언어 코드가 없는 열의 데이터가 있습니다.`);
 let key=String(r[headers.indexOf('en')]??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||`text-${i+1}`;const base=key;let n=2;while(used.has(key))key=`${base}-${n++}`;used.add(key);
 const values=Object.fromEntries(languageOrder.map(l=>[l,String(r[headers.indexOf(l)]??'')]));result.push({key,values});});
 if(!result.length)throw Error('변환할 번역 행이 없습니다.');return {rows:result,langs:languageOrder};
}
function output(js=false){const data=Object.create(null),used=new Set();for(const r of rows){if(!r.key.trim()||used.has(r.key)||['__proto__','constructor','prototype'].includes(r.key))throw Error('비어 있거나 중복된 키를 수정해 주세요.');used.add(r.key);data[r.key]=r.values;}if(!js)return JSON.stringify(data,null,2);
 const escape=v=>v.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${').replace(/\r/g,'\\r').replace(/\n/g,'\\n');
 return 'export default {\n'+rows.map(r=>'  '+JSON.stringify(r.key)+': {\n'+langs.map(l=>'    '+JSON.stringify(l)+': `'+escape(r.values[l])+'`,').join('\n')+'\n  },').join('\n')+'\n};\n';}
function updatePreview(){try{$('#json-preview').textContent=output();}catch(e){$('#json-preview').textContent=e.message;}const empty=rows.reduce((n,r)=>n+Object.values(r.values).filter(v=>!v).length,0);$('#translation-warning').textContent=empty?`빈 번역 ${empty}개 · 빈 문자열로 저장됩니다.`:'모든 언어의 번역이 채워져 있습니다.';}
function renderTable(parsed){rows=parsed.rows;langs=parsed.langs;const table=$('#translation-table');table.replaceChildren();const head=table.createTHead().insertRow();['key',...langs].forEach(l=>{const th=document.createElement('th');th.textContent=l;head.append(th);});const body=table.createTBody();rows.forEach(r=>{const tr=body.insertRow();['key',...langs].forEach(l=>{const td=tr.insertCell();td.textContent=l==='key'?r.key:r.values[l];td.contentEditable='plaintext-only';td.setAttribute('aria-label',l+' 수정');td.addEventListener('input',()=>{if(l==='key')r.key=td.innerText;else r.values[l]=td.innerText;updatePreview();});});});$('#translation-result').hidden=false;$('#translation-count').textContent=`${rows.length}개 항목 · ${langs.length}개 언어`;updatePreview();}
async function readTranslation(file){if(!file)return;try{if(!/\.(xlsx|xls|csv|tsv|txt)$/i.test(file.name))throw Error('엑셀, CSV, TSV, TXT 파일을 선택해 주세요.');if(file.size>30*1024*1024)throw Error('30MB 이하의 번역 파일을 사용해 주세요.');let wb;if(/\.(csv|tsv|txt)$/i.test(file.name)){let text=await file.text();if(text.charCodeAt(0)===0xfeff)text=text.slice(1);wb=XLSX.read(text,{type:'string',raw:true,FS:/\.csv$/i.test(file.name)?',':'\t'});}else wb=XLSX.read(await file.arrayBuffer(),{type:'array'}); const first=wb.SheetNames[0];const parsed=parseRows(sheetRows(wb.Sheets[first]));workbook=wb;$('#sheet-select').replaceChildren(...wb.SheetNames.map(name=>new Option(name,name)));$('#translation-name').textContent=file.name;renderTable(parsed);toast('번역표를 불러왔습니다.');}catch(e){toast(e.message);}}
function sheetRows(sheet){return XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false});}
$('#translation-file').onchange=e=>{readTranslation(e.target.files[0]);e.target.value='';};
$('#sheet-select').onchange=e=>{try{renderTable(parseRows(sheetRows(workbook.Sheets[e.target.value])));}catch(err){toast(err.message);}};
$('#paste-toggle').onclick=()=>{$('#paste-panel').hidden=!$('#paste-panel').hidden;if(!$('#paste-panel').hidden)$('#paste-text').focus();};
$('#paste-load').onclick=()=>{try{const wb=XLSX.read($('#paste-text').value,{type:'string',raw:true,FS:'\t'});const parsed=parseRows(sheetRows(wb.Sheets[wb.SheetNames[0]]));workbook=wb;$('#sheet-select').replaceChildren(new Option('붙여넣은 표',wb.SheetNames[0]));$('#translation-name').textContent='붙여넣은 표';renderTable(parsed);}catch(e){toast(e.message);}};
$('#save-json').onclick=()=>{try{download(new Blob([output()],{type:'application/json;charset=utf-8'}),'translations.json');}catch(e){toast(e.message);}};
$('#save-js').onclick=()=>{try{download(new Blob([output(true)],{type:'text/javascript;charset=utf-8'}),'translations.js');}catch(e){toast(e.message);}};
$('#copy-js').onclick=async()=>{try{await navigator.clipboard.writeText(output(true));toast('JavaScript 객체를 복사했습니다.');}catch(e){toast('복사가 어려우면 JS 저장을 사용해 주세요. '+e.message);}};
function bindDrop(el,handler,multiple){el.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';el.classList.add('dragging');});el.addEventListener('dragleave',()=>el.classList.remove('dragging'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('dragging');const files=[...e.dataTransfer.files];if(!multiple&&files.length!==1){toast('번역 파일은 한 번에 하나씩 넣어 주세요.');return;}handler(multiple?files:files[0]);});}
bindDrop($('#translation-drop'),readTranslation,false);
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
function bytes(n){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;}
