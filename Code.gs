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
  incoming.forEach(function(e){
    if (existing[e]) { skipped++; return; }
    sheet.appendRow([now, e, 'csv']);
    existing[e] = true;
    imported++;
  });
  return jsonResponse({ success: true, imported: imported, skipped: skipped });
}

function handleSendNewsletter(data) {
  requireAuth(data);
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('RESEND_API_KEY');
  if (!apiKey) return jsonResponse({ success: false, error: 'RESEND_API_KEY not set' });
  const fromEmail = props.getProperty('FROM_EMAIL') || 'ben@bepickleballer.com';
  const fromName = props.getProperty('FROM_NAME') || 'BePickleballer';
  const fromAddr = fromName + ' <' + fromEmail + '>';

  const subject = String(data.subject || '').trim();
  const html = String(data.html || '');
  if (!subject || !html) return jsonResponse({ success: false, error: 'Subject and body required' });

  const sheet = getSubscribersSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Subscribers sheet missing' });
  const values = sheet.getDataRange().getValues();
  const emails = [];
  for (let i = 1; i < values.length; i++) {
    const e = String(values[i][1] || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) emails.push(e);
  }

  const CHUNK_SIZE = 50;
  let sent = 0;
  let failed = 0;
  const cache = CacheService.getScriptCache();
  cache.put('send_progress', JSON.stringify({ sent: 0, total: emails.length, failed: 0 }), 600);

  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);
    const requests = chunk.map(function(to){
      return {
        url: 'https://api.resend.com/emails',
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: JSON.stringify({ from: fromAddr, to: [to], subject: subject, html: html }),
        muteHttpExceptions: true
      };
    });
    try {
      const responses = UrlFetchApp.fetchAll(requests);
      responses.forEach(function(resp){
        const code = resp.getResponseCode();
        if (code >= 200 && code < 300) sent++; else failed++;
      });
    } catch (err) {
      failed += chunk.length;
    }
    cache.put('send_progress', JSON.stringify({ sent: sent, total: emails.length, failed: failed }), 600);
  }

  return jsonResponse({ success: true, sent: sent, total: emails.length, failed: failed });
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
