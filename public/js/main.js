const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const menuBtn = document.querySelector('.menu-btn');
if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    const nav = document.querySelector('.nav-links');
    const open = nav.style.display === 'flex';
    nav.style.display = open ? 'none' : 'flex';
    if (!open) {
      nav.style.position = 'absolute';
      nav.style.top = '62px';
      nav.style.right = '20px';
      nav.style.flexDirection = 'column';
      nav.style.padding = '18px';
      nav.style.background = 'rgba(20,20,19,.92)';
      nav.style.color = '#fff';
      nav.style.gap = '16px';
    }
  });
}

function renderJourneyCard(j) {
  const typeLabel = TYPE_LABEL[j.type] || j.type;
  const metaLabel = j.status === 'coming_soon'
    ? `${typeLabel} · Coming Soon`
    : `${typeLabel} · ${j.duration || ''}`;
  const linkLabel = j.status === 'coming_soon' ? 'Coming soon' : 'View journey';
  const href = j.status === 'coming_soon' ? '#' : `journey.html?slug=${encodeURIComponent(j.slug)}`;

  return `
    <article class="card">
      <div class="card-media"><img src="${j.image_url || ''}" alt="${j.title}"></div>
      <div class="card-body">
        <div class="card-meta">${metaLabel}</div>
        <h3>${j.title}</h3>
        <p>${j.summary || ''}</p>
        <a class="card-link" href="${href}">${linkLabel}</a>
      </div>
    </article>`;
}

async function loadJourneys() {
  const grids = document.querySelectorAll('[data-journeys-grid]');
  if (!grids.length) return;
  try {
    const { journeys } = await apiFetch('/journeys');
    grids.forEach((grid) => {
      const tier = grid.dataset.journeysGrid;
      const filtered = !tier ? journeys
        : tier === 'signature' ? journeys.filter((j) => j.type === 'signature')
        : journeys.filter((j) => j.type !== 'signature');
      grid.innerHTML = filtered.length
        ? filtered.map(renderJourneyCard).join('')
        : '<article class="card"><div class="card-body"><p class="card-meta">준비 중입니다.</p></div></article>';
    });
  } catch (e) {
    console.error('Failed to load journeys', e);
  }
}

document.addEventListener('DOMContentLoaded', loadJourneys);

const scrollTopBtn = document.createElement('button');
scrollTopBtn.type = 'button';
scrollTopBtn.className = 'scroll-top-btn';
scrollTopBtn.setAttribute('aria-label', 'Scroll to top');
scrollTopBtn.innerHTML = '↑';
document.body.appendChild(scrollTopBtn);

function toggleScrollTopBtn() {
  scrollTopBtn.classList.toggle('visible', window.scrollY > 600);
}

window.addEventListener('scroll', toggleScrollTopBtn, { passive: true });
toggleScrollTopBtn();

scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
