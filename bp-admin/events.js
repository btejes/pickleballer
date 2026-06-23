import { api, onTab } from './app.js';

const listEl = document.getElementById('bp-events-list');
const countEl = document.getElementById('bp-events-count');
const pagination = document.getElementById('bp-events-pagination');
const pageRangeEl = document.getElementById('bp-events-page-range');
const pageTotalEl = document.getElementById('bp-events-page-total');
const pageInfoEl = document.getElementById('bp-events-page-info');
const prevBtn = document.getElementById('bp-events-prev-btn');
const nextBtn = document.getElementById('bp-events-next-btn');

let currentPage = 1;
const PAGE_SIZE = 25;

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
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
    const events = res.events || [];
    const total = typeof res.total === 'number' ? res.total : events.length;
    const totalPages = res.totalPages || Math.max(1, Math.ceil(total / PAGE_SIZE));
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
      const startIdx = (currentPage - 1) * PAGE_SIZE + 1;
      const endIdx = Math.min(startIdx + events.length - 1, total);
      pageRangeEl.textContent = startIdx + '-' + endIdx;
      pageTotalEl.textContent = total;
      pageInfoEl.textContent = 'Page ' + currentPage + ' of ' + totalPages;
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;
    }
    events.forEach(function(ev){
      const row = document.createElement('div');
      row.className = 'grid grid-cols-[140px_1fr_70px_2fr_100px] gap-3 px-4 py-2.5 items-center text-sm hover:bg-slate-50 transition';

      const dateDiv = document.createElement('div');
      dateDiv.className = 'text-xs text-slate-600';
      dateDiv.textContent = fmtTime(ev.timestamp);

      const emailDiv = document.createElement('div');
      emailDiv.className = 'truncate text-xs';
      if (ev.email) {
        emailDiv.classList.add('text-slate-900', 'font-medium');
        emailDiv.textContent = ev.email;
      } else {
        emailDiv.classList.add('text-slate-400', 'italic');
        emailDiv.textContent = 'no email';
      }

      const clicksDiv = document.createElement('div');
      clicksDiv.className = 'text-center text-xs font-semibold';
      const clickCount = (ev.paddle_clicks || []).length;
      clicksDiv.classList.add(clickCount > 0 ? 'text-emerald-600' : 'text-slate-300');
      clicksDiv.textContent = clickCount;

      const paddlesDiv = document.createElement('div');
      paddlesDiv.className = 'truncate text-xs text-slate-600';
      const names = (ev.paddle_clicks || []).map(function(c){ return c.paddle_name; }).filter(Boolean);
      if (names.length === 0) {
        paddlesDiv.classList.add('text-slate-300');
        paddlesDiv.textContent = '-';
      } else {
        paddlesDiv.textContent = names.join(', ');
        paddlesDiv.title = names.join(', ');
      }

      const linkDiv = document.createElement('div');
      linkDiv.className = 'text-right text-xs';
      if (ev.result_url) {
        const a = document.createElement('a');
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

onTab('events', function(){ loadEvents(); });
