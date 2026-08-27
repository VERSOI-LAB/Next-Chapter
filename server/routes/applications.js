const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { CONSENT_VERSION, CONSENT_TYPES } = require('../lib/consents');
const { getEligibility } = require('../lib/eligibility');

const router = express.Router();

// NOTE: guest checkout (optionalAuth + guest_* fields) is a temporary opening
// for Toss Payments merchant review. It skips the member eligibility check
// (identity/marital-status verification) below since guests have no profile
// to check. Once review is complete, switch these routes back to requireAuth
// and remove the guest branches to restore the verification requirement.

router.post('/', optionalAuth, async (req, res) => {
  const {
    journey_id, message,
    agree_member_info_share: agreeMemberInfo, agree_travel_third_party: agreeTravelThirdParty,
    guest_name: guestName, guest_email: guestEmail, guest_phone: guestPhone,
  } = req.body || {};
  if (!journey_id) return res.status(400).json({ error: '여행을 선택해주세요.' });
  if (!agreeMemberInfo || !agreeTravelThirdParty) {
    return res.status(400).json({ error: '필수 동의 항목을 모두 체크해주세요.' });
  }

  const isGuest = !req.user;
  if (isGuest && (!guestName || !guestEmail || !guestPhone)) {
    return res.status(400).json({ error: '이름, 연락처, 이메일을 입력해주세요.' });
  }

  const { data: journey, error: journeyError } = await supabaseAdmin
    .from('journeys')
    .select('id, status, type')
    .eq('id', journey_id)
    .single();

  if (journeyError || !journey) return res.status(404).json({ error: '여행을 찾을 수 없습니다.' });
  if (!['open', 'coming_soon'].includes(journey.status)) return res.status(400).json({ error: '현재 신청할 수 없는 여행입니다.' });

  if (!isGuest) {
    const eligibility = await getEligibility(supabaseAdmin, req.user.id, journey.type);
    if (!eligibility.eligible) {
      return res.status(403).json({ error: '신청 조건을 아직 충족하지 못했습니다. 마이페이지에서 필요한 항목을 완료해주세요.', eligibility });
    }
  }

  const insertRow = isGuest
    ? { user_id: null, journey_id, message: message || null, guest_name: guestName, guest_email: guestEmail, guest_phone: guestPhone }
    : { user_id: req.user.id, journey_id, message: message || null };

  const { data, error } = await supabaseAdmin
    .from('applications')
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: '이미 신청한 여행입니다.' });
    return res.status(500).json({ error: '신청에 실패했습니다.' });
  }

  await supabaseAdmin.from('consents').insert([
    { user_id: isGuest ? null : req.user.id, application_id: data.id, type: CONSENT_TYPES.MEMBER_INFO_SHARE, agreed: true, version: CONSENT_VERSION },
    { user_id: isGuest ? null : req.user.id, application_id: data.id, type: CONSENT_TYPES.TRAVEL_THIRD_PARTY, agreed: true, version: CONSENT_VERSION },
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

router.get('/:id', optionalAuth, async (req, res) => {
  let query = supabaseAdmin
    .from('applications')
    .select(`*,
      journey:journeys(id, slug, title, type, duration, starts_at, image_url, price, destination_country, destination_city, matching_service_amount, travel_service_amount, capacity_male, capacity_female),
      profile:profiles(full_name, birth_year, phone)`)
    .eq('id', req.params.id);
  query = req.user ? query.eq('user_id', req.user.id) : query.is('user_id', null);
  const { data, error } = await query.single();

  if (error || !data) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });
  res.json({ application: { ...data, user_email: req.user ? req.user.email : data.guest_email } });
});

router.post('/:id/ack', optionalAuth, async (req, res) => {
  let query = supabaseAdmin.from('applications').select('id').eq('id', req.params.id);
  query = req.user ? query.eq('user_id', req.user.id) : query.is('user_id', null);
  const { data: application } = await query.single();
  if (!application) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });

  const ackTypes = [
    CONSENT_TYPES.CONTRACT_CONTENT, CONSENT_TYPES.CONTRACT_MATCH_COUNT, CONSENT_TYPES.CONTRACT_SERVICE_PERIOD,
    CONSENT_TYPES.CONTRACT_FEES, CONSENT_TYPES.CONTRACT_REFUND_LIMIT, CONSENT_TYPES.CONTRACT_NO_GUARANTEE,
  ];
  const rows = ackTypes.map((type) => ({ user_id: req.user ? req.user.id : null, application_id: application.id, type, agreed: true, version: CONSENT_VERSION }));
  const { error } = await supabaseAdmin.from('consents').insert(rows);
  if (error) return res.status(500).json({ error: '확인 처리에 실패했습니다.' });

  res.json({ ok: true });
});

router.delete('/:id', optionalAuth, async (req, res) => {
  let query = supabaseAdmin
    .from('applications')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('status', 'pending');
  query = req.user ? query.eq('user_id', req.user.id) : query.is('user_id', null);
  const { data, error } = await query.select().single();

  if (error || !data) return res.status(400).json({ error: '취소할 수 없는 신청입니다.' });
  res.json({ application: data });
});

module.exports = router;
