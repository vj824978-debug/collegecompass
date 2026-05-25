/* ───────────────────────────────────────────────────────────
   CollegePIPE — NEET UG College Predictor (Schema-Driven)
   ──────────────────────────────────────────────────────────── */

const SCHEMA_URL = 'data/neet/schema.json';
const STATE_BASE = 'data/neet/states/';
const AIQ_URL    = 'data/neet/aiq.json';

let schema      = null;   // master schema
let stateCache  = {};     // slug -> state data
let aiqData     = null;   // loaded on first need
let aiqPromise  = null;
let currentState = null;  // currently loaded state object

/* ── Filter UI definitions ────────────────────────────────── */

// Friendly label per filter key (also drives display order)
const FILTER_META = {
  category:    { label: 'Category',        required: true,  cls: 'state' },
  subCategory: { label: 'Sub-category',    required: false, cls: 'state', help: 'PWD, Defence, Region etc.' },
  seatType:    { label: 'Seat Type / Quota',required: false, cls: 'state', help: 'GQ, MQ, NRI, OU etc.' },
  gender:      { label: 'Gender',          required: false, cls: 'state', help: 'Gender-reserved seats' },
};

const AIQ_FILTERS_DEF = [
  { key: 'category',    label: 'AIQ Category',  required: true,  options: [
    'Open','EWS','OBC','SC','ST','Open PWD','EWS PWD','OBC PWD','SC PWD','ST PWD'
  ]},
  { key: 'collegeType', label: 'College Type',  required: false, options: [
    'Govt','Pvt','Aided','SemiGovt'
  ]},
  { key: 'round',       label: 'Round',         required: false, options: [
    '1','2','3','5','Stray 1','Stray 2'
  ]},
  { key: 'quota',       label: 'Quota (advanced)', required: false, options: 'aiqQuotas' }, // resolved at runtime
];

/* ── Helpers ──────────────────────────────────────────────── */
function el(id) { return document.getElementById(id); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function escapeHtml(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shortCollegeName(name) {
  if (!name) return '';
  let parts = name.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return name;
  let out = parts[0];
  if (out.length < 12 && parts.length > 1) out = parts.slice(0, 2).join(', ');
  out = out.replace(/\s*\b\d{6}\b\s*$/, '');
  if (out.length > 90) out = out.slice(0, 88) + '…';
  return out;
}

function collegeTypePill(ct) {
  if (!ct) return '';
  const k = ct.toLowerCase();
  if (k.includes('govt') && k.includes('ppp')) return `<span class="college-pill pill-aid">Govt (PPP)</span>`;
  if (k.includes('aided')) return `<span class="college-pill pill-aid">Aided</span>`;
  if (k.includes('semi')) return `<span class="college-pill pill-semi">Semi-Govt</span>`;
  if (k.includes('govt')) return `<span class="college-pill pill-govt">Govt</span>`;
  if (k.includes('pvt') || k.includes('private')) return `<span class="college-pill pill-pvt">Private</span>`;
  return `<span class="college-pill pill-pvt">${escapeHtml(ct)}</span>`;
}

function nfmt(n) { return Number(n).toLocaleString('en-IN'); }

/* ── Loaders ──────────────────────────────────────────────── */

async function loadSchema() {
  if (schema) return schema;
  try {
    const r = await fetch(SCHEMA_URL);
    schema = await r.json();
    return schema;
  } catch (e) {
    console.error('Schema load failed', e);
    return null;
  }
}

function loadAIQ() {
  if (aiqData) return Promise.resolve(aiqData);
  if (aiqPromise) return aiqPromise;
  aiqPromise = (async () => {
    try {
      const r = await fetch(AIQ_URL);
      aiqData = await r.json();
      return aiqData;
    } catch (e) {
      console.error('AIQ load failed', e);
      aiqPromise = null;
      return null;
    }
  })();
  return aiqPromise;
}

async function loadState(slug) {
  if (stateCache[slug]) return stateCache[slug];
  try {
    const r = await fetch(STATE_BASE + slug + '.json');
    const data = await r.json();
    stateCache[slug] = data;
    return data;
  } catch (e) {
    console.error('State load failed for', slug, e);
    return null;
  }
}

/* ── Init: build state dropdown + AIQ filters ────────────── */

async function init() {
  const ok = await loadSchema();
  if (!ok) {
    el('dataStatus').innerHTML = '<span style="color:var(--danger);">⚠ Could not load NEET database. Please refresh.</span>';
    return;
  }

  // Populate state dropdown (sorted by row count desc - most data first)
  const sel = el('f_state');
  const sortedStates = [...schema.states].sort((a,b) => b.rowCount - a.rowCount);
  sortedStates.forEach(st => {
    if (st.rowCount === 0) return; // skip empty (Uttarakhand)
    const opt = document.createElement('option');
    opt.value = st.slug;
    opt.textContent = st.state + ' (' + st.rowCount.toLocaleString('en-IN') + ' cutoffs)';
    sel.appendChild(opt);
  });

  // Show all states alphabetical option group separately too
  const sepOpt = document.createElement('option');
  sepOpt.disabled = true;
  sepOpt.textContent = '──── alphabetical ────';
  // (skipping for now to keep dropdown simple)

  // Build AIQ filters
  buildAIQFilters();

  // Background fetch AIQ data (so submit is instant)
  loadAIQ().then(d => {
    if (d) {
      updateAIQQuotaOptions();
      el('dataStatus').innerHTML = '<span class="ok">✓ Database loaded · ' + schema.totalRows.toLocaleString('en-IN') + ' cutoffs ready</span>';
    }
  });

  el('dataStatus').innerHTML = '<span class="pending">⏳ Loading AIQ database in background…</span>';

  // Pre-fill from last session
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cp_neet_fd_')) {
        const saved = JSON.parse(localStorage.getItem(k) || 'null');
        if (saved && saved.email) {
          if (!el('f_name').value)  el('f_name').value  = saved.name  || '';
          if (!el('f_email').value) el('f_email').value = saved.email || '';
          if (!el('f_phone').value) el('f_phone').value = (saved.phone || '').replace('+91', '');
          break;
        }
      }
    }
  } catch(e) {}
}

