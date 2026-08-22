const PROFILE_PHOTO_MIN = 3;
const PROFILE_PHOTO_MAX = 6;

let selfProfileInitialized = false;
let selfProfile = {
  birth_year: '', region: '', region_detail: '', height: '', degree: '', university: '',
  job_major: '', job_minor: '', job_tertiary: '', job_custom: '', company_name: '', salary: '', asset: '',
};
let selfPhotos = [];
let selfVideoUrl = null;

const SELF_PROFILE_STEPS = [
  { title: '인증 자료', desc: '본인 확인을 위한 사진과 영상을 등록해주세요.' },
  { title: '기본 정보', desc: '나이, 지역, 신체 정보를 알려주세요.' },
  { title: '학력 & 직업', desc: '학력과 직업 정보를 입력해주세요.' },
  { title: '경제 정보', desc: '회사, 연봉, 자산 정보를 입력해주세요.' },
];
let selfProfileStep = 0;

const PROFILE_SIDE_CONTENT = [
  {
    image: 'img/journey-strip-3.jpg',
    eyebrow: '왜 필요한가요',
    title: '서로가 진짜 존재하는 사람이라는 확인',
    desc: '사진과 영상은 실제 만남 전, 상대방에게 신뢰를 주는 최소한의 장치예요. 상대방에게는 공개되지 않으며 인증 심사에만 사용됩니다.',
  },
  {
    image: 'img/journey-strip-4.jpg',
    eyebrow: '왜 필요한가요',
    title: '함께 여정을 떠날 그룹을 구성하는 기준',
    desc: '나이, 지역, 신체 정보는 비슷한 생활권과 연령대의 분들과 자연스럽게 어울릴 수 있는 그룹을 구성하는 데 활용돼요.',
  },
  {
    image: 'img/journey-strip-1.jpg',
    eyebrow: '왜 필요한가요',
    title: '대화의 결이 통하는 상대를 위해',
    desc: '학력과 직업은 조건으로 줄 세우기 위한 정보가 아니라, 더 깊은 대화가 가능한 조합을 만들기 위한 참고 기준이에요.',
  },
  {
    image: 'img/journey-strip-2.jpg',
    eyebrow: '왜 필요한가요',
    title: '안정적인 라이프스타일을 보여주는 지표',
    desc: '회사, 연봉, 자산 정보를 채울수록 더 신중하고 진지한 매칭이 가능해지고, 매칭 우선순위에도 긍정적인 영향을 줘요.',
  },
];

function renderProfileSidePanel(step) {
  const wrap = document.getElementById('profile-side-panel');
  if (!wrap) return;
  const content = PROFILE_SIDE_CONTENT[step];
  wrap.innerHTML = `
    <div class="profile-side-panel-media"><img src="${content.image}" alt=""></div>
    <div class="profile-side-panel-eyebrow">${content.eyebrow}</div>
    <h4>${content.title}</h4>
    <p>${content.desc}</p>`;
}

function fieldRow(labelText, inputEl) {
  const row = document.createElement('div');
  row.className = 'condition-row';
  const label = document.createElement('div');
  label.className = 'condition-label';
  label.innerText = labelText;
  row.appendChild(label);
  row.appendChild(inputEl);
  return row;
}

function buildSelect(options, currentValue, onChange, placeholder) {
  const select = document.createElement('select');
  const ph = document.createElement('option');
  ph.value = '';
  ph.innerText = placeholder || '선택';
  select.appendChild(ph);
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.innerText = opt;
    if (String(opt) === String(currentValue)) o.selected = true;
    select.appendChild(o);
  });
  select.onchange = (e) => onChange(e.target.value);
  return select;
}

function buildRegionRow() {
  const row = document.createElement('div');
  row.className = 'condition-row';
  const label = document.createElement('div');
  label.className = 'condition-label';
  label.innerText = '거주 지역';
  row.appendChild(label);

  const rangeRow = document.createElement('div');
  rangeRow.className = 'range-row';

  const majorSelect = document.createElement('select');
  REGION_OPTIONS.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.innerText = opt;
    if (opt === selfProfile.region) o.selected = true;
    majorSelect.appendChild(o);
  });

  const minorSelect = document.createElement('select');

  function populateMinor() {
    minorSelect.innerHTML = '';
    const subs = REGION_SUBAREAS[selfProfile.region] || [];
    subs.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.innerText = opt;
      if (opt === selfProfile.region_detail) o.selected = true;
      minorSelect.appendChild(o);
    });
    if (!subs.includes(selfProfile.region_detail)) {
      selfProfile.region_detail = subs[0] || '';
    }
  }

  if (!selfProfile.region) selfProfile.region = REGION_OPTIONS[0];
  majorSelect.value = selfProfile.region;
  majorSelect.onchange = (e) => { selfProfile.region = e.target.value; populateMinor(); };
  minorSelect.onchange = (e) => { selfProfile.region_detail = e.target.value; };

  populateMinor();

  rangeRow.appendChild(majorSelect);
  rangeRow.appendChild(minorSelect);
  row.appendChild(rangeRow);
  return row;
}

