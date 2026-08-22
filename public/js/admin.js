if (!requireLoginOrRedirect()) {
  // redirected to login
}

const adminContent = document.getElementById('admin-content');
const statusTabs = document.getElementById('status-tabs');
const logoutLink = document.getElementById('logout-link');

const STATUS_LABEL = { pending: '검토 중', approved: '승인됨', rejected: '거절됨', cancelled: '취소됨' };
const VERIFY_LABEL = { marital: '혼인관계증명서', job: '직업', education: '학력', income: '소득', asset: '자산' };
const VERIFY_STATUS_LABEL = { verified: '인증완료', pending: '검토중', rejected: '거절됨', not_submitted: '미제출' };
let currentStatus = '';

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function jobLabel(p) {
  const parts = [p.job_major, p.job_minor, p.job_tertiary].filter(Boolean);
  if (p.job_custom) parts.push(p.job_custom);
  return parts.length ? parts.join(' · ') : '—';
}

function renderApplicantDetail(p) {
  const photosHtml = (p.photos || []).length
    ? p.photos.map((ph) => `<a href="${esc(ph.url)}" target="_blank" rel="noopener"><img src="${esc(ph.url)}" alt="프로필 사진" class="admin-photo-thumb${ph.is_main ? ' is-main' : ''}"></a>`).join('')
    : '<span class="empty-state" style="padding:0">등록된 사진 없음</span>';

  const videoHtml = p.verification_video_url
    ? `<video src="${esc(p.verification_video_url)}" controls class="admin-video-preview"></video>`
    : '<span class="empty-state" style="padding:0">미제출</span>';

  const verifTypes = ['marital', 'job', 'education', 'income', 'asset'];
  const verifHtml = verifTypes.map((type) => {
    const status = (p.verifications || {})[type] || 'not_submitted';
    const docs = (p.documents || {})[type] || [];
    const docsHtml = docs.length
      ? docs.map((d) => `<a href="${esc(d.url)}" target="_blank" rel="noopener" class="admin-doc-link">${esc(d.file_name || '파일')}</a>`).join('')
      : '<span style="color:var(--muted)">제출된 서류 없음</span>';
    return `
      <div class="admin-verify-row">
        <div class="admin-verify-head">
          <span>${VERIFY_LABEL[type]}</span>
          <span class="badge ${status === 'not_submitted' ? '' : status}">${VERIFY_STATUS_LABEL[status]}</span>
        </div>
        <div class="admin-verify-docs">${docsHtml}</div>
      </div>`;
  }).join('');

  return `
    <div class="admin-detail-grid">
      <div>
        <div class="admin-detail-label">사진</div>
        <div class="admin-photo-row">${photosHtml}</div>
        <div class="admin-detail-label" style="margin-top:18px">신원확인 영상</div>
        ${videoHtml}
      </div>
      <div>
        <div class="admin-detail-label">기본 정보</div>
        <div class="admin-detail-kv">
          <span>거주지역</span><span>${esc([p.region, p.region_detail].filter(Boolean).join(' ') || '—')}</span>
          <span>키</span><span>${p.height ? esc(p.height) + ' cm' : '—'}</span>
          <span>학력</span><span>${esc([p.degree, p.university].filter(Boolean).join(' · ') || '—')}</span>
          <span>직업</span><span>${esc(jobLabel(p))}</span>
          <span>회사명</span><span>${esc(p.company_name || '—')}</span>
          <span>연봉</span><span>${p.salary ? esc(p.salary) + '만원' : '—'}</span>
          <span>자산</span><span>${esc(p.asset || '—')}</span>
        </div>
      </div>
      <div>
        <div class="admin-detail-label">신원검증 자료</div>
        ${verifHtml}
      </div>
    </div>`;
}

