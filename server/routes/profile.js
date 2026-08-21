const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
