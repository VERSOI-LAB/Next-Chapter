let STORY_QUOTES = [];
let storyQuotesPromise = null;

function loadStoryQuotes() {
  if (!storyQuotesPromise) {
    storyQuotesPromise = apiFetch('/story/quotes')
      .then(({ quotes }) => { STORY_QUOTES = quotes || []; return STORY_QUOTES; })
      .catch(() => { STORY_QUOTES = []; return STORY_QUOTES; });
  }
  return storyQuotesPromise;
}

async function renderStoryQuoteCard(wrapId) {
  const wrap = document.getElementById(wrapId || 'editorial-strip');
  if (!wrap) return;
  const quotes = await loadStoryQuotes();
  if (!quotes.length) return;
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  wrap.innerHTML = `
    <div class="editorial-strip-media"><img src="${quote.image_url || ''}" alt=""></div>
    <div class="editorial-strip-body">
      <div class="editorial-strip-tag">${quote.tag}</div>
      <h3>${quote.title}</h3>
      <p>${quote.body}</p>
      <a href="story.html" class="editorial-strip-link">Story 전체보기 →</a>
    </div>`;
}
