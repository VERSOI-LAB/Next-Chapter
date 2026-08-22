const express = require('express');
const multer = require('multer');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { getSignedUrl, getSignedUrls } = require('../lib/storage');
const { VERIFY_TYPES } = require('../lib/verificationDocs');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const journeyImageUpload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });
const JOURNEY_IMAGES_BUCKET = 'journey-images';

const storyImageUpload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });
const STORY_IMAGES_BUCKET = 'story-images';

async function uploadStoryImage(folder, id, file) {
  const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${id}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(STORY_IMAGES_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
  if (error) throw new Error('이미지 업로드에 실패했습니다.');
  return supabaseAdmin.storage.from(STORY_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

const JOURNEY_FIELDS = ['slug', 'title', 'type', 'duration', 'capacity_male', 'capacity_female', 'price', 'status', 'summary', 'description', 'image_url', 'starts_at', 'itinerary', 'destination_country', 'destination_city'];

function pickJourneyFields(body) {
  const out = {};
  for (const key of JOURNEY_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

const PHOTOS_BUCKET = 'profile-photos';
const DOCS_BUCKET = 'verification-docs';

async function attachProfileDetails(profiles) {
  const userIds = [...new Set(profiles.map((p) => p.id).filter(Boolean))];
  if (!userIds.length) return profiles;

  const [{ data: photoRows }, { data: docRows }, { data: verifRows }] = await Promise.all([
    supabaseAdmin.from('profile_photos').select('id, user_id, file_path, is_main, sort_order').in('user_id', userIds).order('sort_order', { ascending: true }),
    supabaseAdmin.from('verification_documents').select('user_id, type, slot_key, file_name, file_path, uploaded_at').in('user_id', userIds),
    supabaseAdmin.from('verifications').select('user_id, type, status').in('user_id', userIds),
  ]);

  const videoPaths = profiles.map((p) => p.verification_video_path).filter(Boolean);
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

  return profiles.map((p) => {
    const verifications = {};
    VERIFY_TYPES.forEach((type) => { verifications[type] = (verifByUser[p.id] || {})[type] || 'not_submitted'; });

    return {
      ...p,
      verification_video_url: p.verification_video_path ? (videoUrlMap[p.verification_video_path] || null) : null,
      photos: photosByUser[p.id] || [],
      verifications,
      documents: docsByUser[p.id] || {},
    };
  });
}

async function attachApplicantDetails(applications) {
  const profiles = applications.map((app) => app.profile).filter(Boolean);
  const enriched = await attachProfileDetails(profiles);
  const byId = new Map(enriched.map((p) => [p.id, p]));
  return applications.map((app) => (app.profile ? { ...app, profile: byId.get(app.profile.id) || app.profile } : app));
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

function slugify(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'journey'}-${Date.now().toString(36)}`;
}

router.post('/journeys', async (req, res) => {
  const payload = pickJourneyFields(req.body || {});
  if (!payload.title || !payload.type) {
    return res.status(400).json({ error: '제목과 구분은 필수입니다.' });
  }
  if (!payload.slug) payload.slug = slugify(payload.title);
  if (!payload.status) payload.status = 'draft';

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

router.delete('/journeys/:id', async (req, res) => {
  const { count } = await supabaseAdmin
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('journey_id', req.params.id);

  if ((count || 0) > 0) {
    return res.status(400).json({ error: '신청 내역이 있는 여행은 삭제할 수 없습니다. 마감 처리해주세요.' });
  }

  const { error } = await supabaseAdmin.from('journeys').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: '삭제에 실패했습니다.' });
  res.json({ ok: true });
});

router.post('/journeys/:id/image', journeyImageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '이미지 파일을 선택해주세요.' });
  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: '이미지 파일만 업로드할 수 있습니다.' });
  }

  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const path = `${req.params.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(JOURNEY_IMAGES_BUCKET)
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
  if (uploadError) return res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });

  const { data: publicUrlData } = supabaseAdmin.storage.from(JOURNEY_IMAGES_BUCKET).getPublicUrl(path);
  const image_url = publicUrlData.publicUrl;

  const { data, error } = await supabaseAdmin
    .from('journeys')
    .update({ image_url })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '이미지 저장에 실패했습니다.' });
  res.json({ journey: data });
});

router.get('/journeys/:id/roster', async (req, res) => {
  const { data: journey, error: journeyError } = await supabaseAdmin
    .from('journeys')
    .select('id, title, capacity_male, capacity_female')
    .eq('id', req.params.id)
    .single();
  if (journeyError || !journey) return res.status(404).json({ error: '여행을 찾을 수 없습니다.' });

  const [{ data: groups, error: groupsError }, { data: rawApplications, error: appsError }] = await Promise.all([
    supabaseAdmin.from('journey_groups').select('id, name, created_at').eq('journey_id', journey.id).order('created_at', { ascending: true }),
    supabaseAdmin
      .from('applications')
      .select(`id, group_id, profile:profiles(${PROFILE_DETAIL_FIELDS})`)
      .eq('journey_id', journey.id)
      .eq('status', 'approved'),
  ]);
  if (groupsError || appsError) return res.status(500).json({ error: '매칭 현황을 불러오지 못했습니다.' });

  const applications = await attachApplicantDetails(rawApplications);

  const groupsWithMembers = (groups || []).map((g) => ({
    ...g,
    members: applications.filter((a) => a.group_id === g.id),
  }));

  const unassigned = applications.filter((a) => !a.group_id);
  res.json({
    journey,
    groups: groupsWithMembers,
    unassigned: {
      male: unassigned.filter((a) => a.profile?.gender === 'male'),
      female: unassigned.filter((a) => a.profile?.gender === 'female'),
      other: unassigned.filter((a) => a.profile?.gender !== 'male' && a.profile?.gender !== 'female'),
    },
  });
});

async function tryAutoAssignLodging(journey, bookingId) {
  if (journey.type !== 'domestic' || !journey.destination_country || !journey.destination_city) return;

  const { data: partners } = await supabaseAdmin
    .from('lodging_partners')
    .select('*')
    .eq('active', true)
    .eq('destination_country', journey.destination_country)
    .eq('destination_city', journey.destination_city)
    .order('sort_order', { ascending: true });
  if (!partners || !partners.length) return;

  // A partner is treated as private-use-only per group, so it can't host two groups
  // departing on the same date. Same-date confirmed bookings mark it busy.
  const { data: confirmedLodging } = await supabaseAdmin
    .from('bookings')
    .select('provider, journey:journeys(starts_at)')
    .eq('type', 'lodging')
    .eq('status', 'confirmed');

  const busyProviderNames = new Set(
    (confirmedLodging || [])
      .filter((b) => journey.starts_at && b.journey?.starts_at === journey.starts_at)
      .map((b) => b.provider)
  );

  const available = partners.find((p) => !busyProviderNames.has(p.name));
  if (!available) return;

  await supabaseAdmin
    .from('bookings')
    .update({
      status: 'confirmed',
      provider: available.name,
      cost: available.price,
      confirmation_no: `AUTO-${bookingId.slice(0, 8).toUpperCase()}`,
      details: { auto_assigned: true, partner_id: available.id },
    })
    .eq('id', bookingId);
}

async function tryRequestFlightQuote(journey, bookingId) {
  if (journey.type !== 'overseas' || !journey.destination_country) return;

  const { data: agencies } = await supabaseAdmin
    .from('travel_agencies')
    .select('*')
    .eq('active', true)
    .eq('destination_country', journey.destination_country)
    .order('sort_order', { ascending: true })
    .limit(1);
  if (!agencies || !agencies.length) return;

  const agency = agencies[0];
  await supabaseAdmin
    .from('bookings')
    .update({
      status: 'requested',
      provider: agency.name,
      details: { agency_id: agency.id, requested_at: new Date().toISOString() },
    })
    .eq('id', bookingId);
}

async function maybeCreateBookings(journeyId, groupId) {
  const { data: journey } = await supabaseAdmin
    .from('journeys')
    .select('id, type, capacity_male, capacity_female, destination_country, destination_city, starts_at')
    .eq('id', journeyId)
    .single();
  if (!journey) return;

  const { data: members } = await supabaseAdmin
    .from('applications')
    .select('id, profile:profiles(gender)')
    .eq('group_id', groupId)
    .eq('status', 'approved');

  const maleCount = (members || []).filter((m) => m.profile?.gender === 'male').length;
  const femaleCount = (members || []).filter((m) => m.profile?.gender === 'female').length;
  if (maleCount < journey.capacity_male || femaleCount < journey.capacity_female) return;

  const { data: existing } = await supabaseAdmin.from('bookings').select('type').eq('group_id', groupId);
  const existingTypes = new Set((existing || []).map((b) => b.type));

  const paxCount = maleCount + femaleCount;
  const rows = [];
  if (!existingTypes.has('lodging')) {
    rows.push({ journey_id: journeyId, group_id: groupId, type: 'lodging', pax_count: paxCount });
  }
  if (journey.type === 'overseas' && !existingTypes.has('flight')) {
    rows.push({ journey_id: journeyId, group_id: groupId, type: 'flight', pax_count: paxCount });
  }
  if (!rows.length) return;

  const { data: inserted } = await supabaseAdmin.from('bookings').insert(rows).select();
  const lodgingRow = (inserted || []).find((b) => b.type === 'lodging');
  const flightRow = (inserted || []).find((b) => b.type === 'flight');
  if (lodgingRow) await tryAutoAssignLodging(journey, lodgingRow.id);
  if (flightRow) await tryRequestFlightQuote(journey, flightRow.id);
}

router.post('/journeys/:id/groups', async (req, res) => {
  const { application_ids: applicationIds } = req.body || {};
  if (!Array.isArray(applicationIds) || !applicationIds.length) {
    return res.status(400).json({ error: '팀에 포함할 신청자를 선택해주세요.' });
  }

  const { count } = await supabaseAdmin
    .from('journey_groups')
    .select('id', { count: 'exact', head: true })
    .eq('journey_id', req.params.id);

  const { data: group, error: groupError } = await supabaseAdmin
    .from('journey_groups')
    .insert({ journey_id: req.params.id, name: `${(count || 0) + 1}조` })
    .select()
    .single();
  if (groupError) return res.status(500).json({ error: '팀 생성에 실패했습니다.' });

  const { error: updateError } = await supabaseAdmin
    .from('applications')
    .update({ group_id: group.id })
    .in('id', applicationIds)
    .eq('journey_id', req.params.id);
  if (updateError) return res.status(500).json({ error: '팀원 배정에 실패했습니다.' });

  await maybeCreateBookings(req.params.id, group.id);
  res.status(201).json({ group });
});

router.patch('/groups/:groupId', async (req, res) => {
  const { add_ids: addIds, remove_ids: removeIds } = req.body || {};

  if (Array.isArray(addIds) && addIds.length) {
    const { error } = await supabaseAdmin.from('applications').update({ group_id: req.params.groupId }).in('id', addIds);
    if (error) return res.status(500).json({ error: '팀원 추가에 실패했습니다.' });
  }
  if (Array.isArray(removeIds) && removeIds.length) {
    const { error } = await supabaseAdmin.from('applications').update({ group_id: null }).in('id', removeIds).eq('group_id', req.params.groupId);
    if (error) return res.status(500).json({ error: '팀원 제외에 실패했습니다.' });
  }

  if (Array.isArray(addIds) && addIds.length) {
    const { data: group } = await supabaseAdmin.from('journey_groups').select('journey_id').eq('id', req.params.groupId).single();
    if (group) await maybeCreateBookings(group.journey_id, req.params.groupId);
  }

  res.json({ ok: true });
});

router.delete('/groups/:groupId', async (req, res) => {
  const { error } = await supabaseAdmin.from('journey_groups').delete().eq('id', req.params.groupId);
  if (error) return res.status(500).json({ error: '팀 삭제에 실패했습니다.' });
  res.json({ ok: true });
});

const MEMBER_FIELDS = `id, username, full_name, phone, gender, birth_year, role, verification_status, created_at, ${PROFILE_DETAIL_FIELDS.split(', ').filter((f) => !['id', 'full_name', 'phone', 'gender', 'birth_year', 'verification_status'].includes(f)).join(', ')}`;

router.get('/members', async (req, res) => {
  const { verification, q } = req.query;
  let query = supabaseAdmin.from('profiles').select(MEMBER_FIELDS).order('created_at', { ascending: false });

  if (verification) query = query.eq('verification_status', verification);
  if (q) query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%,phone.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: '회원 목록을 불러오지 못했습니다.' });
  res.json({ members: await attachProfileDetails(data) });
});

