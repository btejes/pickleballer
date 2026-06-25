// Main HTTP dispatcher for the Apps Script web app.
// Routes incoming POST actions to handlers in the other .gs files.

const PUBLIC_ACTIONS = [
  'submit_quiz',
  'get_result',
  'paddle_search',
  'track_click',
  'attach_email',
  'list_filters',
  'list_question_overrides'
];

function doPost(e) {
  let data = {};
  try {
    data = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return jsonResponse({ success: false, error: 'Invalid JSON' });
  }

  const action = String(data.action || '').trim();
  if (!action) return jsonResponse({ success: false, error: 'Missing action' });

  if (PUBLIC_ACTIONS.indexOf(action) === -1 && !checkAuth(data)) {
    return jsonResponse({ success: false, error: 'Unauthorized' });
  }

  try {
    switch (action) {
      case 'submit_quiz':                    return handleSubmitQuiz(data);
      case 'get_result':                     return handleGetResult(data);
      case 'paddle_search':                  return handlePaddleSearch(data);
      case 'track_click':                    return handleTrackClick(data);
      case 'attach_email':                   return handleAttachEmail(data);
      case 'list_filters':                   return handleListFilters(data);
      case 'list_question_overrides':        return handleListQuestionOverrides(data);

      case 'login':                          return handleLogin(data);
      case 'list_subscribers':               return handleListSubscribers(data);
      case 'list_subscribers_with_results':  return handleListSubscribersWithResults(data);
      case 'add_subscriber':                 return handleAddSubscriber(data);
      case 'delete_subscriber':              return handleDeleteSubscriber(data);
      case 'import_csv':                     return handleImportCsv(data);
      case 'send_newsletter':                return handleSendNewsletter(data);
      case 'send_status':                    return handleSendStatus(data);

      case 'list_paddles':                   return handleListPaddles(data);
      case 'add_paddle':                     return handleAddPaddle(data);
      case 'update_paddle':                  return handleUpdatePaddle(data);
      case 'delete_paddle':                  return handleDeletePaddle(data);

      case 'list_categories':                return handleListCategories(data);
      case 'add_category':                   return handleAddCategory(data);
      case 'update_category':                return handleUpdateCategory(data);
      case 'delete_category':                return handleDeleteCategory(data);

      case 'list_mappings':                  return handleListMappings(data);
      case 'save_mappings':                  return handleSaveMappings(data);
      case 'save_question_overrides':        return handleSaveQuestionOverrides(data);
      case 'list_events':                    return handleListEvents(data);

      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: 'Server error: ' + (err && err.message ? err.message : String(err)) });
  }
}

function checkAuth(data) {
  const props = PropertiesService.getScriptProperties();
  const expectedUser = props.getProperty('ADMIN_USERNAME');
  const expectedPass = props.getProperty('ADMIN_PASSWORD');
  if (!expectedUser || !expectedPass) return false;
  return String(data.username || '') === expectedUser && String(data.password || '') === expectedPass;
}

function requireAuth(data) {
  if (!checkAuth(data)) throw new Error('Unauthorized');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleLogin(data) {
  return jsonResponse({ success: true });
}

function getSubscribersSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Subscribers');
}

function handleListSubscribers(data) {
  requireAuth(data);
  const sheet = getSubscribersSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Subscribers sheet missing' });
  const values = sheet.getDataRange().getValues();
  const page = parseInt(data.page, 10) || 1;
  const pageSize = parseInt(data.pageSize, 10) || 20;
  const search = String(data.search || '').trim().toLowerCase();

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const email = String(values[i][1] || '').trim();
    if (!email) continue;
    if (search && email.toLowerCase().indexOf(search) === -1) continue;
    rows.push({ timestamp: values[i][0], email: email, source: values[i][2] || '' });
  }
  rows.sort(function(a, b){ return new Date(b.timestamp) - new Date(a.timestamp); });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;

  return jsonResponse({
    success: true,
    subscribers: rows.slice(startIdx, startIdx + pageSize),
    total: total,
    page: page,
    totalPages: totalPages
  });
}

