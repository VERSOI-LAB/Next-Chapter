const params = new URLSearchParams(window.location.search);
const root = document.getElementById('result-root');

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

const applicationId = params.get('application') || '';
const message = params.get('message') || '결제가 취소되었거나 처리되지 못했습니다.';

root.innerHTML = `
  <div class="eyebrow">결제 실패</div>
  <h1 class="display" style="font-size:clamp(26px,4vw,40px)">결제가 완료되지<br>않았습니다.</h1>
  <div class="form-msg error" style="margin-top:24px">${esc(message)}</div>
  <a href="payment.html?application=${encodeURIComponent(applicationId)}" class="btn" style="display:inline-block;margin-top:20px;text-decoration:none">다시 시도하기</a>
`;
