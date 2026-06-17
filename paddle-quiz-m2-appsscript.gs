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
  let v = parseInt(value, 10);
  if (isNaN(v) || v <= 0 || v > 5) return 0;
  return v - 3;
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
    let completionHeaders = ['id','created_at','email','dupr_min','dupr_max','budget_max','answers_json','top_paddles_json','playing_style','user_agent','referrer'];
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

function loadMappings() {
  let sheet = getMappingsSheet();
  if (!sheet) return {};
  let values = sheet.getDataRange().getValues();
  let map = {};
  for (let i = 1; i < values.length; i++) {
    let qid = String(values[i][0] || '').trim();
    let aid = String(values[i][1] || '').trim();
    let cats = String(values[i][2] || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    if (!qid || !aid) continue;
    if (!map[qid]) map[qid] = {};
    map[qid][aid] = cats;
  }
  return map;
}

function handleListMappings(data) {
  return jsonResponse({ success: true, mappings: loadMappings() });
}

function handleSaveMappings(data) {
  let sheet = getMappingsSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Mappings sheet missing, run setupQuizSheets()' });
  let mappings = data.mappings || {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
  }
  let rows = [];
  Object.keys(mappings).forEach(function(qid){
    let answers = mappings[qid] || {};
    Object.keys(answers).forEach(function(aid){
      let cats = answers[aid] || [];
      let catsStr = Array.isArray(cats) ? cats.join(',') : String(cats || '');
      rows.push([qid, aid, catsStr]);
    });
  });
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
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
  let mappings = loadMappings();
  let paddlesSheet = getPaddlesSheet();
  if (!paddlesSheet) return { paddles: [], duprMin: 0, duprMax: 7, budgetMax: 99999 };

  let values = paddlesSheet.getDataRange().getValues();
  let allPaddles = [];
  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    let p = paddleRowToObject(values[i]);
    if (!p.active) continue;
    allPaddles.push(p);
  }

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

  let top = filtered.slice(0, 3).map(function(p){
    return {
      id: p.id,
      name: p.name,
      image_url: p.image_url,
      affiliate_url: p.affiliate_url,
      discount_code: p.discount_code,
      discount_percent: p.discount_percent,
      price: p.price,
      msrp: p.msrp,
      power_score: p.power_score,
      control_score: p.control_score,
      spin_score: p.spin_score,
      description: p.description,
      score: scores[p.id] || 0
    };
  });

  function clamp15(v) { return Math.max(1, Math.min(5, parseInt(v, 10) || 3)); }
  let profile = {
    Power:   clamp15(answers.q14),
    Control: clamp15(answers.q15),
    Spin:    clamp15(answers.q13)
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

function handleSubmitQuiz(data) {
  let answers = data.answers || {};
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
      referrer
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
      if (!found) subs.appendRow([now, email, 'quiz']);
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
        if (!found) subs.appendRow([new Date(), email, 'quiz']);
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