function buildAIQFilters() {
  const host = el('aiqFilters');
  host.innerHTML = '';
  AIQ_FILTERS_DEF.forEach(f => {
    const field = document.createElement('div');
    field.className = 'field';
    const lab = document.createElement('label');
    if (f.required) lab.classList.add('req');
    lab.textContent = f.label;
    const sel = document.createElement('select');
    sel.id = 'aiq_' + f.key;
    sel.dataset.filter = f.key;
    sel.dataset.scope = 'aiq';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = f.required ? 'Select…' : 'Any';
    sel.appendChild(defOpt);
    const opts = Array.isArray(f.options) ? f.options : [];
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    });
    field.appendChild(lab);
    field.appendChild(sel);
    host.appendChild(field);
  });
  // Default category to Open
  setTimeout(() => { const c = el('aiq_category'); if (c) c.value = 'Open'; }, 0);
}

function updateAIQQuotaOptions() {
  if (!aiqData) return;
  const sel = el('aiq_quota');
  if (!sel) return;
  // Replace options with actual data
  while (sel.options.length > 1) sel.remove(1);
  aiqData.filters.quota.forEach(q => {
    const opt = document.createElement('option');
    opt.value = q;
    // Show short label
    opt.textContent = q.length > 60 ? q.slice(0, 58) + '…' : q;
    sel.appendChild(opt);
  });
  // Also refresh round options from actual data
  const rsel = el('aiq_round');
  if (rsel) {
    while (rsel.options.length > 1) rsel.remove(1);
    aiqData.filters.round.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = 'Round ' + r;
      rsel.appendChild(opt);
    });
  }
}

/* ── State dropdown change handler ───────────────────────── */

async function onStateChange() {
  const sel = el('f_state');
  const slug = sel.value;
  const block = el('stateFilterBlock');
  const host = el('stateFiltersHost');
  const commonNum = el('commonBlockNum');

  if (!slug || slug === '__AIQ_ONLY__') {
    block.style.display = 'none';
    commonNum.textContent = '4';
    currentState = null;
    if (slug === '__AIQ_ONLY__') {
      // Show a friendly note in AIQ block
    }
    return;
  }

  // Show block with loading state
  block.style.display = 'block';
  commonNum.textContent = '5';
  host.innerHTML = '<div class="state-loading">Loading <strong>' + escapeHtml(sel.options[sel.selectedIndex].text) + '</strong> filters<span class="dots"></span></div>';

  const data = await loadState(slug);
  if (!data) {
    host.innerHTML = '<div class="tip-row warn"><span class="ic">⚠</span><span>Could not load state data. Please try again.</span></div>';
    return;
  }
  currentState = data;
  el('stateFilterTitle').textContent = data.state + ' State Quota Filters';
  el('stateFilterTag').textContent = data.state + ' · ~85% domicile seats';
  renderStateFilters(data);
}

