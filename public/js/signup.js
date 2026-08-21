const signupForm = document.getElementById('signup-form');
const signupMsg = document.getElementById('form-msg');
const phoneInput = document.getElementById('phone');
const codeField = document.getElementById('code-field');
const codeInput = document.getElementById('code');
const phoneMsg = document.getElementById('phone-msg');
const sendCodeBtn = document.getElementById('send-code-btn');
const verifyCodeBtn = document.getElementById('verify-code-btn');

if (getSession()) {
  window.location.href = 'mypage.html';
}

let phoneVerified = false;
let verifiedPhone = null;

sendCodeBtn.addEventListener('click', async () => {
  const phone = phoneInput.value.trim();
  if (!phone) {
    phoneMsg.textContent = '휴대폰번호를 입력해주세요.';
    phoneMsg.className = 'form-msg error';
    return;
  }

  phoneVerified = false;
  sendCodeBtn.disabled = true;

  try {
    const { devCode } = await apiFetch('/auth/phone/send-code', { method: 'POST', body: { phone } });
    codeField.style.display = 'block';
    codeInput.value = '';
    codeInput.focus();
    phoneMsg.textContent = `개발 모드: 인증번호는 ${devCode} 입니다. (SMS 연동 전까지 임시로 화면에 표시됩니다)`;
    phoneMsg.className = 'form-msg success';
  } catch (err) {
    phoneMsg.textContent = err.message;
    phoneMsg.className = 'form-msg error';
  } finally {
    sendCodeBtn.disabled = false;
  }
});

verifyCodeBtn.addEventListener('click', async () => {
  const phone = phoneInput.value.trim();
  const code = codeInput.value.trim();
  if (!code) {
    phoneMsg.textContent = '인증번호를 입력해주세요.';
    phoneMsg.className = 'form-msg error';
    return;
  }

  verifyCodeBtn.disabled = true;

  try {
    await apiFetch('/auth/phone/verify-code', { method: 'POST', body: { phone, code } });
    phoneVerified = true;
    verifiedPhone = phone;
    phoneMsg.textContent = '✓ 휴대폰 인증이 완료되었습니다.';
    phoneMsg.className = 'form-msg success';
    phoneInput.disabled = true;
    codeInput.disabled = true;
    sendCodeBtn.disabled = true;
    verifyCodeBtn.disabled = true;
  } catch (err) {
    phoneVerified = false;
    phoneMsg.textContent = err.message;
    phoneMsg.className = 'form-msg error';
    verifyCodeBtn.disabled = false;
  }
});

phoneInput.addEventListener('input', () => {
  if (phoneVerified && phoneInput.value.trim() !== verifiedPhone) {
    phoneVerified = false;
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupMsg.textContent = '';
  signupMsg.className = 'form-msg';

  const password = document.getElementById('password').value;
  const passwordConfirm = document.getElementById('password_confirm').value;

  if (password !== passwordConfirm) {
    signupMsg.textContent = '비밀번호가 일치하지 않습니다.';
    signupMsg.className = 'form-msg error';
    return;
  }

  if (!phoneVerified) {
    signupMsg.textContent = '휴대폰 본인인증을 완료해주세요.';
    signupMsg.className = 'form-msg error';
    return;
  }

  const submitBtn = signupForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const payload = {
      username: document.getElementById('username').value.trim(),
      password,
      full_name: document.getElementById('full_name').value.trim(),
      phone: verifiedPhone,
      email: document.getElementById('email').value.trim(),
    };

    const { session } = await apiFetch('/auth/signup', { method: 'POST', body: payload });

    if (session) {
      setSession(session);
      window.location.href = 'mypage.html';
    } else {
      signupMsg.textContent = '가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.';
      signupMsg.className = 'form-msg success';
      setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    }
  } catch (err) {
    signupMsg.textContent = err.message;
    signupMsg.className = 'form-msg error';
  } finally {
    submitBtn.disabled = false;
  }
});
