const express = require('express');
const multer = require('multer');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { uploadFile, getSignedUrl, removeFile } = require('../lib/storage');

const router = express.Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

const VIDEO_BUCKET = 'verification-docs';

router.put('/', requireAuth, async (req, res) => {
  const { full_name, phone, gender, birth_year, bio } = req.body || {};

  if (gender && !['male', 'female'].includes(gender)) {
    return res.status(400).json({ error: '올바르지 않은 성별 값입니다.' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ full_name, phone, gender, birth_year, bio })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '프로필 저장에 실패했습니다.' });
  res.json({ profile: data });
});

const SELF_PROFILE_FIELDS = [
  'birth_year', 'region', 'region_detail', 'height', 'degree', 'university',
  'job_major', 'job_minor', 'job_tertiary', 'job_custom', 'company_name', 'salary', 'asset',
];

router.put('/self', requireAuth, async (req, res) => {
  const payload = {};
  for (const key of SELF_PROFILE_FIELDS) {
    if (req.body[key] !== undefined) payload[key] = req.body[key] === '' ? null : req.body[key];
  }
  payload.self_profile_completed = true;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(payload)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '프로필 저장에 실패했습니다.' });
  res.json({ profile: data });
});

router.post('/verification-video', requireAuth, upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '영상 파일을 선택해주세요.' });
  if (!req.file.mimetype.startsWith('video/')) {
    return res.status(400).json({ error: '영상 파일만 업로드할 수 있습니다.' });
  }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('verification_video_path')
    .eq('id', req.user.id)
    .single();

  const ext = (req.file.originalname.split('.').pop() || 'mp4').toLowerCase();
  const path = `${req.user.id}/verification-video/${Date.now()}.${ext}`;

  try {
    await uploadFile(VIDEO_BUCKET, path, req.file);
  } catch (err) {
    return res.status(500).json({ error: '영상 업로드에 실패했습니다.' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ verification_video_path: path })
    .eq('id', req.user.id)
    .select('verification_video_path')
    .single();

  if (error) return res.status(500).json({ error: '영상 저장에 실패했습니다.' });

  if (existing?.verification_video_path) {
    await removeFile(VIDEO_BUCKET, existing.verification_video_path);
  }

  const url = await getSignedUrl(VIDEO_BUCKET, data.verification_video_path);
  res.status(201).json({ url });
});

module.exports = router;
