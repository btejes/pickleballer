function getQuizPublicUrl() {
  let v = PropertiesService.getScriptProperties().getProperty('BP_QUIZ_PUBLIC_URL');
  return (v || '').replace(/\/+$/, '');
}

const BP_BASE_CATEGORIES = ['Power', 'Control', 'Spin'];

function isBaseCategory(name) {
  let n = String(name || '').trim().toLowerCase();
  for (let i = 0; i < BP_BASE_CATEGORIES.length; i++) {
    if (BP_BASE_CATEGORIES[i].toLowerCase() === n) return true;
  }
  return false;
}

function paddleBaseScore(paddle, catName) {
  let n = String(catName || '').toLowerCase();
  if (n === 'power') return Number(paddle.power_score) || 0;
  if (n === 'control') return Number(paddle.control_score) || 0;
  if (n === 'spin') return Number(paddle.spin_score) || 0;
  return 0;
}

function sliderMultiplier(value) {
  const v = parseInt(value, 10);
  if (isNaN(v) || v <= 0 || v > 10) return 0;
  return (v - 5.5) * 0.4;
}

function migratePaddleScoresTo1to5() {
  let sheet = getPaddlesSheet();
  if (!sheet) { Logger.log('Paddles sheet missing'); return; }
  let values = sheet.getDataRange().getValues();
  let updated = 0;
  for (let i = 1; i < values.length; i++) {
    let changed = false;
    [8, 9, 10].forEach(function(col){
      let v = Number(values[i][col]);
      if (v > 5) {
        let nv = Math.max(1, Math.min(5, Math.round(v / 2)));
        sheet.getRange(i + 1, col + 1).setValue(nv);
        changed = true;
      }
    });
    if (changed) updated++;
  }
  Logger.log('Migrated ' + updated + ' paddles from 1-10 to 1-5');
}

function isBaseCategoryById(id) {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Categories');
  if (!sheet) return false;
  let values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) return isBaseCategory(values[i][1]);
  }
  return false;
}

function setupQuizSheets() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();

  let completions = ss.getSheetByName('Completions');
  if (!completions) {
    completions = ss.insertSheet('Completions');
    let completionHeaders = ['id','created_at','email','dupr_min','dupr_max','budget_max','answers_json','top_paddles_json','playing_style','user_agent','referrer','explanations','quiz_context','current_paddle'];
    completions.getRange(1, 1, 1, completionHeaders.length).setValues([completionHeaders]);
    completions.getRange(1, 1, 1, completionHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    completions.setFrozenRows(1);
  }

  let mappings = ss.getSheetByName('QuizMappings');
  if (!mappings) {
    mappings = ss.insertSheet('QuizMappings');
    let mappingHeaders = ['question_id','answer_id','categories'];
    mappings.getRange(1, 1, 1, mappingHeaders.length).setValues([mappingHeaders]);
    mappings.getRange(1, 1, 1, mappingHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    mappings.setFrozenRows(1);
    mappings.setColumnWidths(1, mappingHeaders.length, 200);
  }

  let clicks = ss.getSheetByName('PaddleClicks');
  if (!clicks) {
    clicks = ss.insertSheet('PaddleClicks');
    let clickHeaders = ['id','created_at','completion_id','paddle_id','paddle_name'];
    clicks.getRange(1, 1, 1, clickHeaders.length).setValues([clickHeaders]);
    clicks.getRange(1, 1, 1, clickHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    clicks.setFrozenRows(1);
  }

  let overrides = ss.getSheetByName('QuestionOverrides');
  if (!overrides) {
    overrides = ss.insertSheet('QuestionOverrides');
    let overrideHeaders = ['id','text','helper','hidden','levels'];
    overrides.getRange(1, 1, 1, overrideHeaders.length).setValues([overrideHeaders]);
    overrides.getRange(1, 1, 1, overrideHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    overrides.setFrozenRows(1);
    overrides.setColumnWidths(1, overrideHeaders.length, 200);
  }

  let catsSheet = ss.getSheetByName('Categories');
  if (catsSheet) {
    let existing = catsSheet.getDataRange().getValues();
    let existingNames = {};
    for (let i = 1; i < existing.length; i++) {
      if (existing[i][1]) existingNames[String(existing[i][1]).toLowerCase()] = true;
    }
    BP_BASE_CATEGORIES.forEach(function(name){
      if (!existingNames[name.toLowerCase()]) {
        catsSheet.appendRow([Utilities.getUuid(), name, new Date()]);
      }
    });
  }

  Logger.log('Quiz sheets ready: Completions, QuizMappings, PaddleClicks. Base categories seeded.');
}

function getCompletionsSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Completions');
}

function getMappingsSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('QuizMappings');
}

function getClicksSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PaddleClicks');
}

