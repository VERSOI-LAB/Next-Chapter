const STORY_SLIDES = [
  {
    tag: 'Editorial',
    title: '좋은 사람은 어떤 순간에 보일까요?',
    body: '식당 직원에게 말하는 태도, 함께 걷는 속도, 낯선 상황에서 보이는 배려. 여행은 짧은 대화보다 한 사람의 생활 태도를 더 자연스럽게 보여줍니다.',
    image: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1600&q=85',
  },
  {
    tag: 'Journal',
    title: '왜 여행에서 더 쉽게 마음이 열릴까요?',
    body: '일상에서 벗어난 환경이 대화와 호기심을 자연스럽게 만드는 이유. 익숙한 공간을 벗어나면 사람은 조금 더 솔직해집니다.',
    image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=85',
  },
  {
    tag: 'Guide',
    title: "첫 만남에서 중요한 것은 '잘 보이는 것'이 아닙니다.",
    body: '좋은 인상을 만들기보다 서로에게 편안한 사람이 되는 법. 38시간은 꾸며낸 모습이 오래 유지되기엔 충분히 긴 시간입니다.',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=85',
  },
];

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
  const slide = STORY_SLIDES[storyIndex];

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

  dotsWrap.innerHTML = STORY_SLIDES.map((_, i) =>
    `<button type="button" class="story-dot" data-index="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join('');

  dotsWrap.querySelectorAll('.story-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      storyIndex = Number(dot.dataset.index);
      renderStorySlide();
    });
  });

  document.getElementById('story-prev').addEventListener('click', () => {
    storyIndex = (storyIndex - 1 + STORY_SLIDES.length) % STORY_SLIDES.length;
    renderStorySlide();
  });

  document.getElementById('story-next').addEventListener('click', () => {
    storyIndex = (storyIndex + 1) % STORY_SLIDES.length;
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