function handleAddSubscriber(data) {
  requireAuth(data);
  const sheet = getSubscribersSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Subscribers sheet missing' });
  const email = String(data.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ success: false, error: 'Invalid email' });
  }
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === email) {
      return jsonResponse({ success: false, error: 'Already subscribed' });
    }
  }
  sheet.appendRow([new Date(), email, 'manual']);
  addContactToResendAudience(email);
  return jsonResponse({ success: true });
}

function handleDeleteSubscriber(data) {
  requireAuth(data);
  const sheet = getSubscribersSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Subscribers sheet missing' });
  const email = String(data.email || '').trim().toLowerCase();
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][1]).toLowerCase() === email) {
      sheet.deleteRow(i + 1);
      removeContactFromResendAudience(email);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Not found' });
}

function handleImportCsv(data) {
  requireAuth(data);
  const sheet = getSubscribersSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Subscribers sheet missing' });
  const incoming = (data.emails || [])
    .map(function(e){ return String(e || '').trim().toLowerCase(); })
    .filter(function(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); });

  const existing = {};
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    existing[String(values[i][1]).toLowerCase()] = true;
  }

  let imported = 0;
  let skipped = 0;
  const now = new Date();
  const newlyAdded = [];
  incoming.forEach(function(e){
    if (existing[e]) { skipped++; return; }
    sheet.appendRow([now, e, 'csv']);
    existing[e] = true;
    imported++;
    newlyAdded.push(e);
  });
  newlyAdded.forEach(addContactToResendAudience);
  return jsonResponse({ success: true, imported: imported, skipped: skipped });
}

const NEWSLETTER_JOB_KEY = 'newsletter_job';
const NEWSLETTER_CHUNK_SIZE = 25;
const NEWSLETTER_MAX_RUNTIME_MS = 4 * 60 * 1000;

function sendNewsletterPreview() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('RESEND_API_KEY');
  if (!apiKey) { Logger.log('RESEND_API_KEY not set'); return; }
  const fromEmail = props.getProperty('FROM_EMAIL') || 'ben@bepickleballer.com';
  const fromName = props.getProperty('FROM_NAME') || 'BePickleballer';
  const fromAddr = fromName + ' <' + fromEmail + '>';

  const TEST_EMAIL = 'dmytriisynchuk@gmail.com';
  const subject = 'Newsletter layout test';

  const rawHtml = ''
    + '<p>Hi,</p>'
    + '<p>This is paragraph one. It has some normal text to verify that the spacing between paragraphs is reasonable, not too cramped and not too far apart.</p>'
    + '<p>This is paragraph two. Notice how this paragraph sits close to the one above without an awkward gap.</p>'
    + '<p><strong>My quick take:</strong></p>'
    + '<p>If the image below stays within the email column width and the paragraphs hug each other naturally, the post-processor is working.</p>'
    + '<p><img src="https://placehold.co/1600x500/0891b2/ffffff/png?text=Wide+1600x500" width="1600"></p>'
    + '<p>This paragraph follows the wide image. The image above should have been constrained to fit the column instead of overflowing.</p>'
    + '<p>Thanks,<br>Ben</p>';

  const html = prepareNewsletterHtml(rawHtml);

  try {
    const resp = UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({ from: fromAddr, to: [TEST_EMAIL], subject: subject, html: html }),
      muteHttpExceptions: true
    });
    Logger.log('Preview sent to ' + TEST_EMAIL + ' (HTTP ' + resp.getResponseCode() + '): ' + resp.getContentText());
  } catch (err) {
    Logger.log('Preview send failed: ' + err);
  }
}

