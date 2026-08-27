const params = new URLSearchParams(window.location.search);
const root = document.getElementById('result-root');

async function confirmPayment() {
  const applicationId = params.get('application');
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = params.get('amount');

  if (!applicationId || !paymentKey || !orderId || !amount) {
    root.innerHTML = '<div class="empty-state">잘못된 접근입니다.</div>';
    return;
  }

  try {
    await apiFetch('/payments/confirm', {
      method: 'POST',
      body: { applicationId, paymentKey, orderId, amount: Number(amount) },
    });

    root.innerHTML = `
      <div class="eyebrow">결제 완료</div>
      <h1 class="display" style="font-size:clamp(26px,4vw,40px)">결제가<br>완료되었습니다.</h1>
      <div class="form-msg success" style="margin-top:24px">신청과 결제가 정상적으로 접수되었습니다. 참가자 검증·선발 절차 안내를 순차적으로 진행해드립니다.</div>
      <a href="/" class="btn" style="display:inline-block;margin-top:20px;text-decoration:none">홈으로 돌아가기</a>
    `;
  } catch (err) {
    root.innerHTML = `
      <div class="eyebrow">결제 확인 실패</div>
      <h1 class="display" style="font-size:clamp(26px,4vw,40px)">결제 확인 중<br>문제가 발생했습니다.</h1>
      <div class="form-msg error" style="margin-top:24px">${err.message}</div>
      <a href="payment.html?application=${encodeURIComponent(params.get('application') || '')}" class="btn" style="display:inline-block;margin-top:20px;text-decoration:none">다시 시도하기</a>
    `;
  }
}

confirmPayment();
