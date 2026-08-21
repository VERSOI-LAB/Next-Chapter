const STATUS_LABEL = { open: '신청 가능', closed: '마감', coming_soon: '오픈 예정' };

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');

const applyForm = document.getElementById('apply-form');
const applyBtn = document.getElementById('apply-btn');
const applyMsg = document.getElementById('apply-msg');

let currentJourney = null;

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

    if (journey.status !== 'open') {
      applyBtn.disabled = true;
      applyBtn.textContent = journey.status === 'closed' ? '마감되었습니다' : '오픈 예정입니다';
    }
  } catch (err) {
    document.getElementById('journey-root').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

applyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  applyMsg.textContent = '';
  applyMsg.className = 'form-msg';

  if (!getSession()) {
    window.location.href = `login.html?next=journey.html?slug=${encodeURIComponent(slug)}`;
    return;
  }

  applyBtn.disabled = true;
  try {
    await apiFetch('/applications', {
      method: 'POST',
      body: { journey_id: currentJourney.id, message: document.getElementById('message').value.trim() || null },
    });
    applyMsg.textContent = '신청이 접수되었습니다. 검증 및 선발 절차 안내를 기다려주세요.';
    applyMsg.className = 'form-msg success';
    applyForm.reset();
  } catch (err) {
    applyMsg.textContent = err.message;
    applyMsg.className = 'form-msg error';
    applyBtn.disabled = false;
  }
});

loadJourney();
