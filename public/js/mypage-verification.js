const VERIFY_DOCS = {
  marital: {
    title: '혼인관계증명서(상세) 인증',
    slots: [{ key: 'maritalcert', label: '혼인관계증명서(상세)', links: [
      { text: '증명서 발급 바로가기 →', url: 'https://efamily.scourt.go.kr/pt/PtFrrpApplrInfoInqW.do?menuFg=04' },
    ] }],
  },
  job: {
    title: '직업 인증',
    slots: [
      { key: 'bizreg', label: '사업자등록증(사업자등록증, 사업자등록증명원 중 택1)', links: [
        { text: '증명서 발급 바로가기 →', url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000016' },
      ] },
      { key: 'employment', label: '재직증명서(건강보험 자격득실확인서, 국민연금 가입증명서 중 택1)', links: [
        { text: '건강보험 자격득실확인서 발급 바로가기 →', url: 'https://www.nhis.or.kr/nhis/minwon/minwonServiceBoard.do?mode=view&articleNo=10945783' },
        { text: '국민연금 가입증명서 발급 바로가기 →', url: 'https://www.nps.or.kr/elctcvlcpt/comm/getOHAC0000M5.do?menuId=MN24001054' },
      ] },
    ],
  },
  education: { title: '학력 인증', slots: [{ key: 'diploma', label: '졸업증명서' }] },
  income: {
    title: '소득 인증',
    slots: [{ key: 'incomecert', label: '소득금액증명원', links: [
      { text: '증명서 발급 바로가기 →', url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000021' },
    ] }],
  },
  asset: {
    title: '자산 인증',
    slots: [{ key: 'realestate', label: '등기부등본', links: [
      { text: '증명서 발급 바로가기 →', url: 'https://www.iros.go.kr/index.jsp' },
    ] }],
  },
};

const STATUS_LABEL_MAP = { verified: '인증 완료', pending: '심사중', not_submitted: '미인증' };

let verificationState = null;
let openDocType = null;

function renderStatusCell(cellId, type, status) {
  const cell = document.getElementById(cellId);
  cell.innerHTML = '';

  if (status === 'verified') {
    const span = document.createElement('span');
    span.className = 'verify-status-badge verified';
    span.innerText = STATUS_LABEL_MAP.verified;
    cell.appendChild(span);
  } else if (status === 'pending') {
    const span = document.createElement('span');
    span.className = 'verify-status-badge pending';
    span.innerText = STATUS_LABEL_MAP.pending;
    cell.appendChild(span);
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'verify-status-badge not_submitted';
    btn.innerText = STATUS_LABEL_MAP.not_submitted;
    btn.onclick = () => openDocPanel(type);
    cell.appendChild(btn);
  }
}

function renderVerificationTable() {
  if (!verificationState) return;
  renderStatusCell('status-phone', 'phone', 'verified');
  renderStatusCell('status-marital', 'marital', verificationState.types.marital);
  renderStatusCell('status-job', 'job', verificationState.types.job);
  renderStatusCell('status-education', 'education', verificationState.types.education);
  renderStatusCell('status-income', 'income', verificationState.types.income);
  renderStatusCell('status-asset', 'asset', verificationState.types.asset);
}

function openDocPanel(type) {
  openDocType = type;
  const config = VERIFY_DOCS[type];
  const panel = document.getElementById('doc-upload-panel');
  panel.innerHTML = '';
  panel.className = 'doc-upload-panel';

  const title = document.createElement('div');
  title.style.cssText = 'font-family:var(--serif);font-size:18px;margin-bottom:14px';
  title.innerText = config.title;
  panel.appendChild(title);

  config.slots.forEach((slot) => {
    const row = document.createElement('div');
    row.className = 'doc-slot-row';

    const label = document.createElement('div');
    label.className = 'doc-slot-label';
    label.innerText = slot.label;
    row.appendChild(label);

    const uploadedName = verificationState.documents?.[type]?.[slot.key];
    const box = document.createElement('div');
    box.className = 'doc-slot-box' + (uploadedName ? ' has-file' : '');
    box.innerText = uploadedName || '+ 파일 선택 (이미지 또는 PDF)';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      box.innerText = '업로드 중…';
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('slot_key', slot.key);
        const session = getSession();
        const res = await fetch(`/api/verifications/${type}/documents`, {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '업로드에 실패했습니다.');
        await initVerificationTab();
        openDocPanel(type);
        showToast('서류가 제출되었습니다. 심사에는 영업일 기준 1~2일이 소요됩니다.');
      } catch (err) {
        box.innerText = '+ 파일 선택 (이미지 또는 PDF)';
        alert(err.message);
      }
    };
    box.onclick = () => input.click();
    row.appendChild(box);
    row.appendChild(input);

    (slot.links || []).forEach((link) => {
      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'doc-link';
      a.innerText = link.text;
      row.appendChild(a);
    });

    panel.appendChild(row);
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'doc-panel-close';
  closeBtn.innerText = '닫기';
  closeBtn.onclick = () => { panel.innerHTML = ''; panel.className = ''; openDocType = null; };
  panel.appendChild(closeBtn);
}

function showToast(text) {
  const msg = document.createElement('div');
  msg.textContent = text;
  msg.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--dark);color:#fff;padding:12px 20px;border-radius:8px;font-size:12px;z-index:200';
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}

async function initVerificationTab() {
  try {
    verificationState = await apiFetch('/verifications/me');
    renderVerificationTable();
  } catch (err) {
    // ignore — table stays with loading placeholders
  }
}
