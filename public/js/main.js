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
  const grid = document.querySelector('[data-journeys-grid]');
  if (!grid) return;
  try {
    const { journeys } = await apiFetch('/journeys');
    grid.innerHTML = journeys.map(renderJourneyCard).join('');
  } catch (e) {
    console.error('Failed to load journeys', e);
  }
}

document.addEventListener('DOMContentLoaded', loadJourneys);
