(function(){
  var QUIZ_BASE = 'https://btejes.github.io/pickleballer/bp-quiz/';
  var ALLOWED_ORIGIN = 'https://btejes.github.io';
  var iframe = document.getElementById('bp-paddle-quiz-iframe');
  if (!iframe) return;

  if (window.location.search) {
    iframe.src = QUIZ_BASE + window.location.search;
  }

  function syncMinHeight(){
    iframe.style.minHeight = window.innerHeight + 'px';
  }
  syncMinHeight();
  window.addEventListener('resize', syncMinHeight);

  var lastSetHeight = 0;
  window.addEventListener('message', function(e){
    if (e.origin !== ALLOWED_ORIGIN) return;
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'bp-quiz-height') {
      var h = parseInt(e.data.height, 10);
      if (isNaN(h) || h < 200) return;
      if (Math.abs(h - lastSetHeight) < 2) return;
      lastSetHeight = h;
      iframe.style.height = h + 'px';
    }
    if (e.data.type === 'bp-quiz-result-id' && e.data.id) {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('r', String(e.data.id));
        window.history.replaceState({}, '', url.toString());
      } catch (err) {}
    }
  });
})();
