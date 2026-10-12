import { api, showToast, withSpinner, onTab } from './app.js';
import { BP_QUESTIONS } from './questions.js';

const listEl = document.getElementById('bp-questions-list');
const saveBtn = document.getElementById('bp-questions-save-btn');

let overrides = {};
let loaded = false;

function load() {
  listEl.innerHTML = '<div class="w-full flex flex-col items-center justify-center gap-3 py-12 text-sm text-slate-500"><div class="w-8 h-8 rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin"></div><span class="font-medium">Loading questions...</span></div>';
  return api('list_question_overrides').then(function(r){
    if (!r.success) {
      listEl.innerHTML = '<div class="px-4 py-8 text-center text-sm text-red-500">' + (r.error || 'Failed to load') + '</div>';
      return;
    }
    overrides = r.overrides || {};
    loaded = true;
    render();
  });
}

function getOverride(id) {
  return overrides[id] || {};
}

function setOverride(id, patch) {
  const o = overrides[id] || {};
  overrides[id] = Object.assign({}, o, patch);
}

const PLAYER_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

// Which players get asked this question. All four ticked, or none at
// all, means everybody sees it, so an untouched question behaves
// exactly as it did before any of this existed. The point is to stop
// asking a beginner whether they prefer dinking to dropping, which
// they cannot answer honestly and which then skews their result.
function makeLevelsField(current, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "mt-3";

  const label = document.createElement("div");
  label.className = "text-xs font-bold text-slate-500 uppercase tracking-wider mb-1";
  label.textContent = "Ask this of";
  wrap.appendChild(label);

  const row = document.createElement("div");
  row.className = "flex flex-wrap gap-3";

  const chosen = Array.isArray(current) ? current.slice() : String(current || "")
    .split(",").map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean);

  PLAYER_LEVELS.forEach(function(level){
    const l = document.createElement("label");
    l.className = "flex items-center gap-1.5 text-xs cursor-pointer select-none";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "w-4 h-4";
    cb.checked = chosen.length === 0 || chosen.indexOf(level) !== -1;
    cb.addEventListener("change", function(){
      const picked = [];
      row.querySelectorAll("input[type=checkbox]").forEach(function(box, i){
        if (box.checked) picked.push(PLAYER_LEVELS[i]);
      });
      // Unticking the last one would read as "nobody", but an empty
      // list means no restriction, so it would quietly do the
      // opposite. A question nobody should see is what the Visible
      // toggle is for.
      if (picked.length === 0) {
        row.querySelectorAll("input[type=checkbox]").forEach(function(box){ box.checked = true; });
        onChange([]);
        return;
      }
      // Everyone ticked is the same as no restriction, and storing it
      // that way keeps the sheet readable.
      onChange(picked.length === PLAYER_LEVELS.length ? [] : picked);
    });
    l.appendChild(cb);
    const span = document.createElement("span");
    span.textContent = level;
    l.appendChild(span);
    row.appendChild(l);
  });

  wrap.appendChild(row);

  const note = document.createElement("p");
  note.className = "text-xs text-slate-500 mt-1";
  note.textContent = "Untick a level to skip this question for those players. The skill question itself and everything before it is always asked.";
  wrap.appendChild(note);

  return wrap;
}

function render() {
  listEl.innerHTML = '';
  BP_QUESTIONS.forEach(function(q, idx){
    const o = getOverride(q.id);
    const isHidden = !!o.hidden;
    const card = document.createElement('div');
    card.className = 'border border-slate-200 rounded-lg p-4 ' + (isHidden ? 'bg-slate-50 opacity-75' : 'bg-white');

    const head = document.createElement('div');
    head.className = 'flex items-start justify-between gap-3 mb-3';
    head.innerHTML =
      '<div class="flex items-center gap-2">' +
        '<span class="text-xs font-bold text-slate-400 bg-slate-100 rounded px-2 py-0.5">Q' + (idx + 1) + '</span>' +
        '<span class="text-xs text-slate-500">' + q.type + '</span>' +
      '</div>';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'flex items-center gap-2 text-xs font-semibold cursor-pointer select-none';
    toggleLabel.innerHTML = '<input type="checkbox" ' + (isHidden ? '' : 'checked') + ' class="bp-q-visible w-4 h-4"><span>Visible</span>';
    head.appendChild(toggleLabel);

    const visibleCb = toggleLabel.querySelector('.bp-q-visible');
    visibleCb.addEventListener('change', function(){
      setOverride(q.id, { hidden: !visibleCb.checked });
      render();
    });

    card.appendChild(head);

    const titleField = makeField('Title', q.title, o.text || '', function(val){
      setOverride(q.id, { text: val });
    });
    card.appendChild(titleField);

    card.appendChild(makeLevelsField(o.levels, function(levels){
      setOverride(q.id, { levels: levels });
    }));

    if (q.helper !== undefined) {
      const helperField = makeField('Helper text', q.helper || '', o.helper || '', function(val){
        setOverride(q.id, { helper: val });
      });
      card.appendChild(helperField);
    }

    if (q.answers && q.answers.length > 0) {
      const answersHead = document.createElement('div');
      answersHead.className = 'text-xs font-bold text-slate-500 uppercase tracking-wider mt-3 mb-2';
      answersHead.textContent = 'Answers';
      card.appendChild(answersHead);

      q.answers.forEach(function(a){
        const ao = getOverride(a.id);
        const aCard = document.createElement('div');
        aCard.className = 'pl-3 border-l-2 border-slate-200 mb-2';

        const labelField = makeField(a.id, a.label, ao.text || '', function(val){
          setOverride(a.id, { text: val });
        });
        aCard.appendChild(labelField);

        if (a.helper !== undefined) {
          const aHelperField = makeField('Helper', a.helper || '', ao.helper || '', function(val){
            setOverride(a.id, { helper: val });
          });
          aCard.appendChild(aHelperField);
        }

        card.appendChild(aCard);
      });
    }

    listEl.appendChild(card);
  });
}

function makeField(label, defaultText, currentText, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'mb-2';
  const lbl = document.createElement('label');
  lbl.className = 'block text-xs font-semibold text-slate-600 mb-1';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';
  input.placeholder = defaultText;
  input.value = currentText;
  input.addEventListener('input', function(){
    onChange(input.value);
  });
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return wrap;
}

saveBtn.addEventListener('click', function(){
  withSpinner(saveBtn, 'Saving...', function(){
    return api('save_question_overrides', { overrides: overrides }).then(function(r){
      if (r.success) showToast('Saved');
      else showToast(r.error || 'Save failed');
    }).catch(function(){ showToast('Save failed'); });
  });
});

onTab('questions', function(){
  if (!loaded) load();
});
