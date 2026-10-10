// Why each paddle was picked, written for the person who took the quiz
// rather than for everyone.
//
// The card already carries the paddle's own description from the sheet,
// which is the same sentence for every visitor and says nothing about
// the answers they just spent five minutes giving. When a paddle has no
// description at all the card falls back to "Strong match for your
// playing style based on your answers", which is a sentence that says
// it will explain and then does not.
//
// This replaces that text once the model has answered. Results render
// first and are never held back waiting for it: a slow or failed
// request leaves exactly what was on the card before, so the worst case
// is what we shipped yesterday.

import { api } from './app.js';

// Past this we stop waiting. Three paddles of prose is a few seconds
// of generation, and somebody staring at their results is not going to
// wait longer than this to find out why.
const TIMEOUT_MS = 12000;

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

export function applyExplanations(completionId, root) {
  if (!completionId) return;
  const slots = (root || document).querySelectorAll('[data-reason-for]');
  if (!slots.length) return;



  withTimeout(api('explain_result', { id: completionId }), TIMEOUT_MS).then(function (res) {
    if (!res || !res.success || !res.explanations) return;

    slots.forEach(function (el) {
      const text = res.explanations[el.getAttribute('data-reason-for')];
      if (!text) return;
      const target = el.querySelector('.bp-paddle-why-text');
      if (!target) return;
      // textContent, not innerHTML. This string came from a model and
      // is never trusted as markup.
      target.textContent = text;
      el.removeAttribute('hidden');
    });
  });
}
