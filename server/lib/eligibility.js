// Journey application eligibility rules.
//
// All journeys (STANDARD and SIGNATURE) require: 내 프로필 완성 (core self-profile
// fields + min photos) and 혼인관계증명서 제출 (본인인증/phone is satisfied
// automatically — every account passes phone SMS verification at signup, so it
// is not re-checked here).
//
// SIGNATURE journeys (journeys.type === 'signature') additionally require
// 직업·학력·소득 증빙 제출. 자산 stays optional even for signature.

const SELF_PROFILE_CORE_FIELDS = [
  'birth_year', 'region', 'region_detail', 'height', 'degree', 'university',
  'job_major', 'job_minor', 'company_name', 'salary', 'asset',
];
const PROFILE_PHOTO_MIN = 3;

// Matches the conditional fields shown by buildJobRow() in public/js/mypage-profile.js
const JOB_TERTIARY_REQUIRED_MAJOR = '법조 / 회계 / 전문 자격';
const JOB_CUSTOM_REQUIRED_MINOR = '기타 (직접 입력)';

const BASELINE_VERIFY_TYPES = ['marital'];
const SIGNATURE_EXTRA_VERIFY_TYPES = ['job', 'education', 'income'];

function isFilled(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function getMissingProfileFields(profile) {
  const p = profile || {};
  const missing = SELF_PROFILE_CORE_FIELDS.filter((f) => !isFilled(p[f]));
  if (p.job_major === JOB_TERTIARY_REQUIRED_MAJOR && !isFilled(p.job_tertiary)) missing.push('job_tertiary');
  if (p.job_minor === JOB_CUSTOM_REQUIRED_MINOR && !isFilled(p.job_custom)) missing.push('job_custom');
  return missing;
}

function getMissingVerifyTypes(verificationsByType, types) {
  return types.filter((t) => !verificationsByType[t] || verificationsByType[t] === 'not_submitted');
}

async function getEligibility(supabaseAdmin, userId, journeyType) {
  const [{ data: profile }, { count: photoCount }, { data: verifRows }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('birth_year, region, region_detail, height, degree, university, job_major, job_minor, job_tertiary, job_custom, company_name, salary, asset')
      .eq('id', userId)
      .single(),
    supabaseAdmin.from('profile_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('verifications').select('type, status').eq('user_id', userId),
  ]);

  const verificationsByType = {};
  (verifRows || []).forEach((r) => { verificationsByType[r.type] = r.status; });

  const missingProfileFields = getMissingProfileFields(profile);
  const resolvedPhotoCount = photoCount || 0;
  const profileComplete = missingProfileFields.length === 0 && resolvedPhotoCount >= PROFILE_PHOTO_MIN;

  const missingBaselineVerify = getMissingVerifyTypes(verificationsByType, BASELINE_VERIFY_TYPES);
  const missingSignatureVerify = journeyType === 'signature'
    ? getMissingVerifyTypes(verificationsByType, SIGNATURE_EXTRA_VERIFY_TYPES)
    : [];
  const missingVerifyTypes = [...missingBaselineVerify, ...missingSignatureVerify];

  return {
    eligible: profileComplete && missingVerifyTypes.length === 0,
    profile_complete: profileComplete,
    missing_profile_fields: missingProfileFields,
    photo_count: resolvedPhotoCount,
    photo_min: PROFILE_PHOTO_MIN,
    missing_verify_types: missingVerifyTypes,
  };
}

// Re-derives and persists profiles.self_profile_completed for a user. Call
// this after anything that can change core-field or photo-count state
// (self-profile save, photo add/remove).
async function recomputeSelfProfileCompleted(supabaseAdmin, userId) {
  const [{ data: profile }, { count: photoCount }] = await Promise.all([
    supabaseAdmin.from('profiles').select(SELF_PROFILE_CORE_FIELDS.concat(['job_tertiary', 'job_custom']).join(', ')).eq('id', userId).single(),
    supabaseAdmin.from('profile_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const missing = getMissingProfileFields(profile);
  const complete = missing.length === 0 && (photoCount || 0) >= PROFILE_PHOTO_MIN;

  await supabaseAdmin.from('profiles').update({ self_profile_completed: complete }).eq('id', userId);
  return complete;
}

module.exports = {
  SELF_PROFILE_CORE_FIELDS,
  PROFILE_PHOTO_MIN,
  BASELINE_VERIFY_TYPES,
  SIGNATURE_EXTRA_VERIFY_TYPES,
  getMissingProfileFields,
  getEligibility,
  recomputeSelfProfileCompleted,
};
