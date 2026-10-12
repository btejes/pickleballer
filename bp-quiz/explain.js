// Why each paddle was picked, and a read of how this person plays.
//
// Both arrive together from one call, so the summary at the top and the
// bullets on the cards cannot disagree with each other.
//
// The paddle's own description is rendered first and replaced when the
// explanation lands. Ben asked for the description to go, and normally
// it does, but a card has to say something if the call fails, and his
// words are a better fallback than an empty box.

import { api } from './app.js';

// Past this we stop waiting. Somebody looking at their results is not
// going to wait longer than this to find out why.
const TIMEOUT_MS = 15000;

function withTimeout(promise, ms) {
  return new Promise(function (resolve) {
    let settled = false;
    const timer = setTimeout(function () {
      if (!settled) { settled = true; resolve(null); }
    }, ms);
    promise.then(function (value) {
      if (!settled) { settled = true; clearTimeout(timer); resolve(value); }
    }).catch(function () {
      if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
    });
  });
}

function bulletList(rows) {
  const ul = document.createElement('ul');
  ul.className = 'bp-why-list';
  rows.forEach(function (row) {
    const li = document.createElement('li');
    const lead = document.createElement('strong');
    // textContent throughout. Every string here came from a model and
    // is never trusted as markup.
    lead.textContent = row.lead || '';
    li.appendChild(lead);
    if (row.body) li.appendChild(document.createTextNode(' ' + row.body));
    ul.appendChild(li);
  });
  return ul;
}

export function applyExplanations(completionId, root) {
  if (!completionId) return;
  const scope = root || document;

  withTimeout(api('explain_result', { id: completionId }), TIMEOUT_MS).then(function (res) {
    if (!res || !res.success || !res.explanation) return;
    const ex = res.explanation;

    // Their playing style, written from their answers rather than from
    // the three sliders alone.
    const profSlot = scope.querySelector('[data-profile-summary]');
    if (profSlot && ex.profile && ex.profile.summary) {
      profSlot.textContent = ex.profile.summary;
    }
    const bulletSlot = scope.querySelector('[data-profile-bullets]');
    if (bulletSlot && ex.profile && (ex.profile.bullets || []).length) {
      bulletSlot.innerHTML = '';
      const head = document.createElement('div');
      head.className = 'bp-profile-bullets-head';
      head.textContent = 'Based on your quiz answers';
      bulletSlot.appendChild(head);
      bulletSlot.appendChild(bulletList(ex.profile.bullets.map(function (b) {
        return { lead: b, body: '' };
      })));
      bulletSlot.removeAttribute('hidden');
    }

    // Per paddle, replacing the description rather than sitting under it.
    scope.querySelectorAll('[data-reason-for]').forEach(function (el) {
      const rows = ex.paddles && ex.paddles[el.getAttribute('data-reason-for')];
      if (!rows || !rows.length) return;

      const target = el.querySelector('.bp-paddle-why-text');
      if (!target) return;
      target.innerHTML = '';
      target.appendChild(bulletList(rows));
      el.removeAttribute('hidden');

      const fallback = el.parentNode.querySelector('.bp-paddle-reason');
      if (fallback) fallback.setAttribute('hidden', '');
    });
  });
}