function renderStateFilters(state) {
  const host = el('stateFiltersHost');
  host.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  // Determine which filter columns to show
  const showFilters = [];
  ['category','subCategory','seatType'].forEach(k => {
    if (state.filters[k] && state.filters[k].length >= 1) showFilters.push(k);
  });
  if (state.rowSchema.includes('gender')) showFilters.push('gender');

  showFilters.forEach(k => {
    const meta = FILTER_META[k];
    const field = document.createElement('div');
    field.className = 'field';
    const lab = document.createElement('label');
    if (meta.required) lab.classList.add('req');
    lab.textContent = meta.label;
    const sel = document.createElement('select');
    sel.id = 'st_' + k;
    sel.dataset.filter = k;
    sel.dataset.scope = 'state';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = meta.required ? 'Select…' : 'Any';
    sel.appendChild(defOpt);
    if (k === 'gender') {
      ['Any (gender-neutral)','Female','Male'].forEach(g => {
        const opt = document.createElement('option');
        const v = g === 'Female' ? 'Female' : g === 'Male' ? 'Male' : 'Any';
        opt.value = v; opt.textContent = g;
        sel.appendChild(opt);
      });
    } else {
      (state.filters[k] || []).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v.length > 60 ? v.slice(0, 58) + '…' : v;
        sel.appendChild(opt);
      });
    }
    field.appendChild(lab);
    field.appendChild(sel);
    grid.appendChild(field);
  });

  host.appendChild(grid);

  // Helper tips per state
  const tipText = stateTip(state);
  if (tipText) {
    const tip = document.createElement('div');
    tip.className = 'tip-row';
    tip.style.marginTop = '14px';
    tip.innerHTML = '<span class="ic">💡</span><span>' + tipText + '</span>';
    host.appendChild(tip);
  }
}

function stateTip(state) {
  const s = state.state;
  if (s === 'Karnataka')   return '<strong>Karnataka categories:</strong> GM/Open · Cat-1, 2A, 2B, 3A, 3B (state-specific OBC tiers) · SC · ST. Use <em>Seat Type GQ</em> for general govt seats, <em>MQ</em> for management quota.';
  if (s === 'Maharashtra') return '<strong>Maharashtra categories:</strong> Open · EWS · OBC · SC · ST · NT1/NT2/NT3 (Nomadic Tribes) · SEBC · VJ. Sub-categories include DEF (Defence), EMD, HA (Hilly Area), PWD, IQ (Institutional Quota).';
  if (s === 'Tamil Nadu')  return '<strong>Tamil Nadu categories:</strong> Open · BC · BCM (BC Muslim) · MBC · MBC&amp;DNC · SCA · SC · ST. Seat Type: GQ (govt) or MQ (management).';
  if (s === 'Kerala')      return '<strong>Kerala community-based categories:</strong> Open · EWS · SC · ST · EZ · MU · BH · BX · DV · KN · KU · LA · VK · MM · SM. Pick the one that matches your community.';
  if (s === 'Andhra Pradesh') return '<strong>Andhra categories:</strong> Open · BC-A, BC-B, BC-C, BC-D, BC-E (5-way Backward Class) · SC-1, SC-2, SC-3 · ST. Most seats are GQ (govt quota).';
  if (s === 'Telangana')   return '<strong>Telangana:</strong> Pick OU/SVU/AU region under Seat Type (your university region). OU = Osmania, SVU = Sri Venkateswara, AU = Andhra. Gender column applies for female-reserved seats.';
  if (s === 'Bihar')       return '<strong>Bihar categories:</strong> Open · EWS · BC · EBC · SC · ST · RCG · WQ (Women) · DQ · MM (Muslim Minority).';
  if (s === 'Delhi')       return '<strong>Delhi:</strong> Open · OBC · SC · ST · EWS · ARMY · Christian Minority. Note: PWD and Defence have dedicated category entries here.';
  if (s === 'Gujarat')     return '<strong>Gujarat:</strong> Open · EWS · OBC · SC · ST · SEBC. Filter by Seat Type to narrow Govt vs Management seats.';
  if (s === 'Uttar Pradesh') return '<strong>UP:</strong> Open · EWS · OBC · SC · ST. Sub-categories include Freedom Fighter, Defence, Single Girl Child, Wards of Defence.';
  return '';
}

/* ── Submit + Predict ────────────────────────────────────── */

