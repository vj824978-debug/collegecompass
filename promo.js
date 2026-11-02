/* CollegePIPE promo: top ₹99 strip + result-screen upsell. One file, included on every page. */
(function(){
  function paid(){ try{ return localStorage.getItem('cp_premium')==='1'; }catch(e){ return false; } }
  function ev(n,p){ try{ if(window.gtag) gtag('event',n,p||{}); }catch(e){} }
  var path=location.pathname;

  function openPremium(src){
    ev('promo_click',{src:src,page:path});
    if(typeof window.pmShow==='function'){ window.pmShow(); return; }
    location.href='/tests/mocks.html?premium=1';
  }
  window.cpOpenPremium=openPremium;

  var css=''+
  '#cp-top{position:fixed;top:0;left:0;right:0;z-index:120;background:#f59e0b;color:#0d2347;font-family:"Segoe UI",system-ui,Roboto,Arial,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.15)}'+
  '#cp-top .in{max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:12px;padding:7px 14px;min-height:42px}'+
  '#cp-top .tx{font-size:14px;line-height:1.3;font-weight:600;min-width:0}'+
  '#cp-top .tx b{font-weight:800}'+
  '#cp-top .tx s{opacity:.6;margin-left:3px;font-weight:600}'+
  '#cp-top .tx .lg{display:inline}#cp-top .tx .sm{display:none}'+
  '#cp-top .cta{flex:none;background:#0d2347;color:#fff;font-weight:800;font-size:13.5px;padding:7px 14px;border-radius:9px;border:none;cursor:pointer;white-space:nowrap}'+
  '#cp-top .cta:hover{background:#16336b}'+
  '@media(max-width:760px){#cp-top .in{justify-content:space-between;gap:8px;padding:6px 10px}#cp-top .tx{font-size:12.5px}#cp-top .tx .lg{display:none}#cp-top .tx .sm{display:inline}#cp-top .cta{font-size:12.5px;padding:7px 11px}}'+
  '.cp-up{background:linear-gradient(135deg,#0d2347,#16336b);color:#fff;border-radius:16px;padding:20px 22px;margin:0 0 16px;text-align:left;font-family:"Segoe UI",system-ui,Roboto,Arial,sans-serif}'+
  '.cp-up h3{font-size:18px;margin:0 0 6px;color:#fff}'+
  '.cp-up p{font-size:13.5px;line-height:1.6;color:#d5ddeb;margin:0 0 6px}'+
  '.cp-up ul{margin:8px 0 14px;padding:0;list-style:none}'+
  '.cp-up li{font-size:13.5px;padding:3px 0 3px 22px;position:relative;color:#eef2f8}'+
  '.cp-up li:before{content:"✓";position:absolute;left:2px;color:#4ade80;font-weight:800}'+
  '.cp-up .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}'+
  '.cp-up .cta{background:#f59e0b;color:#0d2347;font-weight:800;font-size:15px;padding:12px 20px;border-radius:12px;border:none;cursor:pointer}'+
  '.cp-up .pr{font-size:13px;color:#b9c4d8}.cp-up .pr b{color:#fbbf24;font-size:16px}.cp-up .pr s{margin-left:4px}';
  function addCss(){ if(document.getElementById('cp-promo-css'))return; var s=document.createElement('style'); s.id='cp-promo-css'; s.textContent=css; document.head.appendChild(s); }

  /* ---------- top ₹99 strip (always visible, every page except live tests / payment page) ---------- */
  function bar(){
    if(paid())return;
    if(/\/tests\/(exam|jeeadv|paid)\.html$/.test(path))return;
    addCss();
    var b=document.createElement('div'); b.id='cp-top';
    b.innerHTML='<div class="in"><div class="tx">⭐ <b>CollegePIPE Premium</b> '+
      '<span class="lg">— 47 JEE Main mocks + LevelUp (11,000+ Qs) + Rankers\' Question Bank · </span><span class="sm">· 47 mocks + LevelUp · </span>'+
      '<b>₹99</b><s>₹999</s> lifetime</div><button class="cta" id="cp-top-go">Unlock ₹99 →</button></div>';
    document.body.insertBefore(b,document.body.firstChild);
    document.getElementById('cp-top-go').onclick=function(){ openPremium('topbar'); };
    // push the page (and any fixed/sticky header pinned at top:0) down by the strip height
    var basePad=parseFloat(getComputedStyle(document.body).paddingTop)||0, heads=[];
    Array.prototype.forEach.call(document.body.querySelectorAll('*'),function(el){
      if(el===b||b.contains(el))return;
      var cs=getComputedStyle(el); if(cs.position!=='fixed'&&cs.position!=='sticky')return;
      if(cs.top!=='0px')return;
      var r=el.getBoundingClientRect(); if(r.height>140||r.width<window.innerWidth*0.6)return;
      heads.push(el);
    });
    function fit(){ var h=b.offsetHeight; document.body.style.paddingTop=(basePad+h)+'px'; heads.forEach(function(el){ el.style.top=h+'px'; }); }
    fit(); window.addEventListener('resize',fit);
    ev('promo_view',{variant:'topbar',page:path});
  }

  /* ---------- result-screen upsell ----------
     opts: {type:'mock'|'pyq'|'ja'|'levelup', per:{Subject:{marks}}, total, max, level, passed, chapter} */
  window.cpUpsell=function(container,opts){
    if(paid()||!container)return;
    addCss(); opts=opts||{};
    var weak=null;
    if(opts.per){ for(var s in opts.per){ var m=opts.per[s].marks; if(weak===null||m<weak.m)weak={s:s,m:m}; } }
    var h, items;
    if(opts.type==='levelup'){
      h=opts.passed?'Level '+opts.level+' cleared 🎉 — keep climbing':'Fix the gaps this level just showed you';
      items=['Level 2, Level 3 &amp; Bonus for <b>'+(opts.chapter||'this chapter')+'</b>','Concept cards + topic drills for every weak topic','All 74 chapters — Physics, Chemistry, Maths (11,000+ Qs)','47 JEE Main full mocks in the real CBT'];
    } else {
      h=(opts.type==='mock'?'That was 1 of 47 mocks.':'Nice — a real paper done.')+(typeof opts.total==='number'?' You scored '+opts.total+(opts.max?'/'+opts.max:'')+'.':'');
      items=[opts.type==='mock'?'46 more full mocks — fresh, unseen questions':'47 full mocks with fresh, unseen questions',
             weak?('<b>'+weak.s.replace(/\s*[-–(].*$/,'')+'</b> was your weakest — LevelUp drills it chapter by chapter'):'LevelUp: level-wise practice + theory for every chapter',
             'Rankers\' Question Bank for JEE Advanced','Solutions, analytics &amp; mistake notebook on everything'];
    }
    var d=document.createElement('div'); d.className='cp-up';
    d.innerHTML='<h3>'+h+'</h3><p>Unlock everything with CollegePIPE Premium:</p><ul><li>'+items.join('</li><li>')+'</li></ul>'+
      '<div class="row"><button class="cta">Unlock for ₹99 →</button><span class="pr"><b>₹99</b><s>₹999</s> · one-time · lifetime access</span></div>';
    d.querySelector('.cta').onclick=function(){ openPremium('result_'+(opts.type||'')); };
    // exam result: show the score card first, offer right under it; LevelUp: top of the weak-topics block
    var ref=(opts.type!=='levelup'&&container.firstElementChild)?container.firstElementChild.nextSibling:container.firstChild;
    container.insertBefore(d,ref);
    ev('upsell_view',{type:opts.type||'',page:path});
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bar); else bar();
})();
