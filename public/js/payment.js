const params = new URLSearchParams(window.location.search);
const applicationId = params.get('application');
const root = document.getElementById('payment-content');

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPrice(price) {
  if (price === null || price === undefined) return '추후 공개';
  return `${Number(price).toLocaleString('ko-KR')}원`;
}

function formatDate(dateStr) {
  if (!dateStr) return '추후 공개';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function load() {
  if (!getSession()) {
    window.location.href = `login.html?next=payment.html?application=${encodeURIComponent(applicationId || '')}`;
    return;
  }
  if (!applicationId) {
    root.innerHTML = '<div class="empty-state">잘못된 접근입니다.</div>';
    return;
  }

  try {
    const { application } = await apiFetch(`/applications/${applicationId}`);
    const j = application.journey || {};
    const isOverseas = j.type === 'overseas';

    const passport = isOverseas ? (await apiFetch(`/passport/${applicationId}`)).passport : null;
    const destLabel = [j.destination_country, j.destination_city].filter(Boolean).join(' · ') || '추후 공개';

    const passportSection = !isOverseas ? '' : `
      <p class="section-label" style="margin:32px 0 12px">여권 정보</p>
      ${passport ? `
        <ul class="journey-meta-list">
          <li><span>이름</span><span>${esc(passport.full_name_kr)}</span></li>
          <li><span>영문이름</span><span>${esc(passport.full_name_en)}</span></li>
          <li><span>여권번호</span><span>${esc(passport.passport_number)}</span></li>
          <li><span>여권만료일</span><span>${formatDate(passport.passport_expiry)}</span></li>
        </ul>
        ${passport.image_url ? `<img src="${esc(passport.image_url)}" alt="여권 이미지" style="max-width:280px;display:block;margin-top:16px;border:1px solid var(--line)">` : ''}
      ` : '<div class="empty-state">등록된 여권 정보가 없습니다.</div>'}
    `;

    const hasBreakdown = j.matching_service_amount !== null && j.matching_service_amount !== undefined
      && j.travel_service_amount !== null && j.travel_service_amount !== undefined;
    const vat = hasBreakdown ? Math.round((Number(j.matching_service_amount) + Number(j.travel_service_amount)) * 0.1) : null;

    const breakdownHtml = !hasBreakdown ? '' : `
      <ul class="journey-meta-list">
        <li><span>결혼중개 서비스</span><span>${formatPrice(j.matching_service_amount)}</span></li>
        <li><span>여행서비스</span><span>${formatPrice(j.travel_service_amount)}</span></li>
        <li><span>부가가치세</span><span>${formatPrice(vat)}</span></li>
      </ul>
    `;

    root.innerHTML = `
      <p class="section-label" style="margin-bottom:12px">여행 정보</p>
      <ul class="journey-meta-list">
        <li><span>여행</span><span>${esc(j.title || '—')}</span></li>
        <li><span>목적지</span><span>${esc(destLabel)}</span></li>
        <li><span>일정</span><span>${esc(j.duration || '추후 공개')}</span></li>
        <li><span>출발 예정일</span><span>${formatDate(j.starts_at)}</span></li>
      </ul>

      <p class="section-label" style="margin:32px 0 12px">결제금액</p>
      ${breakdownHtml}
      <ul class="journey-meta-list">
        <li><span><strong>최종 결제금액</strong></span><span><strong>${formatPrice(j.price)}</strong></span></li>
      </ul>

      ${passportSection}

      <div class="form-msg success" style="margin-top:32px">신청이 접수되었습니다. 검증 및 선발 절차 안내 후 결제 방법을 별도로 안내드립니다.</div>
      <a href="mypage.html" class="btn" style="display:inline-block;margin-top:20px;text-decoration:none">마이페이지에서 신청 현황 확인하기</a>
    `;
  } catch (err) {
    root.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

load();
