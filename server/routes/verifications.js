const express = require('express');
const multer = require('multer');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { uploadFile } = require('../lib/storage');
const { VERIFY_TYPES, isValidSlot } = require('../lib/verificationDocs');

const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const BUCKET = 'verification-docs';

router.get('/me', requireAuth, async (req, res) => {
  const { data: statusRows, error } = await supabaseAdmin
    .from('verifications')
    .select('type, status, updated_at')
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: '인증 현황을 불러오지 못했습니다.' });

  const { data: docs } = await supabaseAdmin
    .from('verification_documents')
    .select('type, slot_key, file_name, uploaded_at')
    .eq('user_id', req.user.id)
    .order('uploaded_at', { ascending: false });

  const statusByType = {};
  VERIFY_TYPES.forEach((type) => { statusByType[type] = 'not_submitted'; });
  (statusRows || []).forEach((row) => { statusByType[row.type] = row.status; });

  const docsByType = {};
  (docs || []).forEach((doc) => {
    docsByType[doc.type] = docsByType[doc.type] || {};
    if (!docsByType[doc.type][doc.slot_key]) docsByType[doc.type][doc.slot_key] = doc.file_name;
  });

  res.json({
    phone: { status: 'verified' },
    types: statusByType,
    documents: docsByType,
  });
});

router.post('/:type/documents', requireAuth, upload.single('file'), async (req, res) => {
  const { type } = req.params;
  const { slot_key: slotKey } = req.body || {};

  if (!VERIFY_TYPES.includes(type)) return res.status(400).json({ error: '올바르지 않은 인증 항목입니다.' });
  if (!isValidSlot(type, slotKey)) return res.status(400).json({ error: '올바르지 않은 서류 항목입니다.' });
  if (!req.file) return res.status(400).json({ error: '파일을 선택해주세요.' });

  const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase();
  const path = `${req.user.id}/${type}/${slotKey}-${Date.now()}.${ext}`;

  try {
    await uploadFile(BUCKET, path, req.file);
  } catch (err) {
    return res.status(500).json({ error: '파일 업로드에 실패했습니다.' });
  }

  const { error: docError } = await supabaseAdmin.from('verification_documents').insert({
    user_id: req.user.id,
    type,
    slot_key: slotKey,
    file_path: path,
    file_name: req.file.originalname,
  });
  if (docError) return res.status(500).json({ error: '서류 저장에 실패했습니다.' });

  const { error: statusError } = await supabaseAdmin
    .from('verifications')
    .upsert({ user_id: req.user.id, type, status: 'pending' }, { onConflict: 'user_id,type' });
  if (statusError) return res.status(500).json({ error: '인증 상태 갱신에 실패했습니다.' });

  res.status(201).json({ ok: true, file_name: req.file.originalname });
});

module.exports = router;
