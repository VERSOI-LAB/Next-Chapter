const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const JOURNEY_FIELDS = ['slug', 'title', 'type', 'duration', 'capacity_male', 'capacity_female', 'price', 'status', 'summary', 'description', 'image_url', 'starts_at'];

function pickJourneyFields(body) {
  const out = {};
  for (const key of JOURNEY_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

router.get('/applications', async (req, res) => {
  const { status } = req.query;
  let query = supabaseAdmin
    .from('applications')
    .select('*, journey:journeys(id, slug, title), profile:profiles(id, full_name, phone, gender, birth_year, verification_status)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: '신청 목록을 불러오지 못했습니다.' });
  res.json({ applications: data });
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
