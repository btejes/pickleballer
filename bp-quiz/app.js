// Shared core for the public paddle quiz. Exposes window.bpQuiz with the API
// helper, state container, and a persisted answers store. quiz.js handles the
// flow logic and rendering.

window.bpQuiz = (function(){
  var BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz6R0VAaTHsdqXZmx87wJCLhQrwYfLVW42QGaH4FMKu-wdz50MnPdD-R6ZIE-SK6KdJ/exec';
  var STORAGE_KEY = 'bp_quiz_state_v1';

  function api(action, extra) {
    var payload = Object.assign({ action: action }, extra || {});
    return fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function(r){ return r.json(); });
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {}
    return { currentIndex: 0, answers: {}, currentPaddleName: '' };
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {}
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
  }

  function getResultIdFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var id = (params.get('r') || '').trim();
      if (id) return id;
      // Fallback: support /results/[id] style paths if WordPress ever rewrites to that
      var match = window.location.pathname.match(/\/results\/([A-Za-z0-9_-]+)/);
      if (match) return match[1];
    } catch (err) {}
    return '';
  }

  function setResultIdInUrl(id) {
    if (!id) return;
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('r', id);
      window.history.replaceState({}, '', url.toString());
    } catch (err) {}
    // If embedded, tell the parent so it can mirror the id into its URL bar
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'bp-quiz-result-id', id: id }, '*');
      } catch (err) {}
    }
  }

  // When the quiz is embedded in an iframe on WordPress, post our current height
  // to the parent so the iframe can auto-resize and avoid an inner scrollbar.
  // We measure the FIRST child's offsetHeight (the actual content), NOT
  // document.documentElement.scrollHeight, because the latter grows with the
  // iframe itself when the body has min-height: 100vh - that creates an
  // infinite feedback loop (parent grows iframe -> 100vh grows -> body grows ->
  // we report bigger height -> parent grows iframe again -> ...).
  var lastReportedHeight = 0;
  function measureContentHeight() {
    var el = document.getElementById('bp-quiz-app');
    if (el) {
      var rect = el.getBoundingClientRect();
      return Math.ceil(rect.height);
    }
    return document.body ? document.body.scrollHeight : 0;
  }
  function postHeightToParent() {
    if (window.parent === window) return;
    var h = measureContentHeight();
    if (!h || Math.abs(h - lastReportedHeight) < 2) return;
    lastReportedHeight = h;
    try {
      window.parent.postMessage({ type: 'bp-quiz-height', height: h }, '*');
    } catch (err) {}
  }

  if (window.parent !== window) {
    function attachObserver(){
      if (typeof ResizeObserver === 'undefined') return;
      try {
        var ro = new ResizeObserver(function(){ postHeightToParent(); });
        var target = document.getElementById('bp-quiz-app') || document.body;
        if (target) ro.observe(target);
      } catch (err) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachObserver);
    } else {
      attachObserver();
    }
    window.addEventListener('load', postHeightToParent);
    window.addEventListener('resize', postHeightToParent);
    setInterval(postHeightToParent, 1000);
  }

  return {
    api: api,
    loadState: loadState,
    saveState: saveState,
    clearState: clearState,
    getResultIdFromUrl: getResultIdFromUrl,
    setResultIdInUrl: setResultIdInUrl,
    postHeightToParent: postHeightToParent
  };
})();