function prepareNewsletterHtml(html) {
  let processed = String(html || '');

  processed = processed.replace(/<img\s+([^>]*?)>/gi, function(match, attrs) {
    if (/\bstyle\s*=/.test(attrs)) {
      return '<img ' + attrs.replace(/style\s*=\s*"([^"]*)"/i, function(_, existing){
        return 'style="max-width:100%;height:auto;display:block;' + existing + '"';
      }) + '>';
    }
    return '<img style="max-width:100%;height:auto;display:block;" ' + attrs + '>';
  });

  processed = processed.replace(/<p(\s[^>]*)?>/gi, function(_, attrs){
    attrs = attrs || '';
    if (/\bstyle\s*=/.test(attrs)) {
      return '<p' + attrs.replace(/style\s*=\s*"([^"]*)"/i, function(__, existing){
        return 'style="margin:0 0 10px 0;line-height:1.5;' + existing + '"';
      }) + '>';
    }
    return '<p style="margin:0 0 10px 0;line-height:1.5;"' + attrs + '>';
  });

  processed = processed.replace(/<table(\s[^>]*)?>/gi, function(_, attrs){
    attrs = attrs || '';
    if (/\bstyle\s*=/.test(attrs)) {
      return '<table' + attrs.replace(/style\s*=\s*"([^"]*)"/i, function(__, existing){
        return 'style="max-width:100%;border-collapse:collapse;' + existing + '"';
      }) + '>';
    }
    return '<table style="max-width:100%;border-collapse:collapse;"' + attrs + '>';
  });

  return ''
    + '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:16px 16px 16px 0;background:#ffffff;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2937;text-align:left;">'
    +   '<div style="max-width:600px;margin:0;font-size:15px;line-height:1.5;text-align:left;">'
    +     processed
    +   '</div>'
    + '</body></html>';
}

function handleSendNewsletter(data) {
  requireAuth(data);
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('RESEND_API_KEY');
  if (!apiKey) return jsonResponse({ success: false, error: 'RESEND_API_KEY not set' });

  const audienceId = props.getProperty('RESEND_AUDIENCE_ID');
  if (!audienceId) {
    return jsonResponse({ success: false, error: 'Resend audience not initialized. Run syncFullAudienceToResend() from the Apps Script editor once to set it up.' });
  }

  const subject = String(data.subject || '').trim();
  const rawHtml = String(data.html || '');
  if (!subject || !rawHtml) return jsonResponse({ success: false, error: 'Subject and body required' });
  const html = prepareNewsletterHtml(rawHtml);

  const fromEmail = props.getProperty('FROM_EMAIL') || 'ben@bepickleballer.com';
  const fromName = props.getProperty('FROM_NAME') || 'BePickleballer';
  const fromAddr = fromName + ' <' + fromEmail + '>';

  const broadcast = createResendBroadcast(apiKey, audienceId, fromAddr, subject, html);
  if (!broadcast.success) return jsonResponse({ success: false, error: broadcast.error });

  const sendResult = triggerResendBroadcast(apiKey, broadcast.id);
  if (!sendResult.success) return jsonResponse({ success: false, error: sendResult.error });

  CacheService.getScriptCache().put('last_broadcast_id', broadcast.id, 86400);

  return jsonResponse({
    success: true,
    broadcast_id: broadcast.id,
    message: 'Broadcast queued with Resend. Delivery to all subscribers usually completes within 1-2 minutes.'
  });
}

