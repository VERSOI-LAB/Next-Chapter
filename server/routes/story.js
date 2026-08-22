const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');

const router = express.Router();

router.get('/quotes', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('story_quotes')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: '스토리 카드를 불러오지 못했습니다.' });
  res.json({ quotes: data });
});

router.get('/reviews', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('story_reviews')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: '참가 후기를 불러오지 못했습니다.' });
  res.json({ reviews: data });
});

module.exports = router;
