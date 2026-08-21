const API_BASE = '/api';
const SESSION_KEY = 'nc_session';
const TYPE_LABEL = { domestic: 'Domestic', overseas: 'Overseas', signature: 'Signature' };

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function apiFetch(path, options = {}) {
  const session = getSession();
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

  const res = await fetch(API_BASE + path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearSession();
  }
  if (!res.ok) {
    throw new Error(data.error || '요청에 실패했습니다.');
  }
  return data;
}

function updateNavAuthLinks() {
  const session = getSession();
  document.querySelectorAll('[data-auth-link]').forEach((el) => {
    if (session) {
      el.textContent = 'My Page';
      el.setAttribute('href', 'mypage.html');
    } else {
      el.textContent = 'Login';
      el.setAttribute('href', 'login.html');
    }
  });
  document.querySelectorAll('.nav-cta').forEach((el) => {
    el.style.display = session ? 'none' : '';
  });
}

function requireLoginOrRedirect() {
  if (!getSession()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

document.addEventListener('DOMContentLoaded', updateNavAuthLinks);