router.get('/permissions/admins', requireSuperAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role, created_at')
    .in('role', ['admin', 'super_admin'])
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: '관리자 목록을 불러오지 못했습니다.' });

  const withEmail = await Promise.all(data.map(async (p) => {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(p.id);
    return { ...p, email: userData?.user?.email || null };
  }));

  res.json({ admins: withEmail });
});

router.post('/permissions/admins', requireSuperAdmin, async (req, res) => {
  const { email, username, password, full_name } = req.body || {};
  if (!email || !username || !password || !full_name) {
    return res.status(400).json({ error: '이메일, 아이디, 비밀번호, 이름을 모두 입력해주세요.' });
  }
  if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, username },
  });
  if (createError) return res.status(400).json({ error: createError.message });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', created.user.id)
    .select('id, username, full_name, role, created_at')
    .single();
  if (profileError) return res.status(500).json({ error: '관리자 권한 설정에 실패했습니다.' });

  res.status(201).json({ admin: { ...profile, email } });
});

router.patch('/permissions/admins/:id/revoke', requireSuperAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: '자기 자신의 권한은 여기서 해제할 수 없습니다.' });
  }

  const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', req.params.id).single();
  if (target?.role === 'super_admin') {
    return res.status(400).json({ error: '최고관리자 권한은 해제할 수 없습니다.' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'user' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '권한 해제에 실패했습니다.' });
  res.json({ profile: data });
});

