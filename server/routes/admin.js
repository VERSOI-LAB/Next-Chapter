const express = require('express');
const multer = require('multer');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getSignedUrl, getSignedUrls } = require('../lib/storage');
const { VERIFY_TYPES } = require('../lib/verificationDocs');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const journeyImageUpload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });
const JOURNEY_IMAGES_BUCKET = 'journey-images';

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

const ROSTER_PROFILE_FIELDS = 'id, full_name, gender, birth_year, verification_status';

router.get('/journeys/:id/roster', async (req, res) => {
  const { data: journey, error: journeyError } = await supabaseAdmin
    .from('journeys')
    .select('id, title, capacity_male, capacity_female')
    .eq('id', req.params.id)
    .single();
  if (journeyError || !journey) return res.status(404).json({ error: '여행을 찾을 수 없습니다.' });

  const [{ data: groups, error: groupsError }, { data: applications, error: appsError }] = await Promise.all([
    supabaseAdmin.from('journey_groups').select('id, name, created_at').eq('journey_id', journey.id).order('created_at', { ascending: true }),
    supabaseAdmin
      .from('applications')
      .select(`id, group_id, profile:profiles(${ROSTER_PROFILE_FIELDS})`)
      .eq('journey_id', journey.id)
      .eq('status', 'approved'),
  ]);
  if (groupsError || appsError) return res.status(500).json({ error: '매칭 현황을 불러오지 못했습니다.' });

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

router.patch('/members/:id/role', async (req, res) => {
  const { role } = req.body || {};
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: '올바르지 않은 권한 값입니다.' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ role })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '권한 변경에 실패했습니다.' });
  res.json({ profile: data });
});

router.get('/revenue', async (req, res) => {
  const { from, to, journey_id: journeyId } = req.query;

  let query = supabaseAdmin
    .from('payments')
    .select('id, amount, status, created_at, journey_id, journey:journeys(id, title), user_id, profile:profiles(id, full_name)')
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

  res.json({
    summary: {
      total_paid: totalPaid,
      total_refunded: totalRefunded,
      net_revenue: totalPaid - totalRefunded,
      paid_count: paid.length,
      refunded_count: refunded.length,
    },
    by_journey: Object.values(byJourneyMap).sort((a, b) => b.amount - a.amount),
    transactions: data.slice(0, 200),
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

module.exports = router;