const MAPPINGS_CACHE_KEY = 'bp_mappings_v1';
const PADDLES_CACHE_KEY = 'bp_paddles_v1';
const CACHE_TTL_SECONDS = 300;

function loadMappings() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(MAPPINGS_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (err) {}
  }
  const sheet = getMappingsSheet();
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < values.length; i++) {
    const qid = String(values[i][0] || '').trim();
    const aid = String(values[i][1] || '').trim();
    const cats = String(values[i][2] || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    if (!qid || !aid) continue;
    if (!map[qid]) map[qid] = {};
    map[qid][aid] = cats;
  }
  try { cache.put(MAPPINGS_CACHE_KEY, JSON.stringify(map), CACHE_TTL_SECONDS); } catch (err) {}
  return map;
}

function invalidateMappingsCache() {
  try { CacheService.getScriptCache().remove(MAPPINGS_CACHE_KEY); } catch (err) {}
}

function invalidatePaddlesCache() {
  try { CacheService.getScriptCache().remove(PADDLES_CACHE_KEY); } catch (err) {}
}

function loadActivePaddlesCached() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PADDLES_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (err) {}
  }
  const sheet = getPaddlesSheet();
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const all = [];
  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    const p = paddleRowToObject(values[i]);
    if (!p.active) continue;
    all.push(p);
  }
  try { cache.put(PADDLES_CACHE_KEY, JSON.stringify(all), CACHE_TTL_SECONDS); } catch (err) {}
  return all;
}

function handleListMappings(data) {
  requireAuth(data);
  return jsonResponse({ success: true, mappings: loadMappings() });
}

function handleSaveMappings(data) {
  requireAuth(data);
  const sheet = getMappingsSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Mappings sheet missing, run setupQuizSheets()' });
  const mappings = data.mappings || {};

  // Build new rows FIRST. Only touch the sheet once we have valid data ready,
  // so a malformed payload can never destroy existing mappings.
  const rows = [];
  Object.keys(mappings).forEach(function(qid){
    const answers = mappings[qid] || {};
    Object.keys(answers).forEach(function(aid){
      const cats = answers[aid] || [];
      const catsStr = Array.isArray(cats) ? cats.join(',') : String(cats || '');
      rows.push([qid, aid, catsStr]);
    });
  });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
    }
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    }
    SpreadsheetApp.flush();
    invalidateMappingsCache();
  } finally {
    lock.releaseLock();
  }
  return jsonResponse({ success: true, rows: rows.length });
}

function handlePaddleSearch(data) {
  let query = String(data.query || '').trim().toLowerCase();
  if (query.length < 2) return jsonResponse({ success: true, results: [] });
  let sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: true, results: [] });
  let values = sheet.getDataRange().getValues();
  let results = [];
  for (let i = 1; i < values.length && results.length < 10; i++) {
    if (!values[i][0]) continue;
    let name = String(values[i][1] || '').toLowerCase();
    if (name.indexOf(query) !== -1) {
      results.push({ id: values[i][0], name: values[i][1], image_url: values[i][2] });
    }
  }
  return jsonResponse({ success: true, results: results });
}

