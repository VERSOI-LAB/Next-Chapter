// Auto-matching rules for team formation. Mirrors the bracket lists in
// public/js/profile-data.js (SALARY_BRACKETS / ASSET_BRACKETS) — keep in sync
// if those change.

const SALARY_BRACKETS = [
  '3,000만원 ~ 4,000만원 미만', '4,000만원 ~ 5,000만원 미만', '5,000만원 ~ 6,000만원 미만', '6,000만원 ~ 7,000만원 미만',
  '7,000만원 ~ 8,000만원 미만', '8,000만원 ~ 9,000만원 미만', '9,000만원 ~ 10,000만원 미만', '10,000만원 ~ 15,000만원 미만',
  '15,000만원 ~ 20,000만원 미만', '20,000만원 ~ 25,000만원 미만', '25,000만원 이상',
];

const ASSET_BRACKETS = [
  '5천만 원 미만', '5천만 원 ~ 1억 원 미만', '1억 원 ~ 3억 원 미만', '3억 원 ~ 5억 원 미만', '5억 원 ~ 10억 원 미만',
  '10억 원 ~ 20억 원 미만', '20억 원 ~ 50억 원 미만', '50억 원 이상 ~ 80억 원 미만', '80억 원 이상 ~ 100억 원 미만', '100억 이상',
];

// Seoul-campus subset of public/js/profile-data.js's UNIVERSITY_LIST. Any
// university not in this set (including free-typed names and non-Seoul
// campuses of the same school) is treated as "서울 외".
const SEOUL_UNIVERSITIES = new Set([
  '서울대학교', '연세대학교(신촌)', '고려대학교(안암)', '성균관대학교(서울)', '한양대학교(서울)',
  '중앙대학교(서울)', '경희대학교(서울)', '한국외국어대학교(서울)', '동국대학교(서울)', '건국대학교(서울)',
  '이화여자대학교', '서강대학교', '숙명여자대학교', '숭실대학교', '세종대학교',
  '홍익대학교(서울)', '국민대학교', '서울시립대학교', '광운대학교',
  '명지대학교(서울)', '상명대학교(서울)', '동덕여자대학교', '덕성여자대학교', '성신여자대학교',
  '경기대학교(서울)', '서울과학기술대학교', '인덕대학교', '동양미래대학교', '명지전문대학',
]);

// 의사/검사/판사/변호사 — exempt from the school-region rule regardless of
// which side of the pair they're on. job_minor values per profile-data.js.
const SCHOOL_RULE_EXEMPT_JOBS = new Set([
  '판사', '검사', '변호사', '의사 (봉직의/페이닥터)', '개업의 (원장 / 병원장)',
]);

function isSeoulUniversity(university) {
  return SEOUL_UNIVERSITIES.has((university || '').trim());
}

function isExemptJob(profile) {
  return SCHOOL_RULE_EXEMPT_JOBS.has(profile.job_minor);
}

function bracketIndex(list, value) {
  return list.indexOf(value);
}

function regionMatch(a, b) {
  return Boolean(a.region) && a.region === b.region;
}

function degreeMatch(a, b) {
  return Boolean(a.degree) && a.degree === b.degree;
}

function schoolMatch(a, b) {
  if (isExemptJob(a) || isExemptJob(b)) return true;
  if (!a.university || !b.university) return false;
  return isSeoulUniversity(a.university) === isSeoulUniversity(b.university);
}

function salaryMatch(male, female) {
  const mi = bracketIndex(SALARY_BRACKETS, male.salary);
  const fi = bracketIndex(SALARY_BRACKETS, female.salary);
  if (mi === -1 || fi === -1) return false;
  const diff = mi - fi;
  return diff === 0 || diff === 1 || diff === 2;
}

function assetMatch(male, female) {
  const mi = bracketIndex(ASSET_BRACKETS, male.asset);
  const fi = bracketIndex(ASSET_BRACKETS, female.asset);
  if (mi === -1 || fi === -1) return false;
  const diff = mi - fi;
  return diff === 0 || diff === 1;
}

function isCompatiblePair(male, female) {
  return (
    regionMatch(male, female) &&
    degreeMatch(male, female) &&
    schoolMatch(male, female) &&
    salaryMatch(male, female) &&
    assetMatch(male, female)
  );
}

// Finds the maximal complete bipartite subgroup (every male compatible with
// every female) reachable by narrowing from a seed male's compatible-female
// set. Converges because each step can only shrink (or hold) both sides.
function growBiclique(seedMale, males, females) {
  let F = females.filter((f) => isCompatiblePair(seedMale, f));
  let M = males.filter((m) => F.every((f) => isCompatiblePair(m, f)));

  for (let i = 0; i < 50; i++) {
    const nextF = F.filter((f) => M.every((m) => isCompatiblePair(m, f)));
    const nextM = M.filter((m) => nextF.every((f) => isCompatiblePair(m, f)));
    if (nextF.length === F.length && nextM.length === M.length) break;
    F = nextF;
    M = nextM;
  }
  return { M, F };
}

// Returns { teams: [{ males, females }], leftoverMales, leftoverFemales }.
// Each team is trimmed to exactly capacityMale/capacityFemale (earliest
// applicants first) and removed from the pool before searching for the next.
function findAutoMatchTeams(males, females, capacityMale, capacityFemale) {
  let poolM = [...males];
  let poolF = [...females];
  const teams = [];
  let bestPartial = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let best = null;
    for (const seed of poolM) {
      const { M, F } = growBiclique(seed, poolM, poolF);
      if (M.length >= capacityMale && F.length >= capacityFemale) {
        if (!best || M.length + F.length > best.M.length + best.F.length) best = { M, F };
      } else if (!bestPartial || M.length + F.length > bestPartial.M.length + bestPartial.F.length) {
        bestPartial = { M, F };
      }
    }
    if (!best) break;

    const sortByApplied = (list) => [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const teamMales = sortByApplied(best.M).slice(0, capacityMale);
    const teamFemales = sortByApplied(best.F).slice(0, capacityFemale);
    teams.push({ males: teamMales, females: teamFemales });

    const usedIds = new Set([...teamMales, ...teamFemales].map((p) => p.id));
    poolM = poolM.filter((m) => !usedIds.has(m.id));
    poolF = poolF.filter((f) => !usedIds.has(f.id));
  }

  return {
    teams,
    leftoverMales: poolM,
    leftoverFemales: poolF,
    bestPartial: teams.length === 0 ? bestPartial : null,
  };
}

module.exports = {
  SALARY_BRACKETS,
  ASSET_BRACKETS,
  SEOUL_UNIVERSITIES,
  SCHOOL_RULE_EXEMPT_JOBS,
  isCompatiblePair,
  findAutoMatchTeams,
};