async function submitPredictor() {
  const errEl = el('formError');
  errEl.style.display = 'none';

  const name  = el('f_name').value.trim();
  const email = el('f_email').value.trim();
  const phone = el('f_phone').value.trim();
  const rank  = parseInt(el('f_rank').value, 10);
  const stateSlug = el('f_state').value;
  const course = el('f_course').value;
  const collegeType = el('f_collegeType').value;

  if (!name)                          return showErr('Please enter your name.');
  if (!email || !email.includes('@')) return showErr('Please enter a valid email address.');
  if (!/^\d{10}$/.test(phone))       return showErr('Please enter a valid 10-digit mobile number.');
  if (!rank || rank < 1)              return showErr('Please enter a valid NEET UG All India Rank.');
  if (!stateSlug)                     return showErr('Please pick your domicile state or "AIQ only".');

  // Read AIQ filters
  const aiqCategory = el('aiq_category').value;
  if (!aiqCategory) return showErr('Please pick your AIQ category (Open / EWS / OBC / SC / ST).');
  const aiqFilters = {
    category:    aiqCategory,
    collegeType: el('aiq_collegeType').value,
    round:       el('aiq_round').value,
    quota:       el('aiq_quota').value
  };

  // Read state filters
  let stateUserFilters = null;
  if (stateSlug !== '__AIQ_ONLY__') {
    if (!currentState || currentState.slug !== stateSlug) {
      const data = await loadState(stateSlug);
      if (data) currentState = data;
    }
    if (currentState) {
      stateUserFilters = {};
      ['category','subCategory','seatType','gender'].forEach(k => {
        const sel = el('st_' + k);
        if (sel) stateUserFilters[k] = sel.value;
      });
      // Required: category
      if (currentState.filters.category && !stateUserFilters.category) {
        return showErr('Please pick your category for ' + currentState.state + '.');
      }
    }
  }

  const user = { name, email, phone, rank, stateSlug, course, collegeType, aiqFilters, stateUserFilters };
  window._reportMeta = {
    name, email, phone, rank, course, collegeType,
    stateName: stateSlug === '__AIQ_ONLY__' ? 'AIQ only' : (currentState ? currentState.state : stateSlug),
    aiqCategory,
    stateCategory: stateUserFilters?.category || null,
    stateSubCategory: stateUserFilters?.subCategory || null,
    stateSeatType: stateUserFilters?.seatType || null,
    stateGender: stateUserFilters?.gender || null
  };

  try { localStorage.setItem('cp_neet_fd_'+email, JSON.stringify({name,email,phone})); } catch(e) {}

  const btn = el('submitBtn');
  btn.disabled = true;
  el('submitText').style.display = 'none';
  el('submitSpinner').style.display = 'block';

  try {
    // Ensure AIQ loaded
    await loadAIQ();
    if (!aiqData) return showErr('Could not load AIQ database. Please check your connection and try again.');

    const aiqResult = filterAIQ(user);
    const stateResult = stateUserFilters ? filterState(user, currentState) : null;
    const top = buildTopPicks(user, aiqResult, stateResult);

    showResults({ aiq: aiqResult, state: stateResult, top, stateName: stateUserFilters ? currentState.state : null }, user);
  } catch (err) {
    console.error(err);
    showErr(err.message || 'Something went wrong. Please try again.');
  } finally {
    el('submitText').style.display = 'inline';
    el('submitSpinner').style.display = 'none';
    btn.disabled = false;
  }
}

/* ── Filter functions ─────────────────────────────────────── */

function filterAIQ(user) {
  if (!aiqData) return { dream: [], safe: [] };
  const f = aiqData.filters;
  const schema = aiqData.rowSchema; // [college, openR, closeR, category, quota, course, collegeType, round]
  const idx = {
    college: schema.indexOf('college'),
    openR:   schema.indexOf('openR'),
    closeR:  schema.indexOf('closeR'),
    category:schema.indexOf('category'),
    quota:   schema.indexOf('quota'),
    course:  schema.indexOf('course'),
    collegeType: schema.indexOf('collegeType'),
    round:   schema.indexOf('round')
  };

  // Resolve user filter values to indices
  const catId = user.aiqFilters.category ? f.category.indexOf(user.aiqFilters.category) : -1;
  const ctId  = user.aiqFilters.collegeType && user.aiqFilters.collegeType !== 'ALL' ? f.collegeType.indexOf(user.aiqFilters.collegeType) : -1;
  const rndId = user.aiqFilters.round ? f.round.indexOf(user.aiqFilters.round) : -1;
  const qtId  = user.aiqFilters.quota ? f.quota.indexOf(user.aiqFilters.quota) : -1;
  const crId  = user.course !== 'ALL' ? f.course.indexOf(user.course) : -1;
  const userCT = user.collegeType !== 'ALL' ? user.collegeType : null;

  // Global college type filter — match all matching types
  const ctSet = userCT ? buildCollegeTypeSet(userCT, f.collegeType) : null;

  const dreamMin = Math.floor(user.rank * 0.9);
  const dream = [], safe = [];

  for (const r of aiqData.rows) {
    if (catId !== -1 && r[idx.category] !== catId) continue;
    if (ctId !== -1 && r[idx.collegeType] !== ctId) continue;
    if (rndId !== -1 && r[idx.round] !== rndId) continue;
    if (qtId !== -1 && r[idx.quota] !== qtId) continue;
    if (crId !== -1 && r[idx.course] !== crId) continue;
    if (ctSet && !ctSet.has(r[idx.collegeType])) continue;
    const cr = r[idx.closeR];
    const isDream = cr >= dreamMin && cr < user.rank;
    const isSafe  = cr >= user.rank;
    if (!isDream && !isSafe) continue;
    const item = {
      college: shortCollegeName(aiqData.colleges[r[idx.college]]),
      collegeFull: aiqData.colleges[r[idx.college]],
      course: f.course[r[idx.course]] || '',
      collegeType: f.collegeType[r[idx.collegeType]] || '',
      category: f.category[r[idx.category]] || '',
      quota: f.quota[r[idx.quota]] || '',
      round: f.round[r[idx.round]] || '',
      closeR: cr,
      openR: r[idx.openR],
      gap: cr - user.rank,
      isDream,
      source: 'AIQ'
    };
    if (isDream) dream.push(item);
    else         safe.push(item);
  }

  dream.sort((a,b) => b.closeR - a.closeR);
  safe.sort((a,b) => a.closeR - b.closeR);
  return { dream: dream.slice(0, 80), safe: safe.slice(0, 80) };
}