function runMatching(answers) {
  const mappings = loadMappings();
  const allPaddles = loadActivePaddlesCached();
  if (allPaddles.length === 0) return { paddles: [], duprMin: 0, duprMax: 7, budgetMax: 99999 };

  // Apply DUPR filter from Q5
  let duprMin = 0, duprMax = 7;
  let q5Answer = answers.q5;
  if (q5Answer) {
    let q5Def = findAnswerInQuestions('q5', q5Answer);
    if (q5Def && typeof q5Def.duprMin === 'number') duprMin = q5Def.duprMin;
    if (q5Def && typeof q5Def.duprMax === 'number') duprMax = q5Def.duprMax;
  }

  let budgetMax = 99999;
  let q31Answer = answers.q31;
  if (q31Answer) {
    let q31Def = findAnswerInQuestions('q31', q31Answer);
    if (q31Def && typeof q31Def.budgetMax === 'number') budgetMax = q31Def.budgetMax;
  }

  let filtered = allPaddles.filter(function(p){
    let price = Number(p.price) || 0;
    if (price > 0 && price > budgetMax) return false;
    if (p.skill_tiers && p.skill_tiers.length > 0) {
      let paddleMatchesDupr = p.skill_tiers.some(function(tier){
        let n = parseDuprTier(tier);
        if (n === null) return true;
        return n >= duprMin && n <= duprMax;
      });
      if (!paddleMatchesDupr) return false;
    }
    return true;
  });

  let filtersRelaxed = false;
  if (filtered.length === 0 && allPaddles.length > 0) {
    filtered = allPaddles.slice();
    filtersRelaxed = true;
  }

  let paddleCats = {};
  filtered.forEach(function(p){
    paddleCats[p.id] = {};
    (p.categories || []).forEach(function(c){
      paddleCats[p.id][String(c).toLowerCase()] = true;
    });
  });

  let scores = {};
  filtered.forEach(function(p){ scores[p.id] = 0; });

  Object.keys(answers).forEach(function(qid){
    let answer = answers[qid];

    let isSlider = (typeof answer === 'number');
    let multiplier;
    let answerIds;

    if (isSlider) {
      multiplier = sliderMultiplier(answer);
      if (multiplier === 0) return;
      answerIds = ['__slider__'];
    } else if (Array.isArray(answer)) {
      multiplier = 1;
      answerIds = answer;
    } else {
      multiplier = 1;
      answerIds = [answer];
    }

    answerIds.forEach(function(aid){
      let cats = (mappings[qid] && mappings[qid][aid]) || [];
      cats.forEach(function(cat){
        let catLower = String(cat).toLowerCase();
        if (isBaseCategory(cat)) {
          filtered.forEach(function(p){
            scores[p.id] += paddleBaseScore(p, cat) * multiplier;
          });
        } else {
          filtered.forEach(function(p){
            if (paddleCats[p.id][catLower]) scores[p.id] += multiplier;
          });
        }
      });
    });
  });

  filtered.sort(function(a, b){
    let sa = scores[a.id] || 0;
    let sb = scores[b.id] || 0;
    if (sb !== sa) return sb - sa;
    return String(a.name).localeCompare(String(b.name));
  });

  // One paddle per brand in the top three. A brand with several strong
  // paddles was taking every slot, which reads as a sponsored list
  // rather than a recommendation, and gives somebody nothing to choose
  // between.
  let picked = [];
  let usedBrands = {};
  filtered.forEach(function(p){
    if (picked.length >= 3) return;
    let b = paddleBrand(p).toLowerCase();
    if (b && usedBrands[b]) return;
    if (b) usedBrands[b] = true;
    picked.push(p);
  });

  // A thin catalogue, or one where everything is the same brand, still
  // gets three results. Showing two would look broken to the person and
  // costs a click we already earned.
  if (picked.length < 3) {
    filtered.forEach(function(p){
      if (picked.length >= 3) return;
      if (picked.indexOf(p) === -1) picked.push(p);
    });
  }

  let top = picked.map(function(p){
    return {
      id: p.id,
      name: p.name,
      image_url: p.image_url,
      affiliate_url: p.affiliate_url,
      discount_code: p.discount_code,
      discount_percent: p.discount_percent,
      discount_amount: p.discount_amount,
      price: p.price,
      msrp: p.msrp,
      power_score: p.power_score,
      control_score: p.control_score,
      spin_score: p.spin_score,
      description: p.description,
      // Carried through so the explanation can say which of the
      // things they asked for this paddle actually matched. Scoring
      // runs on these, so without them any "why" is guesswork.
      categories: p.categories || [],
      skill_tiers: p.skill_tiers || [],
      brand: paddleBrand(p),
      score: scores[p.id] || 0
    };
  });

  function clamp110(v) { return Math.max(1, Math.min(10, parseInt(v, 10) || 5)); }
  const profile = {
    Power:   clamp110(answers.q14),
    Control: clamp110(answers.q15),
    Spin:    clamp110(answers.q13)
  };

  return {
    paddles: top,
    duprMin: duprMin,
    duprMax: duprMax,
    budgetMax: budgetMax,
    profile: profile,
    filtersRelaxed: filtersRelaxed
  };
}

function parseDuprTier(tier) {
  if (!tier) return null;
  let s = String(tier).trim();
  if (/beginner/i.test(s)) return 2.5;
  let n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const FILTER_ANSWERS = {
  'q5_beginner': { duprMin: 0, duprMax: 2.9 },
  'q5_30':       { duprMin: 2.8, duprMax: 3.4 },
  'q5_35':       { duprMin: 3.3, duprMax: 3.9 },
  'q5_40':       { duprMin: 3.8, duprMax: 4.4 },
  'q5_45':       { duprMin: 4.3, duprMax: 7.0 },
  'q5_unsure':   { duprMin: 0, duprMax: 7.0 },
  'q31_under25':    { budgetMax: 25 },
  'q31_51to100':    { budgetMax: 100 },
  'q31_101to200':   { budgetMax: 200 },
  'q31_201to300':   { budgetMax: 300 },
  'q31_301plus':    { budgetMax: 99999 },
  'q31_flexible':   { budgetMax: 99999 }
};

function findAnswerInQuestions(qid, aid) {
  return FILTER_ANSWERS[aid] || null;
}

function handleListFilters(data) {
  return jsonResponse({ success: true, filters: FILTER_ANSWERS });
}

function getOverridesSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('QuestionOverrides');
}

