const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');

const router = express.Router();

router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('journeys')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: '여행 목록을 불러오지 못했습니다.' });
  res.json({ journeys: data });
});

router.get('/:slug', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('journeys')
    .select('*')
    .eq('slug', req.params.slug)
    .single();

  if (error || !data) return res.status(404).json({ error: '여행을 찾을 수 없습니다.' });
  res.json({ journey: data });
});

module.exports = router;