router.get('/revenue', async (req, res) => {
  const { from, to, journey_id: journeyId, q } = req.query;

  let query = supabaseAdmin
    .from('payments')
    .select('id, amount, status, created_at, journey_id, journey:journeys(id, title), user_id, profile:profiles(id, full_name, phone)')
    .in('status', ['paid', 'refunded'])
    .order('created_at', { ascending: false });

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  if (journeyId) query = query.eq('journey_id', journeyId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: '매출 데이터를 불러오지 못했습니다.' });

  const paid = data.filter((p) => p.status === 'paid');
  const refunded = data.filter((p) => p.status === 'refunded');
  const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = refunded.reduce((sum, p) => sum + p.amount, 0);

  const byJourneyMap = {};
  paid.forEach((p) => {
    const key = p.journey_id || 'unknown';
    byJourneyMap[key] = byJourneyMap[key] || { journey_id: p.journey_id, title: p.journey?.title || '알 수 없음', amount: 0, count: 0 };
    byJourneyMap[key].amount += p.amount;
    byJourneyMap[key].count += 1;
  });

  const { data: confirmedBookings } = await supabaseAdmin
    .from('bookings')
    .select('journey_id, cost')
    .eq('status', 'confirmed')
    .not('cost', 'is', null);

  const bookingCostByJourney = {};
  (confirmedBookings || []).forEach((b) => {
    bookingCostByJourney[b.journey_id] = (bookingCostByJourney[b.journey_id] || 0) + Number(b.cost);
  });
  const totalBookingCost = Object.values(bookingCostByJourney).reduce((sum, c) => sum + c, 0);

  Object.keys(byJourneyMap).forEach((key) => {
    const row = byJourneyMap[key];
    row.booking_cost = bookingCostByJourney[row.journey_id] || 0;
    row.margin = row.amount - row.booking_cost;
  });

  let transactions = data;
  if (q) {
    const needle = q.trim().replace(/-/g, '');
    transactions = data.filter((p) => {
      const name = p.profile?.full_name || '';
      const phone = (p.profile?.phone || '').replace(/-/g, '');
      return name.includes(q.trim()) || phone.includes(needle);
    });
  }

  res.json({
    summary: {
      total_paid: totalPaid,
      total_refunded: totalRefunded,
      net_revenue: totalPaid - totalRefunded,
      total_booking_cost: totalBookingCost,
      estimated_margin: totalPaid - totalRefunded - totalBookingCost,
      paid_count: paid.length,
      refunded_count: refunded.length,
    },
    by_journey: Object.values(byJourneyMap).sort((a, b) => b.amount - a.amount),
    transactions: transactions.slice(0, 200),
  });
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

const STORY_QUOTE_FIELDS = ['tag', 'title', 'body', 'image_url', 'sort_order'];
const STORY_REVIEW_FIELDS = ['review_date', 'program', 'review_text', 'image_url', 'sort_order'];

function pickFields(body, fields) {
  const out = {};
  for (const key of fields) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

router.get('/story-quotes', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('story_quotes').select('*').order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: '스토리 카드를 불러오지 못했습니다.' });
  res.json({ quotes: data });
});