function createResendBroadcast(apiKey, audienceId, fromAddr, subject, html) {
  try {
    const resp = UrlFetchApp.fetch('https://api.resend.com/broadcasts', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({
        audience_id: audienceId,
        from: fromAddr,
        subject: subject,
        html: html
      }),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    const body = resp.getContentText();
    if (code < 200 || code >= 300) {
      return { success: false, error: 'Create broadcast failed (' + code + '): ' + body };
    }
    return { success: true, id: JSON.parse(body).id };
  } catch (err) {
    return { success: false, error: 'Create broadcast error: ' + err };
  }
}

function triggerResendBroadcast(apiKey, broadcastId) {
  try {
    const resp = UrlFetchApp.fetch('https://api.resend.com/broadcasts/' + broadcastId + '/send', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({}),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      return { success: false, error: 'Send broadcast failed (' + code + '): ' + resp.getContentText() };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Send broadcast error: ' + err };
  }
}

function addContactToResendAudience(email) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('RESEND_API_KEY');
  const audienceId = props.getProperty('RESEND_AUDIENCE_ID');
  if (!apiKey || !audienceId) return;
  try {
    UrlFetchApp.fetch('https://api.resend.com/audiences/' + audienceId + '/contacts', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({ email: email, unsubscribed: false }),
      muteHttpExceptions: true
    });
  } catch (err) {}
}

function removeContactFromResendAudience(email) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('RESEND_API_KEY');
  const audienceId = props.getProperty('RESEND_AUDIENCE_ID');
  if (!apiKey || !audienceId) return;
  try {
    UrlFetchApp.fetch('https://api.resend.com/audiences/' + audienceId + '/contacts/' + encodeURIComponent(email), {
      method: 'delete',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      muteHttpExceptions: true
    });
  } catch (err) {}
}

function syncFullAudienceToResend() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('RESEND_API_KEY');
  if (!apiKey) { Logger.log('RESEND_API_KEY not set'); return; }

  let audienceId = props.getProperty('RESEND_AUDIENCE_ID');
  if (!audienceId) {
    try {
      const r = UrlFetchApp.fetch('https://api.resend.com/audiences', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: JSON.stringify({ name: 'BePickleballer Subscribers' }),
        muteHttpExceptions: true
      });
      if (r.getResponseCode() < 300) {
        audienceId = JSON.parse(r.getContentText()).id;
        props.setProperty('RESEND_AUDIENCE_ID', audienceId);
        Logger.log('Created Resend audience: ' + audienceId);
      } else {
        Logger.log('Audience create failed: ' + r.getContentText());
        return;
      }
    } catch (err) {
      Logger.log('Audience create error: ' + err);
      return;
    }
  }

  const sheet = getSubscribersSheet();
  if (!sheet) { Logger.log('Subscribers sheet missing'); return; }
  const values = sheet.getDataRange().getValues();
  const sheetEmails = [];
  for (let i = 1; i < values.length; i++) {
    const e = String(values[i][1] || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) sheetEmails.push(e);
  }

  const existing = new Set();
  try {
    const r = UrlFetchApp.fetch('https://api.resend.com/audiences/' + audienceId + '/contacts', {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() < 300) {
      const body = JSON.parse(r.getContentText());
      (body.data || []).forEach(function(c){
        if (c && c.email) existing.add(String(c.email).toLowerCase());
      });
    } else {
      Logger.log('Could not list existing contacts: ' + r.getContentText());
    }
  } catch (err) {
    Logger.log('List existing contacts error: ' + err);
  }
  Logger.log('Already in Resend audience: ' + existing.size);

  const toAdd = sheetEmails.filter(function(e){ return !existing.has(e); });
  Logger.log('Missing in Resend, will add: ' + toAdd.length);

  const CHUNK = 8;
  const DELAY_BETWEEN_CHUNKS_MS = 250;
  let added = 0;
  let failed = 0;
  const failedEmails = [];

  for (let i = 0; i < toAdd.length; i += CHUNK) {
    const batch = toAdd.slice(i, i + CHUNK);
    const requests = batch.map(function(email){
      return {
        url: 'https://api.resend.com/audiences/' + audienceId + '/contacts',
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: JSON.stringify({ email: email, unsubscribed: false }),
        muteHttpExceptions: true
      };
    });
    try {
      const responses = UrlFetchApp.fetchAll(requests);
      responses.forEach(function(resp, idx){
        const code = resp.getResponseCode();
        if (code >= 200 && code < 300) added++;
        else { failed++; if (failedEmails.length < 20) failedEmails.push(batch[idx] + ' (' + code + ')'); }
      });
    } catch (err) {
      failed += batch.length;
    }
    Utilities.sleep(DELAY_BETWEEN_CHUNKS_MS);
  }

  Logger.log('Sync complete. Already there: ' + existing.size + '. Added this run: ' + added + '. Failed: ' + failed);
  if (failedEmails.length > 0) {
    Logger.log('First failures: ' + failedEmails.join(', '));
  }
}

