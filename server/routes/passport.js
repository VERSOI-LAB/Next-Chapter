const express = require('express');
const multer = require('multer');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { uploadFile, getSignedUrl } = require('../lib/storage');

const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });
const BUCKET = 'passport-docs';

async function loadOwnedApplication(applicationId, userId) {
  const { data } = await supabaseAdmin
    .from('applications')
    .select('id, user_id, journey:journeys(type)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();
  return data;
}

router.get('/:applicationId', requireAuth, async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.user.id);
  if (!application) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });

  const { data: info, error } = await supabaseAdmin
    .from('passport_info')
    .select('*')
    .eq('application_id', req.params.applicationId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: '여권 정보를 불러오지 못했습니다.' });

  if (!info) return res.json({ passport: null });
  const image_url = info.passport_image_path ? await getSignedUrl(BUCKET, info.passport_image_path) : null;
  res.json({ passport: { ...info, image_url } });
});

router.post('/:applicationId', requireAuth, upload.single('passport_image'), async (req, res) => {
  const application = await loadOwnedApplication(req.params.applicationId, req.user.id);
  if (!application) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });

  const { full_name_kr: fullNameKr, full_name_en: fullNameEn, passport_number: passportNumber, passport_expiry: passportExpiry } = req.body || {};
  if (!fullNameKr || !fullNameEn || !passportNumber || !passportExpiry) {
    return res.status(400).json({ error: '이름, 영문이름, 여권번호, 여권만료일을 모두 입력해주세요.' });
  }
  if (new Date(passportExpiry) <= new Date()) {
    return res.status(400).json({ error: '여권 만료일이 이미 지났거나 올바르지 않습니다.' });
  }

  const payload = {
    application_id: req.params.applicationId,
    user_id: req.user.id,
    full_name_kr: fullNameKr.trim(),
    full_name_en: fullNameEn.trim().toUpperCase(),
    passport_number: passportNumber.trim().toUpperCase(),
    passport_expiry: passportExpiry,
  };

  if (req.file) {
    if (!req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: '이미지 또는 PDF 파일만 업로드할 수 있습니다.' });
    }
    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const path = `${req.user.id}/${req.params.applicationId}-${Date.now()}.${ext}`;
    try {
      await uploadFile(BUCKET, path, req.file);
    } catch (err) {
      return res.status(500).json({ error: '여권 이미지 업로드에 실패했습니다.' });
    }
    payload.passport_image_path = path;
  }

  const { data, error } = await supabaseAdmin
    .from('passport_info')
    .upsert(payload, { onConflict: 'application_id' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: '여권 정보 저장에 실패했습니다.' });

  const image_url = data.passport_image_path ? await getSignedUrl(BUCKET, data.passport_image_path) : null;
  res.json({ passport: { ...data, image_url } });
});

module.exports = router;
