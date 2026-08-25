const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');

const router = express.Router();

router.post('/', async (req, res) => {
  const { name, email, phone, message, website } = req.body || {};

  // Honeypot: real users never fill this hidden field. Bots that do get a
  // fake success without anything being stored.
  if (website) return res.status(201).json({ ok: true });

  if (!name || !email || !message) {
    return res.status(400).json({ error: '이름, 이메일, 문의 내용을 입력해주세요.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '올바른 이메일 주소를 입력해주세요.' });
  }

  const { error } = await supabaseAdmin.from('contact_inquiries').insert({
    name: name.trim(),
    email: email.trim(),
    phone: phone ? phone.trim() : null,
    message: message.trim(),
  });

  if (error) return res.status(500).json({ error: '문의 등록에 실패했습니다.' });
  res.status(201).json({ ok: true });
});

module.exports = router;
