let STORY_REVIEWS = [];
let storyIndex = 0;

function renderStorySlide() {
  const card = document.getElementById('story-slide');
  if (!card || !STORY_QUOTES.length) return;
  const slide = STORY_QUOTES[storyIndex];

  card.classList.add('fading');
  setTimeout(() => {
    card.innerHTML = `
      <div class="story-slide-media"><img src="${slide.image_url || ''}" alt="${slide.title}"></div>
      <div class="story-slide-body">
        <div class="story-slide-tag">${slide.tag}</div>
        <h3>${slide.title}</h3>
        <p>${slide.body}</p>
      </div>`;
    card.classList.remove('fading');
  }, 200);

  document.querySelectorAll('.story-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === storyIndex);
  });
}

function initStorySlider() {
  const dotsWrap = document.getElementById('story-dots');
  if (!dotsWrap || !STORY_QUOTES.length) return;

  dotsWrap.innerHTML = STORY_QUOTES.map((_, i) =>
    `<button type="button" class="story-dot" data-index="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join('');

  dotsWrap.querySelectorAll('.story-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      storyIndex = Number(dot.dataset.index);
      renderStorySlide();
    });
  });

  document.getElementById('story-prev').addEventListener('click', () => {
    storyIndex = (storyIndex - 1 + STORY_QUOTES.length) % STORY_QUOTES.length;
    renderStorySlide();
  });

  document.getElementById('story-next').addEventListener('click', () => {
    storyIndex = (storyIndex + 1) % STORY_QUOTES.length;
    renderStorySlide();
  });

  renderStorySlide();
}

function initReviewGrid() {
  const grid = document.getElementById('review-grid');
  if (!grid) return;

  if (!STORY_REVIEWS.length) {
    grid.innerHTML = '<div class="empty-state">등록된 후기가 없습니다.</div>';
    return;
  }

  grid.innerHTML = STORY_REVIEWS.map((r, i) => `
    <div class="review-card" data-index="${i}">
      <img src="${r.image_url || ''}" alt="참가 후기">
      <div class="review-card-overlay">
        <div class="rc-date">${r.review_date}</div>
        <div class="rc-title">${r.program}</div>
      </div>
    </div>`
  ).join('');

  const backdrop = document.getElementById('review-modal-backdrop');
  const modalImage = document.getElementById('review-modal-image');
  const modalTitle = document.getElementById('review-modal-title');
  const modalText = document.getElementById('review-modal-text');

  function openModal(review) {
    modalImage.src = review.image_url || '';
    modalTitle.textContent = `${review.review_date} · ${review.program}`;
    modalText.textContent = review.review_text;
    backdrop.classList.add('open');
  }

  function closeModal() {
    backdrop.classList.remove('open');
  }

  grid.querySelectorAll('.review-card').forEach((card) => {
    card.addEventListener('click', () => openModal(STORY_REVIEWS[Number(card.dataset.index)]));
  });

  document.getElementById('review-modal-close').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

async function loadStoryReviews() {
  try {
    const { reviews } = await apiFetch('/story/reviews');
    STORY_REVIEWS = reviews || [];
  } catch {
    STORY_REVIEWS = [];
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadStoryQuotes(), loadStoryReviews()]);
  initStorySlider();
  initReviewGrid();
});