function handleListQuestionOverrides(data) {
  const sheet = getOverridesSheet();
  if (!sheet) return jsonResponse({ success: true, overrides: {} });
  const values = sheet.getDataRange().getValues();
  const overrides = {};
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][0] || '').trim();
    if (!id) continue;
    overrides[id] = {
      text: String(values[i][1] || ''),
      helper: String(values[i][2] || ''),
      hidden: values[i][3] === true || String(values[i][3]).toUpperCase() === 'TRUE',
      // Which players see this question, comma separated, from
      // beginner, intermediate, advanced, expert. Blank means everyone,
      // so a sheet nobody has edited behaves exactly as it does today.
      levels: String(values[i][4] || '')
        .split(',')
        .map(function (x) { return x.trim().toLowerCase(); })
        .filter(Boolean)
    };
  }
  return jsonResponse({ success: true, overrides: overrides });
}

function handleSaveQuestionOverrides(data) {
  requireAuth(data);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('QuestionOverrides');
  if (!sheet) {
    sheet = ss.insertSheet('QuestionOverrides');
    const headers = ['id','text','helper','hidden','levels'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f5f9');
    sheet.setFrozenRows(1);
  }
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
  }
  const overrides = data.overrides || {};
  const rows = [];
  Object.keys(overrides).forEach(function(id){
    const o = overrides[id] || {};
    const text = String(o.text || '').trim();
    const helper = String(o.helper || '').trim();
    const hidden = o.hidden === true;
    // Comma separated, from beginner, intermediate, advanced, expert.
    // Blank means every player sees the question, which is why a row
    // carrying only levels still has to be written.
    const levels = Array.isArray(o.levels)
      ? o.levels.join(',')
      : String(o.levels || '').trim();
    if (!text && !helper && !hidden && !levels) return;
    rows.push([id, text, helper, hidden ? 'TRUE' : 'FALSE', levels]);
  });
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }
  return jsonResponse({ success: true, rows: rows.length });
}

function handleSubmitQuiz(data) {
  let answers = data.answers || {};
  // Sent by the browser, which is the only place the question titles and
  // answer labels exist. Stored rather than derived so an explanation
  // written months later still reads against the wording they saw.
  let context = Array.isArray(data.context) ? data.context : [];
  let currentPaddle = String(data.currentPaddle || '').trim();
  let email = String(data.email || '').trim().toLowerCase();
  let userAgent = String(data.userAgent || '');
  let referrer = String(data.referrer || '');

  let result = runMatching(answers);

  let id = Utilities.getUuid();
  let now = new Date();
  let paddleSummary = result.paddles.map(function(p){
    return { id: p.id, name: p.name, score: p.score };
  });

  let completions = getCompletionsSheet();
  if (completions) {
    completions.appendRow([
      id,
      now,
      email,
      result.duprMin,
      result.duprMax,
      result.budgetMax,
      JSON.stringify(answers),
      JSON.stringify(paddleSummary),
      JSON.stringify(result.profile),
      userAgent,
      referrer,
      '',                        // explanations, filled on first generation
      JSON.stringify(context),
      currentPaddle
    ]);
  }

  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    let subs = getSubscribersSheet();
    if (subs) {
      let existing = subs.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < existing.length; i++) {
        if (String(existing[i][1]).toLowerCase() === email) { found = true; break; }
      }
      if (!found) { subs.appendRow([now, email, 'quiz']); addContactToResendAudience(email); }
    }
  }

  return jsonResponse({
    success: true,
    id: id,
    paddles: result.paddles,
    profile: result.profile,
    filtersRelaxed: !!result.filtersRelaxed
  });
}