function filterState(user, state) {
  const f = state.filters;
  const schema = state.rowSchema;
  const idx = {};
  schema.forEach((k,i) => idx[k] = i);

  const sf = user.stateUserFilters;
  const catId = sf.category ? f.category.indexOf(sf.category) : -1;
  const subId = sf.subCategory ? f.subCategory.indexOf(sf.subCategory) : -1;
  const seatId = sf.seatType ? f.seatType.indexOf(sf.seatType) : -1;
  const crId = user.course !== 'ALL' && f.course ? f.course.indexOf(user.course) : -1;
  const ctSet = user.collegeType !== 'ALL' && f.collegeType ? buildCollegeTypeSet(user.collegeType, f.collegeType) : null;

  const userGender = sf.gender; // 'Female' | 'Male' | 'Any' | ''
  const dreamMin = Math.floor(user.rank * 0.9);
  const dream = [], safe = [];

  for (const r of state.rows) {
    if (idx.category != null && catId !== -1 && r[idx.category] !== catId) continue;
    if (idx.subCategory != null && subId !== -1 && r[idx.subCategory] !== subId) continue;
    if (idx.seatType != null && seatId !== -1 && r[idx.seatType] !== seatId) continue;
    if (idx.course != null && crId !== -1 && r[idx.course] !== crId) continue;
    if (idx.collegeType != null && ctSet && !ctSet.has(r[idx.collegeType])) continue;
    if (idx.gender != null && userGender && userGender !== 'Any' && userGender !== '') {
      const rg = r[idx.gender]; // 0=Any, 1=Female, 2=Male
      if (userGender === 'Female' && rg !== 0 && rg !== 1) continue;
      if (userGender === 'Male' && rg !== 0 && rg !== 2) continue;
    }
    const cr = r[idx.closeR];
    const isDream = cr >= dreamMin && cr < user.rank;
    const isSafe  = cr >= user.rank;
    if (!isDream && !isSafe) continue;

    const item = {
      college: shortCollegeName(state.colleges[r[idx.college]]),
      collegeFull: state.colleges[r[idx.college]],
      course: idx.course != null ? f.course[r[idx.course]] : '',
      collegeType: idx.collegeType != null ? f.collegeType[r[idx.collegeType]] : '',
      category: idx.category != null ? f.category[r[idx.category]] : '',
      subCategory: idx.subCategory != null && f.subCategory ? f.subCategory[r[idx.subCategory]] : '',
      seatType: idx.seatType != null && f.seatType ? f.seatType[r[idx.seatType]] : '',
      gender: idx.gender != null ? r[idx.gender] : 0,
      closeR: cr,
      openR: r[idx.openR],
      gap: cr - user.rank,
      isDream,
      source: 'State'
    };
    if (isDream) dream.push(item);
    else         safe.push(item);
  }

  dream.sort((a,b) => b.closeR - a.closeR);
  safe.sort((a,b) => a.closeR - b.closeR);
  return { dream: dream.slice(0, 80), safe: safe.slice(0, 80) };
}

function buildCollegeTypeSet(userType, list) {
  const set = new Set();
  const u = userType.toLowerCase();
  list.forEach((t,i) => {
    const lk = t.toLowerCase();
    if (u === 'govt' && (lk === 'govt' || lk.includes('govt'))) set.add(i);
    else if (u === 'pvt' && (lk === 'pvt' || lk.includes('private'))) set.add(i);
    else if (u === 'aided' && lk.includes('aided')) set.add(i);
    else if (u === 'semigovt' && (lk.includes('semi'))) set.add(i);
  });
  return set;
}

function buildTopPicks(user, aiqRes, stateRes) {
  const COURSE_WEIGHT = { 'MBBS':1, 'BDS':2, 'BAMS':3, 'BHMS':3, 'BSMS':3, 'BUMS':3, 'BNYS':4, 'BPT':4, 'B.Sc Nursing':4, 'BVSc & AH':4, 'BSc':5, 'B.Pharm':5 };
  const all = [
    ...(aiqRes.dream.map(x => ({...x, source: 'AIQ'}))),
    ...(aiqRes.safe.map(x  => ({...x, source: 'AIQ'}))),
    ...(stateRes ? stateRes.dream.map(x => ({...x, source: 'State'})) : []),
    ...(stateRes ? stateRes.safe.map(x  => ({...x, source: 'State'})) : [])
  ];
  const seen = new Set();
  const top = [];
  for (const p of all.slice().sort((a,b) => {
    const cwA = COURSE_WEIGHT[a.course] || 6;
    const cwB = COURSE_WEIGHT[b.course] || 6;
    const govA = (a.collegeType||'').toLowerCase().includes('govt') ? 0 : 1;
    const govB = (b.collegeType||'').toLowerCase().includes('govt') ? 0 : 1;
    if (cwA !== cwB) return cwA - cwB;
    if (govA !== govB) return govA - govB;
    return Math.abs(a.gap) - Math.abs(b.gap);
  })) {
    const k = p.college + '|' + p.course;
    if (seen.has(k)) continue;
    seen.add(k);
    top.push(p);
    if (top.length >= 10) break;
  }
  return top;
}

