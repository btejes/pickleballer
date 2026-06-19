(function(){
  let QUESTIONS = window.BP_QUESTIONS || [];
  let api = window.bpQuiz.api;
  let state = window.bpQuiz.loadState();

  let loadingEl = document.getElementById('bp-loading');
  let qSlot = document.getElementById('bp-question-slot');
  let rSlot = document.getElementById('bp-result-slot');
  let progressBar = document.getElementById('bp-progress-bar');
  let progressLabel = document.getElementById('bp-progress-label');
  let progressMeta = document.getElementById('bp-progress-meta');
  let progressSection = document.getElementById('bp-progress-section');

  function showProgress(show) {
    if (progressSection) progressSection.style.display = show ? '' : 'none';
  }

  let searchDebounce;

  function start() {
    let resultId = window.bpQuiz.getResultIdFromUrl();
    if (resultId) {
      loadResultById(resultId);
    } else {
      loadingEl.classList.add('hidden');
      qSlot.classList.remove('hidden');
      renderQuestion();
    }
  }

  function loadResultById(id) {
    loadingEl.classList.remove('hidden');
    loadingEl.querySelector('p').textContent = 'Loading your results...';
    showProgress(false);
    api('get_result', { id: id }).then(function(r){
      if (!r.success) {
        loadingEl.classList.add('hidden');
        rSlot.classList.remove('hidden');
        rSlot.innerHTML = '<div class="bp-paddle-card text-center"><p class="text-red-600 font-semibold mb-1">Results not found</p><p class="text-sm text-slate-600">This results link may have expired or been removed. <a href="?" class="text-brand-600 font-semibold underline">Take the quiz</a> to get fresh recommendations.</p></div>';
        return;
      }
      loadingEl.classList.add('hidden');
      rSlot.classList.remove('hidden');
      renderResults(r);
    }).catch(function(){
      loadingEl.classList.add('hidden');
      rSlot.classList.remove('hidden');
      rSlot.innerHTML = '<div class="bp-paddle-card text-center text-red-600">Network error loading your results. Please refresh.</div>';
    });
  }

  function renderQuestion() {
    if (state.currentIndex >= QUESTIONS.length) {
      submit();
      return;
    }
    let q = QUESTIONS[state.currentIndex];
    let pct = Math.round(((state.currentIndex) / QUESTIONS.length) * 100);
    progressBar.style.width = pct + '%';
    progressLabel.textContent = pct + '% Complete';
    progressMeta.textContent = 'Question ' + (state.currentIndex + 1) + ' of ' + QUESTIONS.length;

    qSlot.innerHTML = '';
    let card = document.createElement('div');
    card.className = 'bp-question-card';

    let title = document.createElement('h2');
    title.className = 'bp-question-title';
    title.textContent = q.title;
    card.appendChild(title);

    if (q.helper) {
      let helper = document.createElement('p');
      helper.className = 'bp-question-helper';
      helper.textContent = q.helper;
      card.appendChild(helper);
    }

    let body = document.createElement('div');
    body.className = 'bp-question-body';

    if (q.type === 'single' || q.type === 'multi') {
      renderChoices(body, q);
    } else if (q.type === 'slider') {
      renderSlider(body, q);
    } else if (q.type === 'search') {
      renderSearch(body, q);
    }

    card.appendChild(body);

    let nav = document.createElement('div');
    nav.className = 'flex items-center justify-between gap-2 mt-8 flex-wrap';

    let backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'bp-btn-secondary';
    backBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg> Back';
    backBtn.disabled = state.currentIndex === 0;
    backBtn.addEventListener('click', function(){
      if (state.currentIndex > 0) {
        state.currentIndex--;
        persist();
        renderQuestion();
      }
    });
    nav.appendChild(backBtn);

    let nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'bp-btn-primary';
    nextBtn.id = 'bp-next-btn';
    let isLast = state.currentIndex === QUESTIONS.length - 1;
    nextBtn.innerHTML = (isLast ? 'See My Results' : 'Next') + ' <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';
    nextBtn.disabled = !hasAnswerFor(q);
    nextBtn.addEventListener('click', function(){
      if (!hasAnswerFor(q)) return;
      state.currentIndex++;
      persist();
      renderQuestion();
    });
    nav.appendChild(nextBtn);

    card.appendChild(nav);
    qSlot.appendChild(card);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hasAnswerFor(q) {
    let ans = state.answers[q.id];
    if (q.type === 'multi') return Array.isArray(ans) && ans.length > 0;
    if (q.type === 'slider') return typeof ans === 'number';
    if (q.type === 'search' && ans === 'q1_search') {
      return !!(state.currentPaddleName && state.currentPaddleName.trim());
    }
    return ans !== undefined && ans !== null && ans !== '';
  }

  function setAnswer(qid, value) {
    state.answers[qid] = value;
    persist();
    let nextBtn = document.getElementById('bp-next-btn');
    if (nextBtn) {
      let q = QUESTIONS.find(function(x){ return x.id === qid; });
      nextBtn.disabled = !hasAnswerFor(q);
    }
  }

  function persist() {
    window.bpQuiz.saveState(state);
  }

  function renderChoices(container, q) {
    let list = document.createElement('div');
    list.className = 'space-y-2';
    let current = state.answers[q.id];
    let isMulti = q.type === 'multi';

    q.answers.forEach(function(a){
      let option = document.createElement('div');
      option.className = 'bp-option';
      let isSelected = isMulti
        ? (Array.isArray(current) && current.indexOf(a.id) !== -1)
        : (current === a.id);
      if (isSelected) option.classList.add('selected');

      let indicator = document.createElement('span');
      indicator.className = isMulti ? 'bp-option-check' : 'bp-option-radio';
      option.appendChild(indicator);

      let text = document.createElement('div');
      text.className = 'flex-1 min-w-0';
      let label = document.createElement('div');
      label.className = 'bp-option-label';
      label.textContent = a.label;
      text.appendChild(label);
      if (a.helper) {
        let helper = document.createElement('div');
        helper.className = 'bp-option-helper';
        helper.textContent = a.helper;
        text.appendChild(helper);
      }
      option.appendChild(text);

      option.addEventListener('click', function(){
        if (isMulti) {
          let cur = Array.isArray(current) ? current.slice() : [];
          let idx = cur.indexOf(a.id);
          if (idx === -1) cur.push(a.id); else cur.splice(idx, 1);
          current = cur;
          setAnswer(q.id, cur);
          renderQuestion();
        } else {
          current = a.id;
          setAnswer(q.id, a.id);
          renderQuestion();
        }
      });
      list.appendChild(option);
    });
    container.appendChild(list);
  }

  function renderSlider(container, q) {
    let min = q.min || 1;
    let max = q.max || 5;
    let midpoint = Math.round((min + max) / 2);
    let value = state.answers[q.id] || midpoint;

    let wrap = document.createElement('div');
    wrap.className = 'bp-slider-wrap';

    let sliderEl = document.createElement('div');
    sliderEl.className = 'bp-noui-slider';
    wrap.appendChild(sliderEl);

    noUiSlider.create(sliderEl, {
      start: [value],
      step: 1,
      connect: [true, false],
      range: { min: min, max: max },
      format: {
        to: function(v){ return Math.round(v); },
        from: function(v){ return Number(v); }
      }
    });

    sliderEl.noUiSlider.on('update', function(values){
      let v = parseInt(values[0], 10);
      setAnswer(q.id, v);
    });

    let numbers = document.createElement('div');
    numbers.className = 'bp-slider-numbers';
    for (let i = min; i <= max; i++) {
      let s = document.createElement('span');
      s.textContent = i;
      numbers.appendChild(s);
    }
    wrap.appendChild(numbers);

    let ticks = document.createElement('div');
    ticks.className = 'bp-slider-ticks mt-3';
    let minSpan = document.createElement('span');
    minSpan.textContent = q.minLabel || min;
    let maxSpan = document.createElement('span');
    maxSpan.textContent = q.maxLabel || max;
    ticks.appendChild(minSpan);
    ticks.appendChild(maxSpan);
    wrap.appendChild(ticks);

    if (state.answers[q.id] === undefined) {
      setAnswer(q.id, midpoint);
    }

    container.appendChild(wrap);
  }

  function renderSearch(container, q) {
    let list = document.createElement('div');
    list.className = 'space-y-2';
    let current = state.answers[q.id];

    q.answers.forEach(function(a){
      let option = document.createElement('div');
      option.className = 'bp-option';
      if (current === a.id) option.classList.add('selected');

      let indicator = document.createElement('span');
      indicator.className = 'bp-option-radio';
      option.appendChild(indicator);

      let text = document.createElement('div');
      text.className = 'flex-1 min-w-0';
      let label = document.createElement('div');
      label.className = 'bp-option-label';
      label.textContent = a.label;
      text.appendChild(label);
      if (a.helper) {
        let helper = document.createElement('div');
        helper.className = 'bp-option-helper';
        helper.textContent = a.helper;
        text.appendChild(helper);
      }
      option.appendChild(text);

      option.addEventListener('click', function(){
        if (!a.openSearch) state.currentPaddleName = '';
        setAnswer(q.id, a.id);
        renderQuestion();
        if (a.openSearch) {
          let input = document.querySelector('.bp-search-input');
          if (input) input.focus();
        }
      });
      list.appendChild(option);
    });
    container.appendChild(list);

    if (current === 'q1_search') {
      renderSearchBox(container, q);
    }
  }

  function renderSearchBox(container, q) {
    let existing = container.querySelector('.bp-search-box');
    if (existing) return;

    let box = document.createElement('div');
    box.className = 'bp-search-box mt-4';

    let input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type the name of your paddle...';
    input.className = 'bp-search-input';
    input.value = state.currentPaddleName || '';
    box.appendChild(input);

    let results = document.createElement('div');
    results.className = 'bp-search-results hidden';
    box.appendChild(results);

    input.addEventListener('input', function(){
      let q = input.value.trim();
      state.currentPaddleName = q;
      persist();
      let nextBtn = document.getElementById('bp-next-btn');
      if (nextBtn) {
        let qDef = QUESTIONS[state.currentIndex];
        nextBtn.disabled = !hasAnswerFor(qDef);
      }
      clearTimeout(searchDebounce);
      if (q.length < 2) {
        results.classList.add('hidden');
        return;
      }
      searchDebounce = setTimeout(function(){
        api('paddle_search', { query: q }).then(function(r){
          if (!r.success || !r.results) { results.classList.add('hidden'); return; }
          if (r.results.length === 0) {
            results.innerHTML = '<div class="bp-search-result" style="cursor: default; color: #64748b;">No matches in our catalog. You can keep typing or pick "My paddle is not listed" above.</div>';
            results.classList.remove('hidden');
            return;
          }
          results.innerHTML = '';
          r.results.forEach(function(p){
            let item = document.createElement('div');
            item.className = 'bp-search-result';
            let img = document.createElement('img');
            img.src = p.image_url || '';
            img.alt = '';
            img.onerror = function(){ img.style.background = '#f1f5f9'; img.removeAttribute('src'); };
            let name = document.createElement('span');
            name.textContent = p.name;
            item.appendChild(img);
            item.appendChild(name);
            item.addEventListener('click', function(){
              state.currentPaddleName = p.name;
              input.value = p.name;
              results.classList.add('hidden');
              persist();
            });
            results.appendChild(item);
          });
          results.classList.remove('hidden');
        });
      }, 250);
    });

    container.appendChild(box);
  }

  function submit() {
    qSlot.classList.add('hidden');
    rSlot.classList.remove('hidden');
    rSlot.innerHTML = '<div class="bp-question-card text-center"><svg class="w-10 h-10 animate-spin text-brand-600 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-3 text-base font-semibold text-slate-700">Finding your perfect paddles...</p></div>';

    showProgress(false);

    api('submit_quiz', {
      answers: state.answers,
      userAgent: navigator.userAgent,
      referrer: document.referrer || ''
    }).then(function(r){
      console.log('submit_quiz response:', r);
      if (!r.success) {
        rSlot.innerHTML = '<div class="bp-question-card text-center"><p class="text-red-600 font-semibold mb-2">Something went wrong.</p><p class="text-sm text-slate-600">' + (r.error || 'Unknown error') + '</p></div>';
        return;
      }
      window.bpQuiz.clearState();
      if (r.id) window.bpQuiz.setResultIdInUrl(r.id);
      showEmailGate(r);
    }).catch(function(err){
      console.error('submit_quiz error:', err);
      rSlot.innerHTML = '<div class="bp-question-card text-center"><p class="text-red-600 font-semibold mb-2">Network error.</p><p class="text-sm text-slate-600">' + (err && err.message ? err.message : 'Could not reach the server.') + '</p></div>';
    });
  }

  function showEmailGate(r) {
    rSlot.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'bp-email-gate';
    card.innerHTML =
      '<div class="bp-email-gate-icon">' +
        '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>' +
      '</div>' +
      '<h2 class="bp-email-gate-title">Almost there!</h2>' +
      '<p class="bp-email-gate-helper">Enter your email to see your paddle matches. We will also send the results, discount codes, and links so you can come back later.</p>' +
      '<input type="email" id="bp-gate-email" class="bp-email-input" placeholder="your@email.com" autocomplete="email">' +
      '<button type="button" id="bp-gate-submit" class="bp-email-submit">See My Results</button>' +
      '<button type="button" id="bp-gate-skip" class="bp-email-gate-skip">Skip and see results</button>';
    rSlot.appendChild(card);

    const emailInput = document.getElementById('bp-gate-email');
    const submitBtn = document.getElementById('bp-gate-submit');
    const skipBtn = document.getElementById('bp-gate-skip');

    setTimeout(function(){ emailInput.focus(); }, 50);

    function showResultsWithEmail(emailSubmitted) {
      r._emailSubmitted = emailSubmitted;
      renderResults(r);
    }

    submitBtn.addEventListener('click', function(){
      const email = (emailInput.value || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailInput.focus();
        emailInput.classList.add('bp-email-input-error');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
      api('attach_email', { id: r.id, email: email }).then(function(){
        showResultsWithEmail(true);
      }).catch(function(){
        showResultsWithEmail(true);
      });
    });

    emailInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter') submitBtn.click();
    });
    emailInput.addEventListener('input', function(){
      emailInput.classList.remove('bp-email-input-error');
    });

    skipBtn.addEventListener('click', function(){
      showResultsWithEmail(false);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderResults(r) {
    rSlot.innerHTML = '';
    let doc = document.createElement('div');
    doc.className = 'bp-results-doc';

    // --- Top label ---
    let top = document.createElement('div');
    top.className = 'bp-results-title';
    top.innerHTML = '<span>Your Results</span><span class="text-xs font-semibold text-emerald-600 inline-flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Quiz complete</span>';
    doc.appendChild(top);

    let profile = r.profile || { Control: 5, Power: 5, Spin: 5 };
    let profCard = document.createElement('div');
    profCard.className = 'bp-profile-card';
    profCard.innerHTML =
      '<div class="bp-profile-header">' +
        '<div class="bp-profile-avatar"><svg class="w-8 h-8 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg></div>' +
        '<div>' +
          '<div class="bp-profile-title">Your Playing Style Profile</div>' +
          '<div class="bp-profile-desc">' + buildStyleDescription(profile) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="bp-profile-bars">' +
        ['Control','Power','Spin'].map(function(d){
          let v = profile[d] || 0;
          return '<div class="bp-dim-row">' +
            '<div class="bp-dim-labelblock">' +
              '<div class="bp-dim-label">' + d + '</div>' +
              '<div class="bp-dim-value"><strong>' + v + '</strong> <span class="bp-dim-value-suffix">/10</span></div>' +
            '</div>' +
            '<div class="bp-dim-bar"><div class="bp-dim-bar-fill" style="width: ' + (v * 10) + '%"></div></div>' +
          '</div>';
        }).join('') +
      '</div>';
    doc.appendChild(profCard);

    // --- Top Paddle Matches heading ---
    let matchesHeading = document.createElement('div');
    matchesHeading.className = 'bp-matches-heading';
    matchesHeading.textContent = 'Your Top Paddle Matches';
    doc.appendChild(matchesHeading);

    // --- Filters-relaxed note ---
    if (r.filtersRelaxed && r.paddles && r.paddles.length > 0) {
      let note = document.createElement('div');
      note.className = 'bp-filters-note';
      note.textContent = 'No paddles fully matched your skill level and budget, so here are the closest picks from our full catalog.';
      doc.appendChild(note);
    }

    // --- Paddle cards ---
    if (!r.paddles || r.paddles.length === 0) {
      let empty = document.createElement('div');
      empty.className = 'bp-paddle-card text-center text-sm text-slate-500';
      empty.textContent = 'No paddles available right now. Please check back soon.';
      doc.appendChild(empty);
    } else {
      let topScore = r.paddles[0].score || 0;
      r.paddles.forEach(function(p, idx){
        if (topScore === 0) {
          p._pct = idx === 0 ? 88 : (idx === 1 ? 78 : 68);
        } else {
          let raw = Math.round((p.score / topScore) * 99);
          p._pct = Math.max(60, Math.min(99, raw));
        }
      });

      r.paddles.forEach(function(p, idx){
        let card = document.createElement('div');
        card.className = 'bp-paddle-card' + (idx === 0 ? ' top-match' : '');

        let badgeClass = idx === 0 ? '' : (idx === 1 ? ' second' : ' third');
        let dollarOff = Number(p.discount_amount) || ((p.msrp && p.price && p.msrp > p.price) ? (p.msrp - p.price) : 0);
        let discountSuffix = dollarOff > 0
          ? ' for $' + Math.round(dollarOff) + ' off'
          : (p.discount_percent ? ' for ' + p.discount_percent + '% off' : '');
        let codeLine = p.discount_code
          ? '<div class="bp-paddle-code">' +
              '<svg class="w-3.5 h-3.5 bp-paddle-code-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>' +
              '<span>Use code <strong>' + p.discount_code + '</strong>' + discountSuffix + '</span>' +
            '</div>'
          : '';
        let reason = p.description
          ? '<div class="bp-paddle-reason">' + escapeHtml(p.description) + '</div>'
          : '<div class="bp-paddle-reason">Strong match for your playing style based on your answers.</div>';

        let imgTag = p.image_url
          ? '<img src="' + escapeHtml(p.image_url) + '" alt="" class="bp-paddle-img" onerror="this.style.background=\'#f1f5f9\';this.removeAttribute(\'src\')">'
          : '<div class="bp-paddle-img"></div>';
        let btn = p.affiliate_url
          ? '<a href="' + escapeHtml(p.affiliate_url) + '" target="_blank" rel="noopener" class="bp-view-btn" data-paddle-id="' + escapeHtml(p.id) + '" data-paddle-name="' + escapeHtml(p.name) + '">View Product<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></a>'
          : '';

        let priceLine = '';
        if (p.price) {
          priceLine = '<div class="bp-paddle-price">$' + Number(p.price).toFixed(2);
          if (p.msrp && p.msrp > p.price) {
            priceLine += '<span class="bp-paddle-price-msrp">$' + Number(p.msrp).toFixed(2) + '</span>';
          }
          priceLine += '</div>';
        }

        card.innerHTML =
          '<span class="bp-match-badge' + badgeClass + '">' +
            '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>' +
            p._pct + '% Match' +
          '</span>' +
          '<div class="bp-paddle-main">' +
            imgTag +
            '<div class="min-w-0">' +
              '<div class="bp-paddle-name">' + escapeHtml(p.name) + '</div>' +
              priceLine +
              codeLine +
              reason + (btn ? '<div class="bp-paddle-action">' + btn + '</div>' : '') +
            '</div>' +
          '</div>' +
          renderCompareSection(profile, p);
        doc.appendChild(card);
      });
    }

    // Skip the email capture card if email was already submitted via the gate
    let emailCard = r._emailSubmitted ? null : document.createElement('div');
    if (emailCard) {
    emailCard.className = 'bp-email-card';
    emailCard.innerHTML =
      '<div class="bp-email-icon"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>' +
      '<div class="bp-email-title">Want these results emailed to you?</div>' +
      '<div class="bp-email-helper">Enter your email and we will send your paddle matches, discount codes, and links so you can come back later.</div>' +
      '<input type="email" id="bp-email-input" class="bp-email-input" placeholder="your@email.com">' +
      '<button type="button" id="bp-email-submit" class="bp-email-submit">Email My Results</button>';
    doc.appendChild(emailCard);

    setTimeout(function(){
      let input = document.getElementById('bp-email-input');
      let submit = document.getElementById('bp-email-submit');
      if (!input || !submit) return;
      submit.addEventListener('click', function(){
        let email = (input.value || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          input.focus();
          return;
        }
        let resultId = r.id || window.bpQuiz.getResultIdFromUrl();
        if (!resultId) {
          emailCard.innerHTML = '<div class="bp-email-thanks" style="color:#dc2626">Could not attach email to results. Please retake the quiz.</div>';
          return;
        }
        submit.disabled = true;
        submit.textContent = 'Saving...';
        api('attach_email', { id: resultId, email: email }).then(function(res){
          if (res.success) {
            emailCard.innerHTML = '<div class="bp-email-thanks">Got it. Your results will be in your inbox shortly.</div>';
          } else {
            submit.disabled = false;
            submit.textContent = 'Email My Results';
            let err = document.createElement('div');
            err.style.color = '#dc2626';
            err.style.fontSize = '0.85rem';
            err.style.marginTop = '0.5rem';
            err.textContent = res.error || 'Could not save email. Please try again.';
            emailCard.appendChild(err);
          }
        }).catch(function(){
          submit.disabled = false;
          submit.textContent = 'Email My Results';
        });
      });
    }, 0);
    }

    // --- Retake link ---
    let retake = document.createElement('div');
    retake.className = 'bp-retake';
    retake.innerHTML = '<button type="button" id="bp-retake-btn">Retake the quiz</button>';
    doc.appendChild(retake);

    rSlot.appendChild(doc);

    if (!rSlot._bpClickWired) {
      rSlot.addEventListener('click', function(e){
        let a = e.target.closest && e.target.closest('a.bp-view-btn');
        if (!a) return;
        let paddleId = a.getAttribute('data-paddle-id') || '';
        let paddleName = a.getAttribute('data-paddle-name') || '';
        let completionId = (r && r.id) || window.bpQuiz.getResultIdFromUrl() || '';
        api('track_click', {
          completion_id: completionId,
          paddle_id: paddleId,
          paddle_name: paddleName
        }).catch(function(){});
      });
      rSlot._bpClickWired = true;
    }

    setTimeout(function(){
      let btn = document.getElementById('bp-retake-btn');
      if (btn) {
        btn.addEventListener('click', function(){
          window.bpQuiz.clearState();
          state = { currentIndex: 0, answers: {}, currentPaddleName: '' };
          try {
            let url = new URL(window.location.href);
            url.searchParams.delete('r');
            window.history.replaceState({}, '', url.toString());
          } catch (err) {}
          rSlot.classList.add('hidden');
          qSlot.classList.remove('hidden');
          showProgress(true);
          renderQuestion();
        });
      }
    }, 0);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildStyleDescription(profile) {
    let c = profile.Control || 0;
    let p = profile.Power || 0;
    let s = profile.Spin || 0;
    let dims = [['Control', c], ['Power', p], ['Spin', s]].sort(function(a, b){ return b[1] - a[1]; });
    let top1 = dims[0][0];
    let top2 = dims[1][0];
    let bot = dims[2][0];
    if (dims[0][1] === dims[1][1] && dims[1][1] === dims[2][1]) {
      return 'You value a balanced all-court game across control, power, and spin.';
    }
    return 'You value ' + top1.toLowerCase() + ' and ' + top2.toLowerCase() + ' with a solid feel for ' + bot.toLowerCase() + '. You prefer a confident, all-court game.';
  }

  function renderCompareSection(profile, paddle) {
    let dims = [
      { key: 'Control', user: profile.Control || 0, paddle: paddle.control_score || 0 },
      { key: 'Power',   user: profile.Power   || 0, paddle: paddle.power_score   || 0 },
      { key: 'Spin',    user: profile.Spin    || 0, paddle: paddle.spin_score    || 0 }
    ];
    let cols = dims.map(function(d){
      return '<div class="bp-compare-col">' +
        '<div class="bp-compare-col-head">' + d.key + '</div>' +
        '<div class="bp-compare-col-inline"><span>You ' + d.user + '</span><span class="bp-compare-divider">|</span><span>Paddle ' + d.paddle + '</span></div>' +
        '<div class="bp-compare-bar-row">' +
          '<div class="bp-compare-cell-bar"><div class="bp-compare-cell-fill you" style="width:' + Math.min(100, d.user * 10) + '%"></div></div>' +
          '<span class="bp-compare-bar-value">' + d.user + '/10</span>' +
        '</div>' +
        '<div class="bp-compare-bar-row">' +
          '<div class="bp-compare-cell-bar"><div class="bp-compare-cell-fill paddle" style="width:' + Math.min(100, d.paddle * 10) + '%"></div></div>' +
          '<span class="bp-compare-bar-value">' + d.paddle + '/10</span>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="bp-compare"><div class="bp-compare-title">How it compares to your play style</div><div class="bp-compare-grid">' + cols + '</div></div>';
  }


  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  document.addEventListener('DOMContentLoaded', start);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 0);
  }
})();
