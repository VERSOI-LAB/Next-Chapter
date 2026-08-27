const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

router.post('/confirm', optionalAuth, async (req, res) => {
  const { applicationId, paymentKey, orderId, amount } = req.body || {};
  if (!applicationId || !paymentKey || !orderId || amount === undefined || amount === null) {
    return res.status(400).json({ error: '결제 정보가 올바르지 않습니다.' });
  }

  let query = supabaseAdmin
    .from('applications')
    .select('id, user_id, journey_id, journey:journeys(price)')
    .eq('id', applicationId);
  query = req.user ? query.eq('user_id', req.user.id) : query.is('user_id', null);
  const { data: application } = await query.single();
  if (!application) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });

  const expectedAmount = application.journey?.price !== null && application.journey?.price !== undefined
    ? Number(application.journey.price) : null;
  if (expectedAmount !== null && Number(amount) !== expectedAmount) {
    return res.status(400).json({ error: '결제금액이 일치하지 않습니다.' });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: '결제 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.' });

  const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

  let tossRes, tossData;
  try {
    tossRes = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });
    tossData = await tossRes.json();
  } catch (err) {
    return res.status(502).json({ error: '결제 서버와 통신에 실패했습니다.' });
  }

  const status = tossRes.ok ? 'paid' : 'failed';

  await supabaseAdmin.from('payments').upsert({
    application_id: application.id,
    user_id: req.user ? req.user.id : null,
    journey_id: application.journey_id,
    order_id: orderId,
    payment_key: paymentKey,
    amount: Number(amount),
    status,
    method: tossData.method || null,
    raw_response: tossData,
  }, { onConflict: 'order_id' });

  if (!tossRes.ok) {
    return res.status(tossRes.status || 500).json({ error: tossData.message || '결제 승인에 실패했습니다.' });
  }

  res.json({ payment: tossData });
});

module.exports = router;
