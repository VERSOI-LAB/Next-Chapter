const express = require('express');
const { supabaseAnon, supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { email, password, full_name, phone, gender, birth_year } = req.body || {};

  if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  if (!full_name) return res.status(400).json({ error: '이름을 입력해주세요.' });
  if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
  if (gender && !['male', 'female'].includes(gender)) {
    return res.status(400).json({ error: '올바르지 않은 성별 값입니다.' });
  }

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: { data: { full_name, phone, gender, birth_year } },
  });

  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({ user: data.user, session: data.session });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });

  res.json({ user: data.user, session: data.session });
});

router.post('/logout', requireAuth, async (req, res) => {
  await supabaseAdmin.auth.admin.signOut(req.token).catch(() => {});
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: '프로필을 불러오지 못했습니다.' });

  res.json({ user: { id: req.user.id, email: req.user.email }, profile });
});

module.exports = router;
