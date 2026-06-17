function setupPaddleSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var paddles = ss.getSheetByName('Paddles');
  if (!paddles) {
    paddles = ss.insertSheet('Paddles');
    var paddleHeaders = ['id','name','image_url','affiliate_url','discount_code','discount_percent','price','msrp','power_score','control_score','spin_score','skill_tiers','categories','description','active','created_at','updated_at'];
    paddles.getRange(1, 1, 1, paddleHeaders.length).setValues([paddleHeaders]);
    paddles.getRange(1, 1, 1, paddleHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    paddles.setFrozenRows(1);
    paddles.setColumnWidths(1, paddleHeaders.length, 140);
  }

  var categories = ss.getSheetByName('Categories');
  if (!categories) {
    categories = ss.insertSheet('Categories');
    var categoryHeaders = ['id','name','created_at'];
    categories.getRange(1, 1, 1, categoryHeaders.length).setValues([categoryHeaders]);
    categories.getRange(1, 1, 1, categoryHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    categories.setFrozenRows(1);
    categories.setColumnWidths(1, categoryHeaders.length, 200);
  }

  Logger.log('Setup complete. Paddles and Categories tabs are ready.');
}

function getPaddlesSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Paddles');
}

function getCategoriesSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Categories');
}

function generateId() {
  return Utilities.getUuid();
}

function paddleRowToObject(row) {
  return {
    id: row[0],
    name: row[1] || '',
    image_url: row[2] || '',
    affiliate_url: row[3] || '',
    discount_code: row[4] || '',
    discount_percent: Number(row[5]) || 0,
    price: Number(row[6]) || 0,
    msrp: Number(row[7]) || 0,
    power_score: Number(row[8]) || 0,
    control_score: Number(row[9]) || 0,
    spin_score: Number(row[10]) || 0,
    skill_tiers: String(row[11] || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean),
    categories: String(row[12] || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean),
    description: row[13] || '',
    active: row[14] === true || String(row[14]).toUpperCase() === 'TRUE',
    created_at: row[15],
    updated_at: row[16]
  };
}

function paddlePayloadToRow(id, data, createdAt) {
  return [
    id,
    String(data.name || ''),
    String(data.image_url || ''),
    String(data.affiliate_url || ''),
    String(data.discount_code || ''),
    Number(data.discount_percent) || 0,
    Number(data.price) || 0,
    Number(data.msrp) || 0,
    Number(data.power_score) || 0,
    Number(data.control_score) || 0,
    Number(data.spin_score) || 0,
    Array.isArray(data.skill_tiers) ? data.skill_tiers.join(',') : String(data.skill_tiers || ''),
    Array.isArray(data.categories) ? data.categories.join(',') : String(data.categories || ''),
    String(data.description || ''),
    data.active === false ? 'FALSE' : 'TRUE',
    createdAt,
    new Date()
  ];
}

function handleListPaddles(data) {
  var sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Paddles sheet missing, run setupPaddleSheets()' });
  var values = sheet.getDataRange().getValues();
  var paddles = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) paddles.push(paddleRowToObject(values[i]));
  }
  return jsonResponse({ success: true, paddles: paddles });
}

function handleAddPaddle(data) {
  var sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Paddles sheet missing, run setupPaddleSheets()' });
  var name = String(data.name || '').trim();
  if (!name) return jsonResponse({ success: false, error: 'Name required' });
  var id = generateId();
  var row = paddlePayloadToRow(id, data, new Date());
  sheet.appendRow(row);
  return jsonResponse({ success: true, id: id });
}

function handleUpdatePaddle(data) {
  var sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Paddles sheet missing' });
  var id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'ID required' });
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      var existing = paddleRowToObject(values[i]);
      var merged = Object.assign({}, existing, data);
      var row = paddlePayloadToRow(id, merged, existing.created_at || new Date());
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Paddle not found' });
}

function handleDeletePaddle(data) {
  var sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Paddles sheet missing' });
  var id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'ID required' });
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Paddle not found' });
}

function handleListCategories(data) {
  var sheet = getCategoriesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Categories sheet missing, run setupPaddleSheets()' });
  var values = sheet.getDataRange().getValues();
  var categories = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) {
      categories.push({ id: values[i][0], name: values[i][1], created_at: values[i][2] });
    }
  }
  categories.sort(function(a, b){ return String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()); });
  return jsonResponse({ success: true, categories: categories });
}

function handleAddCategory(data) {
  var sheet = getCategoriesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Categories sheet missing' });
  var name = String(data.name || '').trim();
  if (!name) return jsonResponse({ success: false, error: 'Name required' });
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === name.toLowerCase()) {
      return jsonResponse({ success: false, error: 'Category already exists' });
    }
  }
  var id = generateId();
  sheet.appendRow([id, name, new Date()]);
  return jsonResponse({ success: true, id: id });
}

function handleUpdateCategory(data) {
  var sheet = getCategoriesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Categories sheet missing' });
  var id = String(data.id || '').trim();
  var newName = String(data.name || '').trim();
  if (!id || !newName) return jsonResponse({ success: false, error: 'ID and name required' });
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.getRange(i + 1, 2).setValue(newName);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Category not found' });
}

function handleDeleteCategory(data) {
  var sheet = getCategoriesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Categories sheet missing' });
  var id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'ID required' });
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Category not found' });
}
