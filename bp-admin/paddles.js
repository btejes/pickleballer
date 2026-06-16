// Paddle CRUD. Uses window.bpAdmin from app.js and window.bpAdminCategories from categories.js.

window.bpAdminPaddles = (function(){
  var api = window.bpAdmin.api;
  var showToast = window.bpAdmin.showToast;
  var withSpinner = window.bpAdmin.withSpinner;

  var listEl = document.getElementById('bp-paddle-list');
  var countEl = document.getElementById('bp-paddle-count');
  var searchInput = document.getElementById('bp-paddle-search');
  var addBtn = document.getElementById('bp-paddle-add-btn');

  var modal = document.getElementById('bp-paddle-modal');
  var modalTitle = document.getElementById('bp-paddle-modal-title');
  var closeBtn = document.getElementById('bp-paddle-modal-close');
  var cancelBtn = document.getElementById('bp-paddle-cancel-btn');
  var saveBtn = document.getElementById('bp-paddle-save-btn');
  var deleteBtn = document.getElementById('bp-paddle-delete-btn');

  var idInput = document.getElementById('bp-paddle-id');
  var nameInput = document.getElementById('bp-paddle-name');
  var imageInput = document.getElementById('bp-paddle-image');
  var urlInput = document.getElementById('bp-paddle-url');
  var codeInput = document.getElementById('bp-paddle-code');
  var percentInput = document.getElementById('bp-paddle-percent');
  var priceInput = document.getElementById('bp-paddle-price');
  var msrpInput = document.getElementById('bp-paddle-msrp');
  var powerInput = document.getElementById('bp-paddle-power');
  var controlInput = document.getElementById('bp-paddle-control');
  var spinInput = document.getElementById('bp-paddle-spin');
  var activeInput = document.getElementById('bp-paddle-active');
  var descriptionInput = document.getElementById('bp-paddle-description');
  var categoriesBox = document.getElementById('bp-paddle-categories');

  var allPaddles = [];
  var filterTerm = '';

  function loadPaddles() {
    listEl.innerHTML = '<div class="px-4 py-10 text-center text-sm text-slate-500"><div class="inline-block w-8 h-8 rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin"></div></div>';
    return api('list_paddles').then(function(res){
      if (!res.success) {
        listEl.innerHTML = '<div class="px-4 py-8 text-center text-sm text-red-500">' + (res.error || 'Failed to load') + '</div>';
        return;
      }
      allPaddles = res.paddles || [];
      renderList();
    });
  }

  function renderList() {
    var filtered = allPaddles;
    if (filterTerm) {
      var t = filterTerm.toLowerCase();
      filtered = filtered.filter(function(p){ return (p.name || '').toLowerCase().indexOf(t) !== -1; });
    }
    countEl.textContent = '(' + filtered.length + (filterTerm ? ' of ' + allPaddles.length : '') + ')';
    if (filtered.length === 0) {
      var msg = filterTerm ? 'No paddles match "' + filterTerm + '"' : 'No paddles yet. Click Add Paddle to start.';
      listEl.innerHTML = '<div class="px-4 py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">' + msg + '</div>';
      return;
    }
    listEl.innerHTML = '';
    filtered.forEach(function(p){
      var row = document.createElement('div');
      row.className = 'bp-paddle-row' + (p.active ? '' : ' inactive');

      var img = document.createElement('img');
      img.className = 'bp-paddle-thumb';
      img.src = p.image_url || '';
      img.alt = '';
      img.onerror = function(){ img.style.background = '#f1f5f9'; img.removeAttribute('src'); };

      var info = document.createElement('div');
      info.className = 'min-w-0';
      var nameDiv = document.createElement('div');
      nameDiv.className = 'text-sm font-semibold text-slate-900 truncate';
      nameDiv.textContent = p.name;
      var metaDiv = document.createElement('div');
      metaDiv.className = 'text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap';
      var priceStr = p.price ? '$' + Number(p.price).toFixed(2) : '';
      var codeStr = p.discount_code ? p.discount_code + (p.discount_percent ? ' (' + p.discount_percent + '%)' : '') : '';
      metaDiv.innerHTML =
        (priceStr ? '<span>' + priceStr + '</span>' : '') +
        (codeStr ? '<span class="text-slate-400">·</span><span>' + codeStr + '</span>' : '') +
        (p.active ? '' : '<span class="text-slate-400">·</span><span class="text-amber-600">Inactive</span>');
      info.appendChild(nameDiv);
      info.appendChild(metaDiv);

      var scores = document.createElement('div');
      scores.className = 'flex items-center gap-1.5 flex-wrap justify-end';
      scores.innerHTML =
        '<span class="bp-score-pill">P ' + (p.power_score || '-') + '</span>' +
        '<span class="bp-score-pill">C ' + (p.control_score || '-') + '</span>' +
        '<span class="bp-score-pill">S ' + (p.spin_score || '-') + '</span>';

      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(scores);
      row.addEventListener('click', function(){ openModal(p); });
      listEl.appendChild(row);
    });
  }

  function renderCategoriesCheckboxes(selectedNames) {
    var cats = window.bpAdminCategories ? window.bpAdminCategories.getCategories() : [];
    if (cats.length === 0) {
      categoriesBox.innerHTML = '<div class="text-xs text-slate-500 col-span-2">No categories yet. Add some in the Categories tab.</div>';
      return;
    }
    categoriesBox.innerHTML = '';
    cats.forEach(function(c){
      var label = document.createElement('label');
      label.className = 'flex items-center gap-2 text-sm';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = c.name;
      cb.className = 'bp-category-cb w-4 h-4';
      if (selectedNames && selectedNames.indexOf(c.name) !== -1) cb.checked = true;
      var span = document.createElement('span');
      span.textContent = c.name;
      label.appendChild(cb);
      label.appendChild(span);
      categoriesBox.appendChild(label);
    });
  }

  function setSkillCheckboxes(skillTiers) {
    var cbs = document.querySelectorAll('.bp-skill-cb');
    cbs.forEach(function(cb){
      cb.checked = !!(skillTiers && skillTiers.indexOf(cb.value) !== -1);
    });
  }
  function getSkillCheckboxes() {
    var values = [];
    document.querySelectorAll('.bp-skill-cb').forEach(function(cb){
      if (cb.checked) values.push(cb.value);
    });
    return values;
  }
  function getCategoryCheckboxes() {
    var values = [];
    document.querySelectorAll('.bp-category-cb').forEach(function(cb){
      if (cb.checked) values.push(cb.value);
    });
    return values;
  }

  function openModal(paddle) {
    var isEdit = !!paddle;
    modalTitle.textContent = isEdit ? 'Edit Paddle' : 'Add Paddle';
    deleteBtn.classList.toggle('hidden', !isEdit);
    idInput.value = isEdit ? paddle.id : '';
    nameInput.value = isEdit ? paddle.name : '';
    imageInput.value = isEdit ? paddle.image_url : '';
    urlInput.value = isEdit ? paddle.affiliate_url : '';
    codeInput.value = isEdit ? paddle.discount_code : '';
    percentInput.value = isEdit ? (paddle.discount_percent || '') : '';
    priceInput.value = isEdit ? (paddle.price || '') : '';
    msrpInput.value = isEdit ? (paddle.msrp || '') : '';
    powerInput.value = isEdit ? (paddle.power_score || '') : '';
    controlInput.value = isEdit ? (paddle.control_score || '') : '';
    spinInput.value = isEdit ? (paddle.spin_score || '') : '';
    activeInput.checked = isEdit ? !!paddle.active : true;
    descriptionInput.value = isEdit ? paddle.description : '';
    setSkillCheckboxes(isEdit ? paddle.skill_tiers : []);
    renderCategoriesCheckboxes(isEdit ? paddle.categories : []);
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  function collectFormData() {
    return {
      name: nameInput.value.trim(),
      image_url: imageInput.value.trim(),
      affiliate_url: urlInput.value.trim(),
      discount_code: codeInput.value.trim(),
      discount_percent: Number(percentInput.value) || 0,
      price: Number(priceInput.value) || 0,
      msrp: Number(msrpInput.value) || 0,
      power_score: Number(powerInput.value) || 0,
      control_score: Number(controlInput.value) || 0,
      spin_score: Number(spinInput.value) || 0,
      skill_tiers: getSkillCheckboxes(),
      categories: getCategoryCheckboxes(),
      description: descriptionInput.value.trim(),
      active: activeInput.checked
    };
  }

  saveBtn.addEventListener('click', function(){
    var data = collectFormData();
    if (!data.name) { showToast('Name is required'); nameInput.focus(); return; }
    var id = idInput.value;
    var action = id ? 'update_paddle' : 'add_paddle';
    var payload = id ? Object.assign({ id: id }, data) : data;
    withSpinner(saveBtn, 'Saving...', function(){
      return api(action, payload).then(function(r){
        if (r.success) { showToast(id ? 'Paddle updated' : 'Paddle added'); closeModal(); loadPaddles(); }
        else showToast(r.error || 'Save failed');
      }).catch(function(){ showToast('Save failed'); });
    });
  });

  deleteBtn.addEventListener('click', function(){
    var id = idInput.value;
    if (!id) return;
    if (!confirm('Delete this paddle?')) return;
    withSpinner(deleteBtn, 'Deleting...', function(){
      return api('delete_paddle', { id: id }).then(function(r){
        if (r.success) { showToast('Paddle deleted'); closeModal(); loadPaddles(); }
        else showToast(r.error || 'Delete failed');
      }).catch(function(){ showToast('Delete failed'); });
    });
  });

  addBtn.addEventListener('click', function(){ openModal(null); });
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e){ if (e.target === modal) closeModal(); });

  searchInput.addEventListener('input', function(){
    filterTerm = searchInput.value.trim();
    renderList();
  });

  window.bpAdmin.onTab('paddles', function(){
    loadPaddles();
  });

  return {
    refreshCategories: function(){
      if (!modal.classList.contains('hidden')) {
        var current = getCategoryCheckboxes();
        renderCategoriesCheckboxes(current);
      }
    }
  };
})();
