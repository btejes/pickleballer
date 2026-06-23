const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz6R0VAaTHsdqXZmx87wJCLhQrwYfLVW42QGaH4FMKu-wdz50MnPdD-R6ZIE-SK6KdJ/exec';

let creds = null;
const initHooks = [];
const tabHooks = {};

const loginBtn = document.getElementById('bp-login-btn');
const logoutBtn = document.getElementById('bp-logout-btn');
const loginError = document.getElementById('bp-login-error');
const usernameInput = document.getElementById('bp-username');
const passwordInput = document.getElementById('bp-password');
const toastEl = document.getElementById('bp-toast');
const toastBody = document.getElementById('bp-toast-body');
let toastTimeout;

export const spinnerSvg = '<svg class="w-4 h-4 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

export function showToast(msg) {
  toastBody.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function(){ toastEl.classList.remove('show'); }, 2500);
}

export function api(action, extra) {
  const payload = Object.assign({ action: action }, creds || {}, extra || {});
  return fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json(); });
}

export function withSpinner(btn, label, fn) {
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = spinnerSvg + '<span>' + (label || 'Working...') + '</span>';
  return fn().finally(function(){ btn.disabled = false; btn.innerHTML = orig; });
}

export function onInit(fn) { initHooks.push(fn); }
export function onTab(name, fn) { tabHooks[name] = fn; }
export function getCreds() { return creds; }

function showAdmin() {
  document.documentElement.classList.add('bp-has-creds');
  initHooks.forEach(function(h){ try { h(); } catch (err) { console.error(err); } });
  activateTab('subscribers');
}

function showLogin() {
  document.documentElement.classList.remove('bp-has-creds');
}

function activateTab(name) {
  const contents = document.querySelectorAll('.bp-tab-content');
  contents.forEach(function(el){ el.classList.add('hidden'); });
  const target = document.getElementById('bp-tab-' + name);
  if (target) target.classList.remove('hidden');
  const btns = document.querySelectorAll('.bp-tab-btn');
  btns.forEach(function(b){
    if (b.getAttribute('data-tab') === name) b.classList.add('active');
    else b.classList.remove('active');
  });
  if (tabHooks[name]) {
    try { tabHooks[name](); } catch (err) { console.error(err); }
  }
}

document.querySelectorAll('.bp-tab-btn').forEach(function(btn){
  btn.addEventListener('click', function(){ activateTab(btn.getAttribute('data-tab')); });
});

loginBtn.addEventListener('click', function(){
  loginError.textContent = '';
  const u = usernameInput.value.trim();
  const p = passwordInput.value;
  if (!u || !p) { loginError.textContent = 'Username and password required'; return; }
  withSpinner(loginBtn, 'Signing in...', function(){
    return api('login', { username: u, password: p }).then(function(r){
      if (r.success) {
        creds = { username: u, password: p };
        localStorage.setItem('bp_admin_creds', JSON.stringify(creds));
        showAdmin();
      } else {
        loginError.textContent = r.error || 'Invalid credentials';
      }
    }).catch(function(){ loginError.textContent = 'Connection error'; });
  });
});

passwordInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') loginBtn.click(); });

logoutBtn.addEventListener('click', function(){
  localStorage.removeItem('bp_admin_creds');
  creds = null;
  location.reload();
});

const saved = localStorage.getItem('bp_admin_creds');
if (saved) {
  try {
    creds = JSON.parse(saved);
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(showAdmin, 0);
    } else {
      document.addEventListener('DOMContentLoaded', showAdmin);
    }
  } catch (err) {
    creds = null;
    localStorage.removeItem('bp_admin_creds');
    showLogin();
  }
}
