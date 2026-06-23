function setupPaddleSheets() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();

  let paddles = ss.getSheetByName('Paddles');
  if (!paddles) {
    paddles = ss.insertSheet('Paddles');
    let paddleHeaders = ['id','name','image_url','affiliate_url','discount_code','discount_percent','price','msrp','power_score','control_score','spin_score','skill_tiers','categories','description','active','created_at','updated_at','discount_amount'];
    paddles.getRange(1, 1, 1, paddleHeaders.length).setValues([paddleHeaders]);
    paddles.getRange(1, 1, 1, paddleHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
    paddles.setFrozenRows(1);
    paddles.setColumnWidths(1, paddleHeaders.length, 140);
  } else {
    const headerRow = paddles.getRange(1, 1, 1, paddles.getLastColumn()).getValues()[0];
    if (headerRow.indexOf('discount_amount') === -1) {
      paddles.getRange(1, headerRow.length + 1).setValue('discount_amount').setFontWeight('bold').setBackground('#f1f5f9');
    }
  }

  let categories = ss.getSheetByName('Categories');
  if (!categories) {
    categories = ss.insertSheet('Categories');
    let categoryHeaders = ['id','name','created_at'];
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
    updated_at: row[16],
    discount_amount: Number(row[17]) || 0
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
    new Date(),
    Number(data.discount_amount) || 0
  ];
}

function handleListPaddles(data) {
  requireAuth(data);
  const sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Paddles sheet missing, run setupPaddleSheets()' });
  const values = sheet.getDataRange().getValues();
  const paddles = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i][0]) paddles.push(paddleRowToObject(values[i]));
  }
  return jsonResponse({ success: true, paddles: paddles });
}

function handleAddPaddle(data) {
  requireAuth(data);
  const sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Paddles sheet missing, run setupPaddleSheets()' });
  const name = String(data.name || '').trim();
  if (!name) return jsonResponse({ success: false, error: 'Name required' });
  const id = generateId();
  const row = paddlePayloadToRow(id, data, new Date());
  sheet.appendRow(row);
  invalidatePaddlesCache();
  return jsonResponse({ success: true, id: id });
}

function handleUpdatePaddle(data) {
  requireAuth(data);
  const sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Paddles sheet missing' });
  const id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'ID required' });
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      const existing = paddleRowToObject(values[i]);
      const merged = Object.assign({}, existing, data);
      const row = paddlePayloadToRow(id, merged, existing.created_at || new Date());
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      invalidatePaddlesCache();
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Paddle not found' });
}

function handleDeletePaddle(data) {
  requireAuth(data);
  const sheet = getPaddlesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Paddles sheet missing' });
  const id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'ID required' });
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      invalidatePaddlesCache();
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Paddle not found' });
}

function handleListCategories(data) {
  let sheet = getCategoriesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Categories sheet missing, run setupPaddleSheets()' });
  let values = sheet.getDataRange().getValues();
  let categories = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i][0]) {
      categories.push({ id: values[i][0], name: values[i][1], created_at: values[i][2] });
    }
  }
  categories.sort(function(a, b){ return String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()); });
  return jsonResponse({ success: true, categories: categories });
}

function handleAddCategory(data) {
  let sheet = getCategoriesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Categories sheet missing' });
  let name = String(data.name || '').trim();
  if (!name) return jsonResponse({ success: false, error: 'Name required' });
  let values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === name.toLowerCase()) {
      return jsonResponse({ success: false, error: 'Category already exists' });
    }
  }
  let id = generateId();
  sheet.appendRow([id, name, new Date()]);
  return jsonResponse({ success: true, id: id });
}

function handleUpdateCategory(data) {
  let sheet = getCategoriesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Categories sheet missing' });
  let id = String(data.id || '').trim();
  let newName = String(data.name || '').trim();
  if (!id || !newName) return jsonResponse({ success: false, error: 'ID and name required' });
  let values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.getRange(i + 1, 2).setValue(newName);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Category not found' });
}

function handleDeleteCategory(data) {
  let sheet = getCategoriesSheet();
  if (!sheet) return jsonResponse({ success: false, error: 'Categories sheet missing' });
  let id = String(data.id || '').trim();
  if (!id) return jsonResponse({ success: false, error: 'ID required' });
  let values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Category not found' });
}