function handleListEvents(data) {
  requireAuth(data);
  let completions = getCompletionsSheet();
  if (!completions) return jsonResponse({ success: false, error: 'Completions sheet missing' });
  let clicks = getClicksSheet();

  let clicksByCompletion = {};
  if (clicks) {
    let cvals = clicks.getDataRange().getValues();
    for (let i = 1; i < cvals.length; i++) {
      let compId = String(cvals[i][2] || '').trim();
      if (!compId) continue;
      if (!clicksByCompletion[compId]) clicksByCompletion[compId] = [];
      clicksByCompletion[compId].push({
        timestamp: cvals[i][1],
        paddle_id: cvals[i][3],
        paddle_name: cvals[i][4]
      });
    }
  }

  let publicUrl = getQuizPublicUrl();
  let rows = completions.getDataRange().getValues();
  let events = [];
  for (let j = 1; j < rows.length; j++) {
    let id = String(rows[j][0] || '').trim();
    if (!id) continue;
    events.push({
      id: id,
      timestamp: rows[j][1],
      email: rows[j][2] || '',
      result_url: publicUrl ? (publicUrl + '/?r=' + encodeURIComponent(id)) : '',
      paddle_clicks: clicksByCompletion[id] || []
    });
  }
  events.sort(function(a, b){ return new Date(b.timestamp) - new Date(a.timestamp); });

  let page = parseInt(data.page, 10) || 1;
  let pageSize = parseInt(data.pageSize, 10) || 25;
  let total = events.length;
  let totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) page = totalPages;
  let start = (page - 1) * pageSize;
  let pageEvents = events.slice(start, start + pageSize);

  return jsonResponse({
    success: true,
    events: pageEvents,
    total: total,
    page: page,
    totalPages: totalPages
  });
}

function handleListSubscribersWithResults(data) {
  requireAuth(data);
  let subs = getSubscribersSheet();
  if (!subs) return jsonResponse({ success: false, error: 'Subscribers sheet missing' });
  let completions = getCompletionsSheet();

  let emailToId = {};
  if (completions) {
    let cvals = completions.getDataRange().getValues();
    for (let i = 1; i < cvals.length; i++) {
      let cid = String(cvals[i][0] || '').trim();
      let cemail = String(cvals[i][2] || '').trim().toLowerCase();
      let ctime = cvals[i][1];
      if (!cid || !cemail) continue;
      let prior = emailToId[cemail];
      if (!prior || (ctime && (!prior.ts || new Date(ctime) > new Date(prior.ts)))) {
        emailToId[cemail] = { id: cid, ts: ctime };
      }
    }
  }

  let publicUrl = getQuizPublicUrl();
  let svals = subs.getDataRange().getValues();
  let search = String(data.search || '').trim().toLowerCase();
  let rows = [];
  for (let j = 1; j < svals.length; j++) {
    let email = String(svals[j][1] || '').trim().toLowerCase();
    if (!email) continue;
    if (search && email.indexOf(search) === -1) continue;
    let match = emailToId[email];
    let resultUrl = (match && publicUrl) ? (publicUrl + '/?r=' + encodeURIComponent(match.id)) : '';
    rows.push({
      timestamp: svals[j][0],
      email: svals[j][1],
      source: svals[j][2] || '',
      result_id: match ? match.id : '',
      result_url: resultUrl
    });
  }
  rows.sort(function(a, b){ return new Date(b.timestamp) - new Date(a.timestamp); });

  let page = parseInt(data.page, 10) || 1;
  let pageSize = parseInt(data.pageSize, 10) || 20;
  let total = rows.length;
  let totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) page = totalPages;
  let start = (page - 1) * pageSize;
  let pageRows = rows.slice(start, start + pageSize);

  return jsonResponse({
    success: true,
    subscribers: pageRows,
    total: total,
    page: page,
    totalPages: totalPages
  });
}

function handleAttachEmail(data) {
  let id = String(data.id || '').trim();
  let email = String(data.email || '').trim().toLowerCase();
  if (!id) return jsonResponse({ success: false, error: 'Result id required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ success: false, error: 'Please enter a valid email' });
  }

  let sheet = getCompletionsSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Completions sheet missing' });
  let values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === id) {
      sheet.getRange(i + 1, 3).setValue(email);
      SpreadsheetApp.flush();

      let subs = getSubscribersSheet();
      if (subs) {
        let existing = subs.getDataRange().getValues();
        let found = false;
        for (let j = 1; j < existing.length; j++) {
          if (String(existing[j][1]).toLowerCase() === email) { found = true; break; }
        }
        if (!found) { subs.appendRow([new Date(), email, 'quiz']); addContactToResendAudience(email); }
      }

      try {
        sendResultsEmail(email, id);
      } catch (sendErr) {}

      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Result not found' });
}

function sendResultsEmail(toEmail, completionId) {
  let props = PropertiesService.getScriptProperties();
  let apiKey = props.getProperty('RESEND_API_KEY');
  if (!apiKey) { Logger.log('RESEND_API_KEY missing'); return false; }

  let fromEmail = props.getProperty('FROM_EMAIL') || 'ben@bepickleballer.com';
  let fromName = props.getProperty('FROM_NAME') || 'BePickleballer';
  let fromAddr = fromName + ' <' + fromEmail + '>';

  let html = buildResultsEmailHtml(completionId);

  try {
    let resp = UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({
        from: fromAddr,
        to: [toEmail],
        subject: 'Your paddle matches',
        html: html
      }),
      muteHttpExceptions: true
    });
    let code = resp.getResponseCode();
    return code >= 200 && code < 300;
  } catch (err) {
    return false;
  }
}

