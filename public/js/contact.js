const contactForm = document.getElementById('contact-form');
const contactMsg = document.getElementById('contact-msg');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  contactMsg.textContent = '';
  contactMsg.className = 'form-msg';

  const submitBtn = contactForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    await apiFetch('/contact', {
      method: 'POST',
      body: {
        name: document.getElementById('c-name').value.trim(),
        email: document.getElementById('c-email').value.trim(),
        phone: document.getElementById('c-phone').value.trim() || null,
        message: document.getElementById('c-message').value.trim(),
        website: document.getElementById('c-website').value,
      },
    });
    contactMsg.textContent = '문의가 접수되었습니다. 확인 후 이메일로 답변드리겠습니다.';
    contactMsg.className = 'form-msg success';
    contactForm.reset();
  } catch (err) {
    contactMsg.textContent = err.message;
    contactMsg.className = 'form-msg error';
  } finally {
    submitBtn.disabled = false;
  }
});
