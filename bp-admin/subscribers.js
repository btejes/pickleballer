// Subscriber list, CSV import, and newsletter compose/send. Uses window.bpAdmin from app.js.

(function(){
  var api = window.bpAdmin.api;
  var showToast = window.bpAdmin.showToast;
  var withSpinner = window.bpAdmin.withSpinner;
  var spinnerSvg = window.bpAdmin.spinnerSvg;

  var addBtn = document.getElementById('bp-add-btn');
  var newEmailInput = document.getElementById('bp-new-email');
  var csvInput = document.getElementById('bp-csv-input');
  var subCount = document.getElementById('bp-sub-count');
  var subList = document.getElementById('bp-sub-list');
  var pagination = document.getElementById('bp-pagination');
  var pageRangeEl = document.getElementById('bp-page-range');
  var pageTotalEl = document.getElementById('bp-page-total');
  var pageInfoEl = document.getElementById('bp-page-info');
  var prevBtn = document.getElementById('bp-prev-btn');
  var nextBtn = document.getElementById('bp-next-btn');
  var searchInput = document.getElementById('bp-search');
  var searchClearBtn = document.getElementById('bp-search-clear');
  var subjectInput = document.getElementById('bp-subject');
  var sendBtn = document.getElementById('bp-send-btn');
  var sendStatus = document.getElementById('bp-send-status');

  var currentPage = 1;
  var PAGE_SIZE = 20;
  var searchTerm = '';
  var quill;

  var trashSvg = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>';

  function initEditor() {
    if (quill) return;
    quill = new Quill('#bp-editor', {
      theme: 'snow',
      placeholder: 'Write your newsletter here...',
      modules: {
        toolbar: {
          container: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'link'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['image'],
            ['clean']
          ],
          handlers: {
            image: function(){
              var url = prompt('Paste the image URL:');
              if (!url) return;
              url = url.trim();
              if (!/^https?:\/\//i.test(url)) { showToast('URL must start with http or https'); return; }
              var range = this.quill.getSelection(true);
              this.quill.insertEmbed(range.index, 'image', url);
              this.quill.setSelection(range.index + 1);
            }
          }
        }
      }
    });
  }

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
      var subs = res.subscribers || [];
      var total = (typeof res.total === 'number') ? res.total : subs.length;
      var totalPages = res.totalPages || Math.max(1, Math.ceil(total / PAGE_SIZE));
      currentPage = res.page || currentPage;
      subCount.textContent = '(' + total + ')';
      subList.innerHTML = '';
      if (total === 0) {
        var emptyMsg = searchTerm ? 'No subscribers match "' + searchTerm + '"' : 'No subscribers yet';
        subList.innerHTML = '<div class="px-4 py-8 text-center text-sm text-slate-400">' + emptyMsg + '</div>';
        return;
      }
      if (total > PAGE_SIZE) {
        pagination.classList.remove('hidden');
        pagination.classList.add('flex');
        var startIdx = (currentPage - 1) * PAGE_SIZE + 1;
        var endIdx = Math.min(startIdx + subs.length - 1, total);
        pageRangeEl.textContent = startIdx + '-' + endIdx;
        pageTotalEl.textContent = total;
        pageInfoEl.textContent = 'Page ' + currentPage + ' of ' + totalPages;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
      }
      subs.forEach(function(s){
        var row = document.createElement('div');
        row.className = 'grid grid-cols-[1fr_110px_40px] gap-2 px-4 py-2.5 items-center text-sm hover:bg-slate-50 transition';
        var date = s.timestamp ? new Date(s.timestamp).toLocaleDateString() : '';
        var emailDiv = document.createElement('div');
        emailDiv.className = 'truncate text-xs';
        if (s.result_url) {
          var link = document.createElement('a');
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
        var dateDiv = document.createElement('div');
        dateDiv.className = 'text-xs text-slate-500';
        dateDiv.textContent = date;
        var btn = document.createElement('button');
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
    var email = newEmailInput.value.trim();
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
    var val = searchInput.value.trim();
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

  // CSV import
  csvInput.addEventListener('change', function(e){
    var file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      complete: function(results){
        var rows = results.data;
        var emails = [];
        rows.forEach(function(row){
          row.forEach(function(cell){
            var c = String(cell || '').trim();
            if (c && c.indexOf('@') > 0) emails.push(c);
          });
        });
        if (emails.length === 0) { showToast('No emails found in file'); return; }
        showToast('Importing ' + emails.length + ' emails...');
        api('import_csv', { emails: emails }).then(function(r){
          if (r.success) { showToast('Imported ' + r.imported + ', skipped ' + r.skipped); loadSubscribers(); }
          else { showToast(r.error || 'Import failed'); }
        });
        csvInput.value = '';
      }
    });
  });

  // Send newsletter
  sendBtn.addEventListener('click', function(){
    var subject = subjectInput.value.trim();
    var html = quill.root.innerHTML;
    if (!subject) { showToast('Subject required'); return; }
    if (!quill.getText().trim()) { showToast('Body required'); return; }
    if (!confirm('Send this newsletter to all subscribers?')) return;
    sendStatus.textContent = '';
    var pollInterval = setInterval(function(){
      api('send_status').then(function(r){
        if (r.success && r.total > 0) sendStatus.textContent = 'Sent ' + r.sent + ' of ' + r.total;
      });
    }, 1500);
    withSpinner(sendBtn, 'Sending...', function(){
      return api('send_newsletter', { subject: subject, html: html }).then(function(r){
        clearInterval(pollInterval);
        if (r.success) {
          sendStatus.textContent = 'Sent ' + r.sent + ' of ' + r.total + (r.failed ? ', failed ' + r.failed : '');
          showToast('Newsletter sent');
          subjectInput.value = '';
          quill.setText('');
        } else {
          sendStatus.textContent = '';
          showToast(r.error || 'Send failed');
        }
      }).catch(function(){ clearInterval(pollInterval); showToast('Send failed'); });
    });
  });

  window.bpAdmin.onInit(function(){
    initEditor();
    loadSubscribers();
  });
})();