function buildSchoolAutocomplete() {
  const wrap = document.createElement('div');
  wrap.className = 'autocomplete-wrap';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '학교명을 입력해주세요 (예: 연세)';
  input.autocomplete = 'off';
  input.value = selfProfile.university || '';
  const list = document.createElement('div');
  list.className = 'autocomplete-list';
  list.style.display = 'none';
  wrap.appendChild(input);
  wrap.appendChild(list);

  function renderMatches() {
    const q = input.value.trim();
    list.innerHTML = '';
    if (!q) { list.style.display = 'none'; return; }
    const matches = UNIVERSITY_LIST.filter((u) => u.includes(q)).slice(0, 8);
    if (!matches.length) { list.style.display = 'none'; return; }
    matches.forEach((name) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerText = name;
      item.onmousedown = (e) => {
        e.preventDefault();
        input.value = name;
        selfProfile.university = name;
        list.style.display = 'none';
      };
      list.appendChild(item);
    });
    list.style.display = 'block';
  }

  input.oninput = (e) => { selfProfile.university = e.target.value; renderMatches(); };
  input.onfocus = renderMatches;
  input.onblur = () => { setTimeout(() => { list.style.display = 'none'; }, 150); };

  return wrap;
}

function buildDegreeRow() {
  const row = document.createElement('div');
  row.className = 'condition-row';
  const label = document.createElement('div');
  label.className = 'condition-label';
  label.innerText = '학위';
  row.appendChild(label);

  const sub1 = document.createElement('div');
  sub1.className = 'condition-sub';
  sub1.innerText = '최종 학위';
  row.appendChild(sub1);
  row.appendChild(buildSelect(DEGREE_OPTIONS, selfProfile.degree, (val) => { selfProfile.degree = val; }));

  const sub2 = document.createElement('div');
  sub2.className = 'condition-sub';
  sub2.innerText = '학교 구분';
  row.appendChild(sub2);
  row.appendChild(buildSchoolAutocomplete());

  return row;
}

function buildJobRow() {
  const row = document.createElement('div');
  row.className = 'condition-row';
  const label = document.createElement('div');
  label.className = 'condition-label';
  label.innerText = '직업';
  row.appendChild(label);

  const majorSelect = document.createElement('select');
  majorSelect.style.marginBottom = '8px';
  JOB_MAJOR_OPTIONS.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.innerText = opt;
    if (opt === selfProfile.job_major) o.selected = true;
    majorSelect.appendChild(o);
  });
  const minorSelect = document.createElement('select');
  row.appendChild(majorSelect);
  row.appendChild(minorSelect);

  const extraContainer = document.createElement('div');
  row.appendChild(extraContainer);

  function renderExtras() {
    extraContainer.innerHTML = '';
    const tertiaryOptions = JOB_TERTIARY_MAP[selfProfile.job_major];
    if (tertiaryOptions) {
      if (!tertiaryOptions.includes(selfProfile.job_tertiary)) selfProfile.job_tertiary = tertiaryOptions[0];
      const tertiarySelect = document.createElement('select');
      tertiarySelect.style.marginTop = '8px';
      tertiaryOptions.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt;
        o.innerText = opt;
        if (opt === selfProfile.job_tertiary) o.selected = true;
        tertiarySelect.appendChild(o);
      });
      tertiarySelect.onchange = (e) => { selfProfile.job_tertiary = e.target.value; };
      extraContainer.appendChild(tertiarySelect);
    } else {
      selfProfile.job_tertiary = '';
    }

    if (selfProfile.job_minor === '기타 (직접 입력)') {
      const customInput = document.createElement('input');
      customInput.type = 'text';
      customInput.style.marginTop = '8px';
      customInput.placeholder = '직업을 직접 입력해주세요';
      customInput.value = selfProfile.job_custom || '';
      customInput.oninput = (e) => { selfProfile.job_custom = e.target.value; };
      extraContainer.appendChild(customInput);
    } else {
      selfProfile.job_custom = '';
    }
  }

  function populateMinor() {
    minorSelect.innerHTML = '';
    const subs = JOB_CATEGORY_MAP[selfProfile.job_major] || [];
    subs.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.innerText = opt;
      if (opt === selfProfile.job_minor) o.selected = true;
      minorSelect.appendChild(o);
    });
    if (!subs.includes(selfProfile.job_minor)) selfProfile.job_minor = subs[0] || '';
    renderExtras();
  }

  if (!selfProfile.job_major) selfProfile.job_major = JOB_MAJOR_OPTIONS[0];
  majorSelect.value = selfProfile.job_major;
  majorSelect.onchange = (e) => { selfProfile.job_major = e.target.value; populateMinor(); };
  minorSelect.onchange = (e) => { selfProfile.job_minor = e.target.value; renderExtras(); };

  populateMinor();

  return row;
}

