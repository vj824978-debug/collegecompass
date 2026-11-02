/* CollegePIPE promo: sticky ₹99 bar + result-screen upsell. One file, included on every page. */
(function(){
  function paid(){ try{ return localStorage.getItem('cp_premium')==='1'; }catch(e){ return false; } }
  function ev(n,p){ try{ if(window.gtag) gtag('event',n,p||{}); }catch(e){} }
  var FREE_MOCK='/tests/exam.html?paper=mock-01';
  var path=location.pathname;
  var isPrep=/^\/(tests|confidence)(\/|$)/.test(path);

  function openPremium(src){
    ev('promo_click',{src:src,page:path});
    if(typeof window.pmShow==='function'){ window.pmShow(); return; }
    location.href='/tests/mocks.html?premium=1';
  }
  window.cpOpenPremium=openPremium;

  var css=''+
  '#cp-bar{position:fixed;left:0;right:0;bottom:0;z-index:140;background:#0d2347;color:#fff;box-shadow:0 -6px 24px rgba(0,0,0,.18);font-family:"Segoe UI",system-ui,Roboto,Arial,sans-serif}'+
  '#cp-bar .in{max-width:1080px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:10px 14px}'+
  '#cp-bar .tx{flex:1;min-width:0;font-size:14px;line-height:1.35}'+
  '#cp-bar .tx b{color:#fbbf24}'+
  '#cp-bar .tx s{color:#94a3b8;margin-left:3px}'+
  '#cp-bar .tx small{display:block;color:#b9c4d8;font-size:12px}'+
  '#cp-bar .cta{flex:none;background:#f59e0b;color:#0d2347;font-weight:800;font-size:14px;padding:10px 16px;border-radius:10px;text-decoration:none;border:none;cursor:pointer;white-space:nowrap}'+
  '#cp-bar .cta2{flex:none;color:#fbbf24;font-weight:700;font-size:12.5px;text-decoration:underline;cursor:pointer;background:none;border:none;white-space:nowrap}'+
  '#cp-bar .x{flex:none;background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:4px}'+
  '@media(max-width:640px){#cp-bar .in{gap:8px;padding:9px 10px}#cp-bar .tx{font-size:12.5px}#cp-bar .tx small{display:none}#cp-bar .cta{font-size:13px;padding:9px 12px}#cp-bar .cta2{display:none}}'+
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

  /* ---------- sticky bar ---------- */
  function bar(){
    if(paid())return;
    if(/\/tests\/(exam|jeeadv|paid)\.html$/.test(path))return;      // never over a live test or the payment page
    try{ if(sessionStorage.getItem('cp_bar_x')==='1')return; }catch(e){}
    addCss();
    var b=document.createElement('div'); b.id='cp-bar';
    if(isPrep){
      b.innerHTML='<div class="in"><div class="tx">⭐ <b>Premium ₹99</b><s>₹999</s> · lifetime<small>47 JEE Main mocks · LevelUp 11,000+ questions · Rankers\' Question Bank</small></div>'+
        '<button class="cta" id="cp-bar-go">Unlock ₹99 →</button><button class="x" id="cp-bar-x" aria-label="Close">✕</button></div>';
    } else {
      b.innerHTML='<div class="in"><div class="tx">🎯 <b>Preparing for JEE 2027?</b> Take a full JEE Main mock in the real CBT — free<small>Then 46 more mocks + LevelUp for ₹99 lifetime</small></div>'+
        '<a class="cta" id="cp-bar-go" href="'+FREE_MOCK+'">Start free mock →</a><button class="cta2" id="cp-bar-prem">Premium ₹99</button><button class="x" id="cp-bar-x" aria-label="Close">✕</button></div>';
    }
    document.body.appendChild(b);
    var pad=function(){ document.body.style.paddingBottom=(b.offsetHeight+8)+'px'; }; pad(); window.addEventListener('resize',pad);
    document.getElementById('cp-bar-x').onclick=function(){ b.remove(); document.body.style.paddingBottom=''; try{sessionStorage.setItem('cp_bar_x','1');}catch(e){} ev('promo_close',{page:path}); };
    var go=document.getElementById('cp-bar-go');
    if(isPrep) go.onclick=function(){ openPremium('bar'); };
    else { go.addEventListener('click',function(){ ev('promo_click',{src:'bar_free_mock',page:path}); });
           document.getElementById('cp-bar-prem').onclick=function(){ openPremium('bar'); }; }
    ev('promo_view',{variant:isPrep?'prep':'visitor',page:path});
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
