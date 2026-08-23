const STATUS_LABEL = { open: '신청 가능', closed: '마감', coming_soon: '오픈 예정' };

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');

const applyForm = document.getElementById('apply-form');
const applyBtn = document.getElementById('apply-btn');
const applySaveBtn = document.getElementById('apply-save-btn');
const applyMsg = document.getElementById('apply-msg');
const passportFields = document.getElementById('passport-fields');

let currentJourney = null;
let pendingApplicationId = null;

function formatPrice(price) {
  if (price === null || price === undefined) return '추후 공개';
  return `${Number(price).toLocaleString('ko-KR')}원`;
}

function formatDate(dateStr) {
  if (!dateStr) return '추후 공개';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function loadJourney() {
  if (!slug) {
    document.getElementById('journey-root').innerHTML = '<div class="empty-state">잘못된 접근입니다.</div>';
    return;
  }

  try {
    const { journey } = await apiFetch(`/journeys/${encodeURIComponent(slug)}`);
    currentJourney = journey;

    document.title = `${journey.title} — NEXT CHAPTER`;
    document.getElementById('j-image').src = journey.image_url || '';
    document.getElementById('j-image').alt = journey.title;
    document.getElementById('j-meta').textContent = `${TYPE_LABEL[journey.type] || journey.type} · ${STATUS_LABEL[journey.status] || journey.status}`;
    document.getElementById('j-title').textContent = journey.title;
    document.getElementById('j-summary').textContent = journey.summary || '';
    document.getElementById('j-description').textContent = journey.description || '';
    document.getElementById('j-duration').textContent = journey.duration || '추후 공개';
    document.getElementById('j-capacity').textContent = `${journey.capacity_male}:${journey.capacity_female}`;
    document.getElementById('j-price').textContent = formatPrice(journey.price);
    document.getElementById('j-start').textContent = formatDate(journey.starts_at);

    const serviceLabel = journey.type === 'domestic' ? '국내결혼중개 서비스 1회'
      : journey.type === 'overseas' ? '해외결혼중개 서비스 1회'
      : '결혼중개 서비스 1회';
    const includedItems = [
      serviceLabel,
      '참가자 검증 및 선발',
      journey.duration ? `${journey.duration} 매칭 프로그램` : '매칭 프로그램',
      '숙박', '교통', '식사', '체험 프로그램',
    ];
    fillList('j-included', includedItems);

    const requirementItems = ['마이페이지 · 내 프로필 작성 완료', '마이페이지 · 신원검증 · 혼인관계증명서 제출'];
    if (journey.type === 'signature') {
      requirementItems.push('마이페이지 · 신원검증 · 직업·학력·소득 증빙 제출 (SIGNATURE 전용)');
    }
    fillList('j-requirements', requirementItems);

    if (journey.status === 'closed') {
      applyBtn.disabled = true;
      applyBtn.textContent = '마감되었습니다';
    } else if (journey.status === 'coming_soon') {
      applyBtn.textContent = '대기 신청하기';
    }

    await checkEligibility();
  } catch (err) {
    document.getElementById('journey-root').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function fillList(id, items) {
  const list = document.getElementById(id);
  list.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
}

const VERIFY_LABELS = { marital: '혼인관계증명서', job: '직업 증빙', education: '학력 증빙', income: '소득 증빙' };

async function checkEligibility() {
  const notice = document.getElementById('eligibility-notice');
  if (!getSession() || journeyClosedOrDisabled()) return;

  try {
    const query = currentJourney.type === 'signature' ? '?journey_type=signature' : '';
    const eligibility = await apiFetch(`/profile/eligibility${query}`);
    if (eligibility.eligible) {
      notice.style.display = 'none';
      return;
    }

    const parts = [];
    if (!eligibility.profile_complete) {
      parts.push('내 프로필의 필수 정보와 사진 3장 이상을 모두 채워주세요.');
    }
    if (eligibility.missing_verify_types?.length) {
      const labels = eligibility.missing_verify_types.map((t) => VERIFY_LABELS[t] || t).join(', ');
      parts.push(`${labels} 서류를 제출해주세요.`);
    }

    notice.innerHTML = `
      <p style="color:var(--accent-dark);margin-bottom:8px">이 여행에 신청하려면 아래 항목을 먼저 완료해주세요.</p>
      <p style="color:var(--muted)">${parts.join(' ')}</p>
      <a href="mypage.html" class="link-btn" style="display:inline-block;margin-top:10px">마이페이지에서 완료하기 →</a>
    `;
    notice.style.display = '';
    applyBtn.disabled = true;
  } catch (err) {
    // eligibility pre-check is a UX convenience; the server re-validates on submit regardless
  }
}

function journeyClosedOrDisabled() {
  return currentJourney?.status === 'closed';
}

function consentsChecked() {
  return document.getElementById('consent-member-info').checked && document.getElementById('consent-third-party').checked;
}

async function createApplication() {
  const { application } = await apiFetch('/applications', {
    method: 'POST',
    body: {
      journey_id: currentJourney.id,
      message: document.getElementById('message').value.trim() || null,
      agree_member_info_share: document.getElementById('consent-member-info').checked,
      agree_travel_third_party: document.getElementById('consent-third-party').checked,
    },
  });
  return application;
}

applyForm.addEventListener('submit', (e) => e.preventDefault());

applyBtn.addEventListener('click', async () => {
  applyMsg.textContent = '';
  applyMsg.className = 'form-msg';

  if (!getSession()) {
    window.location.href = `login.html?next=journey.html?slug=${encodeURIComponent(slug)}`;
    return;
  }

  if (!consentsChecked()) {
    applyMsg.textContent = '필수 동의 항목을 모두 체크해주세요.';
    applyMsg.className = 'form-msg error';
    return;
  }

  if (currentJourney.type === 'overseas') {
    passportFields.style.display = '';
    applyBtn.style.display = 'none';
    applySaveBtn.style.display = '';
    passportFields.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  applyBtn.disabled = true;
  try {
    const application = await createApplication();
    window.location.href = `payment.html?application=${application.id}`;
  } catch (err) {
    applyMsg.textContent = err.message;
    applyMsg.className = 'form-msg error';
    applyBtn.disabled = false;
  }
});

applySaveBtn.addEventListener('click', async () => {
  applyMsg.textContent = '';
  applyMsg.className = 'form-msg';

  if (!consentsChecked()) {
    applyMsg.textContent = '필수 동의 항목을 모두 체크해주세요.';
    applyMsg.className = 'form-msg error';
    return;
  }

  const fullNameKr = document.getElementById('passport-name-kr').value.trim();
  const fullNameEn = document.getElementById('passport-name-en').value.trim();
  const passportNumber = document.getElementById('passport-number').value.trim();
  const passportExpiry = document.getElementById('passport-expiry').value;
  const imageFile = document.getElementById('passport-image').files[0];

  if (!fullNameKr || !fullNameEn || !passportNumber || !passportExpiry || !imageFile) {
    applyMsg.textContent = '여권 정보를 모두 입력하고 이미지를 첨부해주세요.';
    applyMsg.className = 'form-msg error';
    return;
  }

  applySaveBtn.disabled = true;
  try {
    if (!pendingApplicationId) {
      const application = await createApplication();
      pendingApplicationId = application.id;
    }

    const fd = new FormData();
    fd.append('full_name_kr', fullNameKr);
    fd.append('full_name_en', fullNameEn);
    fd.append('passport_number', passportNumber);
    fd.append('passport_expiry', passportExpiry);
    fd.append('passport_image', imageFile);

    const session = getSession();
    const res = await fetch(`/api/passport/${pendingApplicationId}`, {
      method: 'POST',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '여권 정보 저장에 실패했습니다.');

    window.location.href = `payment.html?application=${pendingApplicationId}`;
  } catch (err) {
    applyMsg.textContent = err.message;
    applyMsg.className = 'form-msg error';
    applySaveBtn.disabled = false;
  }
});

loadJourney();
