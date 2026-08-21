const signupForm = document.getElementById('signup-form');
const signupMsg = document.getElementById('form-msg');

if (getSession()) {
  window.location.href = 'mypage.html';
}

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupMsg.textContent = '';
  signupMsg.className = 'form-msg';

  const submitBtn = signupForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const payload = {
      full_name: document.getElementById('full_name').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      gender: document.getElementById('gender').value || null,
      birth_year: document.getElementById('birth_year').value || null,
      phone: document.getElementById('phone').value.trim() || null,
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
