import { api, showToast, withSpinner, onTab } from './app.js';
import { getCategories } from './categories.js';
import { BP_QUESTIONS } from './questions.js';

const listEl = document.getElementById('bp-mapping-list');
const saveBtn = document.getElementById('bp-mapping-save-btn');

let mappings = {};

function loadAll() {
  listEl.innerHTML = '<div class="w-full flex flex-col items-center justify-center gap-3 py-12 text-sm text-slate-500"><div class="w-8 h-8 rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin"></div><span class="font-medium">Loading mapping...</span></div>';
  return api('list_mappings').then(function(r){
    if (!r.success) {
      listEl.innerHTML = '<div class="px-4 py-8 text-center text-sm text-red-500">' + (r.error || 'Failed to load') + '</div>';
      return;
    }
    mappings = r.mappings || {};
    renderList();
  });
}

function renderList() {
  const categories = getCategories().map(function(c){ return c.name; });

  if (categories.length === 0) {
    listEl.innerHTML = '<div class="px-4 py-12 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">Add some categories on the Categories tab first. Then come back here to map them to quiz answers.</div>';
    return;
  }

  const questions = BP_QUESTIONS.filter(function(q){
    return q.type === 'single' || q.type === 'multi' || q.type === 'search';
  });

  listEl.innerHTML = '';
  questions.forEach(function(q){
    const card = document.createElement('div');
    card.className = 'border border-slate-200 rounded-lg overflow-hidden';

    const header = document.createElement('div');
    header.className = 'px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2';
    const hLeft = document.createElement('div');
    hLeft.innerHTML = '<span class="text-xs font-bold text-slate-500 uppercase mr-2">' + q.id + '</span><span class="text-sm font-semibold text-slate-900">' + escapeHtml(q.title) + '</span>';
    const hRight = document.createElement('span');
    hRight.className = 'text-xs text-slate-500';
    hRight.textContent = q.type === 'multi' ? 'multi-select' : (q.type === 'search' ? 'paddle search' : 'single choice');
    header.appendChild(hLeft);
    header.appendChild(hRight);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'divide-y divide-slate-100';

    q.answers.forEach(function(a){
      const row = document.createElement('div');
      row.className = 'px-4 py-3 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 items-start';

      const labelDiv = document.createElement('div');
      labelDiv.className = 'text-sm text-slate-700 font-medium';
      labelDiv.textContent = a.label;
      row.appendChild(labelDiv);

      const catsWrap = document.createElement('div');
      catsWrap.className = 'flex flex-wrap gap-1.5';

      const currentCats = (mappings[q.id] && mappings[q.id][a.id]) || [];

      categories.forEach(function(catName){
        const chip = document.createElement('label');
        chip.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer transition';
        const isOn = currentCats.indexOf(catName) !== -1;
        if (isOn) {
          chip.classList.add('bg-brand-50','border-brand-300','text-brand-800');
        } else {
          chip.classList.add('bg-white','border-slate-200','text-slate-600','hover:border-slate-300');
        }

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'w-3.5 h-3.5';
        cb.checked = isOn;
        cb.addEventListener('change', function(){
          if (!mappings[q.id]) mappings[q.id] = {};
          if (!mappings[q.id][a.id]) mappings[q.id][a.id] = [];
          const list = mappings[q.id][a.id];
          if (cb.checked) {
            if (list.indexOf(catName) === -1) list.push(catName);
            chip.classList.remove('bg-white','border-slate-200','text-slate-600','hover:border-slate-300');
            chip.classList.add('bg-brand-50','border-brand-300','text-brand-800');
          } else {
            const idx = list.indexOf(catName);
            if (idx !== -1) list.splice(idx, 1);
            chip.classList.add('bg-white','border-slate-200','text-slate-600','hover:border-slate-300');
            chip.classList.remove('bg-brand-50','border-brand-300','text-brand-800');
          }
        });

        const span = document.createElement('span');
        span.textContent = catName;

        chip.appendChild(cb);
        chip.appendChild(span);
        catsWrap.appendChild(chip);
      });

      row.appendChild(catsWrap);
      body.appendChild(row);
    });

    card.appendChild(body);
    listEl.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function(c){
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
  });
}

saveBtn.addEventListener('click', function(){
  withSpinner(saveBtn, 'Saving...', function(){
    return api('save_mappings', { mappings: mappings }).then(function(r){
      if (r.success) showToast('Mappings saved');
      else showToast(r.error || 'Save failed');
    }).catch(function(){ showToast('Save failed'); });
  });
});

onTab('mappings', function(){ loadAll(); });
