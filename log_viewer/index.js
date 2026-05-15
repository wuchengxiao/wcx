(function(){
  const editor = document.getElementById('editor');
  const fileInput = document.getElementById('fileInput');
  const btnUpload = document.getElementById('btnUpload');
  const btnPaste = document.getElementById('btnPaste');
  const btnToggleView = document.getElementById('btnToggleView');
  const renderedView = document.getElementById('renderedView');
  const contentWrapper = document.getElementById('contentWrapper');
  const keywordList = document.getElementById('keywordList');
  const btnAddKw = document.getElementById('btnAddKw');
  const newKw = document.getElementById('newKw');
  const newColor = document.getElementById('newColor');
  const btnAddFromSelection = document.getElementById('btnAddFromSelection');
  const btnHideToolbar = document.getElementById('btnHideToolbar');
  const btnShowToolbar = document.getElementById('btnShowToolbar');
  const toolbar = document.getElementById('toolbar');
  const searchInput = document.getElementById('searchInput');
  const caseChk = document.getElementById('caseChk');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const gotoLine = document.getElementById('gotoLine');
  const btnGoto = document.getElementById('btnGoto');
  const status = document.getElementById('status');

  let viewMode = 'edit'; // 'edit' or 'render'
  let keywords = [];
  let matches = [];
  let currentMatch = -1;

  const DEFAULT_SEVERITY = [
    {k:'ERROR',c:'#ff6b6b'},
    {k:'WARN',c:'#ff9f43'},
    {k:'Exception',c:'#c56cf0'}
  ];

  function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}

  function showStatus(msg, warn){status.textContent = msg || ''; if(warn) status.classList.add('warning'); else status.classList.remove('warning')}

  function setView(mode){viewMode = mode; if(mode==='render'){editor.style.display='none';renderedView.style.display='block';btnToggleView.textContent='编辑模式';renderLines();}else{editor.style.display='block';renderedView.style.display='none';btnToggleView.textContent='显示为 HTML';}}

  function renderLines(){
    const text = editor.value || '';
    const sizeBytes = new Blob([text]).size;
    const lines = text.split(/\r?\n/);
    if(lines.length>10000 || sizeBytes>5*1024*1024){
      showStatus('警告: 文件较大（可能影响性能），建议拆分或使用专业工具', true);
    } else showStatus('');

    // build combined list of keywords with severity defaults first
    const kws = DEFAULT_SEVERITY.concat(keywords);

    // prepare regexes
    const regs = kws.map(kw=>{
      const text = kw.k || kw;
      const escaped = escapeRegExp(text);
      return {re:new RegExp(escaped,'g'),color:kw.c||kw.color||kw.c||'#ffff00',raw:text};
    });

    renderedView.innerHTML='';
    const frag = document.createDocumentFragment();
    for(let i=0;i<lines.length;i++){
      const d = document.createElement('div');
      d.className='line';
      d.dataset.line = i+1;
      let ln = escapeHtml(lines[i]);

      // apply highlights by doing replacements; process regs longer-first to reduce overlap
      regs.sort((a,b)=>b.raw.length - a.raw.length);
      regs.forEach(r=>{
        try{
          ln = ln.replace(new RegExp(escapeRegExp(r.raw),'g'),match => `<span style="background:${r.color};padding:0 2px;border-radius:2px;color:#000">${match}</span>`);
        }catch(e){/*ignore*/}
      });

      d.innerHTML = ln || '\u00A0';
      d.addEventListener('click',()=>{d.scrollIntoView({block:'center'}); highlightLine(d.dataset.line)});
      frag.appendChild(d);
    }
    renderedView.appendChild(frag);
    indexMatches();
  }

  function highlightLine(lineNo){
    const el = renderedView.querySelector(`.line[data-line='${lineNo}']`);
    if(el){el.classList.add('match'); setTimeout(()=>el.classList.remove('match'),800)}
  }

  function addKeyword(text,color){ if(!text || !text.trim()) return; keywords.push({k:text.trim(),c:color||'#ffff00'}); refreshKeywordList(); if(viewMode==='render') renderLines(); }

  function refreshKeywordList(){ keywordList.innerHTML=''; keywords.forEach((kw,idx)=>{
    const el = document.createElement('div'); el.className='kw';
    const sw = document.createElement('div'); sw.className='swatch'; sw.style.background = kw.c;
    const span = document.createElement('span'); span.textContent = kw.k;
    const del = document.createElement('button'); del.textContent='✕'; del.title='删除'; del.addEventListener('click',()=>{keywords.splice(idx,1); refreshKeywordList(); if(viewMode==='render') renderLines();});
    el.appendChild(sw); el.appendChild(span); el.appendChild(del); keywordList.appendChild(el);
  })}

  function indexMatches(){
    matches = [];
    currentMatch = -1;
    const term = searchInput.value; if(!term) return;
    const flags = caseChk.checked? 'g': 'gi';
    let re;
    try{ re = new RegExp(term, flags); }catch(e){ showStatus('搜索正则无效', true); return }
    const nodes = renderedView.querySelectorAll('.line');
    nodes.forEach(n=>{
      const html = n.textContent || '';
      let m; while((m = re.exec(html))){ matches.push({line:parseInt(n.dataset.line),start:m.index,end:m.index+m[0].length}); if(!re.global) break; }
    });
    if(matches.length) { currentMatch = 0; gotoMatch(0); showStatus(`${matches.length} 条匹配`) } else showStatus('无匹配');
  }

  function gotoMatch(idx){ if(matches.length===0) return; currentMatch = (idx+matches.length)%matches.length; const item = matches[currentMatch]; const node = renderedView.querySelector(`.line[data-line='${item.line}']`); if(node){ node.scrollIntoView({block:'center'}); node.classList.add('match'); setTimeout(()=>node.classList.remove('match'),800); showStatus(`第 ${currentMatch+1} / ${matches.length} 条，行 ${item.line}`) } }

  // events
  btnUpload.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',e=>{
    const f = e.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = ()=>{ editor.value = reader.result; showStatus(`已加载 ${f.name}`); if(viewMode==='render') renderLines(); }; reader.readAsText(f);
  });

  btnPaste.addEventListener('click',()=>{
    navigator.clipboard.readText().then(t=>{ if(!t) return; editor.value = t; showStatus('已从剪贴板粘贴'); if(viewMode==='render') renderLines(); }).catch(()=>{ showStatus('无法访问剪贴板，请手动粘贴', true)});
  });

  btnToggleView.addEventListener('click',()=>{ setView(viewMode==='edit'?'render':'edit'); });

  btnAddKw.addEventListener('click',()=>{ addKeyword(newKw.value, newColor.value); newKw.value=''; });

  btnAddFromSelection.addEventListener('click',()=>{
    let sel = '';
    if(viewMode==='edit'){
      const s = editor.selectionStart, e = editor.selectionEnd; sel = editor.value.substring(s,e);
    } else {
      sel = (window.getSelection && window.getSelection().toString()) || '';
    }
    if(!sel){ alert('未选中任何文本'); return }
    addKeyword(sel.trim(), newColor.value);
  });

  btnHideToolbar.addEventListener('click',()=>{ toolbar.style.display='none'; btnShowToolbar.style.display='block'; });
  btnShowToolbar.addEventListener('click',()=>{ toolbar.style.display='flex'; btnShowToolbar.style.display='none'; });

  searchInput.addEventListener('input',()=>{ if(viewMode==='render') indexMatches(); });
  btnPrev.addEventListener('click',()=>{ if(matches.length) gotoMatch((currentMatch-1+matches.length)%matches.length); });
  btnNext.addEventListener('click',()=>{ if(matches.length) gotoMatch((currentMatch+1)%matches.length); });

  btnGoto.addEventListener('click',()=>{ const n = parseInt(gotoLine.value); if(!n) return; const node = renderedView.querySelector(`.line[data-line='${n}']`); if(node){ node.scrollIntoView({block:'center'}); node.classList.add('match'); setTimeout(()=>node.classList.remove('match'),800);} else { showStatus('行号超出范围', true);} });

  // initial
  setView('edit'); refreshKeywordList();

  // expose simple functions for console debugging
  window.logViewer = {addKeyword,renderLines,setView};

})();
