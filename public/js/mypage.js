if (!requireLoginOrRedirect()) {
  // redirected
}

const profileForm = document.getElementById('profile-form');
const profileMsg = document.getElementById('profile-msg');
const applicationsList = document.getElementById('applications-list');
const logoutLink = document.getElementById('logout-link');

const VERIFICATION_LABEL = { pending: '확인 중', verified: '인증 완료', rejected: '반려됨' };
const APPLICATION_STATUS_LABEL = { pending: '검토 중', approved: '승인됨', rejected: '거절됨', cancelled: '취소됨' };

function formatJourneyDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ddayInfo(startsAt) {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((start - today) / 86400000);
  if (diff < 0) return null;
  return { num: diff === 0 ? 'DAY' : `${diff}`, label: diff === 0 ? '출발 당일' : '출발까지' };
}

const TRACKER_STEPS = ['applied', 'review', 'confirmed', 'departure'];

const PREP_CHECKLIST = [
  { threshold: 30, title: '짐 싸기 가이드', desc: '여정에 필요한 준비물과 챙기면 좋을 아이템을 안내해드려요.' },
  { threshold: 14, title: '여정 일정표 확정', desc: '숙소, 이동 경로 등 확정된 일정표를 확인할 수 있어요.' },
  { threshold: 7, title: '준비물 최종 점검 & 컨시어지 안내', desc: '출발 전 마지막 체크리스트와 전담 컨시어지 연락처를 안내해드려요.' },
  { threshold: 1, title: '집합 장소 & 시간 안내', desc: '출발 당일 만나는 장소와 정확한 시간을 확인하세요.' },
];

function renderPrepChecklist(dday) {
  const wrap = document.getElementById('prep-checklist');
  const list = document.getElementById('prep-list');
  if (!dday) {
    wrap.style.display = 'none';
    return;
  }

  const diff = dday.num === 'DAY' ? 0 : Number(dday.num);
  wrap.style.display = 'block';
  list.innerHTML = PREP_CHECKLIST.map((item) => {
    const unlocked = diff <= item.threshold;
    if (unlocked) {
      return `
        <div class="prep-item unlocked">
          <div class="prep-item-icon">✓</div>
          <div class="prep-item-body">
            <h4>${item.title}</h4>
            <p>${item.desc}</p>
          </div>
        </div>`;
    }
    const remain = diff - item.threshold;
    return `
      <div class="prep-item locked">
        <div class="prep-item-icon">🔒</div>
        <div class="prep-item-body">
          <h4>${item.title}</h4>
          <p class="prep-lock-caption">D-${item.threshold}에 공개돼요 · ${remain}일 후</p>
        </div>
      </div>`;
  }).join('');
}

const MYPAGE_EDITORIAL_QUOTES = [
  {
    tag: 'Editorial',
    title: '좋은 사람은 어떤 순간에 보일까요?',
    body: '식당 직원에게 말하는 태도, 함께 걷는 속도, 낯선 상황에서 보이는 배려. 여행은 짧은 대화보다 한 사람의 생활 태도를 더 자연스럽게 보여줍니다.',
    image: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1600&q=85',
  },
  {
    tag: 'Journal',
    title: '왜 여행에서 더 쉽게 마음이 열릴까요?',
    body: '일상에서 벗어난 환경이 대화와 호기심을 자연스럽게 만드는 이유. 익숙한 공간을 벗어나면 사람은 조금 더 솔직해집니다.',
    image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=85',
  },
  {
    tag: 'Guide',
    title: "첫 만남에서 중요한 것은 '잘 보이는 것'이 아닙니다.",
    body: '좋은 인상을 만들기보다 서로에게 편안한 사람이 되는 법. 38시간은 꾸며낸 모습이 오래 유지되기엔 충분히 긴 시간입니다.',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=85',
  },
];

function renderEditorialStrip() {
  const wrap = document.getElementById('editorial-strip');
  if (!wrap) return;
  const quote = MYPAGE_EDITORIAL_QUOTES[Math.floor(Math.random() * MYPAGE_EDITORIAL_QUOTES.length)];
  wrap.innerHTML = `
    <div class="editorial-strip-media"><img src="${quote.image}" alt=""></div>
    <div class="editorial-strip-body">
      <div class="editorial-strip-tag">${quote.tag}</div>
      <h3>${quote.title}</h3>
      <p>${quote.body}</p>
      <a href="story.html" class="editorial-strip-link">Story 전체보기 →</a>
    </div>`;
}

