const REVIEW_PLACEHOLDER = {
  date: 'Coming Soon',
  program: '참가 후기',
  review: '실제 참가자의 사진과 후기는 프로그램 운영 이후 이곳에 순차적으로 업데이트될 예정입니다.',
};

const REVIEW_IMAGES = [
  'img/journey-strip-1.jpg',
  'img/journey-strip-2.jpg',
  'img/journey-strip-3.jpg',
  'img/journey-strip-4.jpg',
  'img/journey-strip-5.jpg',
  'img/hero.jpg',
];

let storyIndex = 0;

function renderStorySlide() {
  const card = document.getElementById('story-slide');
  if (!card) return;
  const slide = STORY_QUOTES[storyIndex];

  card.classList.add('fading');
  setTimeout(() => {
    card.innerHTML = `
      <div class="story-slide-media"><img src="${slide.image}" alt="${slide.title}"></div>
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
  if (!dotsWrap) return;

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

  grid.innerHTML = REVIEW_IMAGES.map((src) => `
    <div class="review-card" data-image="${src}">
      <img src="${src}" alt="참가 후기">
      <div class="review-card-overlay">
        <div class="rc-date">${REVIEW_PLACEHOLDER.date}</div>
        <div class="rc-title">${REVIEW_PLACEHOLDER.program}</div>
      </div>
    </div>`
  ).join('');

  const backdrop = document.getElementById('review-modal-backdrop');
  const modalImage = document.getElementById('review-modal-image');
  const modalTitle = document.getElementById('review-modal-title');
  const modalText = document.getElementById('review-modal-text');

  function openModal(src) {
    modalImage.src = src;
    modalTitle.textContent = `${REVIEW_PLACEHOLDER.date} · ${REVIEW_PLACEHOLDER.program}`;
    modalText.textContent = REVIEW_PLACEHOLDER.review;
    backdrop.classList.add('open');
  }

  function closeModal() {
    backdrop.classList.remove('open');
  }

  grid.querySelectorAll('.review-card').forEach((card) => {
    card.addEventListener('click', () => openModal(card.dataset.image));
  });

  document.getElementById('review-modal-close').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initStorySlider();
  initReviewGrid();
});