function buildResultsEmailHtml(completionId) {
  let publicUrl = getQuizPublicUrl();
  let resultsLink = publicUrl ? (publicUrl + '/?r=' + encodeURIComponent(completionId)) : '';

  let discountDbUrl = PropertiesService.getScriptProperties().getProperty('DISCOUNT_DB_URL') || '';

  let brand = '#0891b2';
  let dark = '#0f172a';
  let slate = '#475569';

  let resultsLine = resultsLink
    ? 'Here are the results: <a href="' + escapeHtmlServer(resultsLink) + '" style="color:' + brand + ';">Your Results</a>'
    : 'Here are the results: Your Results';

  let discountLine = discountDbUrl
    ? 'Here’s the access to my pickleball paddle discount codes database: <a href="' + escapeHtmlServer(discountDbUrl) + '" style="color:' + brand + ';">Discount Code Database</a>'
    : '';

  let p = function(text){
    return '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:' + dark + ';">' + text + '</p>';
  };

  return ''
    + '<!DOCTYPE html><html><body style="margin:0;padding:24px 24px 24px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:' + dark + ';background:#ffffff;text-align:left;">'
    +   '<div style="max-width:560px;text-align:left;">'
    +     p('Hi,')
    +     p('Thanks for taking the pickleball paddle quiz.')
    +     p(resultsLine)
    +     (discountLine ? p(discountLine) : '')
    +     p('Can you share if the results were accurate or if you’d change anything? I am constantly trying to make this the best quiz out there.')
    +     p('Thanks,<br>Ben')
    +   '</div>'
    + '</body></html>';
}

function escapeHtmlServer(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
  });
}

function handleGetResult(data) {
  let id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'Result id required' });

  let sheet = getCompletionsSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Completions sheet missing' });
  let values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      let answers = {};
      try { answers = JSON.parse(values[i][6] || '{}'); } catch (err) {}
      let result = runMatching(answers);
      let profile = {};
      try { profile = JSON.parse(values[i][8] || '{}'); } catch (err) {}
      return jsonResponse({
        success: true,
        id: id,
        created_at: values[i][1],
        email: values[i][2],
        answers: answers,
        paddles: result.paddles,
        profile: result.profile,
        filtersRelaxed: !!result.filtersRelaxed
      });
    }
  }
  return jsonResponse({ success: false, error: 'Result not found' });
}

function handleTrackClick(data) {
  let sheet = getClicksSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Clicks sheet missing' });
  sheet.appendRow([
    Utilities.getUuid(),
    new Date(),
    String(data.completion_id || ''),
    String(data.paddle_id || ''),
    String(data.paddle_name || '')
  ]);
  return jsonResponse({ success: true });
}

// --- Why this paddle was picked for this person ---
//
// Ben asked for AI to explain why a paddle was picked. The first build
// explained what each paddle is good at, which is a different question
// and one the paddle description already answered. This one works from
// what the matcher actually did: it filtered on budget and skill level,
// then ranked by how many of the things their answers asked for each
// paddle offers.
//
// Runs here rather than in the browser because the quiz is a static
// page on GitHub Pages. A key shipped to the browser is a key anyone
// can read and spend.

const EXPLAIN_MODEL = 'gpt-4o-mini';
const EXPLAIN_COL = 12;         // 'explanations' on the Completions sheet, 1 based
const CONTEXT_COL = 13;         // the quiz as words, sent by the browser
const CURRENT_PADDLE_COL = 14;  // what they already play with

function getOpenAiKey() {
  return PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') || '';
}

// Everything their answers asked for that is not power, control or spin.
// Those three are sliders that scale scores, while these are the named
// things a paddle either offers or does not, so they are what makes one
// recommendation different from another.
function wantedCategories(answers) {
  var mappings = loadMappings();
  var wanted = {};
  Object.keys(answers || {}).forEach(function (qid) {
    var answer = answers[qid];
    if (typeof answer === 'number') return;
    var ids = Array.isArray(answer) ? answer : [answer];
    ids.forEach(function (aid) {
      var cats = (mappings[qid] && mappings[qid][aid]) || [];
      cats.forEach(function (cat) {
        if (!isBaseCategory(cat)) wanted[String(cat).toLowerCase()] = String(cat);
      });
    });
  });
  return Object.keys(wanted).map(function (k) { return wanted[k]; });
}