/* ── Render ──────────────────────────────────────────────── */

function showResults(results, user) {
  el('predForm').style.display = 'none';
  el('resultsArea').style.display = 'block';

  const title = results.stateName
    ? `Your ${results.stateName} + AIQ Medical College List`
    : 'Your AIQ Medical College List';
  el('resultsTitle').textContent = title;

  const aiqCount = results.aiq.dream.length + results.aiq.safe.length;
  const stCount = results.state ? (results.state.dream.length + results.state.safe.length) : 0;
  el('resultsSub').textContent =
    `${aiqCount + stCount} matching colleges · Dream (within 10% of your rank) + Safe (≥ your rank) · sorted by closing rank.`;

  const meta = el('resultsMeta'); meta.innerHTML = '';
  const m = window._reportMeta;
  const chips = [
    {cls: 'rank', label: '🩺 NEET AIR ' + nfmt(m.rank)},
    {cls: 'aiq',  label: 'AIQ: ' + m.aiqCategory}
  ];
  if (m.stateCategory) chips.push({cls:'',label: m.stateName + ': ' + m.stateCategory});
  if (m.stateSubCategory) chips.push({cls:'',label: m.stateSubCategory});
  if (m.stateSeatType) chips.push({cls:'',label: m.stateSeatType});
  if (m.stateGender && m.stateGender !== 'Any' && m.stateGender !== '') chips.push({cls:'',label: m.stateGender + ' seats'});
  if (m.course !== 'ALL') chips.push({cls:'',label: m.course});
  if (m.collegeType !== 'ALL') chips.push({cls:'',label: m.collegeType});
  chips.forEach(c => {
    const span = document.createElement('span');
    span.className = 'meta-chip ' + (c.cls || '');
    span.textContent = c.label;
    meta.appendChild(span);
  });

  renderResultsHtml(results, user);
  setTimeout(() => el('resultsArea').scrollIntoView({behavior: 'smooth', block: 'start'}), 100);
}

function renderResultsHtml(results, user) {
  let html = '';
  if (results.top.length) html += renderTopPicks(results.top);
  if (results.state) {
    html += renderStateSection(results.stateName, results.state, user);
  }
  html += renderAIQSection(results.aiq, user);
  if (!html) {
    html = `<div class="empty-block"><div class="icon">🔍</div><h4>No matching colleges found</h4><p>Try widening your filters — set Course to "All courses", change category, or pick "AIQ only" if you're not a state domicile.</p></div>`;
  }
  el('resultsContent').innerHTML = html;
}

function renderTopPicks(top) {
  const headers = `<tr>
    <th style="width:32px;text-align:center;">#</th>
    <th>College</th>
    <th style="width:90px;">Course</th>
    <th style="width:90px;text-align:center;">Closing Rank</th>
    <th style="width:65px;text-align:center;">Gap</th>
    <th style="width:60px;text-align:center;">Quota</th>
  </tr>`;
  const rows = top.map((p, i) => {
    const gc = p.gap <= 0 ? 'gap-neg' : 'gap-pos';
    const gs = p.gap >= 0 ? '+' : '';
    return `<tr class="${p.isDream ? 'dream-row' : 'safe-row'}">
      <td style="text-align:center;font-weight:700;">${i+1}</td>
      <td class="college-cell">
        <strong>${escapeHtml(p.college)}</strong>
        <div class="col-meta">${collegeTypePill(p.collegeType)}<span>${escapeHtml(p.category)}${p.seatType ? ' · '+escapeHtml(p.seatType) : ''}</span></div>
      </td>
      <td><span class="course-badge">${escapeHtml(p.course)}</span></td>
      <td style="text-align:center;"><span class="rank-badge">${nfmt(p.closeR)}</span></td>
      <td style="text-align:center;" class="${gc}">${gs}${nfmt(p.gap)}</td>
      <td style="text-align:center;font-size:11px;color:var(--muted);font-weight:600;">${escapeHtml(p.source)}</td>
    </tr>`;
  }).join('');
  return `<div class="result-section">
    <div class="result-section-title">🏆 Top 10 Personalised Picks <span class="count">${top.length}</span></div>
    <div class="result-section-sub">Ranked by course value (MBBS &gt; BDS &gt; AYUSH), college type (Govt preferred), and proximity to your rank.</div>
    <table class="ctable">${headers}${rows}</table>
  </div>`;
}

