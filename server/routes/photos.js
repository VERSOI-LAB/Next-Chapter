const express = require('express');
const multer = require('multer');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { uploadFile, getSignedUrls, removeFile } = require('../lib/storage');
const { recomputeSelfProfileCompleted } = require('../lib/eligibility');

const router = express.Router();
const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });

const BUCKET = 'profile-photos';
const MAX_PHOTOS = 6;

async function withSignedUrls(rows) {
  const urlMap = await getSignedUrls(BUCKET, rows.map((r) => r.file_path));
  return rows.map((r) => ({ ...r, url: urlMap[r.file_path] || null }));
}

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profile_photos')
    .select('*')
    .eq('user_id', req.user.id)
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: '사진을 불러오지 못했습니다.' });
  res.json({ photos: await withSignedUrls(data) });
});

router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '사진 파일을 선택해주세요.' });
  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: '이미지 파일만 업로드할 수 있습니다.' });
  }

  const { count } = await supabaseAdmin
    .from('profile_photos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id);

  if ((count || 0) >= MAX_PHOTOS) {
    return res.status(400).json({ error: `사진은 최대 ${MAX_PHOTOS}장까지 등록할 수 있습니다.` });
  }

  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const path = `${req.user.id}/${Date.now()}.${ext}`;

  try {
    await uploadFile(BUCKET, path, req.file);
  } catch (err) {
    return res.status(500).json({ error: '사진 업로드에 실패했습니다.' });
  }

  const isFirst = (count || 0) === 0;
  const { data, error } = await supabaseAdmin
    .from('profile_photos')
    .insert({ user_id: req.user.id, file_path: path, is_main: isFirst, sort_order: count || 0 })
    .select()
    .single();

  if (error) return res.status(500).json({ error: '사진 저장에 실패했습니다.' });
  await recomputeSelfProfileCompleted(supabaseAdmin, req.user.id);

  const [withUrl] = await withSignedUrls([data]);
  res.status(201).json({ photo: withUrl });
});

router.patch('/:id/main', requireAuth, async (req, res) => {
  const { data: photo } = await supabaseAdmin
    .from('profile_photos')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!photo) return res.status(404).json({ error: '사진을 찾을 수 없습니다.' });

  await supabaseAdmin.from('profile_photos').update({ is_main: false }).eq('user_id', req.user.id);
  const { data, error } = await supabaseAdmin
    .from('profile_photos')
    .update({ is_main: true })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '대표사진 지정에 실패했습니다.' });
  res.json({ photo: data });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { data: photo } = await supabaseAdmin
    .from('profile_photos')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (!photo) return res.status(404).json({ error: '사진을 찾을 수 없습니다.' });

  await removeFile(BUCKET, photo.file_path);
  const { error } = await supabaseAdmin.from('profile_photos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: '사진 삭제에 실패했습니다.' });

  if (photo.is_main) {
    const { data: next } = await supabaseAdmin
      .from('profile_photos')
      .select('id')
      .eq('user_id', req.user.id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabaseAdmin.from('profile_photos').update({ is_main: true }).eq('id', next.id);
    }
  }

  await recomputeSelfProfileCompleted(supabaseAdmin, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
