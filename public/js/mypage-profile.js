const PROFILE_PHOTO_MIN = 3;
const PROFILE_PHOTO_MAX = 6;

let selfProfileInitialized = false;
let selfProfile = {
  birth_year: '', region: '', region_detail: '', height: '', degree: '', university: '',
  job_major: '', job_minor: '', job_tertiary: '', job_custom: '', company_name: '', salary: '', asset: '',
};
let selfPhotos = [];
let selfVideoUrl = null;

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

function renderSelfProfileForm() {
  const c = document.getElementById('self-profile-container');
  c.innerHTML = '';

  const photoRow = document.createElement('div');
  photoRow.className = 'condition-row';
  photoRow.innerHTML = `<div class="condition-label">프로필 사진 (최소 ${PROFILE_PHOTO_MIN}장, 대표사진 지정)</div>`;
  photoRow.appendChild(renderPhotoGrid());
  const photoHint = document.createElement('div');
  photoHint.className = 'photo-upload-hint';
  photoHint.innerText = '사진을 눌러 대표사진으로 지정할 수 있습니다.';
  photoRow.appendChild(photoHint);
  c.appendChild(photoRow);

  const videoRow = document.createElement('div');
  videoRow.className = 'condition-row';
  videoRow.innerHTML = '<div class="condition-label">본인확인용 영상 (1개, 카메라 촬영)</div>';
  videoRow.appendChild(renderVideoBox());
  const videoHint = document.createElement('div');
  videoHint.className = 'photo-upload-hint';
  videoHint.innerText = '상대방에게 공개되지 않으며 인증 심사에만 사용됩니다.';
  videoRow.appendChild(videoHint);
  c.appendChild(videoRow);

  c.appendChild(fieldRow('출생년도', buildSelect(
    BIRTH_YEARS.map((y) => y + '년생'),
    selfProfile.birth_year ? selfProfile.birth_year + '년생' : '',
    (val) => { selfProfile.birth_year = val.replace('년생', ''); },
  )));

  c.appendChild(buildRegionRow());

  const heightInput = document.createElement('input');
  heightInput.type = 'number';
  heightInput.value = selfProfile.height || '';
  heightInput.oninput = (e) => { selfProfile.height = e.target.value; };
  c.appendChild(fieldRow('키 (cm)', heightInput));

  c.appendChild(buildDegreeRow());
  c.appendChild(buildJobRow());

  const companyInput = document.createElement('input');
  companyInput.type = 'text';
  companyInput.placeholder = '재직 중인 회사명을 입력하세요';
  companyInput.value = selfProfile.company_name || '';
  companyInput.oninput = (e) => { selfProfile.company_name = e.target.value; };
  c.appendChild(fieldRow('회사명', companyInput));

  const salaryInput = document.createElement('input');
  salaryInput.type = 'number';
  salaryInput.placeholder = '예: 5000';
  salaryInput.value = selfProfile.salary || '';
  salaryInput.oninput = (e) => { selfProfile.salary = e.target.value; };
  c.appendChild(fieldRow('연봉 (만원)', salaryInput));

  c.appendChild(fieldRow('자산', buildSelect(ASSET_BRACKETS, selfProfile.asset, (val) => { selfProfile.asset = val; })));
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
    msg.textContent = '저장되었습니다.';
    msg.className = 'form-msg success';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg error';
  }
});