function renderStateSection(stateName, bucket, user) {
  const total = bucket.dream.length + bucket.safe.length;
  if (total === 0) {
    return `<div class="result-section">
      <div class="result-section-title">🏠 ${escapeHtml(stateName)} State Quota <span class="count">0</span></div>
      <div class="empty-block"><div class="icon">🤔</div><h4>No matches in ${escapeHtml(stateName)} state quota</h4><p>For your current category and rank, no cutoffs match. Try changing the sub-category or seat type, or check AIQ results below.</p></div>
    </div>`;
  }
  return `<div class="result-section">
    <div class="result-section-title">🏠 ${escapeHtml(stateName)} State Quota <span class="count">${total} colleges</span></div>
    <div class="result-section-sub">~85% of govt + private medical seats in ${escapeHtml(stateName)} are reserved for state domicile students. These cutoffs are from the state's official counselling.</div>
    <div class="sub-label sub-dream">🎯 Dream <span class="sub-count">— ${bucket.dream.length} colleges (cutoff close to your rank, slight stretch)</span></div>
    ${bucket.dream.length ? `<table class="ctable">${stateRowsTable(bucket.dream)}</table>` : emptyRowsMsg('No dream colleges in this bucket.')}
    <div class="sub-label sub-safe">✅ Safe <span class="sub-count">— ${bucket.safe.length} colleges (cutoff ≥ your rank, comfortably within reach)</span></div>
    ${bucket.safe.length ? `<table class="ctable">${stateRowsTable(bucket.safe)}</table>` : emptyRowsMsg('No safe colleges in this bucket.')}
  </div>`;
}

function renderAIQSection(bucket, user) {
  const total = bucket.dream.length + bucket.safe.length;
  if (total === 0) {
    return `<div class="result-section">
      <div class="result-section-title aiq">🇮🇳 All India Quota (MCC) <span class="count">0</span></div>
      <div class="empty-block"><div class="icon">🤔</div><h4>No AIQ matches</h4><p>For your AIQ category and filters, no cutoffs match. Try changing course or college type.</p></div>
    </div>`;
  }
  return `<div class="result-section">
    <div class="result-section-title aiq">🇮🇳 All India Quota (MCC) <span class="count">${total} colleges</span></div>
    <div class="result-section-sub">15% govt seats + 100% central institutes (AIIMS, JIPMER) + Deemed Universities. Open to all states.</div>
    <div class="sub-label sub-dream">🎯 Dream <span class="sub-count">— ${bucket.dream.length} colleges</span></div>
    ${bucket.dream.length ? `<table class="ctable">${aiqRowsTable(bucket.dream)}</table>` : emptyRowsMsg('No dream colleges.')}
    <div class="sub-label sub-safe">✅ Safe <span class="sub-count">— ${bucket.safe.length} colleges</span></div>
    ${bucket.safe.length ? `<table class="ctable">${aiqRowsTable(bucket.safe)}</table>` : emptyRowsMsg('No safe colleges.')}
  </div>`;
}

function stateRowsTable(rows) {
  const header = `<tr>
    <th>College</th>
    <th style="width:90px;">Course</th>
    <th style="width:130px;">Seat Type / Sub</th>
    <th style="width:90px;text-align:center;">Closing Rank</th>
    <th style="width:70px;text-align:center;">Gap</th>
  </tr>`;
  const body = rows.map(r => {
    const gc = r.gap <= 0 ? 'gap-neg' : 'gap-pos';
    const gs = r.gap >= 0 ? '+' : '';
    const seatBits = [r.seatType, r.subCategory].filter(Boolean).join(' · ');
    const genderTxt = r.gender === 1 ? 'F' : r.gender === 2 ? 'M' : '';
    return `<tr class="${r.isDream ? 'dream-row' : 'safe-row'}">
      <td class="college-cell">
        <strong>${escapeHtml(r.college)}</strong>
        <div class="col-meta">${collegeTypePill(r.collegeType)}<span>${escapeHtml(r.category)}${genderTxt ? ' · ' + genderTxt : ''}</span></div>
      </td>
      <td><span class="course-badge">${escapeHtml(r.course)}</span></td>
      <td style="font-size:11px;color:var(--muted);">${escapeHtml(seatBits || '—')}</td>
      <td style="text-align:center;"><span class="rank-badge">${nfmt(r.closeR)}</span></td>
      <td style="text-align:center;" class="${gc}">${gs}${nfmt(r.gap)}</td>
    </tr>`;
  }).join('');
  return header + body;
}

