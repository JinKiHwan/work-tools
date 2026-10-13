'use strict';
(() => {
 const q=id=>document.getElementById('email-'+id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={text:'텍스트',image:'이미지',button:'버튼',divider:'구분선',spacer:'여백',columns:'2단 텍스트'};
 const defaults={text:'여기에 내용을 입력하세요.',button:'자세히 보기',columns:'왼쪽 내용을 입력하세요.'};
 const make=type=>({type,text:defaults[type]||'',text2:'오른쪽 내용을 입력하세요.',fontSize:type==='button'?15:16,fontWeight:'400',lineHeight:1.6,color:'#333333',background:'#ffffff',paddingTop:12,paddingBottom:12,paddingX:24,align:'left',url:'https://example.com',src:'',alt:'이미지 설명',imageWidth:520,buttonColor:'#e87543',radius:6,height:24,borderWidth:1,borderColor:'#dddddd'});
 const initial=()=>({title:'새 이메일',preheader:'',width:600,font:'Arial, sans-serif',background:'#f2f3f5',surface:'#ffffff',blocks:[]});
 let state=initial(),selected=-1,output='mjml',mjml='',html='',timer,enteringBlock=null;

 const safeURL=(value,image=false)=>{try{const u=new URL(value);return (['http:','https:'].includes(u.protocol)||(!image&&u.protocol==='mailto:'))?u.href:'';}catch{return '';}};
 const paragraphs=s=>esc(s).replace(/\r?\n/g,'<br />');
 function buildMJML(preview=false){const body=state.blocks.map((b,i)=>{const pad=`${b.paddingTop}px ${b.paddingX}px ${b.paddingBottom}px`,textAttrs=`font-weight="${b.fontWeight}" font-size="${b.fontSize}px" line-height="${b.lineHeight}" color="${b.color}" align="${b.align}" padding="${pad}"`;let content;
 if(b.type==='text')content=`<mj-text ${textAttrs}>${paragraphs(b.text)}</mj-text>`;
 if(b.type==='image')content=b.src?`<mj-image src="${esc(safeURL(b.src,true))}" alt="${esc(b.alt)}" width="${b.imageWidth}px" align="${b.align}" padding="${pad}" />`:`<mj-text font-size="14px" color="#999999" align="center" padding="32px">이미지 URL을 입력하세요.</mj-text>`;
 if(b.type==='button')content=`<mj-button ${textAttrs} href="${esc(safeURL(b.url))}" background-color="${b.buttonColor}" border-radius="${b.radius}px" inner-padding="12px 24px">${paragraphs(b.text)}</mj-button>`;
 if(b.type==='divider')content=`<mj-divider border-width="${b.borderWidth}px" border-color="${b.borderColor}" padding="${pad}" />`;
 if(b.type==='spacer')content=`<mj-spacer height="${b.height}px" padding="0" />`;
 if(b.type==='columns')return `<mj-section${preview?` css-class="email-preview-block-${i}"`:""} background-color="${b.background}" padding="0"><mj-column width="50%"><mj-text ${textAttrs}>${paragraphs(b.text)}</mj-text></mj-column><mj-column width="50%"><mj-text ${textAttrs}>${paragraphs(b.text2)}</mj-text></mj-column></mj-section>`;
 return `<mj-section${preview?` css-class="email-preview-block-${i}"`:""} background-color="${b.background}" padding="0"><mj-column>${content}</mj-column></mj-section>`;}).join('\n    ');
 return `<mjml lang="ko">\n  <mj-head>\n    <mj-title>${esc(state.title)}</mj-title>\n    <mj-preview>${esc(state.preheader)}</mj-preview>\n    <mj-attributes><mj-all font-family="${esc(state.font)}" /><mj-text font-size="16px" line-height="1.6" /></mj-attributes>\n  </mj-head>\n  <mj-body width="${state.width}px" background-color="${state.background}">\n    <mj-wrapper background-color="${state.surface}" padding="0">\n    ${body}\n    </mj-wrapper>\n  </mj-body>\n</mjml>`;
 }
 function saveDraft(){try{localStorage.setItem('work-tools-email-v1',JSON.stringify(state));}catch{}}
 function showCode(){q('code').textContent=output==='mjml'?mjml:html;['mjml','html'].forEach(t=>{q('tab-'+t).classList.toggle('selected',output===t);q('tab-'+t).setAttribute('aria-pressed',String(output===t));});}
 function compile(keepPreview=false){clearTimeout(timer);mjml=buildMJML();try{if(typeof window.mjml!=='function')throw Error('MJML 변환기를 불러오지 못했습니다. 새로고침해 주세요.');const result=window.mjml(buildMJML(true),{validationLevel:'soft'});if(result.errors.length)throw Error(result.errors.map(e=>e.formattedMessage||e.message).join('\n'));html=result.html.replace(/email-preview-block-\d+/g,'');if(!keepPreview)q('preview').srcdoc=result.html;q('status').textContent='미리보기 업데이트 완료';q('status').classList.remove('error');q('save-html').disabled=false;}catch(e){html='';q('preview').srcdoc='<p style="padding:24px;font:14px sans-serif">미리보기를 만들 수 없습니다. 입력값을 확인해 주세요.</p>';q('status').textContent=e.message;q('status').classList.add('error');q('save-html').disabled=true;}q('preview-size').textContent=q('preview').classList.contains('mobile')?'모바일 · 375px':`PC · 최대 ${state.width}px`;showCode();saveDraft();}
 function schedule(){q('status').textContent='미리보기 반영 중…';clearTimeout(timer);timer=setTimeout(compile,180);}
 function highlightPreview(){const doc=q('preview').contentDocument;if(!doc)return;doc.querySelectorAll('[data-email-block]').forEach(el=>el.classList.toggle('editor-selected',Number(el.dataset.emailBlock)===selected));}
 function selectPreview(index){selected=index;renderList();inspect();document.querySelector('.email-inspector').open=true;highlightPreview();}
 function insertPreview(index,type){if(state.blocks.length>=100){toast('블록은 최대 100개까지 추가할 수 있습니다.');return;}state.blocks.splice(index+1,0,{...make(type),background:state.surface});selected=index+1;enteringBlock=state.blocks[selected];renderList();inspect();document.querySelector('.email-inspector').open=true;compile();}
 q('preview').onload=()=>{
 const doc=q('preview').contentDocument;if(!doc||!html)return;
 const style=doc.createElement('style');style.textContent=`
 [data-email-block]{position:relative;min-height:22px;cursor:pointer;outline-offset:-2px}
 [data-email-block]:hover{outline:1px dashed #e87543}
 [data-email-block].editor-selected{outline:2px solid #e87543}
 .email-inline-tools{position:absolute;right:4px;top:2px;z-index:10;display:flex;gap:3px;opacity:0;pointer-events:none;background:white;padding:3px;border:1px solid #eadbd3;border-radius:6px;box-shadow:0 2px 8px #0002;font:12px Arial,sans-serif}
 [data-email-block]:hover>.email-inline-tools,.editor-selected>.email-inline-tools,[data-email-block]:focus-within>.email-inline-tools{opacity:1;pointer-events:auto}
 .email-inline-tools button,.email-inline-tools select{font:12px Arial,sans-serif;border:0;background:#fff4ee;color:#9d441e;padding:5px 7px;border-radius:4px;cursor:pointer}
 .email-inline-tools button:focus-visible,.email-inline-tools select:focus-visible{outline:2px solid #e87543}
 [contenteditable]{cursor:text;min-height:1em;outline:none;white-space:pre-wrap}
 [contenteditable]:focus{box-shadow:inset 0 -1px #e87543}
 .email-preview-insert{margin:0 auto;text-align:center;font:12px Arial,sans-serif;padding:4px 0;box-sizing:border-box}
 .email-insert-toggle{width:100%;height:24px;background:#fff;border:1px dashed #e6ddd7;color:#a86743;font-size:19px;border-radius:6px;cursor:pointer}
 .email-preview-insert.last{padding-top:12px;padding-bottom:24px}
 .email-preview-insert.last>.email-insert-toggle{height:80px;border:0;color:#242426;font-size:36px;box-shadow:0 1px 3px #00000008}
 .email-insert-choices{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:10px 0}
 .email-insert-choices[hidden]{display:none}
 .email-insert-choices:not([hidden]){animation:email-menu-enter .2s ease-out both;transform-origin:top center}
 .email-insert-choices:not([hidden])>button{animation:email-choice-enter .22s ease-out both}
 .email-insert-choices>button:nth-child(2){animation-delay:20ms}.email-insert-choices>button:nth-child(3){animation-delay:40ms}.email-insert-choices>button:nth-child(4){animation-delay:60ms}.email-insert-choices>button:nth-child(5){animation-delay:80ms}.email-insert-choices>button:nth-child(6){animation-delay:100ms}
 .email-block-enter{animation:email-block-enter .26s ease-out both}
 .email-insert-toggle{transition:background-color .16s,color .16s,box-shadow .16s}
 .email-insert-toggle:hover{background:#fff4ee!important;color:#e87543!important}
 .email-choice-icon{transition:transform .16s,border-color .16s,color .16s}
 .email-insert-choices>button:hover .email-choice-icon{transform:translateY(-2px)}
 .email-insert-choices>button:active .email-choice-icon{transform:scale(.96)}
 @keyframes email-menu-enter{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
 @keyframes email-choice-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
 @keyframes email-block-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
 @media(prefers-reduced-motion:reduce){.email-insert-choices,.email-insert-choices>button,.email-block-enter{animation:none!important}.email-insert-toggle,.email-choice-icon{transition:none!important}.email-insert-choices>button:hover .email-choice-icon{transform:none}}

 .email-insert-choices>button{min-width:0;display:flex;flex-direction:column;align-items:center;gap:8px;border:0;background:transparent;color:#444;font:11px Arial,sans-serif;cursor:pointer;padding:0}
 .email-choice-icon{display:flex;align-items:center;justify-content:center;width:100%;height:62px;border-radius:6px;background:white;font-size:26px;color:#555;border:1px solid #eee}
 .email-insert-choices>button:hover .email-choice-icon{border-color:#e87543;color:#e87543}
 .email-preview-drag{cursor:grab!important;touch-action:none}
 .editor-dragging{opacity:.45}.editor-drop-before{box-shadow:0 -3px #e87543}.editor-drop-after{box-shadow:0 3px #e87543}
 body{padding:16px!important;box-sizing:border-box;min-height:100vh}
 @media(max-width:440px){.email-insert-choices{grid-template-columns:repeat(3,minmax(0,1fr))}}
 `;doc.head.append(style);
 let previewDrag=null;
 function clearPreviewDrag(){doc.querySelectorAll('[data-email-block]').forEach(el=>el.classList.remove('editor-dragging','editor-drop-before','editor-drop-after'));}
 function palette(index){const wrap=doc.createElement('div');wrap.className='email-preview-insert'+(index===state.blocks.length-1?' last':'');wrap.style.maxWidth=state.width+'px';const toggle=doc.createElement('button');toggle.className='email-insert-toggle';toggle.textContent='＋';toggle.type='button';toggle.setAttribute('aria-label','블록 타입 선택');toggle.setAttribute('aria-expanded','false');const choices=doc.createElement('div');choices.className='email-insert-choices';choices.hidden=true;const icons={image:'▧',text:'T',button:'▰',divider:'―',columns:'▥',spacer:'↕'};['image','text','button','divider','columns','spacer'].forEach(type=>{const button=doc.createElement('button');button.type='button';button.dataset.blockType=type;button.setAttribute('aria-label',names[type]+' 블록 추가');const icon=doc.createElement('span'),label=doc.createElement('span');icon.className='email-choice-icon';icon.textContent=icons[type];label.textContent=names[type];button.append(icon,label);button.onclick=e=>{e.stopPropagation();insertPreview(index,type);};choices.append(button);});toggle.onclick=e=>{e.stopPropagation();choices.hidden=!choices.hidden;toggle.setAttribute('aria-expanded',String(!choices.hidden));};wrap.append(toggle,choices);wrap.ondragover=e=>{if(previewDrag===null)return;e.preventDefault();wrap.classList.add('editor-drop-before');};wrap.ondragleave=()=>wrap.classList.remove('editor-drop-before');wrap.ondrop=e=>{if(previewDrag===null)return;e.preventDefault();const from=previewDrag;previewDrag=null;moveBlock(from,index+1);};return wrap;}
 state.blocks.forEach((b,i)=>{const section=doc.querySelector('.email-preview-block-'+i);if(!section)return;section.dataset.emailBlock=i;if(b===enteringBlock){section.classList.add('email-block-enter');enteringBlock=null;}
 section.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();selectPreview(i);});
 const tools=doc.createElement('div');tools.className='email-inline-tools';tools.contentEditable='false';tools.setAttribute('role','group');tools.setAttribute('aria-label',names[b.type]+' 블록 편집');tools.addEventListener('click',e=>e.stopPropagation());tools.addEventListener('mousedown',e=>{if(e.target.tagName==='BUTTON')e.preventDefault();});
 const action=(label,title,fn)=>{const button=doc.createElement('button');button.type='button';button.textContent=label;button.title=title;button.setAttribute('aria-label',title);button.onclick=fn;tools.append(button);};
 action('＋','블록 추가',()=>section.nextElementSibling?.querySelector('.email-insert-toggle')?.click());
 action('⠿','블록 순서 변경',()=>selectPreview(i));tools.lastElementChild.className='email-preview-drag';tools.lastElementChild.draggable=false;
 action('수정','블록 설정 수정',()=>selectPreview(i));action('복제','블록 복제',()=>{selectPreview(i);q('duplicate').click();});
 action('−','블록 삭제',()=>{selectPreview(i);q('delete').click();});section.append(tools);
 section.after(palette(i));
 const handle=tools.querySelector('.email-preview-drag');handle.ondragstart=e=>{previewDrag=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));section.classList.add('editor-dragging');};handle.ondragend=()=>{previewDrag=null;clearPreviewDrag();};handle.onkeydown=e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const position=e.key==='ArrowUp'?i-1:i+2;if(position>=0&&position<=state.blocks.length)moveBlock(i,position);}};
 // Pointer capture avoids native drag cancellation by toolbar focus/blur handlers.
 let pointerDrag=null,suppressClick=false;
 handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();clearTimeout(timer);handle.setPointerCapture(e.pointerId);pointerDrag={id:e.pointerId,x:e.clientX,y:e.clientY,position:i,moved:false};};
 handle.onpointermove=e=>{if(!pointerDrag||pointerDrag.id!==e.pointerId)return;if(!pointerDrag.moved&&Math.hypot(e.clientX-pointerDrag.x,e.clientY-pointerDrag.y)<5)return;pointerDrag.moved=true;clearPreviewDrag();section.classList.add('editor-dragging');const blocks=[...doc.querySelectorAll('[data-email-block]')];let position=blocks.length;for(let n=0;n<blocks.length;n++){const r=blocks[n].getBoundingClientRect();if(e.clientY<r.top+r.height/2){position=n;break;}}pointerDrag.position=position;if(position<blocks.length)blocks[position].classList.add('editor-drop-before');else blocks.at(-1)?.classList.add('editor-drop-after');const height=doc.defaultView.innerHeight;if(e.clientY<40)doc.defaultView.scrollBy(0,-18);else if(e.clientY>height-40)doc.defaultView.scrollBy(0,18);};
 handle.onpointerup=e=>{if(!pointerDrag||pointerDrag.id!==e.pointerId)return;const drag=pointerDrag;pointerDrag=null;if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);clearPreviewDrag();if(drag.moved){suppressClick=true;moveBlock(i,drag.position);}};
 handle.onpointercancel=()=>{pointerDrag=null;clearPreviewDrag();};
 handle.onclick=e=>{e.stopPropagation();if(suppressClick){suppressClick=false;return;}selectPreview(i);};
 section.ondragover=e=>{if(previewDrag===null)return;e.preventDefault();clearPreviewDrag();const r=section.getBoundingClientRect();section.classList.add(e.clientY<r.top+r.height/2?'editor-drop-before':'editor-drop-after');};section.ondragleave=()=>section.classList.remove('editor-drop-before','editor-drop-after');section.ondrop=e=>{if(previewDrag===null)return;e.preventDefault();const r=section.getBoundingClientRect(),position=i+(e.clientY>=r.top+r.height/2?1:0),from=previewDrag;previewDrag=null;clearPreviewDrag();moveBlock(from,position);};
 if(['text','columns','button'].includes(b.type)){
 const targets=b.type==='button'?[section.querySelector('a')]:[...section.querySelectorAll('td > div')].filter(el=>el.style.fontSize&&el.style.lineHeight);
 targets.slice(0,b.type==='columns'?2:1).forEach((el,column)=>{if(!el)return;const key=column===1?'text2':'text';el.textContent=b[key];el.contentEditable='plaintext-only';el.setAttribute('role','textbox');el.setAttribute('aria-label',names[b.type]+(column===1?' 오른쪽':'')+' 내용 직접 수정');el.setAttribute('aria-multiline','true');el.spellcheck=false;
 el.oninput=()=>{b[key]=el.innerText.replace(/\r\n/g,'\n');selected=i;renderList();inspect();highlightPreview();compile(true);};
 el.onblur=()=>{if(state.blocks.includes(b))compile();};
 el.onkeydown=e=>{if(e.key==='Escape'||(e.key==='Enter'&&(e.ctrlKey||e.metaKey))){e.preventDefault();el.blur();}};
 });}
 });
 if(!state.blocks.length)doc.body.append(palette(-1));
 highlightPreview();
 };
 function syncSettings(){['title','preheader','width','font','background','surface'].forEach(k=>q(k).value=state[k]);}
 let draggedBlock=null;
 function clearDrag(){q('block-list').querySelectorAll('button').forEach(b=>b.classList.remove('dragging','drop-before','drop-after'));}
 function moveBlock(from,position){const target=position-(from<position?1:0);if(from===target)return;const active=state.blocks[selected],block=state.blocks.splice(from,1)[0];state.blocks.splice(target,0,block);selected=state.blocks.indexOf(active);renderList();inspect();compile();toast('블록 순서를 변경했습니다.');}
 function renderList(){q('block-list').replaceChildren();state.blocks.forEach((b,i)=>{
 const button=document.createElement('button');button.className='email-block-select';button.draggable=true;button.setAttribute('aria-pressed',String(i===selected));button.title='드래그해서 순서 변경 · Alt + 위/아래 방향키로 이동';
 const grip=document.createElement('small');grip.className='email-drag-grip';grip.textContent='⠿';grip.setAttribute('aria-hidden','true');const number=document.createElement('small');number.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.textContent=names[b.type]+' · '+(b.text||b.alt||'');button.append(grip,number,label);
 button.onclick=()=>{selected=i;renderList();inspect();highlightPreview();};
 button.ondragstart=e=>{draggedBlock=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));button.classList.add('dragging');};
 button.ondragover=e=>{if(draggedBlock===null)return;e.preventDefault();e.dataTransfer.dropEffect='move';clearDrag();q('block-list').children[draggedBlock]?.classList.add('dragging');const r=button.getBoundingClientRect();button.classList.add(e.clientY<r.top+r.height/2?'drop-before':'drop-after');};
 button.ondragleave=()=>button.classList.remove('drop-before','drop-after');
 button.ondrop=e=>{if(draggedBlock===null)return;e.preventDefault();const r=button.getBoundingClientRect(),position=i+(e.clientY>=r.top+r.height/2?1:0),from=draggedBlock;draggedBlock=null;clearDrag();moveBlock(from,position);};
 button.ondragend=()=>{draggedBlock=null;clearDrag();};
 button.onkeydown=e=>{if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const position=e.key==='ArrowUp'?i-1:i+2;if(position<0||position>state.blocks.length)return;moveBlock(i,position);q('block-list').children[e.key==='ArrowUp'?i-1:i+1]?.focus();};
 q('block-list').append(button);});if(!state.blocks.length){const p=document.createElement('p');p.className='email-empty';p.textContent='블록을 추가해 메일을 시작하세요.';q('block-list').append(p);}}

 function field(container,label,key,type='number',opts={}){const l=document.createElement('label');l.textContent=label;const input=document.createElement(type==='textarea'?'textarea':type==='select'?'select':'input');if(type==='select'){opts.options.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;input.append(o);});}else if(type!=='textarea')input.type=type;input.value=state.blocks[selected][key];if(opts.min!==undefined)input.min=opts.min;if(opts.max!==undefined)input.max=opts.max;if(opts.step)input.step=opts.step;input.oninput=()=>{const b=state.blocks[selected];if(type==='number'){if(input.value===''||!Number.isFinite(input.valueAsNumber))return;b[key]=Math.max(opts.min??0,Math.min(opts.max??1000,input.valueAsNumber));}else b[key]=input.value;renderList();schedule();};input.onchange=()=>{if(type==='number')input.value=state.blocks[selected][key];if(type==='url'&&input.value&&!safeURL(input.value,key==='src'))toast('http(s) URL을 입력해 주세요. 버튼은 mailto: 주소도 사용할 수 있습니다.');compile();};l.append(input);container.append(l);}
 function inspect(){const container=q('inspector');container.replaceChildren();const b=state.blocks[selected];q('inspector-title').textContent=b?names[b.type]+' 설정':'블록 설정';q('up').disabled=!b||selected===0;q('down').disabled=!b||selected===state.blocks.length-1;q('duplicate').disabled=q('delete').disabled=!b;if(!b){container.textContent='미리보기의 +로 블록을 추가하거나, 편집할 블록을 선택하세요.';return;}
 const text=['text','button','columns'].includes(b.type);if(text)field(container,b.type==='button'?'버튼 문구':'내용','text','textarea');if(b.type==='columns')field(container,'오른쪽 내용','text2','textarea');
 if(b.type==='image'){field(container,'이미지 URL','src','url');field(container,'이미지 설명 (대체 텍스트)','alt','text');field(container,'이미지 최대 너비 (px)','imageWidth','number',{min:40,max:1200});const p=document.createElement('p');p.className='email-help';p.textContent='받는 사람도 볼 수 있는 공개 이미지 URL을 사용하세요.';container.append(p);}
 if(b.type==='button'){field(container,'이동할 주소','url','url');field(container,'버튼 배경','buttonColor','color');field(container,'둥근 모서리 (px)','radius','number',{min:0,max:100});}
 if(text){field(container,'글자 굵기','fontWeight','select',{options:[['100','100 · 아주 얇게'],['200','200 · 얇게'],['300','300 · 가볍게'],['400','400 · 보통'],['500','500 · 중간'],['600','600 · 약간 굵게'],['700','700 · 굵게'],['800','800 · 아주 굵게'],['900','900 · 가장 굵게']]});field(container,'글자 크기 (px)','fontSize','number',{min:8,max:96});field(container,'줄 간격 (배수)','lineHeight','number',{min:1,max:3,step:.1});field(container,'글자색','color','color');}
 if(['text','image','button','columns'].includes(b.type))field(container,'정렬','align','select',{options:[['left','왼쪽'],['center','가운데'],['right','오른쪽']]});
 field(container,'블록 배경','background','color');
 if(b.type==='spacer')field(container,'여백 높이 (px)','height','number',{min:0,max:300});else{field(container,'위쪽 간격 (px)','paddingTop','number',{min:0,max:200});field(container,'아래쪽 간격 (px)','paddingBottom','number',{min:0,max:200});field(container,'좌우 간격 (px)','paddingX','number',{min:0,max:150});}
 if(b.type==='divider'){field(container,'선 두께 (px)','borderWidth','number',{min:1,max:20});field(container,'선 색상','borderColor','color');}}
 function render(){syncSettings();renderList();inspect();compile();}
 Object.entries(names).forEach(([type,name])=>{const b=document.createElement('button');b.className='button';b.textContent='＋ '+name;b.onclick=()=>{if(state.blocks.length>=100){toast('블록은 최대 100개까지 추가할 수 있습니다.');return;}state.blocks.splice(selected+1,0,{...make(type),background:state.surface});selected=Math.min(selected+1,state.blocks.length-1);renderList();inspect();compile();};q('add-blocks').append(b);});
 ['title','preheader','width','font','background','surface'].forEach(k=>{q(k).oninput=()=>{if(k==='width'){const n=q(k).valueAsNumber;if(!Number.isFinite(n))return;state.width=Math.max(320,Math.min(1200,n));}else {if(k==='surface'){const previous=state.surface;state.blocks.forEach(b=>{if(b.background===previous)b.background=q(k).value;});}state[k]=q(k).value;}schedule();};q(k).onchange=()=>{q(k).value=state[k];compile();};});
 q('up').onclick=()=>{if(selected<=0)return;[state.blocks[selected-1],state.blocks[selected]]=[state.blocks[selected],state.blocks[selected-1]];selected--;renderList();inspect();compile();};
 q('down').onclick=()=>{if(selected>=state.blocks.length-1)return;[state.blocks[selected+1],state.blocks[selected]]=[state.blocks[selected],state.blocks[selected+1]];selected++;renderList();inspect();compile();};
 q('duplicate').onclick=()=>{if(!state.blocks[selected])return;if(state.blocks.length>=100){toast('블록은 최대 100개까지 추가할 수 있습니다.');return;}state.blocks.splice(selected+1,0,{...state.blocks[selected]});selected++;renderList();inspect();compile();};
 q('delete').onclick=()=>{state.blocks.splice(selected,1);selected=Math.min(selected,state.blocks.length-1);renderList();inspect();compile();};
 ['desktop','mobile'].forEach(device=>q(device).onclick=()=>{q('preview').classList.toggle('mobile',device==='mobile');['desktop','mobile'].forEach(d=>{q(d).classList.toggle('selected',d===device);q(d).setAttribute('aria-pressed',String(d===device));});compile();});
 ['mjml','html'].forEach(t=>q('tab-'+t).onclick=()=>{output=t;showCode();});
 q('code-copy').onclick=async()=>{compile();if(output==='html'&&!html)return;try{await navigator.clipboard.writeText(output==='mjml'?mjml:html);toast('코드를 복사했습니다.');}catch{toast('복사가 어려우면 파일 저장을 사용해 주세요.');}};
 q('save-mjml').onclick=()=>{compile();download(new Blob([mjml],{type:'text/plain;charset=utf-8'}),'email.mjml');};q('save-html').onclick=()=>{compile();if(html)download(new Blob([html],{type:'text/html;charset=utf-8'}),'email.html');};
 q('project-save').onclick=()=>download(new Blob([JSON.stringify({version:1,state},null,2)],{type:'application/json'}),'email-project.json');
 function validate(data){if(!data||!Array.isArray(data.blocks)||data.blocks.length>100)throw Error('올바른 작업 파일이 아닙니다.');const base=initial(),next={...base,blocks:[]};['title','preheader'].forEach(k=>{if(typeof data[k]==='string')next[k]=data[k].slice(0,2000);});next.width=Math.max(320,Math.min(1200,Number(data.width)||600));if([...q('font').options].some(o=>o.value===data.font))next.font=data.font;['background','surface'].forEach(k=>{if(/^#[\da-f]{6}$/i.test(data[k]))next[k]=data[k];});next.blocks=data.blocks.map(raw=>{if(!raw||!Object.hasOwn(names,raw.type))throw Error('지원하지 않는 블록입니다.');const b=make(raw.type);Object.keys(b).forEach(k=>{if(typeof b[k]==='number'){if(Number.isFinite(raw[k]))b[k]=Math.max(0,Math.min(1200,raw[k]));}else if(typeof raw[k]==='string')b[k]=raw[k].slice(0,50000);});['color','background','buttonColor','borderColor'].forEach(k=>{if(!/^#[\da-f]{6}$/i.test(b[k]))b[k]=make(raw.type)[k];});if(!/^[1-9]00$/.test(b.fontWeight))b.fontWeight='400';if(!['left','center','right'].includes(b.align))b.align='left';return b;});return next;}
 q('project-open').onchange=async()=>{const file=q('project-open').files[0];if(!file)return;try{if(file.size>2000000)throw Error('작업 파일은 2MB 이하로 선택해 주세요.');const data=JSON.parse(await file.text());if(data.version!==1)throw Error('지원하지 않는 작업 파일입니다.');const next=validate(data.state);state=next;selected=state.blocks.length?0:-1;render();toast('작업을 불러왔습니다.');}catch(e){toast(e.message);}q('project-open').value='';};
 q('reset').onclick=()=>{if(!confirm('현재 작업을 비우고 새 이메일을 만들까요? 필요한 작업은 먼저 저장하세요.'))return;state=initial();selected=-1;render();};
 try{const saved=localStorage.getItem('work-tools-email-v1');if(saved){state=validate(JSON.parse(saved));selected=state.blocks.length?0:-1;}}catch{}render();
})();
