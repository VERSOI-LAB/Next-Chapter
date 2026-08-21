const express = require('express');
const { supabaseAnon, supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const phoneVerification = require('../lib/phoneVerification');
const { getSignedUrl } = require('../lib/storage');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{4,20}$/;

router.post('/phone/send-code', (req, res) => {
  const { phone } = req.body || {};
  const digits = phoneVerification.normalizePhone(phone);
  if (digits.length < 9) return res.status(400).json({ error: '올바른 휴대폰번호를 입력해주세요.' });

  const code = phoneVerification.generateCode(digits);

  // No SMS provider connected yet — return the code directly so the flow is testable end-to-end.
  // Replace this with a real SMS send once a provider (e.g. Solapi, Twilio) is wired up.
  res.json({ ok: true, devCode: code });
});

router.post('/phone/verify-code', (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !code) return res.status(400).json({ error: '인증번호를 입력해주세요.' });

  const ok = phoneVerification.verifyCode(phone, code);
  if (!ok) return res.status(400).json({ error: '인증번호가 올바르지 않거나 만료되었습니다.' });

  res.json({ verified: true });
});

router.post('/signup', async (req, res) => {
  const { username, email, password, full_name, phone } = req.body || {};

  if (!username || !email || !password || !full_name || !phone) {
    return res.status(400).json({ error: '모든 필수 항목을 입력해주세요.' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: '아이디는 영문, 숫자, _ 조합 4~20자여야 합니다.' });
  }
  if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
  if (!phoneVerification.isVerified(phone)) {
    return res.status(400).json({ error: '휴대폰 본인인증을 완료해주세요.' });
  }

  const digits = phoneVerification.normalizePhone(phone);
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .or(`username.ilike.${username},phone.eq.${digits}`)
    .maybeSingle();
  if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디 또는 휴대폰번호입니다.' });

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: { data: { full_name, phone: digits, username } },
  });

  if (error) return res.status(400).json({ error: error.message });

  phoneVerification.clear(phone);

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

  const verification_video_url = await getSignedUrl('verification-docs', profile.verification_video_path);

  res.json({ user: { id: req.user.id, email: req.user.email }, profile: { ...profile, verification_video_url } });
});

module.exports = router;