function explainFacts(profile, paddles, ctx) {
  var cats = [
    { key: 'power_score', label: 'power' },
    { key: 'control_score', label: 'control' },
    { key: 'spin_score', label: 'spin' }
  ];

  // Raw scores are useless on their own. The sheet holds 1 to 10 while
  // the code carries a migration to 1 to 5 that was never run, and
  // either way a number means nothing without the other two beside it.
  var leaders = {};
  cats.forEach(function (c) {
    var best = -Infinity;
    paddles.forEach(function (p) { best = Math.max(best, Number(p[c.key]) || 0); });
    leaders[c.key] = paddles
      .map(function (p, i) { return (Number(p[c.key]) || 0) === best ? i : -1; })
      .filter(function (i) { return i !== -1; });
  });

  var prices = paddles.map(function (p) { return Number(p.price) || 0; });
  var paid = prices.filter(function (v) { return v > 0; });
  var cheapest = paid.length ? prices.indexOf(Math.min.apply(null, paid)) : -1;

  var wanted = (ctx.wantedCategories || []).map(function (c) { return String(c).toLowerCase(); });

  var lines = paddles.map(function (p, i) {
    var notes = [];

    // The real reason it ranked where it did.
    var has = (p.categories || []).map(function (c) { return String(c).toLowerCase(); });
    var matched = (ctx.wantedCategories || []).filter(function (c) {
      return has.indexOf(String(c).toLowerCase()) !== -1;
    });
    if (matched.length) notes.push('matches what they asked for: ' + matched.join(', '));

    var standout = cats
      .filter(function (c) { return leaders[c.key].length === 1 && leaders[c.key][0] === i; })
      .map(function (c) { return c.label; });
    if (standout.length) notes.push('the most ' + standout.join(' and ') + ' of the three');

    if (i === cheapest && paid.length > 1) notes.push('the cheapest of the three');
    if (!notes.length) notes.push('the balanced one, no single standout');

    return (i + 1) + '. ' + p.name + ', $' + p.price + '. ' + notes.join('. ') + '.';
  }).join('\n');

  var known = [];
  if (ctx.filtersRelaxed) {
    // Saying a paddle fits their budget when the filter was dropped
    // would be a straight lie, and it is the one claim here somebody
    // can check against the price on the card.
    known.push('- Nothing in the range fitted their budget and level, so these are the ' +
      'closest from the whole catalogue. Do not claim they fit a budget or a level.');
  } else {
    if (ctx.budgetMax && ctx.budgetMax < 9999) known.push('- Budget: up to $' + ctx.budgetMax + ', and all three are inside it.');
    if (ctx.duprMax && ctx.duprMax < 7) known.push('- Level: DUPR ' + ctx.duprMin + ' to ' + ctx.duprMax + ', and all three suit it.');
  }

  if (ctx.currentPaddle) {
    known.push('- They currently play with: ' + ctx.currentPaddle + '.');
  }

  var vals = [Number(profile.Power) || 0, Number(profile.Control) || 0, Number(profile.Spin) || 0];
  var spread = Math.max.apply(null, vals) - Math.min.apply(null, vals);
  if (spread <= 1) {
    known.push('- They did not lean towards power, control or spin. Do not claim they wanted any one of them.');
  } else {
    var top = Math.max.apply(null, vals);
    var named = [];
    if (vals[0] === top) named.push('power');
    if (vals[1] === top) named.push('control');
    if (vals[2] === top) named.push('spin');
    known.push('- They leaned towards ' + named.join(' and ') + '.');
  }

  if (wanted.length) {
    known.push('- Their answers asked for: ' + (ctx.wantedCategories || []).join(', ') + '.');
  }

  return { lines: lines, known: known.join('\n') };
}