function aiqRowsTable(rows) {
  const header = `<tr>
    <th>College</th>
    <th style="width:90px;">Course</th>
    <th style="width:140px;">Quota</th>
    <th style="width:90px;text-align:center;">Closing Rank</th>
    <th style="width:70px;text-align:center;">Gap</th>
    <th style="width:55px;text-align:center;">Round</th>
  </tr>`;
  const body = rows.map(r => {
    const gc = r.gap <= 0 ? 'gap-neg' : 'gap-pos';
    const gs = r.gap >= 0 ? '+' : '';
    const quotaShort = (r.quota || '').length > 32 ? r.quota.slice(0, 30) + '…' : r.quota;
    return `<tr class="${r.isDream ? 'dream-row' : 'safe-row'}">
      <td class="college-cell">
        <strong>${escapeHtml(r.college)}</strong>
        <div class="col-meta">${collegeTypePill(r.collegeType)}<span>${escapeHtml(r.category)}</span></div>
      </td>
      <td><span class="course-badge">${escapeHtml(r.course)}</span></td>
      <td style="font-size:11px;color:var(--muted);" title="${escapeHtml(r.quota)}">${escapeHtml(quotaShort)}</td>
      <td style="text-align:center;"><span class="rank-badge">${nfmt(r.closeR)}</span></td>
      <td style="text-align:center;" class="${gc}">${gs}${nfmt(r.gap)}</td>
      <td style="text-align:center;font-size:11px;color:var(--muted);">${escapeHtml(r.round)}</td>
    </tr>`;
  }).join('');
  return header + body;
}

function emptyRowsMsg(msg) {
  return `<table class="ctable"><tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px;font-style:italic;background:#f8fafc;">${escapeHtml(msg)}</td></tr></table>`;
}

/* ── Try Again / Errors / Download ───────────────────────── */

function tryAgain() {
  el('resultsArea').style.display = 'none';
  el('predForm').style.display = 'block';
  el('predForm').scrollIntoView({behavior: 'smooth'});
}

function showErr(msg) {
  const el2 = el('formError');
  el2.textContent = msg;
  el2.style.display = 'block';
  el2.scrollIntoView({behavior: 'smooth', block: 'center'});
}

function downloadPdf() {
  const content = el('resultsContent'); if (!content) return;
  const btn = el('downloadBtn');
  btn.disabled = true; btn.textContent = '⏳ Preparing…';
  const m = window._reportMeta || {};
  const filterChips = el('resultsMeta').innerHTML;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CollegePIPE NEET UG Report — ${escapeHtml(m.name||'')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;color:#0f1f3d;background:#fff;padding:32px;font-size:12px;}
h1{font-size:20px;margin-bottom:6px;}
.sub{color:#64748b;font-size:12px;margin-bottom:14px;line-height:1.55;}
.meta-chip{display:inline-block;font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;margin:0 3px 4px 0;}
.meta-chip.rank{background:#0f1f3d;color:#fff;}
.meta-chip.aiq{background:#eff6ff;color:#2255c4;border-color:#bfdbfe;}
.result-section{margin-bottom:24px;page-break-inside:avoid;}
.result-section-title{font-size:14px;font-weight:800;padding-bottom:7px;border-bottom:2px solid #fecdd3;margin-bottom:6px;}
.result-section-title.aiq{border-bottom-color:#bfdbfe;}
.result-section-title .count{font-weight:500;color:#64748b;margin-left:8px;font-size:11px;}
.result-section-sub{font-size:11px;color:#64748b;margin:5px 0 12px;line-height:1.5;}
.sub-label{font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;margin:8px 0 5px;display:inline-block;}
.sub-dream{background:rgba(244,63,94,0.10);color:#9f1239;}
.sub-safe{background:rgba(16,185,129,0.10);color:#059669;}
table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:5px;}
th{background:#f1f5f9;padding:6px 8px;text-align:left;font-size:9px;color:#64748b;border-bottom:1px solid #e2e8f0;font-weight:700;}
td{padding:7px 8px;border-bottom:1px solid #f1f5f9;}
.rank-badge{background:#fff1f2;color:#be123c;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;}
.course-badge{background:#eff6ff;color:#2255c4;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;}
.college-pill{display:inline-block;font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;margin-right:4px;}
.pill-govt{background:#ecfdf5;color:#065f46;}
.pill-pvt{background:#fef3c7;color:#92400e;}
.pill-aid{background:#ddd6fe;color:#5b21b6;}
.pill-semi{background:#ffedd5;color:#9a3412;}
.gap-neg{color:#dc2626;font-weight:700;}
.gap-pos{color:#059669;font-weight:700;}
.college-cell strong{display:block;font-size:11px;}
.col-meta{margin-top:2px;font-size:9px;color:#64748b;}
@media print { body { padding: 18px; } button { display: none; } }
.print-btn{position:fixed;top:16px;right:16px;background:#f43f5e;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
<h1>CollegePIPE — NEET UG Predicted Colleges</h1>
<div class="sub"><strong>${escapeHtml(m.name||'')}</strong> · ${escapeHtml(m.email||'')} · NEET AIR ${nfmt(m.rank||0)}</div>
<div style="margin-bottom:14px;">${filterChips}</div>
${content.innerHTML}
<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;color:#64748b;font-size:10px;">© CollegePIPE · Data from official MCC AIQ + state counselling cutoffs · Reference only — verify with official sources before applying</div>
</body></html>`;
  const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CollegePIPE_NEET_${(m.name||'Report').replace(/\s+/g,'_')}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  btn.disabled = false; btn.textContent = '⬇ Download Report';
}

/* ── Boot ────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
