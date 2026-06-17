(function(){
  var api = window.bpAdmin.api;
  var showToast = window.bpAdmin.showToast;

  var listEl = document.getElementById('bp-events-list');
  var countEl = document.getElementById('bp-events-count');
  var pagination = document.getElementById('bp-events-pagination');
  var pageRangeEl = document.getElementById('bp-events-page-range');
  var pageTotalEl = document.getElementById('bp-events-page-total');
  var pageInfoEl = document.getElementById('bp-events-page-info');
  var prevBtn = document.getElementById('bp-events-prev-btn');
  var nextBtn = document.getElementById('bp-events-next-btn');

  var currentPage = 1;
  var PAGE_SIZE = 25;

  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function loadEvents() {
    listEl.innerHTML = '<div class="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-500"><div class="w-8 h-8 rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin"></div><span class="font-medium">Loading events...</span></div>';
    pagination.classList.add('hidden');
    pagination.classList.remove('flex');
    api('list_events', { page: currentPage, pageSize: PAGE_SIZE }).then(function(res){
      if (!res.success) {
        listEl.innerHTML = '<div class="px-4 py-8 text-center text-sm text-red-500">' + (res.error || 'Failed to load events') + '</div>';
        return;
      }
      var events = res.events || [];
      var total = typeof res.total === 'number' ? res.total : events.length;
      var totalPages = res.totalPages || Math.max(1, Math.ceil(total / PAGE_SIZE));
      currentPage = res.page || currentPage;
      countEl.textContent = '(' + total + ')';
      listEl.innerHTML = '';
      if (total === 0) {
        listEl.innerHTML = '<div class="px-4 py-12 text-center text-sm text-slate-400">No quiz completions yet.</div>';
        return;
      }
      if (total > PAGE_SIZE) {
        pagination.classList.remove('hidden');
        pagination.classList.add('flex');
        var startIdx = (currentPage - 1) * PAGE_SIZE + 1;
        var endIdx = Math.min(startIdx + events.length - 1, total);
        pageRangeEl.textContent = startIdx + '-' + endIdx;
        pageTotalEl.textContent = total;
        pageInfoEl.textContent = 'Page ' + currentPage + ' of ' + totalPages;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
      }
      events.forEach(function(ev){
        var row = document.createElement('div');
        row.className = 'grid grid-cols-[140px_1fr_70px_2fr_100px] gap-3 px-4 py-2.5 items-center text-sm hover:bg-slate-50 transition';

        var dateDiv = document.createElement('div');
        dateDiv.className = 'text-xs text-slate-600';
        dateDiv.textContent = fmtTime(ev.timestamp);

        var emailDiv = document.createElement('div');
        emailDiv.className = 'truncate text-xs';
        if (ev.email) {
          emailDiv.classList.add('text-slate-900', 'font-medium');
          emailDiv.textContent = ev.email;
        } else {
          emailDiv.classList.add('text-slate-400', 'italic');
          emailDiv.textContent = 'no email';
        }

        var clicksDiv = document.createElement('div');
        clicksDiv.className = 'text-center text-xs font-semibold';
        var clickCount = (ev.paddle_clicks || []).length;
        if (clickCount > 0) {
          clicksDiv.classList.add('text-emerald-600');
        } else {
          clicksDiv.classList.add('text-slate-300');
        }
        clicksDiv.textContent = clickCount;

        var paddlesDiv = document.createElement('div');
        paddlesDiv.className = 'truncate text-xs text-slate-600';
        var names = (ev.paddle_clicks || []).map(function(c){ return c.paddle_name; }).filter(Boolean);
        if (names.length === 0) {
          paddlesDiv.classList.add('text-slate-300');
          paddlesDiv.textContent = '-';
        } else {
          paddlesDiv.textContent = names.join(', ');
          paddlesDiv.title = names.join(', ');
        }

        var linkDiv = document.createElement('div');
        linkDiv.className = 'text-right text-xs';
        if (ev.result_url) {
          var a = document.createElement('a');
          a.href = ev.result_url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.className = 'text-brand-700 font-medium hover:underline';
          a.textContent = 'View';
          linkDiv.appendChild(a);
        }

        row.appendChild(dateDiv);
        row.appendChild(emailDiv);
        row.appendChild(clicksDiv);
        row.appendChild(paddlesDiv);
        row.appendChild(linkDiv);
        listEl.appendChild(row);
      });
    }).catch(function(){
      listEl.innerHTML = '<div class="px-4 py-8 text-center text-sm text-red-500">Failed to load events</div>';
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', function(){ if (currentPage > 1) { currentPage--; loadEvents(); } });
  if (nextBtn) nextBtn.addEventListener('click', function(){ currentPage++; loadEvents(); });

  window.bpAdmin.onTab('events', function(){
    loadEvents();
  });
})();
