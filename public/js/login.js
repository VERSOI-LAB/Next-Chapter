const loginForm = document.getElementById('login-form');
const loginMsg = document.getElementById('form-msg');

if (getSession()) {
  window.location.href = 'mypage.html';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';
  loginMsg.className = 'form-msg';

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { session } = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
    setSession(session);
    window.location.href = 'mypage.html';
  } catch (err) {
    loginMsg.textContent = err.message;
    loginMsg.className = 'form-msg error';
  } finally {
    submitBtn.disabled = false;
  }
});
