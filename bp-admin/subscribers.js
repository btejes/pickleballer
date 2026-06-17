(function(){
  const api = window.bpAdmin.api;
  const showToast = window.bpAdmin.showToast;
  const withSpinner = window.bpAdmin.withSpinner;
  const spinnerSvg = window.bpAdmin.spinnerSvg;

  const addBtn = document.getElementById('bp-add-btn');
  const newEmailInput = document.getElementById('bp-new-email');
  const subCount = document.getElementById('bp-sub-count');
  const subList = document.getElementById('bp-sub-list');
  const pagination = document.getElementById('bp-pagination');
  const pageRangeEl = document.getElementById('bp-page-range');
  const pageTotalEl = document.getElementById('bp-page-total');
  const pageInfoEl = document.getElementById('bp-page-info');
  const prevBtn = document.getElementById('bp-prev-btn');
  const nextBtn = document.getElementById('bp-next-btn');
  const searchInput = document.getElementById('bp-search');
  const searchClearBtn = document.getElementById('bp-search-clear');

  let currentPage = 1;
  const PAGE_SIZE = 20;
  let searchTerm = '';

  const trashSvg = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>';

  function loadSubscribers() {
    subCount.textContent = '(...)';
    subList.innerHTML = '<div class="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-500"><div class="w-8 h-8 rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin"></div><span class="font-medium">Loading subscribers...</span></div>';
    pagination.classList.add('hidden');
    pagination.classList.remove('flex');
    api('list_subscribers_with_results', { page: currentPage, pageSize: PAGE_SIZE, search: searchTerm }).then(function(res){
      if (!res.success) {
        subCount.textContent = '(Failed)';
        subList.innerHTML = '<div class="px-4 py-8 text-center text-sm text-red-500">Failed to load subscribers</div>';
        return;
      }
      let subs = res.subscribers || [];
      let total = (typeof res.total === 'number') ? res.total : subs.length;
      let totalPages = res.totalPages || Math.max(1, Math.ceil(total / PAGE_SIZE));
      currentPage = res.page || currentPage;
      subCount.textContent = '(' + total + ')';
      subList.innerHTML = '';
      if (total === 0) {
        let emptyMsg = searchTerm ? 'No subscribers match "' + searchTerm + '"' : 'No subscribers yet';
        subList.innerHTML = '<div class="px-4 py-8 text-center text-sm text-slate-400">' + emptyMsg + '</div>';
        return;
      }
      if (total > PAGE_SIZE) {
        pagination.classList.remove('hidden');
        pagination.classList.add('flex');
        let startIdx = (currentPage - 1) * PAGE_SIZE + 1;
        let endIdx = Math.min(startIdx + subs.length - 1, total);
        pageRangeEl.textContent = startIdx + '-' + endIdx;
        pageTotalEl.textContent = total;
        pageInfoEl.textContent = 'Page ' + currentPage + ' of ' + totalPages;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
      }
      subs.forEach(function(s){
        let row = document.createElement('div');
        row.className = 'grid grid-cols-[1fr_110px_40px] gap-2 px-4 py-2.5 items-center text-sm hover:bg-slate-50 transition';
        let date = s.timestamp ? new Date(s.timestamp).toLocaleDateString() : '';
        let emailDiv = document.createElement('div');
        emailDiv.className = 'truncate text-xs';
        if (s.result_url) {
          let link = document.createElement('a');
          link.href = s.result_url;
          link.target = '_blank';
          link.rel = 'noopener';
          link.className = 'text-brand-700 font-medium hover:underline';
          link.title = 'View results';
          link.textContent = s.email;
          emailDiv.appendChild(link);
        } else {
          emailDiv.className += ' text-slate-900 font-medium';
          emailDiv.textContent = s.email;
        }
        let dateDiv = document.createElement('div');
        dateDiv.className = 'text-xs text-slate-500';
        dateDiv.textContent = date;
        let btn = document.createElement('button');
        btn.className = 'text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md w-7 h-7 flex items-center justify-center transition justify-self-end';
        btn.title = 'Delete';
        btn.innerHTML = trashSvg;
        btn.addEventListener('click', function(){
          if (!confirm('Delete ' + s.email + '?')) return;
          btn.disabled = true;
          btn.innerHTML = spinnerSvg;
          api('delete_subscriber', { email: s.email }).then(function(r){
            if (r.success) { showToast('Subscriber deleted'); loadSubscribers(); }
            else { showToast(r.error || 'Delete failed'); btn.disabled = false; btn.innerHTML = trashSvg; }
          }).catch(function(){ showToast('Delete failed'); btn.disabled = false; btn.innerHTML = trashSvg; });
        });
        row.appendChild(emailDiv);
        row.appendChild(dateDiv);
        row.appendChild(btn);
        subList.appendChild(row);
      });
    });
  }

  // Add subscriber
  addBtn.addEventListener('click', function(){
    let email = newEmailInput.value.trim();
    if (!email) return;
    withSpinner(addBtn, 'Adding...', function(){
      return api('add_subscriber', { email: email }).then(function(r){
        if (r.success) { newEmailInput.value = ''; showToast('Subscriber added'); loadSubscribers(); }
        else { showToast(r.error || 'Add failed'); }
      }).catch(function(){ showToast('Add failed'); });
    });
  });
  newEmailInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') addBtn.click(); });

  // Pagination
  prevBtn.addEventListener('click', function(){ if (currentPage > 1) { currentPage--; loadSubscribers(); } });
  nextBtn.addEventListener('click', function(){ currentPage++; loadSubscribers(); });

  // Search
  function runSearch() {
    let val = searchInput.value.trim();
    if (val === searchTerm) return;
    searchTerm = val;
    currentPage = 1;
    loadSubscribers();
  }
  searchInput.addEventListener('input', function(){
    if (searchInput.value.trim()) searchClearBtn.classList.remove('hidden');
    else searchClearBtn.classList.add('hidden');
  });
  searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
  searchInput.addEventListener('blur', function(){ runSearch(); });
  searchClearBtn.addEventListener('click', function(){
    searchInput.value = '';
    searchClearBtn.classList.add('hidden');
    if (searchTerm) { searchTerm = ''; currentPage = 1; loadSubscribers(); }
    searchInput.focus();
  });

  window.addEventListener('bp-subscribers-changed', function(){
    loadSubscribers();
  });

  window.bpAdmin.onInit(function(){
    loadSubscribers();
  });
})();
