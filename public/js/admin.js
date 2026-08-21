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
