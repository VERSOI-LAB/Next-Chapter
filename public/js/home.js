const heroCarousel = document.getElementById('hero-carousel');

if (heroCarousel) {
  const heroSlides = heroCarousel.querySelectorAll('.hero-v2-slide');
  const heroDotsWrap = document.getElementById('hero-dots');
  const heroPrevBtn = document.getElementById('hero-prev');
  const heroNextBtn = document.getElementById('hero-next');

  let heroIndex = 0;
  let heroTimer = null;

  function goToHeroSlide(i) {
    heroIndex = (i + heroSlides.length) % heroSlides.length;
    heroSlides.forEach((slide, idx) => slide.classList.toggle('active', idx === heroIndex));
    heroDotsWrap.querySelectorAll('.hero-v2-dot').forEach((dot, idx) => dot.classList.toggle('active', idx === heroIndex));
  }

  function startHeroAutoplay() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goToHeroSlide(heroIndex + 1), 6500);
  }

  heroDotsWrap.innerHTML = Array.from(heroSlides).map((_, i) =>
    `<button type="button" class="hero-v2-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join('');

  heroDotsWrap.querySelectorAll('.hero-v2-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      goToHeroSlide(Number(dot.dataset.index));
      startHeroAutoplay();
    });
  });

  heroPrevBtn.addEventListener('click', () => {
    goToHeroSlide(heroIndex - 1);
    startHeroAutoplay();
  });
  heroNextBtn.addEventListener('click', () => {
    goToHeroSlide(heroIndex + 1);
    startHeroAutoplay();
  });

  startHeroAutoplay();
}

renderStoryQuoteCard('editorial-strip');