function renderPhotoGrid() {
  const grid = document.createElement('div');
  grid.className = 'photo-upload-grid';

  selfPhotos.forEach((photo) => {
    const cell = document.createElement('div');
    cell.className = 'photo-thumb' + (photo.is_main ? ' is-rep' : '');
    cell.innerHTML = `
      <img src="${photo.url}" alt="프로필 사진">
      ${photo.is_main ? '<div class="photo-rep-badge">대표</div>' : ''}
      <button type="button" class="photo-remove-btn" aria-label="삭제">×</button>`;
    cell.querySelector('img').onclick = async () => {
      await apiFetch(`/photos/${photo.id}/main`, { method: 'PATCH' });
      await loadSelfPhotos();
    };
    cell.querySelector('.photo-remove-btn').onclick = async (e) => {
      e.stopPropagation();
      await apiFetch(`/photos/${photo.id}`, { method: 'DELETE' });
      await loadSelfPhotos();
    };
    grid.appendChild(cell);
  });

  if (selfPhotos.length < PROFILE_PHOTO_MAX) {
    const addBox = document.createElement('div');
    addBox.className = 'upload-box photo-add-box';
    addBox.innerHTML = '<div>+</div>';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('photo', file);
      addBox.style.opacity = '.5';
      try {
        const session = getSession();
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '업로드에 실패했습니다.');
        await loadSelfPhotos();
      } catch (err) {
        alert(err.message);
      } finally {
        addBox.style.opacity = '1';
      }
    };
    addBox.onclick = () => input.click();
    grid.appendChild(addBox);
    grid.appendChild(input);
  }

  return grid;
}

function renderVideoBox() {
  const grid = document.createElement('div');
  grid.className = 'photo-upload-grid';

  if (selfVideoUrl) {
    const cell = document.createElement('div');
    cell.className = 'photo-thumb';
    cell.innerHTML = `<video src="${selfVideoUrl}" muted playsinline controls preload="metadata"></video>`;
    grid.appendChild(cell);
  } else {
    const addBox = document.createElement('div');
    addBox.className = 'upload-box photo-add-box';
    addBox.innerHTML = '<div>🎥</div>';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.setAttribute('capture', 'user');
    input.style.display = 'none';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('video', file);
      addBox.style.opacity = '.5';
      try {
        const session = getSession();
        const res = await fetch('/api/profile/verification-video', {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '업로드에 실패했습니다.');
        selfVideoUrl = data.url;
        renderSelfProfileForm();
      } catch (err) {
        alert(err.message);
      } finally {
        addBox.style.opacity = '1';
      }
    };
    addBox.onclick = () => input.click();
    grid.appendChild(addBox);
    grid.appendChild(input);
  }

  return grid;
}

function renderStepFields(step, body) {
  if (step === 0) {
    const photoRow = document.createElement('div');
    photoRow.className = 'condition-row';
    photoRow.innerHTML = `<div class="condition-label">프로필 사진 (최소 ${PROFILE_PHOTO_MIN}장, 대표사진 지정)</div>`;
    photoRow.appendChild(renderPhotoGrid());
    const photoHint = document.createElement('div');
    photoHint.className = 'photo-upload-hint';
    photoHint.innerText = '사진을 눌러 대표사진으로 지정할 수 있습니다.';
    photoRow.appendChild(photoHint);
    body.appendChild(photoRow);

    const videoRow = document.createElement('div');
    videoRow.className = 'condition-row';
    videoRow.innerHTML = '<div class="condition-label">본인확인용 영상 (1개, 카메라 촬영)</div>';
    videoRow.appendChild(renderVideoBox());
    const videoHint = document.createElement('div');
    videoHint.className = 'photo-upload-hint';
    videoHint.innerText = '상대방에게 공개되지 않으며 인증 심사에만 사용됩니다.';
    videoRow.appendChild(videoHint);
    body.appendChild(videoRow);
  } else if (step === 1) {
    body.appendChild(fieldRow('출생년도', buildSelect(
      BIRTH_YEARS.map((y) => y + '년생'),
      selfProfile.birth_year ? selfProfile.birth_year + '년생' : '',
      (val) => { selfProfile.birth_year = val.replace('년생', ''); },
    )));

    body.appendChild(buildRegionRow());

    const heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.value = selfProfile.height || '';
    heightInput.oninput = (e) => { selfProfile.height = e.target.value; };
    body.appendChild(fieldRow('키 (cm)', heightInput));
  } else if (step === 2) {
    body.appendChild(buildDegreeRow());
    body.appendChild(buildJobRow());
  } else if (step === 3) {
    const companyInput = document.createElement('input');
    companyInput.type = 'text';
    companyInput.placeholder = '재직 중인 회사명을 입력하세요';
    companyInput.value = selfProfile.company_name || '';
    companyInput.oninput = (e) => { selfProfile.company_name = e.target.value; };
    body.appendChild(fieldRow('회사명', companyInput));

    body.appendChild(fieldRow('연봉', buildSelect(SALARY_BRACKETS, selfProfile.salary, (val) => { selfProfile.salary = val; })));

    body.appendChild(fieldRow('자산', buildSelect(ASSET_BRACKETS, selfProfile.asset, (val) => { selfProfile.asset = val; })));
  }
}

