function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPrice(v) {
  if (v === null || v === undefined) return '추후 공개';
  return `${Number(v).toLocaleString('ko-KR')}원`;
}

async function load() {
  const root = document.getElementById('fee-content');
  try {
    const { journeys } = await apiFetch('/journeys');
    if (!journeys.length) {
      root.innerHTML = '<div class="empty-state">등록된 여행 상품이 없습니다.</div>';
      return;
    }

    root.innerHTML = journeys.map((j) => {
      const hasBreakdown = j.matching_service_amount !== null && j.matching_service_amount !== undefined
        && j.travel_service_amount !== null && j.travel_service_amount !== undefined;
      const vat = hasBreakdown ? Math.round((Number(j.matching_service_amount) + Number(j.travel_service_amount)) * 0.1) : null;

      return `
        <div style="border:1px solid var(--line);padding:24px;margin-bottom:16px">
          <h3 style="margin-bottom:12px">${esc(j.title)}</h3>
          <ul class="journey-meta-list" style="margin:0">
            <li><span>결혼중개 서비스 수수료·회비</span><span>${hasBreakdown ? formatPrice(j.matching_service_amount) : '추후 공개'}</span></li>
            <li><span>여행서비스 비용</span><span>${hasBreakdown ? formatPrice(j.travel_service_amount) : '추후 공개'}</span></li>
            <li><span>부가가치세</span><span>${hasBreakdown ? formatPrice(vat) : '추후 공개'}</span></li>
            <li><span><strong>총 결제금액</strong></span><span><strong>${formatPrice(j.price)}</strong></span></li>
          </ul>
        </div>`;
    }).join('');
  } catch (err) {
    root.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

load();