function renderJourneyHero(applications) {
  const defaultHeader = document.getElementById('default-header');
  const hero = document.getElementById('journey-hero');
  const tracker = document.getElementById('journey-tracker');

  const approved = applications.filter((a) => a.status === 'approved' && a.journey?.starts_at);
  if (!approved.length) {
    defaultHeader.style.display = '';
    hero.style.display = 'none';
    tracker.style.display = 'none';
    renderPrepChecklist(null);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sorted = [...approved].sort((a, b) => new Date(a.journey.starts_at) - new Date(b.journey.starts_at));
  const upcoming = sorted.find((a) => new Date(a.journey.starts_at) >= today);
  const highlight = upcoming || sorted[sorted.length - 1];
  const j = highlight.journey;
  const dday = ddayInfo(j.starts_at);

  defaultHeader.style.display = 'none';
  hero.style.display = 'block';
  tracker.style.display = 'flex';

  document.getElementById('hero-img').src = j.image_url || '';
  document.getElementById('hero-img').alt = j.title || '';
  document.getElementById('hero-title').textContent = j.title || '';
  document.getElementById('hero-date').textContent = `${formatJourneyDate(j.starts_at)} 출발`;

  const ddayEl = document.getElementById('hero-dday');
  if (dday) {
    ddayEl.style.display = 'inline-flex';
    document.getElementById('hero-dday-num').textContent = `D-${dday.num}`;
    document.getElementById('hero-dday-label').textContent = dday.label;
  } else {
    ddayEl.style.display = 'none';
  }

  let currentIndex;
  if (!dday) currentIndex = TRACKER_STEPS.length; // past trip — every step complete
  else if (dday.num === 'DAY') currentIndex = 3; // departure day
  else currentIndex = 2; // approved and upcoming — matching confirmed

  tracker.querySelectorAll('.tracker-step').forEach((el, i) => {
    el.classList.remove('done', 'current');
    if (i < currentIndex) el.classList.add('done');
    else if (i === currentIndex) el.classList.add('current');
  });

  renderPrepChecklist(dday);
}

const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 34;

function updateProfileGauge(profile) {
  const fields = ['full_name', 'gender', 'birth_year', 'phone', 'bio'];
  const filled = fields.filter((f) => profile[f]).length;
  const pct = Math.round((filled / fields.length) * 100);
  const fillCircle = document.getElementById('gauge-fill-circle');
  fillCircle.style.strokeDasharray = `${GAUGE_CIRCUMFERENCE}`;
  fillCircle.style.strokeDashoffset = `${GAUGE_CIRCUMFERENCE * (1 - pct / 100)}`;
  document.getElementById('gauge-percent').textContent = `${pct}%`;
}

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

    updateProfileGauge(profile);
  } catch (err) {
    if (err.message.includes('세션') || err.message.includes('로그인')) {
      window.location.href = 'login.html';
    }
  }
}

async function loadApplications() {
  try {
    const { applications } = await apiFetch('/applications/me');
    renderJourneyHero(applications);

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
      const dday = app.status === 'approved' ? ddayInfo(j.starts_at) : null;
      const ddayChip = dday
        ? `<div class="dday-chip"><span class="dday-num">D-${dday.num}</span><span class="dday-caption">${dday.label}</span></div>`
        : '';
      const dateLine = j.starts_at
        ? `<p class="app-item-date">${formatJourneyDate(j.starts_at)} 출발</p>`
        : '';
      return `
        <div class="app-item">
          <div class="app-item-media"><img src="${j.image_url || ''}" alt="${j.title || ''}"></div>
          <div class="app-item-body">
            <h3>${j.title || '알 수 없는 여행'}</h3>
            <p>${typeLabel} · ${j.duration || ''}</p>
            ${dateLine}
          </div>
          <div class="app-actions">
            ${ddayChip}
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
renderEditorialStrip();