async function loadApplications() {
  adminContent.innerHTML = '<div class="empty-state">불러오는 중…</div>';
  try {
    const query = currentStatus ? `?status=${encodeURIComponent(currentStatus)}` : '';
    const { applications } = await apiFetch(`/admin/applications${query}`);

    if (!applications.length) {
      adminContent.innerHTML = '<div class="empty-state">신청 내역이 없습니다.</div>';
      return;
    }

    const rows = applications.map((app) => {
      const p = app.profile || {};
      const j = app.journey || {};
      const genderLabel = p.gender === 'male' ? '남' : p.gender === 'female' ? '여' : '-';
      const actions = app.status === 'pending'
        ? `<div class="admin-actions">
             <button class="approve" data-id="${app.id}" data-status="approved">Approve</button>
             <button class="reject" data-id="${app.id}" data-status="rejected">Reject</button>
           </div>`
        : `<div class="admin-actions"><button data-id="${app.id}" data-status="pending">Reset</button></div>`;

      return `
        <tr>
          <td>${esc(p.full_name || '—')}<br><span style="color:var(--muted)">${genderLabel}${p.birth_year ? ' · ' + esc(p.birth_year) : ''}</span></td>
          <td>${esc(p.phone || '—')}</td>
          <td><span class="badge ${p.verification_status}">${esc(p.verification_status)}</span></td>
          <td>${esc(j.title || '—')}</td>
          <td><span class="badge ${app.status}">${STATUS_LABEL[app.status] || app.status}</span></td>
          <td>${new Date(app.created_at).toLocaleDateString('ko-KR')}</td>
          <td>
            ${actions}
            <button type="button" class="link-btn admin-detail-toggle" data-detail-id="${app.id}" style="margin-top:8px">상세보기 ▾</button>
          </td>
        </tr>
        <tr class="admin-detail-row" id="detail-${app.id}" style="display:none">
          <td colspan="7">${renderApplicantDetail(p)}</td>
        </tr>`;
    }).join('');

    adminContent.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Verification</th><th>Journey</th><th>Status</th><th>Applied</th><th>Actions</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    adminContent.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await apiFetch(`/admin/applications/${btn.dataset.id}`, {
            method: 'PATCH',
            body: { status: btn.dataset.status },
          });
          loadApplications();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });

    adminContent.querySelectorAll('.admin-detail-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = document.getElementById(`detail-${btn.dataset.detailId}`);
        const isOpen = row.style.display !== 'none';
        row.style.display = isOpen ? 'none' : 'table-row';
        btn.textContent = isOpen ? '상세보기 ▾' : '접기 ▴';
      });
    });
  } catch (err) {
    adminContent.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

let journeysCache = [];
let journeysLoaded = false;
let editingJourneyId = null;
let editingItinerary = [];

const JOURNEY_STATUS_LABEL = { draft: '임시저장', open: '공개중', closed: '마감', coming_soon: '오픈예정' };
const JOURNEY_TYPE_LABEL = { domestic: '국내', overseas: '해외', signature: '시그니처' };
const DURATION_PRESETS = ['1박2일', '2박3일', '3박4일'];

function emptyDay(dayNum) {
  return { day: dayNum, date_label: `Day ${dayNum}`, items: [] };
}

function emptyItem() {
  return { time: '', title: '', desc: '' };
}

function journeyFormHtml(j) {
  const journey = j || {};
  const isEdit = Boolean(journey.id);
  const durationIsPreset = !journey.duration || DURATION_PRESETS.includes(journey.duration);

  return `
    <div class="itin-editor-panel" id="journey-form-panel">
      <div class="itin-editor-head">
        <h3>${isEdit ? '여행 수정' : '새 여행 추가'}</h3>
        <button type="button" id="journey-form-close" class="link-btn">닫기</button>
      </div>
      <form id="journey-form">
        <div class="field-row">
          <div class="field">
            <label>구분</label>
            <select name="type">
              <option value="domestic" ${journey.type === 'domestic' ? 'selected' : ''}>국내</option>
              <option value="overseas" ${journey.type === 'overseas' ? 'selected' : ''}>해외</option>
              <option value="signature" ${journey.type === 'signature' ? 'selected' : ''}>시그니처</option>
            </select>
          </div>
          <div class="field">
            <label>기간</label>
            <select name="duration_preset">
              ${DURATION_PRESETS.map((d) => `<option value="${d}" ${journey.duration === d ? 'selected' : ''}>${d}</option>`).join('')}
              <option value="__custom" ${!durationIsPreset ? 'selected' : ''}>직접입력</option>
            </select>
            <input type="text" name="duration_custom" placeholder="예: 4박5일" style="margin-top:8px;display:${durationIsPreset ? 'none' : 'block'}" value="${!durationIsPreset ? esc(journey.duration) : ''}">
          </div>
        </div>
        <div class="field">
          <label>제목</label>
          <input type="text" name="title" required value="${esc(journey.title || '')}">
        </div>
        <div class="field">
          <label>한줄 소개</label>
          <input type="text" name="summary" value="${esc(journey.summary || '')}">
        </div>
        <div class="field">
          <label>상세 설명</label>
          <textarea name="description">${esc(journey.description || '')}</textarea>
        </div>
        <div class="field">
          <label>사진</label>
          ${journey.image_url ? `<img src="${esc(journey.image_url)}" alt="" style="width:120px;height:80px;object-fit:cover;display:block;margin-bottom:8px">` : ''}
          <input type="file" name="image" accept="image/*">
        </div>
        <div class="field-row">
          <div class="field">
            <label>정원 (남)</label>
            <input type="number" name="capacity_male" value="${journey.capacity_male ?? 8}" min="0">
          </div>
          <div class="field">
            <label>정원 (여)</label>
            <input type="number" name="capacity_female" value="${journey.capacity_female ?? 8}" min="0">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>참가비 (원)</label>
            <input type="number" name="price" value="${journey.price ?? ''}" min="0">
          </div>
          <div class="field">
            <label>출발 예정일</label>
            <input type="date" name="starts_at" value="${journey.starts_at || ''}">
          </div>
        </div>
        <div class="field">
          <label>공개 상태</label>
          <select name="status">
            <option value="draft" ${(!journey.status || journey.status === 'draft') ? 'selected' : ''}>임시저장 (비공개)</option>
            <option value="coming_soon" ${journey.status === 'coming_soon' ? 'selected' : ''}>오픈예정 (대기 신청 가능)</option>
            <option value="open" ${journey.status === 'open' ? 'selected' : ''}>공개중</option>
            <option value="closed" ${journey.status === 'closed' ? 'selected' : ''}>마감</option>
          </select>
        </div>
        <div class="itin-editor-actions">
          <button type="submit" class="btn-outline">저장</button>
          <span class="form-msg" id="journey-form-msg"></span>
        </div>
      </form>
    </div>`;
}

function bindJourneyForm(journey) {
  const wrap = document.getElementById('journey-form-wrap');
  wrap.innerHTML = journeyFormHtml(journey);

  const form = document.getElementById('journey-form');
  const msg = document.getElementById('journey-form-msg');
  const durationPreset = form.duration_preset;
  const durationCustom = form.duration_custom;

  durationPreset.addEventListener('change', () => {
    durationCustom.style.display = durationPreset.value === '__custom' ? 'block' : 'none';
  });

  document.getElementById('journey-form-close').addEventListener('click', () => { wrap.innerHTML = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-msg';

    const duration = durationPreset.value === '__custom' ? durationCustom.value.trim() : durationPreset.value;
    const payload = {
      type: form.type.value,
      duration,
      title: form.title.value.trim(),
      summary: form.summary.value.trim() || null,
      description: form.description.value.trim() || null,
      capacity_male: Number(form.capacity_male.value) || 0,
      capacity_female: Number(form.capacity_female.value) || 0,
      price: form.price.value ? Number(form.price.value) : null,
      starts_at: form.starts_at.value || null,
      status: form.status.value,
    };

    if (!payload.title) {
      msg.textContent = '제목을 입력해주세요.';
      msg.className = 'form-msg error';
      return;
    }

    try {
      let saved;
      if (journey && journey.id) {
        ({ journey: saved } = await apiFetch(`/admin/journeys/${journey.id}`, { method: 'PUT', body: payload }));
      } else {
        ({ journey: saved } = await apiFetch('/admin/journeys', { method: 'POST', body: payload }));
      }

      const imageFile = form.image.files[0];
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        const session = getSession();
        const res = await fetch(`/api/admin/journeys/${saved.id}/image`, {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '이미지 업로드에 실패했습니다.');
        saved = data.journey;
      }

      msg.textContent = '저장되었습니다.';
      msg.className = 'form-msg success';
      wrap.innerHTML = '';
      await loadJourneys();

      editingJourneyId = saved.id;
      editingItinerary = Array.isArray(saved.itinerary) ? JSON.parse(JSON.stringify(saved.itinerary)) : [];
      renderItineraryEditor();
      document.getElementById('itinerary-editor').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
}

document.getElementById('journey-new-btn').addEventListener('click', () => {
  bindJourneyForm(null);
  document.getElementById('journey-form-panel').scrollIntoView({ behavior: 'smooth' });
});

async function loadJourneys() {
  const wrap = document.getElementById('journeys-content');
  wrap.innerHTML = '<div class="empty-state">불러오는 중…</div>';
  try {
    const { journeys } = await apiFetch('/admin/journeys');
    journeysCache = journeys;

    if (!journeys.length) {
      wrap.innerHTML = '<div class="empty-state">등록된 여행이 없습니다.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="journey-admin-list">
        ${journeys.map((j) => {
          const dayCount = Array.isArray(j.itinerary) ? j.itinerary.length : 0;
          const itinLabel = dayCount ? `${dayCount}일 일정 등록됨` : '일정 미등록';
          const dateLabel = j.starts_at ? new Date(j.starts_at).toLocaleDateString('ko-KR') : '출발일 미정';
          return `
            <div class="journey-admin-row">
              <div>
                <h4>${esc(j.title)} <span class="badge ${j.status === 'open' ? 'approved' : j.status === 'closed' ? 'rejected' : ''}">${JOURNEY_STATUS_LABEL[j.status] || j.status}</span></h4>
                <p>${JOURNEY_TYPE_LABEL[j.type] || esc(j.type)} · ${esc(j.duration || '-')} · ${dateLabel}</p>
                <span class="itin-status ${dayCount ? 'has-itin' : ''}">${itinLabel}</span>
              </div>
              <div class="admin-actions">
                <button type="button" class="btn-outline" data-edit-journey="${j.id}">수정</button>
                <button type="button" class="btn-outline" data-edit-itinerary="${j.id}">일정 편집</button>
                <button type="button" class="reject" data-delete-journey="${j.id}">삭제</button>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    wrap.querySelectorAll('[data-edit-journey]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const journey = journeysCache.find((j) => j.id === btn.dataset.editJourney);
        if (!journey) return;
        bindJourneyForm(journey);
        document.getElementById('journey-form-panel').scrollIntoView({ behavior: 'smooth' });
      });
    });

    wrap.querySelectorAll('[data-delete-journey]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 여행을 삭제하시겠습니까?')) return;
        btn.disabled = true;
        try {
          await apiFetch(`/admin/journeys/${btn.dataset.deleteJourney}`, { method: 'DELETE' });
          await loadJourneys();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });

    wrap.querySelectorAll('[data-edit-itinerary]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const journey = journeysCache.find((j) => j.id === btn.dataset.editItinerary);
        if (!journey) return;
        editingJourneyId = journey.id;
        editingItinerary = Array.isArray(journey.itinerary) ? JSON.parse(JSON.stringify(journey.itinerary)) : [];
        renderItineraryEditor();
        document.getElementById('itinerary-editor').scrollIntoView({ behavior: 'smooth' });
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

function renderItineraryEditor() {
  const wrap = document.getElementById('itinerary-editor');
  if (!editingJourneyId) {
    wrap.innerHTML = '';
    return;
  }

  const journey = journeysCache.find((j) => j.id === editingJourneyId);
  const title = journey ? journey.title : '';

  const daysHtml = editingItinerary.map((day, di) => {
    const itemsHtml = day.items.map((item, ii) => `
      <div class="itin-item-row">
        <input type="text" class="itin-time" data-day="${di}" data-item="${ii}" value="${esc(item.time)}" placeholder="14:00">
        <input type="text" class="itin-title" data-day="${di}" data-item="${ii}" value="${esc(item.title)}" placeholder="일정 제목">
        <textarea class="itin-desc" data-day="${di}" data-item="${ii}" placeholder="설명 (선택)">${esc(item.desc)}</textarea>
        <button type="button" class="itin-remove-item" data-day="${di}" data-item="${ii}">삭제</button>
      </div>`).join('');

    return `
      <div class="itin-day-card">
        <div class="itin-day-head">
          <input type="text" class="itin-day-label" data-day="${di}" value="${esc(day.date_label)}" placeholder="Day ${day.day}">
          <button type="button" class="itin-remove-day" data-day="${di}">일차 삭제</button>
        </div>
        <div class="itin-items">${itemsHtml || '<div class="empty-state" style="padding:16px 0">등록된 일정이 없습니다.</div>'}</div>
        <button type="button" class="itin-add-item" data-day="${di}">+ 항목 추가</button>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="itin-editor-panel">
      <div class="itin-editor-head">
        <h3>${esc(title)} — 일정표 편집</h3>
        <button type="button" id="itin-close-btn" class="link-btn">닫기</button>
      </div>
      ${daysHtml || '<div class="empty-state">등록된 일차가 없습니다.</div>'}
      <button type="button" id="itin-add-day-btn" class="itin-add-item">+ Day 추가</button>
      <div class="itin-editor-actions">
        <button type="button" id="itin-save-btn" class="btn-outline">저장</button>
        <span class="form-msg" id="itin-msg"></span>
      </div>
    </div>`;

  wrap.querySelectorAll('.itin-day-label').forEach((input) => {
    input.addEventListener('input', (e) => {
      editingItinerary[Number(input.dataset.day)].date_label = e.target.value;
    });
  });
  wrap.querySelectorAll('.itin-remove-day').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingItinerary.splice(Number(btn.dataset.day), 1);
      renderItineraryEditor();
    });
  });
  wrap.querySelectorAll('.itin-add-item[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingItinerary[Number(btn.dataset.day)].items.push(emptyItem());
      renderItineraryEditor();
    });
  });
  wrap.querySelectorAll('.itin-remove-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingItinerary[Number(btn.dataset.day)].items.splice(Number(btn.dataset.item), 1);
      renderItineraryEditor();
    });
  });
  wrap.querySelectorAll('.itin-time').forEach((input) => {
    input.addEventListener('input', (e) => {
      editingItinerary[Number(input.dataset.day)].items[Number(input.dataset.item)].time = e.target.value;
    });
  });
  wrap.querySelectorAll('.itin-title').forEach((input) => {
    input.addEventListener('input', (e) => {
      editingItinerary[Number(input.dataset.day)].items[Number(input.dataset.item)].title = e.target.value;
    });
  });
  wrap.querySelectorAll('.itin-desc').forEach((input) => {
    input.addEventListener('input', (e) => {
      editingItinerary[Number(input.dataset.day)].items[Number(input.dataset.item)].desc = e.target.value;
    });
  });

  document.getElementById('itin-add-day-btn').addEventListener('click', () => {
    editingItinerary.push(emptyDay(editingItinerary.length + 1));
    renderItineraryEditor();
  });
  document.getElementById('itin-close-btn').addEventListener('click', () => {
    editingJourneyId = null;
    editingItinerary = [];
    renderItineraryEditor();
  });
  document.getElementById('itin-save-btn').addEventListener('click', async () => {
    const msg = document.getElementById('itin-msg');
    msg.textContent = '';
    msg.className = 'form-msg';
    try {
      await apiFetch(`/admin/journeys/${editingJourneyId}`, { method: 'PUT', body: { itinerary: editingItinerary } });
      msg.textContent = '저장되었습니다.';
      msg.className = 'form-msg success';
      await loadJourneys();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
}

let storyQuotesCache = [];
let storyReviewsCache = [];
let storyQuotesLoaded = false;
let storyReviewsLoaded = false;

function storyQuoteFormHtml(q) {
  const quote = q || {};
  const isEdit = Boolean(quote.id);
  return `
    <div class="itin-editor-panel" id="story-quote-form-panel">
      <div class="itin-editor-head">
        <h3>${isEdit ? '카드 수정' : '새 카드 추가'}</h3>
        <button type="button" id="story-quote-form-close" class="link-btn">닫기</button>
      </div>
      <form id="story-quote-form">
        <div class="field">
          <label>태그</label>
          <input type="text" name="tag" value="${esc(quote.tag || 'Editorial')}" placeholder="Editorial / Journal / Guide">
        </div>
        <div class="field">
          <label>제목</label>
          <input type="text" name="title" required value="${esc(quote.title || '')}">
        </div>
        <div class="field">
          <label>본문</label>
          <textarea name="body" required>${esc(quote.body || '')}</textarea>
        </div>
        <div class="field">
          <label>사진</label>
          ${quote.image_url ? `<img src="${esc(quote.image_url)}" alt="" style="width:120px;height:80px;object-fit:cover;display:block;margin-bottom:8px">` : ''}
          <input type="file" name="image" accept="image/*">
        </div>
        <div class="itin-editor-actions">
          <button type="submit" class="btn-outline">저장</button>
          <span class="form-msg" id="story-quote-form-msg"></span>
        </div>
      </form>
    </div>`;
}

function bindStoryQuoteForm(quote) {
  const wrap = document.getElementById('story-quote-form-wrap');
  wrap.innerHTML = storyQuoteFormHtml(quote);
  const form = document.getElementById('story-quote-form');
  const msg = document.getElementById('story-quote-form-msg');

  document.getElementById('story-quote-form-close').addEventListener('click', () => { wrap.innerHTML = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-msg';

    const payload = {
      tag: form.tag.value.trim() || 'Editorial',
      title: form.title.value.trim(),
      body: form.body.value.trim(),
    };
    if (!payload.title || !payload.body) {
      msg.textContent = '제목과 본문을 입력해주세요.';
      msg.className = 'form-msg error';
      return;
    }

    try {
      let saved;
      if (quote && quote.id) {
        ({ quote: saved } = await apiFetch(`/admin/story-quotes/${quote.id}`, { method: 'PUT', body: payload }));
      } else {
        ({ quote: saved } = await apiFetch('/admin/story-quotes', { method: 'POST', body: payload }));
      }

      const imageFile = form.image.files[0];
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        const session = getSession();
        const res = await fetch(`/api/admin/story-quotes/${saved.id}/image`, {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '이미지 업로드에 실패했습니다.');
        saved = data.quote;
      }

      msg.textContent = '저장되었습니다.';
      msg.className = 'form-msg success';
      wrap.innerHTML = '';
      await loadStoryQuotesAdmin();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
}

document.getElementById('story-quote-new-btn').addEventListener('click', () => {
  bindStoryQuoteForm(null);
  document.getElementById('story-quote-form-panel').scrollIntoView({ behavior: 'smooth' });
});

async function loadStoryQuotesAdmin() {
  const wrap = document.getElementById('story-quotes-content');
  wrap.innerHTML = '<div class="empty-state">불러오는 중…</div>';
  try {
    const { quotes } = await apiFetch('/admin/story-quotes');
    storyQuotesCache = quotes;

    if (!quotes.length) {
      wrap.innerHTML = '<div class="empty-state">등록된 카드가 없습니다.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="journey-admin-list">
        ${quotes.map((q) => `
          <div class="journey-admin-row">
            ${q.image_url ? `<img src="${esc(q.image_url)}" alt="" style="width:80px;height:56px;object-fit:cover;margin-right:14px">` : ''}
            <div>
              <h4>${esc(q.title)} <span class="badge">${esc(q.tag)}</span></h4>
              <p>${esc((q.body || '').slice(0, 60))}${(q.body || '').length > 60 ? '…' : ''}</p>
            </div>
            <div class="admin-actions">
              <button type="button" class="btn-outline" data-edit-quote="${q.id}">수정</button>
              <button type="button" class="reject" data-delete-quote="${q.id}">삭제</button>
            </div>
          </div>`).join('')}
      </div>`;

    wrap.querySelectorAll('[data-edit-quote]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const quote = storyQuotesCache.find((q) => q.id === btn.dataset.editQuote);
        if (!quote) return;
        bindStoryQuoteForm(quote);
        document.getElementById('story-quote-form-panel').scrollIntoView({ behavior: 'smooth' });
      });
    });

    wrap.querySelectorAll('[data-delete-quote]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 카드를 삭제하시겠습니까?')) return;
        btn.disabled = true;
        try {
          await apiFetch(`/admin/story-quotes/${btn.dataset.deleteQuote}`, { method: 'DELETE' });
          await loadStoryQuotesAdmin();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

function storyReviewFormHtml(r) {
  const review = r || {};
  const isEdit = Boolean(review.id);
  return `
    <div class="itin-editor-panel" id="story-review-form-panel">
      <div class="itin-editor-head">
        <h3>${isEdit ? '후기 수정' : '새 후기 추가'}</h3>
        <button type="button" id="story-review-form-close" class="link-btn">닫기</button>
      </div>
      <form id="story-review-form">
        <div class="field-row">
          <div class="field">
            <label>날짜 라벨</label>
            <input type="text" name="review_date" value="${esc(review.review_date || 'Coming Soon')}" placeholder="예: 2026.03 또는 Coming Soon">
          </div>
          <div class="field">
            <label>프로그램명</label>
            <input type="text" name="program" required value="${esc(review.program || '')}">
          </div>
        </div>
        <div class="field">
          <label>후기 내용</label>
          <textarea name="review_text" required>${esc(review.review_text || '')}</textarea>
        </div>
        <div class="field">
          <label>사진</label>
          ${review.image_url ? `<img src="${esc(review.image_url)}" alt="" style="width:120px;height:80px;object-fit:cover;display:block;margin-bottom:8px">` : ''}
          <input type="file" name="image" accept="image/*">
        </div>
        <div class="itin-editor-actions">
          <button type="submit" class="btn-outline">저장</button>
          <span class="form-msg" id="story-review-form-msg"></span>
        </div>
      </form>
    </div>`;
}

function bindStoryReviewForm(review) {
  const wrap = document.getElementById('story-review-form-wrap');
  wrap.innerHTML = storyReviewFormHtml(review);
  const form = document.getElementById('story-review-form');
  const msg = document.getElementById('story-review-form-msg');

  document.getElementById('story-review-form-close').addEventListener('click', () => { wrap.innerHTML = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-msg';

    const payload = {
      review_date: form.review_date.value.trim() || 'Coming Soon',
      program: form.program.value.trim(),
      review_text: form.review_text.value.trim(),
    };
    if (!payload.program || !payload.review_text) {
      msg.textContent = '프로그램명과 후기 내용을 입력해주세요.';
      msg.className = 'form-msg error';
      return;
    }

    try {
      let saved;
      if (review && review.id) {
        ({ review: saved } = await apiFetch(`/admin/story-reviews/${review.id}`, { method: 'PUT', body: payload }));
      } else {
        ({ review: saved } = await apiFetch('/admin/story-reviews', { method: 'POST', body: payload }));
      }

      const imageFile = form.image.files[0];
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        const session = getSession();
        const res = await fetch(`/api/admin/story-reviews/${saved.id}/image`, {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '이미지 업로드에 실패했습니다.');
        saved = data.review;
      }

      msg.textContent = '저장되었습니다.';
      msg.className = 'form-msg success';
      wrap.innerHTML = '';
      await loadStoryReviewsAdmin();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
}

document.getElementById('story-review-new-btn').addEventListener('click', () => {
  bindStoryReviewForm(null);
  document.getElementById('story-review-form-panel').scrollIntoView({ behavior: 'smooth' });
});

async function loadStoryReviewsAdmin() {
  const wrap = document.getElementById('story-reviews-content');
  wrap.innerHTML = '<div class="empty-state">불러오는 중…</div>';
  try {
    const { reviews } = await apiFetch('/admin/story-reviews');
    storyReviewsCache = reviews;

    if (!reviews.length) {
      wrap.innerHTML = '<div class="empty-state">등록된 후기가 없습니다.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="journey-admin-list">
        ${reviews.map((r) => `
          <div class="journey-admin-row">
            ${r.image_url ? `<img src="${esc(r.image_url)}" alt="" style="width:80px;height:56px;object-fit:cover;margin-right:14px">` : ''}
            <div>
              <h4>${esc(r.program)} <span class="badge">${esc(r.review_date)}</span></h4>
              <p>${esc((r.review_text || '').slice(0, 60))}${(r.review_text || '').length > 60 ? '…' : ''}</p>
            </div>
            <div class="admin-actions">
              <button type="button" class="btn-outline" data-edit-review="${r.id}">수정</button>
              <button type="button" class="reject" data-delete-review="${r.id}">삭제</button>
            </div>
          </div>`).join('')}
      </div>`;

    wrap.querySelectorAll('[data-edit-review]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const review = storyReviewsCache.find((r) => r.id === btn.dataset.editReview);
        if (!review) return;
        bindStoryReviewForm(review);
        document.getElementById('story-review-form-panel').scrollIntoView({ behavior: 'smooth' });
      });
    });

    wrap.querySelectorAll('[data-delete-review]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 후기를 삭제하시겠습니까?')) return;
        btn.disabled = true;
        try {
          await apiFetch(`/admin/story-reviews/${btn.dataset.deleteReview}`, { method: 'DELETE' });
          await loadStoryReviewsAdmin();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

document.getElementById('story-sub-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-story-tab]');
  if (!btn) return;
  document.querySelectorAll('#story-sub-tabs button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('story-quotes-panel').style.display = btn.dataset.storyTab === 'quotes' ? '' : 'none';
  document.getElementById('story-reviews-panel').style.display = btn.dataset.storyTab === 'reviews' ? '' : 'none';
  if (btn.dataset.storyTab === 'reviews' && !storyReviewsLoaded) {
    storyReviewsLoaded = true;
    loadStoryReviewsAdmin();
  }
});

const VERIFICATION_STATUS_LABEL = { pending: '검토중', verified: '인증완료', rejected: '거절됨' };
const ROLE_LABEL = { user: 'USER', admin: 'ADMIN', super_admin: '최고관리자' };
let currentMemberVerification = '';
let currentMemberQuery = '';

function ageFromBirthYear(birthYear) {
  if (!birthYear) return null;
  return new Date().getFullYear() - Number(birthYear);
}

async function loadMembers() {
  const wrap = document.getElementById('members-content');
  wrap.innerHTML = '<div class="empty-state">불러오는 중…</div>';
  try {
    const params = new URLSearchParams();
    if (currentMemberVerification) params.set('verification', currentMemberVerification);
    if (currentMemberQuery) params.set('q', currentMemberQuery);
    const query = params.toString() ? `?${params.toString()}` : '';
    const { members } = await apiFetch(`/admin/members${query}`);

    if (!members.length) {
      wrap.innerHTML = '<div class="empty-state">회원이 없습니다.</div>';
      return;
    }

    const rows = members.map((m) => {
      const genderLabel = m.gender === 'male' ? '남' : m.gender === 'female' ? '여' : '-';
      const age = ageFromBirthYear(m.birth_year);
      return `
        <tr>
          <td>${esc(m.full_name || '—')}<br><span style="color:var(--muted)">${esc(m.username || '—')} · ${genderLabel}${age ? ' · ' + age + '세' : ''}</span></td>
          <td>${esc(m.phone || '—')}</td>
          <td>
            <select data-verification-select="${m.id}">
              ${['pending', 'verified', 'rejected'].map((s) => `<option value="${s}" ${m.verification_status === s ? 'selected' : ''}>${VERIFICATION_STATUS_LABEL[s]}</option>`).join('')}
            </select>
          </td>
          <td>${new Date(m.created_at).toLocaleDateString('ko-KR')}</td>
          <td>
            <span class="badge ${m.role === 'user' ? '' : 'approved'}">${ROLE_LABEL[m.role] || m.role}</span>
          </td>
          <td>
            <button type="button" class="link-btn admin-detail-toggle" data-detail-id="member-${m.id}">상세보기 ▾</button>
          </td>
        </tr>
        <tr class="admin-detail-row" id="detail-member-${m.id}" style="display:none">
          <td colspan="6">${renderApplicantDetail(m)}</td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Verification</th><th>Joined</th><th>Role</th><th>Actions</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    wrap.querySelectorAll('[data-verification-select]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        sel.disabled = true;
        try {
          await apiFetch(`/admin/verification/${sel.dataset.verificationSelect}`, {
            method: 'PATCH',
            body: { verification_status: sel.value },
          });
        } catch (err) {
          alert(err.message);
        } finally {
          sel.disabled = false;
        }
      });
    });

    wrap.querySelectorAll('.admin-detail-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = document.getElementById(`detail-${btn.dataset.detailId}`);
        const isOpen = row.style.display !== 'none';
        row.style.display = isOpen ? 'none' : 'table-row';
        btn.textContent = isOpen ? '상세보기 ▾' : '접기 ▴';
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

document.getElementById('member-status-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-verification]');
  if (!btn) return;
  document.querySelectorAll('#member-status-tabs button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentMemberVerification = btn.dataset.verification;
  loadMembers();
});

let memberSearchTimer = null;
document.getElementById('member-search').addEventListener('input', (e) => {
  clearTimeout(memberSearchTimer);
  memberSearchTimer = setTimeout(() => {
    currentMemberQuery = e.target.value.trim();
    loadMembers();
  }, 300);
});

let matchingJourneys = [];
let currentMatchingJourneyId = null;

async function loadMatchingJourneyOptions() {
  const select = document.getElementById('matching-journey-select');
  try {
    const { journeys } = await apiFetch('/admin/journeys');
    matchingJourneys = journeys.filter((j) => ['open', 'coming_soon'].includes(j.status));

    if (!matchingJourneys.length) {
      select.innerHTML = '<option value="">열려있는 여행이 없습니다</option>';
      document.getElementById('matching-content').innerHTML = '';
      return;
    }

    select.innerHTML = matchingJourneys.map((j) => `<option value="${j.id}">${esc(j.title)}</option>`).join('');
    currentMatchingJourneyId = matchingJourneys[0].id;
    select.value = currentMatchingJourneyId;
    await loadMatchingRoster();
  } catch (err) {
    select.innerHTML = '<option value="">불러오기 실패</option>';
  }
}

document.getElementById('matching-journey-select').addEventListener('change', (e) => {
  currentMatchingJourneyId = e.target.value;
  loadMatchingRoster();
});

function matchingCardHtml(app) {
  const p = app.profile || {};
  const age = ageFromBirthYear(p.birth_year);
  return `
    <div class="matching-card-wrap">
      <label class="matching-card">
        <input type="checkbox" data-app-id="${app.id}" data-gender="${p.gender || ''}">
        <span>${esc(p.full_name || '—')}${age ? ' · ' + age + '세' : ''}</span>
        <span class="badge ${p.verification_status}">${VERIFICATION_STATUS_LABEL[p.verification_status] || p.verification_status}</span>
      </label>
      <button type="button" class="link-btn admin-detail-toggle" data-detail-id="match-${app.id}">상세보기 ▾</button>
      <div class="matching-card-detail" id="detail-match-${app.id}" style="display:none">${renderApplicantDetail(p)}</div>
    </div>`;
}

async function loadMatchingRoster() {
  const wrap = document.getElementById('matching-content');
  if (!currentMatchingJourneyId) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<div class="empty-state">불러오는 중…</div>';

  try {
    const { journey, groups, unassigned } = await apiFetch(`/admin/journeys/${currentMatchingJourneyId}/roster`);

    const groupsHtml = groups.map((g) => {
      const maleCount = g.members.filter((m) => m.profile?.gender === 'male').length;
      const femaleCount = g.members.filter((m) => m.profile?.gender === 'female').length;
      return `
        <div class="matching-group">
          <div class="matching-group-head">
            <h4>${esc(g.name)} <span style="color:var(--muted);font-size:12px">(승인 남 ${maleCount}/${journey.capacity_male} · 여 ${femaleCount}/${journey.capacity_female})</span></h4>
            <button type="button" class="link-btn" data-delete-group="${g.id}">팀 해체</button>
          </div>
          <div class="matching-group-members">
            ${g.members.map((m) => {
              const p = m.profile || {};
              const age = ageFromBirthYear(p.birth_year);
              return `<span class="matching-chip">${esc(p.full_name || '—')}${age ? ' · ' + age + '세' : ''} <button type="button" data-remove-member="${m.id}" data-group-id="${g.id}">×</button></span>`;
            }).join('') || '<span style="color:var(--muted);font-size:13px">팀원 없음</span>'}
          </div>
        </div>`;
    }).join('') || '<div class="empty-state">아직 만들어진 팀이 없습니다.</div>';

    wrap.innerHTML = `
      <p class="section-label" style="margin:24px 0 12px">확정된 팀</p>
      ${groupsHtml}
      <p class="section-label" style="margin:32px 0 12px">대기 명단 (정원: 남 ${journey.capacity_male} · 여 ${journey.capacity_female})</p>
      <div class="matching-pool-grid">
        <div>
          <h4>남성 신청자 (${unassigned.male.length})</h4>
          <div id="pool-male">${unassigned.male.map(matchingCardHtml).join('') || '<div class="empty-state">없음</div>'}</div>
        </div>
        <div>
          <h4>여성 신청자 (${unassigned.female.length})</h4>
          <div id="pool-female">${unassigned.female.map(matchingCardHtml).join('') || '<div class="empty-state">없음</div>'}</div>
        </div>
      </div>
      <div class="itin-editor-actions" style="flex-wrap:wrap">
        <button type="button" id="matching-create-team-btn" class="btn-outline">체크한 인원으로 새 팀 만들기</button>
        <span style="color:var(--muted);font-size:12px">또는</span>
        <select id="matching-add-to-group-select">
          <option value="">추가할 기존 팀 선택</option>
          ${groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
        </select>
        <button type="button" id="matching-add-to-team-btn" class="btn-outline" ${groups.length ? '' : 'disabled'}>체크한 인원을 선택한 팀에 추가</button>
        <span class="form-msg" id="matching-msg"></span>
        <span style="font-size:12px;color:var(--muted)" id="matching-capacity-note"></span>
      </div>`;

    const msg = document.getElementById('matching-msg');

    function getCheckedIds() {
      return [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.dataset.appId);
    }

    function enforceCapacity() {
      ['male', 'female'].forEach((gender) => {
        const capacity = gender === 'male' ? journey.capacity_male : journey.capacity_female;
        const boxes = [...wrap.querySelectorAll(`input[type="checkbox"][data-gender="${gender}"]`)];
        const checkedCount = boxes.filter((b) => b.checked).length;
        const atCapacity = checkedCount >= capacity;
        boxes.forEach((b) => { if (!b.checked) b.disabled = atCapacity; });
      });

      const maleChecked = wrap.querySelectorAll('input[data-gender="male"]:checked').length;
      const femaleChecked = wrap.querySelectorAll('input[data-gender="female"]:checked').length;
      const notes = [];
      if (maleChecked >= journey.capacity_male) notes.push(`남 정원(${journey.capacity_male}명)까지 선택했습니다`);
      if (femaleChecked >= journey.capacity_female) notes.push(`여 정원(${journey.capacity_female}명)까지 선택했습니다`);
      document.getElementById('matching-capacity-note').textContent = notes.join(' · ');
    }

    wrap.querySelectorAll('input[type="checkbox"][data-app-id]').forEach((box) => {
      box.addEventListener('change', enforceCapacity);
    });
    enforceCapacity();

    wrap.querySelectorAll('.admin-detail-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const panel = document.getElementById(`detail-${btn.dataset.detailId}`);
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';
        btn.textContent = isOpen ? '상세보기 ▾' : '접기 ▴';
      });
    });

    document.getElementById('matching-create-team-btn').addEventListener('click', async () => {
      const ids = getCheckedIds();
      if (!ids.length) { msg.textContent = '팀에 포함할 신청자를 선택해주세요.'; msg.className = 'form-msg error'; return; }
      try {
        await apiFetch(`/admin/journeys/${currentMatchingJourneyId}/groups`, { method: 'POST', body: { application_ids: ids } });
        await loadMatchingRoster();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = 'form-msg error';
      }
    });

    document.getElementById('matching-add-to-team-btn').addEventListener('click', async () => {
      const groupId = document.getElementById('matching-add-to-group-select').value;
      const ids = getCheckedIds();
      if (!groupId) { msg.textContent = '추가할 팀을 선택해주세요.'; msg.className = 'form-msg error'; return; }
      if (!ids.length) { msg.textContent = '추가할 인원을 선택해주세요.'; msg.className = 'form-msg error'; return; }
      try {
        await apiFetch(`/admin/groups/${groupId}`, { method: 'PATCH', body: { add_ids: ids } });
        await loadMatchingRoster();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = 'form-msg error';
      }
    });

    wrap.querySelectorAll('[data-remove-member]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await apiFetch(`/admin/groups/${btn.dataset.groupId}`, { method: 'PATCH', body: { remove_ids: [btn.dataset.removeMember] } });
          await loadMatchingRoster();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });

    wrap.querySelectorAll('[data-delete-group]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 팀을 해체하시겠습니까? 팀원은 대기 명단으로 돌아갑니다.')) return;
        btn.disabled = true;
        try {
          await apiFetch(`/admin/groups/${btn.dataset.deleteGroup}`, { method: 'DELETE' });
          await loadMatchingRoster();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

async function loadRevenue() {
  const wrap = document.getElementById('revenue-content');
  wrap.innerHTML = '<div class="empty-state">불러오는 중…</div>';
  try {
    const params = new URLSearchParams();
    const q = document.getElementById('revenue-search').value.trim();
    const from = document.getElementById('revenue-from').value;
    const to = document.getElementById('revenue-to').value;
    if (q) params.set('q', q);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString() ? `?${params.toString()}` : '';

    const { summary, by_journey: byJourney, transactions } = await apiFetch(`/admin/revenue${query}`);

    const statRow = `
      <div class="revenue-stats">
        <div class="revenue-stat"><span class="revenue-stat-label">총 결제액</span><span class="revenue-stat-value">${summary.total_paid.toLocaleString('ko-KR')}원</span></div>
        <div class="revenue-stat"><span class="revenue-stat-label">총 환불액</span><span class="revenue-stat-value">${summary.total_refunded.toLocaleString('ko-KR')}원</span></div>
        <div class="revenue-stat"><span class="revenue-stat-label">순매출</span><span class="revenue-stat-value">${summary.net_revenue.toLocaleString('ko-KR')}원</span></div>
      </div>`;

    const byJourneyHtml = byJourney.length
      ? `<table class="admin-table"><thead><tr><th>Journey</th><th>결제 건수</th><th>금액</th></tr></thead><tbody>
          ${byJourney.map((j) => `<tr><td>${esc(j.title)}</td><td>${j.count}</td><td>${j.amount.toLocaleString('ko-KR')}원</td></tr>`).join('')}
        </tbody></table>`
      : '<div class="empty-state">아직 결제 데이터가 없습니다. 토스페이먼츠 연동 후 이 화면에 매출이 표시됩니다.</div>';

    const txHtml = transactions.length
      ? `<table class="admin-table"><thead><tr><th>결제일</th><th>이름</th><th>전화번호</th><th>Journey</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          ${transactions.map((t) => `<tr>
            <td>${new Date(t.created_at).toLocaleDateString('ko-KR')}</td>
            <td>${esc(t.profile?.full_name || '—')}</td>
            <td>${esc(t.profile?.phone || '—')}</td>
            <td>${esc(t.journey?.title || '—')}</td>
            <td>${t.amount.toLocaleString('ko-KR')}원</td>
            <td><span class="badge ${t.status === 'paid' ? 'approved' : 'rejected'}">${t.status === 'paid' ? '결제완료' : '환불됨'}</span></td>
          </tr>`).join('')}
        </tbody></table>`
      : (q || from || to) ? '<div class="empty-state">검색 결과가 없습니다.</div>' : '';

    wrap.innerHTML = `
      ${statRow}
      <p class="section-label" style="margin:28px 0 12px">여행별 매출</p>
      ${byJourneyHtml}
      <p class="section-label" style="margin:28px 0 12px">결제 내역${(q || from || to) ? ` (검색 결과 ${transactions.length}건)` : ''}</p>
      ${txHtml || '<div class="empty-state">결제 내역이 없습니다.</div>'}
    `;
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

let revenueSearchTimer = null;
['revenue-search', 'revenue-from', 'revenue-to'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    clearTimeout(revenueSearchTimer);
    revenueSearchTimer = setTimeout(loadRevenue, 300);
  });
});

function permissionFormHtml() {
  return `
    <div class="itin-editor-panel" id="permission-form-panel">
      <div class="itin-editor-head">
        <h3>관리자 계정 추가</h3>
        <button type="button" id="permission-form-close" class="link-btn">닫기</button>
      </div>
      <form id="permission-form">
        <div class="field">
          <label>이메일 (로그인용)</label>
          <input type="email" name="email" required>
        </div>
        <div class="field">
          <label>아이디</label>
          <input type="text" name="username" required>
        </div>
        <div class="field">
          <label>비밀번호</label>
          <input type="password" name="password" minlength="8" required>
        </div>
        <div class="field">
          <label>이름</label>
          <input type="text" name="full_name" required>
        </div>
        <div class="itin-editor-actions">
          <button type="submit" class="btn-outline">추가</button>
          <span class="form-msg" id="permission-form-msg"></span>
        </div>
      </form>
    </div>`;
}

document.getElementById('permission-new-btn').addEventListener('click', () => {
  const wrap = document.getElementById('permission-form-wrap');
  wrap.innerHTML = permissionFormHtml();
  const form = document.getElementById('permission-form');
  const msg = document.getElementById('permission-form-msg');

  document.getElementById('permission-form-close').addEventListener('click', () => { wrap.innerHTML = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-msg';
    try {
      await apiFetch('/admin/permissions/admins', {
        method: 'POST',
        body: {
          email: form.email.value.trim(),
          username: form.username.value.trim(),
          password: form.password.value,
          full_name: form.full_name.value.trim(),
        },
      });
      wrap.innerHTML = '';
      await loadPermissions();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });
});

async function loadPermissions() {
  const wrap = document.getElementById('permissions-content');
  wrap.innerHTML = '<div class="empty-state">불러오는 중…</div>';
  try {
    const { admins } = await apiFetch('/admin/permissions/admins');

    if (!admins.length) {
      wrap.innerHTML = '<div class="empty-state">등록된 관리자가 없습니다.</div>';
      return;
    }

    const rows = admins.map((a) => `
      <tr>
        <td>${esc(a.full_name || '—')}<br><span style="color:var(--muted)">${esc(a.username || '—')}</span></td>
        <td>${esc(a.email || '—')}</td>
        <td><span class="badge ${a.role === 'super_admin' ? 'approved' : ''}">${ROLE_LABEL[a.role] || a.role}</span></td>
        <td>${new Date(a.created_at).toLocaleDateString('ko-KR')}</td>
        <td>${a.role === 'super_admin' ? '' : `<button type="button" class="link-btn" data-revoke-admin="${a.id}">권한 해제</button>`}</td>
      </tr>`).join('');

    wrap.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    wrap.querySelectorAll('[data-revoke-admin]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 관리자의 권한을 해제하시겠습니까?')) return;
        btn.disabled = true;
        try {
          await apiFetch(`/admin/permissions/admins/${btn.dataset.revokeAdmin}/revoke`, { method: 'PATCH' });
          await loadPermissions();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

const adminSectionTabs = document.querySelectorAll('#admin-section-tabs button');
const adminPanels = {
  applications: document.getElementById('panel-applications'),
  journeys: document.getElementById('panel-journeys'),
  story: document.getElementById('panel-story'),
  members: document.getElementById('panel-members'),
  matching: document.getElementById('panel-matching'),
  revenue: document.getElementById('panel-revenue'),
  permissions: document.getElementById('panel-permissions'),
};
const ADMIN_TITLE_LABEL = { applications: 'Applications', journeys: 'Journeys', story: 'Story', members: 'Members', matching: 'Matching', revenue: 'Revenue', permissions: 'Permissions' };

let membersLoaded = false;
let matchingLoaded = false;
let revenueLoaded = false;
let permissionsLoaded = false;

(async function initRole() {
  try {
    const { profile } = await apiFetch('/auth/me');
    if (profile?.role === 'super_admin') {
      document.getElementById('permissions-tab-btn').style.display = '';
    }
  } catch {
    // ignore — tab just stays hidden
  }
})();

adminSectionTabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    adminSectionTabs.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(adminPanels).forEach((p) => p.classList.remove('active'));
    adminPanels[btn.dataset.section].classList.add('active');
    document.getElementById('admin-title').textContent = ADMIN_TITLE_LABEL[btn.dataset.section] || 'Applications';

    if (btn.dataset.section === 'journeys' && !journeysLoaded) {
      journeysLoaded = true;
      loadJourneys();
    }
    if (btn.dataset.section === 'story' && !storyQuotesLoaded) {
      storyQuotesLoaded = true;
      loadStoryQuotesAdmin();
    }
    if (btn.dataset.section === 'members' && !membersLoaded) {
      membersLoaded = true;
      loadMembers();
    }
    if (btn.dataset.section === 'matching' && !matchingLoaded) {
      matchingLoaded = true;
      loadMatchingJourneyOptions();
    }
    if (btn.dataset.section === 'revenue' && !revenueLoaded) {
      revenueLoaded = true;
      loadRevenue();
    }
    if (btn.dataset.section === 'permissions' && !permissionsLoaded) {
      permissionsLoaded = true;
      loadPermissions();
    }
  });
});

statusTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-status]');
  if (!btn) return;
  statusTabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentStatus = btn.dataset.status;
  loadApplications();
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

loadApplications();
