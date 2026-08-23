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

const ACK_ITEMS = [
  '계약내용을 확인했습니다.',
  '매칭횟수 1회를 확인했습니다.',
  '서비스 제공기간이 신청한 여행기간임을 확인했습니다.',
  '결혼중개 수수료·회비와 여행서비스 비용을 확인했습니다.',
  '팀 확정 후 환불 제한 조건을 확인했습니다.',
  '특정 상대방과의 교제·결혼이 보장되지 않음을 확인했습니다.',
];

function contractHtml(application) {
  const j = application.journey || {};
  const p = application.profile || {};
  const isOverseas = j.type === 'overseas';
  const contractTitle = isOverseas ? '해외결혼중개 회원계약서' : '국내결혼중개 회원계약서';
  const hasBreakdown = j.matching_service_amount !== null && j.matching_service_amount !== undefined
    && j.travel_service_amount !== null && j.travel_service_amount !== undefined;
  const vat = hasBreakdown ? Math.round((Number(j.matching_service_amount) + Number(j.travel_service_amount)) * 0.1) : null;
  const partySize = (j.capacity_male !== undefined && j.capacity_female !== undefined) ? `${j.capacity_male}:${j.capacity_female}` : '추후 공개';

  return `
    <div style="font-size:14px;line-height:1.85;color:var(--ink);border:1px solid var(--line);padding:24px;margin-top:16px">
      <h3 style="margin-bottom:16px">${esc(contractTitle)}</h3>
      <p style="color:var(--muted);margin-bottom:16px">본 계약서는 회원이 상품을 신청하면 아래 정보가 자동 삽입되어 전자문서로 교부됩니다.</p>

      <h4>제1조 계약당사자</h4>
      <p>회사: VERSOI(베르소이) / 브랜드: NEXT CHAPTER<br>
      대표자: 이재희 · 사업자등록번호: 550-38-01564 · 국내결혼중개업 신고번호: 제0000-000000호 · 여행업 등록번호: 제0000-0000호<br>
      주소: 경기도 성남시 수정구 창업로 18, 876호(시흥동) · 연락처: versoi.labs@gmail.com<br>
      회원 성명: ${esc(p.full_name || '—')} · 생년월일: ${esc(p.birth_year || '—')} · 연락처: ${esc(p.phone || '—')} · 이메일: ${esc(application.user_email || '—')}</p>

      <h4>제2조 신청상품</h4>
      <p>상품명: ${esc(j.title || '—')}<br>
      여행기간: ${esc(j.duration || '추후 공개')}<br>
      참가구성: ${esc(partySize)}<br>
      매칭횟수: 1회<br>
      결혼중개 서비스 제공기간: 해당 여행기간</p>

      <h4>제3조 계약목적</h4>
      <p>회원에게 결혼을 전제로 한 만남의 기회를 제공하기 위해 회원 검증, 참가자 선발, 그룹 구성 및 회원 간 만남의 기회를 제공합니다.</p>

      <h4>제4조 제공서비스</h4>
      <p>본인확인, 혼인 여부 확인, 참가자격 확인, 참가자 선발, 그룹 구성, 회원 간 만남의 기회, 여행 프로그램 중 교류 및 상품에 표시된 결혼중개 서비스를 제공합니다.</p>

      <h4>제5조 매칭횟수 및 기간</h4>
      <p>매칭횟수는 신청한 여행 프로그램 1회입니다. 서비스 제공기간은 해당 여행기간입니다. 별도의 추가 1:1 소개 또는 추가 여행 참가권은 포함되지 않습니다.</p>

      <h4>제6조 계약금액</h4>
      <p>결혼중개 서비스 수수료·회비: ${hasBreakdown ? formatPrice(j.matching_service_amount) : '[자동삽입]'}<br>
      여행서비스 비용: ${hasBreakdown ? formatPrice(j.travel_service_amount) : '[자동삽입]'}<br>
      부가가치세: ${hasBreakdown ? formatPrice(vat) : '[자동삽입]'}<br>
      총 결제금액: ${formatPrice(j.price)}</p>

      <h4>제7조 팀 확정</h4>
      <p>팀 확정일: 미정 (팀 확정 후 별도 통지)<br>
      통지방법: 문자·이메일·서비스 내 알림 등. 팀 확정 후 여행 예약 및 준비가 본격화됩니다.</p>

      <h4>제8조 해약·해지 및 반환</h4>
      <p>팀 확정 전 취소는 원칙적으로 전액 환불합니다. 관계 법령상 공제가 허용되거나 회원 귀책으로 이미 발생한 비용이 있는 경우 그 범위에서 조정할 수 있습니다. 팀 확정 후 회원의 단순 변심·개인 사정에 따른 취소는 원칙적으로 환불하지 않습니다. 다만 관계 법령상 청약철회·계약해지·환불이 인정되는 경우와 회사 귀책사유는 예외로 합니다. 자세한 내용은 <a href="refund-policy.html" target="_blank" rel="noopener">취소·환불규정</a>을 참고해주세요.</p>

      <h4>제9조 회사의 배상책임</h4>
      <p>회사는 회사의 고의 또는 과실로 발생한 손해에 대해 관계 법령에 따라 배상책임을 부담합니다.</p>

      <h4>제10조 회원정보</h4>
      <p>회원은 혼인 여부 및 참가자격에 관한 정보를 사실대로 제공해야 합니다.</p>

      <h4>제11조 전자계약서 교부</h4>
      <p>본 계약서는 전자문서로 작성·교부하며 회원이 저장·출력할 수 있도록 제공합니다.</p>
    </div>

    <div style="font-size:14px;line-height:1.85;color:var(--ink);border:1px solid var(--line);padding:24px;margin-top:16px">
      <h3 style="margin-bottom:16px">여행계약조건</h3>
      <p style="color:var(--muted);margin-bottom:16px">상품 상세페이지의 정보가 결제 시점에 계약서에 저장되어 개별 계약조건이 됩니다.</p>

      <h4>제1조 여행업자</h4>
      <p>VERSOI(베르소이) / NEXT CHAPTER<br>대표자: 이재희 · 사업자등록번호: 550-38-01564 · 여행업 등록번호: 제0000-0000호<br>주소: 경기도 성남시 수정구 창업로 18, 876호(시흥동)</p>

      <h4>제2조 상품정보</h4>
      <p>상품명: ${esc(j.title || '—')} · 여행기간: ${esc(j.duration || '추후 공개')} · 목적지: ${esc([j.destination_country, j.destination_city].filter(Boolean).join(' · ') || '추후 공개')} · 참가구성: ${esc(partySize)}<br>포함 사항: 숙박, 교통, 식사, 관광·체험 및 매칭 프로그램. 상세 포함·불포함 사항은 상품 상세페이지를 따릅니다.</p>

      <h4>제3조 계약성립</h4>
      <p>회원이 상품내용과 조건을 확인하고 결제하고 회사가 신청을 승인하면 여행계약이 성립합니다. 참가자 선발을 전제로 한 경우 최종 참가확정은 팀 확정 절차에 따릅니다.</p>

      <h4>제4조 일정변경</h4>
      <p>기상악화, 교통기관 사정, 시설 운영중단, 안전상 필요, 천재지변 등 불가피한 사유가 있는 경우 관계 법령에 따라 일정 또는 프로그램을 변경할 수 있습니다.</p>

      <h4>제5조 최소출발인원</h4>
      <p>상품별 최소출발인원은 상품페이지에 표시합니다. 미충족으로 회사가 여행을 취소하는 경우 관계 법령 및 계약조건에 따라 환불합니다.</p>

      <h4>제6조 회원의 의무</h4>
      <p>일정·안전수칙·시설규칙을 준수하고 다른 참가자를 존중해야 합니다.</p>

      <h4>제7조 중도이탈</h4>
      <p>회원의 개인사정으로 여행을 중도 이탈하는 경우 원칙적으로 환불하지 않습니다. 회원 귀책으로 발생한 추가 비용은 회원이 부담할 수 있습니다. 회사 귀책 또는 법령상 환불사유는 예외입니다.</p>

      <h4>제8조 보험</h4>
      <p>여행자보험 가입 여부와 보장내용은 상품별로 표시하며 보험금 지급은 보험약관에 따릅니다.</p>

      <h4>제9조 취소·환불</h4>
      <p>별도 <a href="refund-policy.html" target="_blank" rel="noopener">취소·환불규정</a> 및 관계 법령에 따릅니다.</p>
    </div>
  `;
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

    const ackHtml = `
      <p class="section-label" style="margin:32px 0 12px">회원 최종확인</p>
      <div style="border:1px solid var(--line);padding:20px">
        ${ACK_ITEMS.map((text, i) => `
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;margin-bottom:${i < ACK_ITEMS.length - 1 ? '12px' : '0'}">
            <input type="checkbox" class="ack-item" style="width:auto;margin-top:3px">
            <span>${esc(text)}</span>
          </label>`).join('')}
      </div>
      <button type="button" class="btn" id="ack-btn" style="margin-top:16px">확인 완료</button>
      <div class="form-msg" id="ack-msg"></div>
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

      <p class="section-label" style="margin:32px 0 12px">전자계약서</p>
      ${contractHtml(application)}

      <div id="ack-section">${ackHtml}</div>
      <div id="done-section" style="display:none">
        <div class="form-msg success" style="margin-top:32px">신청이 접수되었습니다. 검증 및 선발 절차 안내 후 결제 방법을 별도로 안내드립니다.</div>
        <a href="mypage.html" class="btn" style="display:inline-block;margin-top:20px;text-decoration:none">마이페이지에서 신청 현황 확인하기</a>
      </div>
    `;

    const ackBtn = document.getElementById('ack-btn');
    const ackMsg = document.getElementById('ack-msg');
    ackBtn.addEventListener('click', async () => {
      const boxes = [...root.querySelectorAll('.ack-item')];
      if (!boxes.every((b) => b.checked)) {
        ackMsg.textContent = '모든 확인 항목을 체크해주세요.';
        ackMsg.className = 'form-msg error';
        return;
      }
      ackBtn.disabled = true;
      try {
        await apiFetch(`/applications/${applicationId}/ack`, { method: 'POST' });
        document.getElementById('ack-section').style.display = 'none';
        document.getElementById('done-section').style.display = '';
      } catch (err) {
        ackMsg.textContent = err.message;
        ackMsg.className = 'form-msg error';
        ackBtn.disabled = false;
      }
    });
  } catch (err) {
    root.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

load();