router.post('/story-quotes', async (req, res) => {
  const payload = pickFields(req.body || {}, STORY_QUOTE_FIELDS);
  if (!payload.title || !payload.body) {
    return res.status(400).json({ error: '제목과 본문은 필수입니다.' });
  }
  if (!payload.tag) payload.tag = 'Editorial';

  const { data, error } = await supabaseAdmin.from('story_quotes').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ quote: data });
});

router.put('/story-quotes/:id', async (req, res) => {
  const payload = pickFields(req.body || {}, STORY_QUOTE_FIELDS);
  const { data, error } = await supabaseAdmin.from('story_quotes').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ quote: data });
});

router.delete('/story-quotes/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('story_quotes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: '삭제에 실패했습니다.' });
  res.json({ ok: true });
});

router.post('/story-quotes/:id/image', storyImageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '이미지 파일을 선택해주세요.' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: '이미지 파일만 업로드할 수 있습니다.' });

  try {
    const image_url = await uploadStoryImage('quotes', req.params.id, req.file);
    const { data, error } = await supabaseAdmin.from('story_quotes').update({ image_url }).eq('id', req.params.id).select().single();
    if (error) throw new Error('이미지 저장에 실패했습니다.');
    res.json({ quote: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/story-reviews', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('story_reviews').select('*').order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: '참가 후기를 불러오지 못했습니다.' });
  res.json({ reviews: data });
});

router.post('/story-reviews', async (req, res) => {
  const payload = pickFields(req.body || {}, STORY_REVIEW_FIELDS);
  if (!payload.program || !payload.review_text) {
    return res.status(400).json({ error: '프로그램명과 후기 내용은 필수입니다.' });
  }
  if (!payload.review_date) payload.review_date = 'Coming Soon';

  const { data, error } = await supabaseAdmin.from('story_reviews').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ review: data });
});

