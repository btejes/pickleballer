const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz6R0VAaTHsdqXZmx87wJCLhQrwYfLVW42QGaH4FMKu-wdz50MnPdD-R6ZIE-SK6KdJ/exec';
const STORAGE_KEY = 'bp_quiz_state_v1';
const PARENT_ORIGIN = 'https://bepickleballer.com';

export function api(action, extra) {
  const payload = Object.assign({ action: action }, extra || {});
  return fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json(); });
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {}
  return { currentIndex: 0, answers: {}, currentPaddleName: '' };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {}
}

export function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
}

export function getResultIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get('r') || '').trim();
    if (id) return id;
    const match = window.location.pathname.match(/\/results\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];
  } catch (err) {}
  return '';
}

export function setResultIdInUrl(id) {
  if (!id) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('r', id);
    window.history.replaceState({}, '', url.toString());
  } catch (err) {}
  if (window.parent !== window) {
    try {
      window.parent.postMessage({ type: 'bp-quiz-result-id', id: id }, PARENT_ORIGIN);
    } catch (err) {}
  }
}

let lastReportedHeight = 0;
function measureContentHeight() {
  const el = document.getElementById('bp-quiz-app');
  if (el) {
    const rect = el.getBoundingClientRect();
    return Math.ceil(rect.height);
  }
  return document.body ? document.body.scrollHeight : 0;
}

export function postHeightToParent() {
  if (window.parent === window) return;
  const h = measureContentHeight();
  if (!h || Math.abs(h - lastReportedHeight) < 2) return;
  lastReportedHeight = h;
  try {
    window.parent.postMessage({ type: 'bp-quiz-height', height: h }, PARENT_ORIGIN);
  } catch (err) {}
}

if (window.parent !== window) {
  const attachObserver = function(){
    if (typeof ResizeObserver === 'undefined') return;
    try {
      const ro = new ResizeObserver(function(){ postHeightToParent(); });
      const target = document.getElementById('bp-quiz-app') || document.body;
      if (target) ro.observe(target);
    } catch (err) {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachObserver);
  } else {
    attachObserver();
  }
  window.addEventListener('load', postHeightToParent);
  window.addEventListener('resize', postHeightToParent);
  setInterval(postHeightToParent, 1000);
}