function goToStep(step) {
  selfProfileStep = Math.max(0, Math.min(SELF_PROFILE_STEPS.length - 1, step));
  renderSelfProfileForm();
}

function renderSelfProfileForm() {
  const c = document.getElementById('self-profile-container');
  c.innerHTML = '';

  renderProfileSidePanel(selfProfileStep);

  const stepDef = SELF_PROFILE_STEPS[selfProfileStep];
  const stepNum = String(selfProfileStep + 1).padStart(2, '0');
  const stepTotal = String(SELF_PROFILE_STEPS.length).padStart(2, '0');

  const header = document.createElement('div');
  header.innerHTML = `
    <div class="wizard-step-count">STEP ${stepNum} / ${stepTotal}</div>
    <h3 class="wizard-step-title">${stepDef.title}</h3>
    <p class="wizard-step-desc">${stepDef.desc}</p>
    <div class="wizard-progress"><div class="wizard-progress-bar" style="width:${((selfProfileStep + 1) / SELF_PROFILE_STEPS.length) * 100}%"></div></div>`;
  c.appendChild(header);

  const body = document.createElement('div');
  body.className = 'wizard-body';
  c.appendChild(body);
  renderStepFields(selfProfileStep, body);

  const nav = document.createElement('div');
  nav.className = 'wizard-nav';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'wizard-arrow-btn';
  prevBtn.innerHTML = '‹';
  prevBtn.disabled = selfProfileStep === 0;
  prevBtn.onclick = () => goToStep(selfProfileStep - 1);
  nav.appendChild(prevBtn);

  const dots = document.createElement('div');
  dots.className = 'wizard-dots';
  SELF_PROFILE_STEPS.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'wizard-dot' + (i === selfProfileStep ? ' active' : '') + (i < selfProfileStep ? ' done' : '');
    dots.appendChild(dot);
  });
  nav.appendChild(dots);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'wizard-arrow-btn';
  nextBtn.innerHTML = '›';
  nextBtn.disabled = selfProfileStep === SELF_PROFILE_STEPS.length - 1;
  nextBtn.onclick = () => goToStep(selfProfileStep + 1);
  nav.appendChild(nextBtn);

  c.appendChild(nav);

  const saveBtn = document.getElementById('save-self-profile-btn');
  if (saveBtn) saveBtn.style.display = selfProfileStep === SELF_PROFILE_STEPS.length - 1 ? 'inline-block' : 'none';
}

async function loadSelfPhotos() {
  const { photos } = await apiFetch('/photos');
  selfPhotos = photos;
  renderSelfProfileForm();
}

async function initSelfProfile() {
  const msg = document.getElementById('self-profile-msg');
  msg.textContent = '';
  msg.className = 'form-msg';

  try {
    const { profile } = await apiFetch('/auth/me');
    Object.keys(selfProfile).forEach((key) => {
      selfProfile[key] = profile[key] ?? '';
    });
    selfVideoUrl = profile.verification_video_url || null;

    const { photos } = await apiFetch('/photos');
    selfPhotos = photos;

    if (!selfProfileInitialized) selfProfileStep = 0;
    renderSelfProfileForm();
    selfProfileInitialized = true;
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg error';
  }
}

document.getElementById('save-self-profile-btn')?.addEventListener('click', async () => {
  const msg = document.getElementById('self-profile-msg');
  msg.textContent = '';
  msg.className = 'form-msg';

  if (selfPhotos.length < PROFILE_PHOTO_MIN) {
    msg.textContent = `프로필 사진을 최소 ${PROFILE_PHOTO_MIN}장 등록해주세요.`;
    msg.className = 'form-msg error';
    return;
  }

  try {
    await apiFetch('/profile/self', { method: 'PUT', body: selfProfile });
    msg.innerHTML = '🎉 프로필 작성이 완료되었습니다. 이제 설레는 여행을 신청할 수 있어요! <a href="journeys.html" class="wizard-cta-link">여행 둘러보기 →</a>';
    msg.className = 'form-msg success';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg error';
  }
});