router.put('/story-reviews/:id', async (req, res) => {
  const payload = pickFields(req.body || {}, STORY_REVIEW_FIELDS);
  const { data, error } = await supabaseAdmin.from('story_reviews').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ review: data });
});

router.delete('/story-reviews/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('story_reviews').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: '삭제에 실패했습니다.' });
  res.json({ ok: true });
});

router.post('/story-reviews/:id/image', storyImageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '이미지 파일을 선택해주세요.' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: '이미지 파일만 업로드할 수 있습니다.' });

  try {
    const image_url = await uploadStoryImage('reviews', req.params.id, req.file);
    const { data, error } = await supabaseAdmin.from('story_reviews').update({ image_url }).eq('id', req.params.id).select().single();
    if (error) throw new Error('이미지 저장에 실패했습니다.');
    res.json({ review: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const BOOKING_SELECT = '*, journey:journeys(id, title, type, destination_country, destination_city, starts_at), group:journey_groups(id, name)';
const BOOKING_FIELDS = ['status', 'provider', 'cost', 'confirmation_no', 'details', 'partner_notified_at'];
const BOOKING_STATUSES = ['draft', 'requested', 'confirmed', 'failed', 'cancelled'];

async function attachBookingPaymentSummary(bookings) {
  const groupIds = [...new Set(bookings.map((b) => b.group_id))];
  if (!groupIds.length) return bookings;

  const { data: members } = await supabaseAdmin
    .from('applications')
    .select('group_id, user_id, journey_id')
    .in('group_id', groupIds)
    .eq('status', 'approved');

  const userIds = [...new Set((members || []).map((m) => m.user_id))];
  const { data: payments } = userIds.length
    ? await supabaseAdmin.from('payments').select('user_id, journey_id, amount').in('user_id', userIds).eq('status', 'paid')
    : { data: [] };

  return bookings.map((b) => {
    const memberUserIds = new Set((members || []).filter((m) => m.group_id === b.group_id).map((m) => m.user_id));
    const relevant = (payments || []).filter((p) => memberUserIds.has(p.user_id) && p.journey_id === b.journey_id);
    return { ...b, paid_participant_count: relevant.length, paid_total: relevant.reduce((sum, p) => sum + p.amount, 0) };
  });
}

router.get('/bookings', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: '예약 목록을 불러오지 못했습니다.' });
  res.json({ bookings: await attachBookingPaymentSummary(data) });
});

