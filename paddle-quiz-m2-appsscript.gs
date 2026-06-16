// === PADDLE QUIZ V0 - Milestone 2: Quiz Engine Backend ===
// Add this to the existing BePickleballer Email Capture Apps Script project
// (alongside PaddleQuiz.gs from M1).
//
// After pasting, run setupQuizSheets() once from the editor, then redeploy.
//
// Also add these action routes to the switch() inside doPost in Code.gs:
//   case 'submit_quiz':       return handleSubmitQuiz(data);
//   case 'get_result':        return handleGetResult(data);
//   case 'paddle_search':     return handlePaddleSearch(data);
//   case 'list_mappings':     return handleListMappings(data);
//   case 'save_mappings':     return handleSaveMappings(data);

// Public URL where the quiz is hosted. Used in the results email so the user
// can click back to view / share their results. Set via Script Properties:
//   File > Project Settings > Script Properties: BP_QUIZ_PUBLIC_URL
// Example: https://yourname.github.io/bp-quiz/
function getQuizPublicUrl() {
  var v = PropertiesService.getScriptProperties().getProperty('BP_QUIZ_PUBLIC_URL');
  return (v || '').replace(/\/+$/, '');
}

// Base categories are hardcoded and map 1:1 to paddle performance scores.
var BP_BASE_CATEGORIES = ['Power', 'Control', 'Spin'];

function isBaseCategory(name) {
  var n = String(name || '').trim().toLowerCase();
  for (var i = 0; i < BP_BASE_CATEGORIES.length; i++) {
    if (BP_BASE_CATEGORIES[i].toLowerCase() === n) return true;
  }
  return false;
}

function paddleBaseScore(paddle, catName) {
  var n = String(catName || '').toLowerCase();
  if (n === 'power') return Number(paddle.power_score) || 0;
  if (n === 'control') return Number(paddle.control_score) || 0;
  if (n === 'spin') return Number(paddle.spin_score) || 0;
  return 0;
}

// Map slider/Likert value (1-5) to contribution multiplier (-2..+2).
function sliderMultiplier(value) {
  var v = parseInt(value, 10);
  if (isNaN(v)) return 0;
  if (v <= 0 || v > 5) return 0;
  return v - 3; // 1=>-2, 2=>-1, 3=>0, 4=>+1, 5=>+2
}

// Convert any paddle scores still on the 1-10 scale to the 1-5 scale (halving, rounded).
// Run this ONCE after deploying the new model, then never again.
function migratePaddleScoresTo1to5() {
  var sheet = getPaddlesSheet();
  if (!sheet) { Logger.log('Paddles sheet missing'); return; }
  var values = sheet.getDataRange().getValues();
  var updated = 0;
  for (var i = 1; i < values.length; i++) {
    var changed = false;
    // Columns I, J, K = power_score, control_score, spin_score (1-indexed letters)
    [8, 9, 10].forEach(function(col){
      var v = Number(values[i][col]);
      if (v > 5) {
        var nv = Math.max(1, Math.min(5, Math.round(v / 2)));
        sheet.getRange(i + 1, col + 1).setValue(nv);
        changed = true;
      }
    });
    if (changed) updated++;
  }
  Logger.log('Migrated ' + updated + ' paddles from 1-10 to 1-5');
}

function isBaseCategoryById(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Categories');
  if (!sheet) return false;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) return isBaseCategory(values[i][1]);
  }
  return false;
}

function setupQuizSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var completions = ss.getSheetByName('Completions');
  if (!completions) {
    completions = ss.insertSheet('Completions');
    var completionHeaders = ['id','created_at','email','dupr_min','dupr_max','budget_max','answers_json','top_paddles_json','playing_style','user_agent','referrer'];
    completions.getRange(1, 1, 1, completionHeaders.length).setValues([completionHeaders]);
    completions.getRange(1, 1, 1, completionHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    completions.setFrozenRows(1);
  }

  var mappings = ss.getSheetByName('QuizMappings');
  if (!mappings) {
    mappings = ss.insertSheet('QuizMappings');
    var mappingHeaders = ['question_id','answer_id','categories'];
    mappings.getRange(1, 1, 1, mappingHeaders.length).setValues([mappingHeaders]);
    mappings.getRange(1, 1, 1, mappingHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    mappings.setFrozenRows(1);
    mappings.setColumnWidths(1, mappingHeaders.length, 200);
  }

  var clicks = ss.getSheetByName('PaddleClicks');
  if (!clicks) {
    clicks = ss.insertSheet('PaddleClicks');
    var clickHeaders = ['id','created_at','completion_id','paddle_id','paddle_name'];
    clicks.getRange(1, 1, 1, clickHeaders.length).setValues([clickHeaders]);
    clicks.getRange(1, 1, 1, clickHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    clicks.setFrozenRows(1);
  }

  // Seed base categories in the Categories sheet if missing.
  var catsSheet = ss.getSheetByName('Categories');
  if (catsSheet) {
    var existing = catsSheet.getDataRange().getValues();
    var existingNames = {};
    for (var i = 1; i < existing.length; i++) {
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

// ----------------------------------------------------------------------------
// Quiz mappings (which categories each answer awards)
// ----------------------------------------------------------------------------

function loadMappings() {
  var sheet = getMappingsSheet();
  if (!sheet) return {};
  var values = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < values.length; i++) {
    var qid = String(values[i][0] || '').trim();
    var aid = String(values[i][1] || '').trim();
    var cats = String(values[i][2] || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
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
  var sheet = getMappingsSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Mappings sheet missing, run setupQuizSheets()' });
  var mappings = data.mappings || {};
  // Wipe existing rows, write fresh
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
  }
  var rows = [];
  Object.keys(mappings).forEach(function(qid){
    var answers = mappings[qid] || {};
    Object.keys(answers).forEach(function(aid){
      var cats = answers[aid] || [];
      var catsStr = Array.isArray(cats) ? cats.join(',') : String(cats || '');
      rows.push([qid, aid, catsStr]);
    });
  });
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  return jsonResponse({ success: true, rows: rows.length });
}

// ----------------------------------------------------------------------------
// Paddle search (autocomplete for Q1)
// ----------------------------------------------------------------------------

function handlePaddleSearch(data) {
  var query = String(data.query || '').trim().toLowerCase();
  if (query.length < 2) return jsonResponse({ success: true, results: [] });
  var sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: true, results: [] });
  var values = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < values.length && results.length < 10; i++) {
    if (!values[i][0]) continue;
    var name = String(values[i][1] || '').toLowerCase();
    if (name.indexOf(query) !== -1) {
      results.push({ id: values[i][0], name: values[i][1], image_url: values[i][2] });
    }
  }
  return jsonResponse({ success: true, results: results });
}

// ----------------------------------------------------------------------------
// Matching engine (simple +1 per category match, with hard filters)
// ----------------------------------------------------------------------------

function runMatching(answers) {
  // answers: { q1: 'q1_search', q2: 'q2_power', q30: ['q30_tennis','q30_squash'], q7: 7, ... }

  var mappings = loadMappings();
  var paddlesSheet = getPaddlesSheet();
  if (!paddlesSheet) return { paddles: [], duprMin: 0, duprMax: 7, budgetMax: 99999 };

  var values = paddlesSheet.getDataRange().getValues();
  var allPaddles = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    var p = paddleRowToObject(values[i]);
    if (!p.active) continue;
    allPaddles.push(p);
  }

  // Apply DUPR filter from Q5
  var duprMin = 0, duprMax = 7;
  var q5Answer = answers.q5;
  if (q5Answer) {
    var q5Def = findAnswerInQuestions('q5', q5Answer);
    if (q5Def && typeof q5Def.duprMin === 'number') duprMin = q5Def.duprMin;
    if (q5Def && typeof q5Def.duprMax === 'number') duprMax = q5Def.duprMax;
  }

  // Apply budget filter from Q31
  var budgetMax = 99999;
  var q31Answer = answers.q31;
  if (q31Answer) {
    var q31Def = findAnswerInQuestions('q31', q31Answer);
    if (q31Def && typeof q31Def.budgetMax === 'number') budgetMax = q31Def.budgetMax;
  }

  // Filter paddles
  var filtered = allPaddles.filter(function(p){
    // Budget check
    var price = Number(p.price) || 0;
    if (price > 0 && price > budgetMax) return false;
    // DUPR check: paddle.skill_tiers stored as comma-separated list of allowed levels
    // For V0, if no skill_tiers set, paddle passes; otherwise check overlap with user's range
    if (p.skill_tiers && p.skill_tiers.length > 0) {
      var paddleMatchesDupr = p.skill_tiers.some(function(tier){
        var n = parseDuprTier(tier);
        if (n === null) return true;
        return n >= duprMin && n <= duprMax;
      });
      if (!paddleMatchesDupr) return false;
    }
    return true;
  });

  // Score each paddle with the new model:
  //   - Base category (Power/Control/Spin): paddle.match += paddle[dim_score] * multiplier
  //   - Extra category: paddle has tag ? paddle.match += multiplier : 0
  // Multiplier is +1 for regular answers, -2..+2 for slider/Likert (1-5) answers.

  // Build extra-category tag lookup per paddle.
  var paddleCats = {};
  filtered.forEach(function(p){
    paddleCats[p.id] = {};
    (p.categories || []).forEach(function(c){
      paddleCats[p.id][String(c).toLowerCase()] = true;
    });
  });

  var scores = {};
  filtered.forEach(function(p){ scores[p.id] = 0; });

  Object.keys(answers).forEach(function(qid){
    var answer = answers[qid];

    // Slider values arrive as numbers. Treat them as Likert-style 1-5.
    var isSlider = (typeof answer === 'number');
    var multiplier;
    var answerIds;

    if (isSlider) {
      multiplier = sliderMultiplier(answer);
      if (multiplier === 0) return; // neutral, no effect
      answerIds = ['__slider__']; // we use the question-level mapping under a fixed key
    } else if (Array.isArray(answer)) {
      multiplier = 1;
      answerIds = answer;
    } else {
      multiplier = 1;
      answerIds = [answer];
    }

    answerIds.forEach(function(aid){
      var cats = (mappings[qid] && mappings[qid][aid]) || [];
      cats.forEach(function(cat){
        var catLower = String(cat).toLowerCase();
        if (isBaseCategory(cat)) {
          // Base: paddle's dimension score times multiplier
          filtered.forEach(function(p){
            scores[p.id] += paddleBaseScore(p, cat) * multiplier;
          });
        } else {
          // Extra: flat multiplier if paddle tagged
          filtered.forEach(function(p){
            if (paddleCats[p.id][catLower]) scores[p.id] += multiplier;
          });
        }
      });
    });
  });

  // Sort by score desc, tiebreak by name
  filtered.sort(function(a, b){
    var sa = scores[a.id] || 0;
    var sb = scores[b.id] || 0;
    if (sb !== sa) return sb - sa;
    return String(a.name).localeCompare(String(b.name));
  });

  var top = filtered.slice(0, 3).map(function(p){
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

  // Derive playing-style profile on a 1-5 scale.
  // V0 rule: user profile per dimension = the slider answer for that dimension's
  // importance question. If not answered, default to 3 (neutral).
  //   Power  <- Q14 (How important is power)
  //   Control <- Q15 (How important is control)
  //   Spin   <- Q13 (How important is spin)
  function clamp15(v) { return Math.max(1, Math.min(5, parseInt(v, 10) || 3)); }
  var profile = {
    Power:   clamp15(answers.q14),
    Control: clamp15(answers.q15),
    Spin:    clamp15(answers.q13)
  };

  return {
    paddles: top,
    duprMin: duprMin,
    duprMax: duprMax,
    budgetMax: budgetMax,
    profile: profile
  };
}

function parseDuprTier(tier) {
  if (!tier) return null;
  var s = String(tier).trim();
  if (/beginner/i.test(s)) return 2.5;
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// SOURCE OF TRUTH for DUPR + budget filter ranges.
// This is the ONLY place the numeric ranges live. The frontend questions.js
// stores the answer IDs and display labels only - it does not duplicate these
// ranges. If a range changes, change it ONLY here.
// Any consumer that needs the ranges can fetch them via the `list_filters` action.
var FILTER_ANSWERS = {
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

// Public action: returns the filter ranges so any frontend can fetch them
// instead of hardcoding (single source of truth).
function handleListFilters(data) {
  return jsonResponse({ success: true, filters: FILTER_ANSWERS });
}

// ----------------------------------------------------------------------------
// Submit + Get result
// ----------------------------------------------------------------------------

function handleSubmitQuiz(data) {
  var answers = data.answers || {};
  var email = String(data.email || '').trim().toLowerCase();
  var userAgent = String(data.userAgent || '');
  var referrer = String(data.referrer || '');

  var result = runMatching(answers);

  var id = Utilities.getUuid();
  var now = new Date();
  var paddleSummary = result.paddles.map(function(p){
    return { id: p.id, name: p.name, score: p.score };
  });

  var completions = getCompletionsSheet();
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

  // If email provided, add to Subscribers sheet (unified newsletter list)
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    var subs = getSubscribersSheet();
    if (subs) {
      var existing = subs.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < existing.length; i++) {
        if (String(existing[i][1]).toLowerCase() === email) { found = true; break; }
      }
      if (!found) subs.appendRow([now, email, 'quiz']);
    }
  }

  return jsonResponse({
    success: true,
    id: id,
    paddles: result.paddles,
    profile: result.profile
  });
}

function handleAttachEmail(data) {
  var id = String(data.id || '').trim();
  var email = String(data.email || '').trim().toLowerCase();
  if (!id) return jsonResponse({ success: false, error: 'Result id required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ success: false, error: 'Please enter a valid email' });
  }

  var sheet = getCompletionsSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Completions sheet missing' });
  var values = sheet.getDataRange().getValues();
  Logger.log('attach_email looking for id: ' + id + ' across ' + (values.length - 1) + ' rows');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === id) {
      sheet.getRange(i + 1, 3).setValue(email);
      SpreadsheetApp.flush();
      Logger.log('attach_email wrote ' + email + ' to row ' + (i + 1));

      var subs = getSubscribersSheet();
      if (subs) {
        var existing = subs.getDataRange().getValues();
        var found = false;
        for (var j = 1; j < existing.length; j++) {
          if (String(existing[j][1]).toLowerCase() === email) { found = true; break; }
        }
        if (!found) subs.appendRow([new Date(), email, 'quiz']);
      }

      // Build and send the results email via Resend. If the send fails, we still
      // return success because the email is saved and we do not want to lose it.
      try {
        var sendOk = sendResultsEmail(email, id);
        Logger.log('Resend send ok? ' + sendOk);
      } catch (sendErr) {
        Logger.log('Resend send threw: ' + sendErr);
      }

      return jsonResponse({ success: true });
    }
  }
  Logger.log('attach_email FAILED to find id: ' + id);
  return jsonResponse({ success: false, error: 'Result not found' });
}

// ----------------------------------------------------------------------------
// Results email via Resend
// ----------------------------------------------------------------------------

function sendResultsEmail(toEmail, completionId, paddles, profile) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('RESEND_API_KEY');
  if (!apiKey) { Logger.log('RESEND_API_KEY missing'); return false; }

  var fromEmail = props.getProperty('FROM_EMAIL') || 'ben@bepickleballer.com';
  var fromName = props.getProperty('FROM_NAME') || 'BePickleballer';
  var fromAddr = fromName + ' <' + fromEmail + '>';

  var html = buildResultsEmailHtml(completionId);

  try {
    var resp = UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({
        from: fromAddr,
        to: [toEmail],
        subject: 'Your Pickleball Paddle Quiz Results',
        html: html
      }),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    Logger.log('Resend response code: ' + code + ' body: ' + resp.getContentText());
    return code >= 200 && code < 300;
  } catch (err) {
    Logger.log('Resend fetch error: ' + err);
    return false;
  }
}

function buildResultsEmailHtml(completionId) {
  var publicUrl = getQuizPublicUrl();
  var resultsLink = publicUrl ? (publicUrl + '/?r=' + encodeURIComponent(completionId)) : '';

  var discountDbUrl = PropertiesService.getScriptProperties().getProperty('DISCOUNT_DB_URL') || '';

  var brand = '#0891b2';
  var dark = '#0f172a';
  var slate = '#475569';

  var resultsLine = resultsLink
    ? 'Here are the results: <a href="' + escapeHtmlServer(resultsLink) + '" style="color:' + brand + ';">Your Results</a>'
    : 'Here are the results: Your Results';

  var discountLine = discountDbUrl
    ? 'Here’s the access to my pickleball paddle discount codes database: <a href="' + escapeHtmlServer(discountDbUrl) + '" style="color:' + brand + ';">Discount Code Database</a>'
    : '';

  var p = function(text){
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
  var id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'Result id required' });

  var sheet = getCompletionsSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Completions sheet missing' });
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      // Re-derive paddles by re-running the match? Or return stored summary?
      // We stored top_paddles_json with just id/name/score. To return full data, re-run match.
      var answers = {};
      try { answers = JSON.parse(values[i][6] || '{}'); } catch (err) {}
      var result = runMatching(answers);
      var profile = {};
      try { profile = JSON.parse(values[i][8] || '{}'); } catch (err) {}
      return jsonResponse({
        success: true,
        id: id,
        created_at: values[i][1],
        email: values[i][2],
        answers: answers,
        paddles: result.paddles,
        profile: result.profile
      });
    }
  }
  return jsonResponse({ success: false, error: 'Result not found' });
}

// ----------------------------------------------------------------------------
// Paddle click tracking (will be wired in M4, defining now so the sheet exists)
// ----------------------------------------------------------------------------

function handleTrackClick(data) {
  var sheet = getClicksSheet();
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
