if (!requireLoginOrRedirect()) {
  // redirected to login
}

const adminContent = document.getElementById('admin-content');
const statusTabs = document.getElementById('status-tabs');
const logoutLink = document.getElementById('logout-link');

const STATUS_LABEL = { pending: '검토 중', approved: '승인됨', rejected: '거절됨', cancelled: '취소됨' };
let currentStatus = '';

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
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
          <td>${actions}</td>
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
  } catch (err) {
    adminContent.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

let journeysCache = [];
let journeysLoaded = false;
let editingJourneyId = null;
let editingItinerary = [];

function emptyDay(dayNum) {
  return { day: dayNum, date_label: `Day ${dayNum}`, items: [] };
}

function emptyItem() {
  return { time: '', title: '', desc: '' };
}

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
                <h4>${esc(j.title)}</h4>
                <p>${esc(j.type)} · ${esc(j.duration || '-')} · ${dateLabel}</p>
                <span class="itin-status ${dayCount ? 'has-itin' : ''}">${itinLabel}</span>
              </div>
              <button type="button" class="btn-outline" data-edit-itinerary="${j.id}">일정 편집</button>
            </div>`;
        }).join('')}
      </div>`;

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

const adminSectionTabs = document.querySelectorAll('#admin-section-tabs button');
const adminPanels = {
  applications: document.getElementById('panel-applications'),
  journeys: document.getElementById('panel-journeys'),
};

adminSectionTabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    adminSectionTabs.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(adminPanels).forEach((p) => p.classList.remove('active'));
    adminPanels[btn.dataset.section].classList.add('active');
    document.getElementById('admin-title').textContent = btn.dataset.section === 'journeys' ? 'Journeys' : 'Applications';

    if (btn.dataset.section === 'journeys' && !journeysLoaded) {
      journeysLoaded = true;
      loadJourneys();
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