router.patch('/bookings/:id', async (req, res) => {
  const payload = pickFields(req.body || {}, BOOKING_FIELDS);
  if (payload.status && !BOOKING_STATUSES.includes(payload.status)) {
    return res.status(400).json({ error: '올바르지 않은 상태값입니다.' });
  }

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update(payload)
    .eq('id', req.params.id)
    .select(BOOKING_SELECT)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  const [withPayments] = await attachBookingPaymentSummary([data]);
  res.json({ booking: withPayments });
});

router.post('/bookings/:id/retry', async (req, res) => {
  const { data: booking } = await supabaseAdmin.from('bookings').select('*, journey:journeys(*)').eq('id', req.params.id).single();
  if (!booking) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });

  if (booking.type === 'lodging') await tryAutoAssignLodging(booking.journey, booking.id);
  if (booking.type === 'flight') await tryRequestFlightQuote(booking.journey, booking.id);

  const { data, error } = await supabaseAdmin.from('bookings').select(BOOKING_SELECT).eq('id', req.params.id).single();
  if (error) return res.status(500).json({ error: '예약 정보를 다시 불러오지 못했습니다.' });
  const [withPayments] = await attachBookingPaymentSummary([data]);
  res.json({ booking: withPayments });
});

const LODGING_PARTNER_FIELDS = ['destination_country', 'destination_city', 'name', 'contact_name', 'contact_phone', 'price', 'notes', 'active', 'sort_order'];

router.get('/lodging-partners', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('lodging_partners')
    .select('*')
    .order('destination_city', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: '숙소 파트너 목록을 불러오지 못했습니다.' });
  res.json({ partners: data });
});

router.post('/lodging-partners', async (req, res) => {
  const payload = pickFields(req.body || {}, LODGING_PARTNER_FIELDS);
  if (!payload.destination_country || !payload.destination_city || !payload.name) {
    return res.status(400).json({ error: '목적지 국가·도시와 업체명은 필수입니다.' });
  }

  const { data, error } = await supabaseAdmin.from('lodging_partners').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ partner: data });
});

router.put('/lodging-partners/:id', async (req, res) => {
  const payload = pickFields(req.body || {}, LODGING_PARTNER_FIELDS);
  const { data, error } = await supabaseAdmin.from('lodging_partners').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ partner: data });
});

router.delete('/lodging-partners/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('lodging_partners').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: '삭제에 실패했습니다.' });
  res.json({ ok: true });
});

const TRAVEL_AGENCY_FIELDS = ['destination_country', 'name', 'contact_name', 'contact_phone', 'contact_email', 'notes', 'active', 'sort_order'];

router.get('/travel-agencies', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('travel_agencies')
    .select('*')
    .order('destination_country', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: '여행사 파트너 목록을 불러오지 못했습니다.' });
  res.json({ agencies: data });
});

router.post('/travel-agencies', async (req, res) => {
  const payload = pickFields(req.body || {}, TRAVEL_AGENCY_FIELDS);
  if (!payload.destination_country || !payload.name) {
    return res.status(400).json({ error: '목적지 국가와 여행사명은 필수입니다.' });
  }

  const { data, error } = await supabaseAdmin.from('travel_agencies').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ agency: data });
});

router.put('/travel-agencies/:id', async (req, res) => {
  const payload = pickFields(req.body || {}, TRAVEL_AGENCY_FIELDS);
  const { data, error } = await supabaseAdmin.from('travel_agencies').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ agency: data });
});

router.delete('/travel-agencies/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('travel_agencies').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: '삭제에 실패했습니다.' });
  res.json({ ok: true });
});

module.exports = router;
