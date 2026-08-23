const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { CONSENT_VERSION, CONSENT_TYPES } = require('../lib/consents');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { journey_id, message, agree_member_info_share: agreeMemberInfo, agree_travel_third_party: agreeTravelThirdParty } = req.body || {};
  if (!journey_id) return res.status(400).json({ error: '여행을 선택해주세요.' });
  if (!agreeMemberInfo || !agreeTravelThirdParty) {
    return res.status(400).json({ error: '필수 동의 항목을 모두 체크해주세요.' });
  }

  const { data: journey, error: journeyError } = await supabaseAdmin
    .from('journeys')
    .select('id, status')
    .eq('id', journey_id)
    .single();

  if (journeyError || !journey) return res.status(404).json({ error: '여행을 찾을 수 없습니다.' });
  if (!['open', 'coming_soon'].includes(journey.status)) return res.status(400).json({ error: '현재 신청할 수 없는 여행입니다.' });

  const { data, error } = await supabaseAdmin
    .from('applications')
    .insert({ user_id: req.user.id, journey_id, message: message || null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: '이미 신청한 여행입니다.' });
    return res.status(500).json({ error: '신청에 실패했습니다.' });
  }

  await supabaseAdmin.from('consents').insert([
    { user_id: req.user.id, application_id: data.id, type: CONSENT_TYPES.MEMBER_INFO_SHARE, agreed: true, version: CONSENT_VERSION },
    { user_id: req.user.id, application_id: data.id, type: CONSENT_TYPES.TRAVEL_THIRD_PARTY, agreed: true, version: CONSENT_VERSION },
  ]);

  res.status(201).json({ application: data });
});

router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('*, journey:journeys(id, slug, title, type, duration, starts_at, image_url, itinerary)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: '신청 내역을 불러오지 못했습니다.' });
  res.json({ applications: data });
});

router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('applications')
    .select(`*,
      journey:journeys(id, slug, title, type, duration, starts_at, image_url, price, destination_country, destination_city, matching_service_amount, travel_service_amount, capacity_male, capacity_female),
      profile:profiles(full_name, birth_year, phone)`)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });
  res.json({ application: { ...data, user_email: req.user.email } });
});

router.post('/:id/ack', requireAuth, async (req, res) => {
  const { data: application } = await supabaseAdmin
    .from('applications')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (!application) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });

  const ackTypes = [
    CONSENT_TYPES.CONTRACT_CONTENT, CONSENT_TYPES.CONTRACT_MATCH_COUNT, CONSENT_TYPES.CONTRACT_SERVICE_PERIOD,
    CONSENT_TYPES.CONTRACT_FEES, CONSENT_TYPES.CONTRACT_REFUND_LIMIT, CONSENT_TYPES.CONTRACT_NO_GUARANTEE,
  ];
  const rows = ackTypes.map((type) => ({ user_id: req.user.id, application_id: application.id, type, agreed: true, version: CONSENT_VERSION }));
  const { error } = await supabaseAdmin.from('consents').insert(rows);
  if (error) return res.status(500).json({ error: '확인 처리에 실패했습니다.' });

  res.json({ ok: true });
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