function buildExplainPrompt(profile, paddles, ctx) {
  var f = explainFacts(profile, paddles, ctx);
  var body = [
    'Someone finished a pickleball paddle quiz. Tell them why each paddle came up for them.',
    '',
    'What we know about them:',
    'KNOWN_LINES',
    '',
    'Their answers, in their own words:',
    'TRANSCRIPT',
    '',
    'Our matcher removed anything outside their budget and level, then ranked what was left by how much of what they asked for each paddle offers. These three came out on top, best first.',
    '',
    'PADDLE_LINES',
    '',
    'Write one sentence per paddle, speaking to them as you.',
    '',
    'Each sentence says why this paddle came up for them. Lead with the reason it was picked, not with what the paddle is like in general. A sentence that would sit just as well under a different paddle is wrong.',
    '',
    'Where something they said explains the pick, say it back to them in their own terms rather than ours. Their words are more convincing than our category names.',
    '',
    'If they told us what they like or dislike about the paddle they already play with, you may answer that directly, using only what they said. Never state a fact about their current paddle that they did not tell us: they own it and will know.',
    '',
    'Only use reasons listed above. Never invent a feature, a price or a level.',
    '',
    'Do not claim one quality causes an unrelated outcome. More control does not make the ball travel harder, and more spin does not add reach. If the honest link is not there, write about what the paddle does give them instead of inventing a chain between the two.',
    '',
    'Only the paddle marked cheapest may mention price, value, affordability or budget. Calling a dearer paddle affordable while a cheaper one sits under it reads as a sales line.',
    '',
    'Never say a paddle matches, suits or aligns with something they want unless the notes above say they want it. If they leaned towards power and this paddle leads on control, do not call that a match: give the reason it was actually picked instead. The comparison bars are printed under your sentence and will contradict you.',
    '',
    'Every sentence stays positive. Never explain why a paddle is a compromise, and never use despite, although, however, may not, or less than ideal.',
    '',
    'Treat the second and third as good alternatives with a different character, not as worse versions of the first.',
    '',
    'Every sentence must carry at least one concrete thing: something they actually said, or the one way this paddle differs from the other two. A sentence with neither is filler, however well it reads.',
    '',
    'Plain spoken, like a good shop assistant, not marketing copy. Banned because they say nothing: elevate your game, versatile option, game strategies, dynamic style, good feedback, improved consistency, opportunity to explore, without a high commitment, perfect for your current skill level, suits your playing style.',
    '',
    'Under 24 words each. Do not repeat the paddle name and never quote a score.',
    '',
    'Reply as JSON only: {"1": "...", "2": "...", "3": "..."}'
  ].join(String.fromCharCode(10));

  var transcript = (ctx.quizContext || [])
    .map(function (row) { return '- ' + row.q + ' ' + row.a; })
    .join(String.fromCharCode(10));
  if (!transcript) transcript = '- (not recorded for this result)';

  return body
    .split('KNOWN_LINES').join(f.known)
    .split('TRANSCRIPT').join(transcript)
    .split('PADDLE_LINES').join(f.lines);
}

function handleExplainResult(data) {
  var id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'Missing id' });

  var sheet = getCompletionsSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Completions sheet missing' });

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== id) continue;

    // Written back after the first generation, so revisiting a results
    // link costs nothing and reads the same as it did the first time.
    var cached = String(values[i][EXPLAIN_COL - 1] || '');
    if (cached) {
      try { return jsonResponse({ success: true, explanations: JSON.parse(cached) }); } catch (err) {}
    }

    var key = getOpenAiKey();
    if (!key) return jsonResponse({ success: false, error: 'No API key configured' });

    var answers = {};
    try { answers = JSON.parse(values[i][6] || '{}'); } catch (err) {}
    var result = runMatching(answers);
    var paddles = result.paddles.slice(0, 3);
    if (!paddles.length) return jsonResponse({ success: false, error: 'No paddles' });

    var quizContext = [];
    try { quizContext = JSON.parse(values[i][CONTEXT_COL - 1] || '[]'); } catch (err) {}

    var ctx = {
      quizContext: quizContext,
      currentPaddle: String(values[i][CURRENT_PADDLE_COL - 1] || ''),
      budgetMax: result.budgetMax,
      duprMin: result.duprMin,
      duprMax: result.duprMax,
      filtersRelaxed: result.filtersRelaxed,
      wantedCategories: wantedCategories(answers)
    };

    var text = '';
    try {
      var res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + key },
        muteHttpExceptions: true,
        payload: JSON.stringify({
          model: EXPLAIN_MODEL,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: buildExplainPrompt(result.profile, paddles, ctx) }]
        })
      });
      if (res.getResponseCode() !== 200) {
        return jsonResponse({ success: false, error: 'Model call failed' });
      }
      text = JSON.parse(res.getContentText()).choices[0].message.content;
    } catch (err) {
      return jsonResponse({ success: false, error: 'Model call failed' });
    }

    var parsed = {};
    try { parsed = JSON.parse(text); } catch (err) {
      return jsonResponse({ success: false, error: 'Bad model response' });
    }

    // Keyed by paddle id, because the card knows its paddle and not its
    // position in a list the matcher could reorder.
    var byPaddle = {};
    paddles.forEach(function (p, idx) {
      var line = parsed[String(idx + 1)];
      if (line) byPaddle[p.id] = String(line);
    });

    try {
      sheet.getRange(i + 1, EXPLAIN_COL).setValue(JSON.stringify(byPaddle));
    } catch (err) {
      // Not worth failing the response over. The worst case is paying
      // for this result again if somebody reopens the link.
    }

    return jsonResponse({ success: true, explanations: byPaddle });
  }

  return jsonResponse({ success: false, error: 'Result not found' });
}
