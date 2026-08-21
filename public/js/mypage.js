if (!requireLoginOrRedirect()) {
  // redirected
}

const profileForm = document.getElementById('profile-form');
const profileMsg = document.getElementById('profile-msg');
const applicationsList = document.getElementById('applications-list');
const logoutLink = document.getElementById('logout-link');

const VERIFICATION_LABEL = { pending: '확인 중', verified: '인증 완료', rejected: '반려됨' };
const APPLICATION_STATUS_LABEL = { pending: '검토 중', approved: '승인됨', rejected: '거절됨', cancelled: '취소됨' };

async function loadProfile() {
  try {
    const { user, profile } = await apiFetch('/auth/me');
    document.getElementById('p-email').value = user.email;
    document.getElementById('p-full-name').value = profile.full_name || '';
    document.getElementById('p-gender').value = profile.gender || '';
    document.getElementById('p-birth-year').value = profile.birth_year || '';
    document.getElementById('p-phone').value = profile.phone || '';
    document.getElementById('p-bio').value = profile.bio || '';

    const status = profile.verification_status || 'pending';
    document.getElementById('p-verification').innerHTML =
      `<span class="badge ${status}">${VERIFICATION_LABEL[status]}</span>`;
  } catch (err) {
    if (err.message.includes('세션') || err.message.includes('로그인')) {
      window.location.href = 'login.html';
    }
  }
}

async function loadApplications() {
  try {
    const { applications } = await apiFetch('/applications/me');
    if (!applications.length) {
      applicationsList.innerHTML = '<div class="empty-state">아직 신청한 여행이 없습니다.</div>';
      return;
    }

    applicationsList.innerHTML = applications.map((app) => {
      const j = app.journey || {};
      const typeLabel = TYPE_LABEL[j.type] || j.type || '';
      const cancelBtn = app.status === 'pending'
        ? `<button class="link-btn" data-cancel="${app.id}">신청 취소</button>`
        : '';
      return `
        <div class="app-item">
          <div>
            <h3>${j.title || '알 수 없는 여행'}</h3>
            <p>${typeLabel} · ${j.duration || ''}</p>
          </div>
          <div class="app-actions">
            <span class="badge ${app.status}">${APPLICATION_STATUS_LABEL[app.status] || app.status}</span>
            ${cancelBtn}
          </div>
        </div>`;
    }).join('');

    applicationsList.querySelectorAll('[data-cancel]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('신청을 취소하시겠습니까?')) return;
        btn.disabled = true;
        try {
          await apiFetch(`/applications/${btn.dataset.cancel}`, { method: 'DELETE' });
          loadApplications();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    applicationsList.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileMsg.textContent = '';
  profileMsg.className = 'form-msg';

  try {
    await apiFetch('/profile', {
      method: 'PUT',
      body: {
        full_name: document.getElementById('p-full-name').value.trim(),
        gender: document.getElementById('p-gender').value || null,
        birth_year: document.getElementById('p-birth-year').value || null,
        phone: document.getElementById('p-phone').value.trim() || null,
        bio: document.getElementById('p-bio').value.trim() || null,
      },
    });
    profileMsg.textContent = '저장되었습니다.';
    profileMsg.className = 'form-msg success';
  } catch (err) {
    profileMsg.textContent = err.message;
    profileMsg.className = 'form-msg error';
  }
});

logoutLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  clearSession();
  window.location.href = 'index.html';
});

const mypageTabButtons = document.querySelectorAll('.mypage-tabs button');
const mypagePanels = {
  account: document.getElementById('panel-account'),
  profile: document.getElementById('panel-profile'),
  verification: document.getElementById('panel-verification'),
};

mypageTabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    mypageTabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(mypagePanels).forEach((p) => p.classList.remove('active'));
    mypagePanels[btn.dataset.tab].classList.add('active');

    if (btn.dataset.tab === 'profile' && typeof initSelfProfile === 'function') initSelfProfile();
    if (btn.dataset.tab === 'verification' && typeof initVerificationTab === 'function') initVerificationTab();
  });
});

loadProfile();
loadApplications();