function processNewsletterChunk() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(NEWSLETTER_JOB_KEY);
  if (!raw) { cleanupNewsletterTriggers(); return; }

  let job;
  try { job = JSON.parse(raw); } catch (err) { props.deleteProperty(NEWSLETTER_JOB_KEY); cleanupNewsletterTriggers(); return; }

  if (job.cursor >= job.emails.length) {
    props.deleteProperty(NEWSLETTER_JOB_KEY);
    cleanupNewsletterTriggers();
    return;
  }

  const apiKey = props.getProperty('RESEND_API_KEY');
  const fromEmail = props.getProperty('FROM_EMAIL') || 'ben@bepickleballer.com';
  const fromName = props.getProperty('FROM_NAME') || 'BePickleballer';
  const fromAddr = fromName + ' <' + fromEmail + '>';
  const cache = CacheService.getScriptCache();
  const startTime = Date.now();

  while (job.cursor < job.emails.length && (Date.now() - startTime) < NEWSLETTER_MAX_RUNTIME_MS) {
    const end = Math.min(job.cursor + NEWSLETTER_CHUNK_SIZE, job.emails.length);
    const chunk = job.emails.slice(job.cursor, end);
    const requests = chunk.map(function(to){
      return {
        url: 'https://api.resend.com/emails',
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: JSON.stringify({ from: fromAddr, to: [to], subject: job.subject, html: job.html }),
        muteHttpExceptions: true
      };
    });
    try {
      const responses = UrlFetchApp.fetchAll(requests);
      responses.forEach(function(resp){
        const code = resp.getResponseCode();
        if (code >= 200 && code < 300) job.sent++; else job.failed++;
      });
    } catch (err) {
      job.failed += chunk.length;
    }
    job.cursor = end;
    props.setProperty(NEWSLETTER_JOB_KEY, JSON.stringify(job));
    cache.put('send_progress', JSON.stringify({ sent: job.sent, total: job.emails.length, failed: job.failed }), 600);
  }

  if (job.cursor < job.emails.length) {
    ScriptApp.newTrigger('processNewsletterChunk').timeBased().after(60 * 1000).create();
  } else {
    props.deleteProperty(NEWSLETTER_JOB_KEY);
    cleanupNewsletterTriggers();
  }
}

function cleanupNewsletterTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t){
    if (t.getHandlerFunction() === 'processNewsletterChunk') {
      try { ScriptApp.deleteTrigger(t); } catch (err) {}
    }
  });
}

function resumeNewsletterFromIndex(startIndex) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(NEWSLETTER_JOB_KEY);
  if (!raw) { Logger.log('No newsletter job to resume'); return; }
  const job = JSON.parse(raw);
  job.cursor = Math.max(0, Math.min(parseInt(startIndex, 10) || 0, job.emails.length));
  props.setProperty(NEWSLETTER_JOB_KEY, JSON.stringify(job));
  cleanupNewsletterTriggers();
  processNewsletterChunk();
}

function handleSendStatus(data) {
  requireAuth(data);
  const cache = CacheService.getScriptCache();
  const raw = cache.get('send_progress');
  if (!raw) return jsonResponse({ success: true, sent: 0, total: 0, failed: 0 });
  try {
    const p = JSON.parse(raw);
    return jsonResponse({ success: true, sent: p.sent || 0, total: p.total || 0, failed: p.failed || 0 });
  } catch (err) {
    return jsonResponse({ success: true, sent: 0, total: 0, failed: 0 });
  }
}
