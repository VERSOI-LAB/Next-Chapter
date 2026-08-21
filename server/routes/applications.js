const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { journey_id, message } = req.body || {};
  if (!journey_id) return res.status(400).json({ error: '여행을 선택해주세요.' });

  const { data: journey, error: journeyError } = await supabaseAdmin
    .from('journeys')
    .select('id, status')
    .eq('id', journey_id)
    .single();

  if (journeyError || !journey) return res.status(404).json({ error: '여행을 찾을 수 없습니다.' });
  if (journey.status !== 'open') return res.status(400).json({ error: '현재 신청할 수 없는 여행입니다.' });

  const { data, error } = await supabaseAdmin
    .from('applications')
    .insert({ user_id: req.user.id, journey_id, message: message || null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: '이미 신청한 여행입니다.' });
    return res.status(500).json({ error: '신청에 실패했습니다.' });
  }

  res.status(201).json({ application: data });
});

router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('*, journey:journeys(id, slug, title, type, duration, starts_at, image_url)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: '신청 내역을 불러오지 못했습니다.' });
  res.json({ applications: data });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('applications')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) return res.status(400).json({ error: '취소할 수 없는 신청입니다.' });
  res.json({ application: data });
});

module.exports = router;
