const STORY_QUOTES = [
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
    body: '좋은 인상을 만들기보다 서로에게 편안한 사람이 되는 법. 32/56시간은 꾸며낸 모습이 오래 유지되기엔 충분히 긴 시간입니다.',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=85',
  },
];

function renderStoryQuoteCard(wrapId) {
  const wrap = document.getElementById(wrapId || 'editorial-strip');
  if (!wrap) return;
  const quote = STORY_QUOTES[Math.floor(Math.random() * STORY_QUOTES.length)];
  wrap.innerHTML = `
    <div class="editorial-strip-media"><img src="${quote.image}" alt=""></div>
    <div class="editorial-strip-body">
      <div class="editorial-strip-tag">${quote.tag}</div>
      <h3>${quote.title}</h3>
      <p>${quote.body}</p>
      <a href="story.html" class="editorial-strip-link">Story 전체보기 →</a>
    </div>`;
}
