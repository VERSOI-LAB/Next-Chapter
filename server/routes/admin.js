const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getSignedUrl, getSignedUrls } = require('../lib/storage');
const { VERIFY_TYPES } = require('../lib/verificationDocs');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const JOURNEY_FIELDS = ['slug', 'title', 'type', 'duration', 'capacity_male', 'capacity_female', 'price', 'status', 'summary', 'description', 'image_url', 'starts_at', 'itinerary'];

function pickJourneyFields(body) {
  const out = {};
  for (const key of JOURNEY_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

const PHOTOS_BUCKET = 'profile-photos';
const DOCS_BUCKET = 'verification-docs';

async function attachApplicantDetails(applications) {
  const userIds = [...new Set(applications.map((app) => app.profile?.id).filter(Boolean))];
  if (!userIds.length) return applications;

  const [{ data: photoRows }, { data: docRows }, { data: verifRows }] = await Promise.all([
    supabaseAdmin.from('profile_photos').select('id, user_id, file_path, is_main, sort_order').in('user_id', userIds).order('sort_order', { ascending: true }),
    supabaseAdmin.from('verification_documents').select('user_id, type, slot_key, file_name, file_path, uploaded_at').in('user_id', userIds),
    supabaseAdmin.from('verifications').select('user_id, type, status').in('user_id', userIds),
  ]);

  const videoPaths = applications.map((app) => app.profile?.verification_video_path).filter(Boolean);
  const [photoUrlMap, docUrlMap, videoUrlMap] = await Promise.all([
    getSignedUrls(PHOTOS_BUCKET, (photoRows || []).map((p) => p.file_path)),
    getSignedUrls(DOCS_BUCKET, (docRows || []).map((d) => d.file_path)),
    getSignedUrls(DOCS_BUCKET, videoPaths),
  ]);

  const photosByUser = {};
  (photoRows || []).forEach((p) => {
    photosByUser[p.user_id] = photosByUser[p.user_id] || [];
    photosByUser[p.user_id].push({ id: p.id, is_main: p.is_main, url: photoUrlMap[p.file_path] || null });
  });

  const docsByUser = {};
  (docRows || []).forEach((d) => {
    docsByUser[d.user_id] = docsByUser[d.user_id] || {};
    docsByUser[d.user_id][d.type] = docsByUser[d.user_id][d.type] || [];
    docsByUser[d.user_id][d.type].push({ slot_key: d.slot_key, file_name: d.file_name, url: docUrlMap[d.file_path] || null });
  });

  const verifByUser = {};
  (verifRows || []).forEach((v) => {
    verifByUser[v.user_id] = verifByUser[v.user_id] || {};
    verifByUser[v.user_id][v.type] = v.status;
  });

  return applications.map((app) => {
    if (!app.profile) return app;
    const uid = app.profile.id;
    const verifications = {};
    VERIFY_TYPES.forEach((type) => { verifications[type] = (verifByUser[uid] || {})[type] || 'not_submitted'; });

    return {
      ...app,
      profile: {
        ...app.profile,
        verification_video_url: app.profile.verification_video_path ? (videoUrlMap[app.profile.verification_video_path] || null) : null,
        photos: photosByUser[uid] || [],
        verifications,
        documents: docsByUser[uid] || {},
      },
    };
  });
}

const PROFILE_DETAIL_FIELDS = 'id, full_name, phone, gender, birth_year, verification_status, region, region_detail, height, degree, university, job_major, job_minor, job_tertiary, job_custom, company_name, salary, asset, verification_video_path';

router.get('/applications', async (req, res) => {
  const { status } = req.query;
  let query = supabaseAdmin
    .from('applications')
    .select(`*, journey:journeys(id, slug, title), profile:profiles(${PROFILE_DETAIL_FIELDS})`)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: '신청 목록을 불러오지 못했습니다.' });
  res.json({ applications: await attachApplicantDetails(data) });
});

router.patch('/applications/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: '올바르지 않은 상태값입니다.' });
  }

  const { data, error } = await supabaseAdmin
    .from('applications')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '상태 변경에 실패했습니다.' });
  res.json({ application: data });
});

router.get('/journeys', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('journeys').select('*').order('created_at');
  if (error) return res.status(500).json({ error: '여행 목록을 불러오지 못했습니다.' });
  res.json({ journeys: data });
});

router.post('/journeys', async (req, res) => {
  const payload = pickJourneyFields(req.body || {});
  if (!payload.slug || !payload.title || !payload.type) {
    return res.status(400).json({ error: 'slug, title, type은 필수입니다.' });
  }

  const { data, error } = await supabaseAdmin.from('journeys').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ journey: data });
});

router.put('/journeys/:id', async (req, res) => {
  const payload = pickJourneyFields(req.body || {});
  const { data, error } = await supabaseAdmin
    .from('journeys')
    .update(payload)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ journey: data });
});

router.patch('/verification/:userId', async (req, res) => {
  const { verification_status } = req.body || {};
  if (!['pending', 'verified', 'rejected'].includes(verification_status)) {
    return res.status(400).json({ error: '올바르지 않은 상태값입니다.' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ verification_status })
    .eq('id', req.params.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '검증 상태 변경에 실패했습니다.' });
  res.json({ profile: data });
});

module.exports = router;
