'use strict';

// These helpers are also exercised directly in the verification script.
function normalizeName(value) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}
function matchesExhibition(value, exhibition) {
  const normalized = normalizeName(value);
  try {
    const input = new URL(normalized);
    const official = new URL(exhibition.officialUrl);
    const path = url => url.pathname.replace(/\/+$/u, '') || '/';
    return input.protocol === 'https:' && !input.username && !input.password &&
      input.host === official.host && path(input) === path(official);
  } catch {
    return [exhibition.title, exhibition.fullTitle, ...exhibition.aliases]
      .some(name => normalizeName(name) === normalized);
  }
}
function localDate(now = new Date(), timezone = 'Asia/Tokyo') {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function periodFor(date, dates) {
  if (date < dates.start) return 'before';
  if (date > dates.end) return 'ended';
  if (date <= dates.firstEnd) return 'first';
  if (date < dates.secondStart) return 'changeover';
  return 'second';
}
function visibleWorks(exhibition, period) {
  if (period === 'before' || period === 'first') return exhibition.focusWorks.filter(work => work.period !== 'second');
  if (period === 'second') return exhibition.focusWorks.filter(work => work.period !== 'first');
  return [];
}
function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function localAsset(value) {
  return typeof value === 'string' && /^assets\/[a-zA-Z0-9_/-]+\.(webp|jpg|jpeg|png)$/u.test(value) && !value.includes('..') ? value : null;
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(text, url) {
  const node = el('a', text);
  const safe = httpsUrl(url);
  if (safe) {node.href = safe; node.target = '_blank'; node.rel = 'noopener noreferrer';}
  return node;
}
function append(id, ...children) {document.getElementById(id).append(...children);}
function placeholder(work, detail) {
  const node = el('div', undefined, 'media placeholder' + (work.id === 'met-45813' && !detail ? ' portrait' : ''));
  const inner = el('div');
  inner.append(el('p', detail ? '部分拡大・準備中' : '参考作品・画像準備中', 'eyebrow'), el('strong', work.title),
    el('small', detail ? '元画像を取得後、観察する箇所を選んで追加します。' : '画像未取得のため、作品ページでご覧ください。'), link('所蔵館の作品ページを見る ↗', work.sourceUrl));
  node.append(inner);
  return node;
}
function artwork(work, {detail = false, hero = false} = {}) {
  const figure = el('figure');
  const path = localAsset(detail ? work.detailImagePath : work.localImagePath);
  const width = detail ? work.detailWidth : work.width;
  const height = detail ? work.detailHeight : work.height;
  if (path && Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0) {
    const media = el('div', undefined, 'media has-image');
    const full = el('a'); full.href = path; full.target = '_blank'; full.rel = 'noopener noreferrer';
    full.setAttribute('aria-label', `${work.title}${detail ? 'の部分拡大' : 'の全体画像'}を別タブで開く`);
    const image = el('img'); image.src = path; image.alt = detail ? `${work.title}の部分拡大：${work.detailAlt || work.alt}` : work.alt;
    image.width = width; image.height = height; image.loading = hero ? 'eager' : 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => media.replaceWith(placeholder(work, detail)), {once: true});
    full.append(image); media.append(full); figure.append(media);
  } else figure.append(placeholder(work, detail));
  figure.append(el('figcaption', work.captionNote));
  return figure;
}
function card(title, text) {
  const node = el('div', undefined, 'card'); node.append(el('h3', title), el('p', text)); return node;
}
function render(exhibition, knowledge, now = new Date()) {
  const day = localDate(now, exhibition.timezone);
  const period = periodFor(day, exhibition.dates);
  const labels = {before:'開催前', first:'前期', changeover:'展示替え', second:'後期', ended:'会期終了'};
  document.getElementById('exhibition-title').textContent = exhibition.fullTitle;
  document.getElementById('period').textContent = `${labels[period]} / ${day}（日本時間）`;
  append('exhibition-meta', el('p', exhibition.venue), el('p', `会期 ${exhibition.dates.start}〜${exhibition.dates.end}`),
    el('p', `前期 ${exhibition.dates.start}〜${exhibition.dates.firstEnd} ／ 後期 ${exhibition.dates.secondStart}〜${exhibition.dates.end}`),
    el('p', exhibition.hours), el('p', `情報確認：${exhibition.checkedAt}`, 'small'));
  document.getElementById('opening-note').textContent = exhibition.openingNote;
  const official = document.getElementById('official-link'); official.href = httpsUrl(exhibition.officialUrl); official.target = '_blank'; official.rel = 'noopener noreferrer';
  document.getElementById('intro').textContent = exhibition.intro;
  const modules = new Map(knowledge.modules.map(module => [module.id, module]));
  const works = new Map(knowledge.referenceWorks.map(work => [work.id, work]));
  append('hero-work', artwork(works.get(exhibition.referenceWorkIds[0]), {hero: true}), el('p', '波・船・富士山。目はどの順番に動いた？', 'image-question'));
  for (const step of exhibition.steps) {
    append('preview-steps', el('h3', step.title), el('p', step.knowledgeId ? modules.get(step.knowledgeId).text + (step.suffix || '') : step.text));
    if (step.knowledgeId === 'woodblock-vs-painting') append('preview-steps', el('p', 'この線は、どこで細くなり、どこで太くなる？', 'image-question'));
  }
  exhibition.questions.forEach(question => append('questions', el('li', question)));
  knowledge.people.forEach(person => append('people-cards', card(person.name, person.text)));
  document.getElementById('background').textContent = exhibition.background;
  knowledge.timeline.forEach(item => {const row = el('li'); row.append(el('strong', item.year), el('span', item.text)); append('timeline', row);});
  for (const id of exhibition.referenceWorkIds) {
    const work = works.get(id); const notes = exhibition.referenceNotes.find(item => item.workId === id);
    const row = el('div', undefined, 'reference'); const images = el('div');
    images.append(artwork(work));
    const detail = el('div', undefined, 'detail'); detail.append(el('h3', '部分拡大'), artwork(work, {detail: true})); images.append(detail);
    const text = el('div'); text.append(el('p', '予習用の参考作品', 'eyebrow'), el('h3', work.title),
      el('p', notes.whole, 'image-question'), el('p', `部分を見る：${notes.detail}`), el('p', notes.why), el('p', `会場で試す：${notes.connection}`), link('作品情報を見る ↗', work.sourceUrl));
    row.append(images, text); append('reference-works', row);
  }
  const venueText = {before:'開催前です。以下は前期に見るための予定です。',first:'前期に見る三つの作品。',changeover:'前後期の切り替え期間です。10月19日は休館、10月20日は特別展休室です。開館状況は公式で確認してください。',second:'後期です。前期限定の2作品は表示していません。',ended:'会期は終了しました。予習記事と出典は引き続き読めます。'};
  document.getElementById('venue-status').textContent = venueText[period];
  for (const work of visibleWorks(exhibition, period)) {
    const node = card(work.title, work.question);
    node.prepend(el('span', work.period === 'all' ? '通期・半期巻き替え' : '前期', 'badge'));
    node.append(link('公式の画像・作品紹介を見る ↗', work.sourceUrl)); append('focus-works', node);
  }
  if (period === 'second') append('venue-links', link('後期の作品は公式リストで確認 ↗', exhibition.officialUrl));
  if (period === 'changeover' || period === 'ended') append('venue-links', link('公式の展示情報を見る ↗', exhibition.officialUrl));
  for (const item of exhibition.deepDive) { const node = card(item.title, item.text); node.append(link('続きを見る ↗', item.url)); append('deep-links', node); }
  document.getElementById('reflection').textContent = exhibition.reflection;
  for (const source of knowledge.sources) {const row = el('li'); row.append(link(source.title, source.url)); append('source-links', row);}
  for (const work of works.values()) {
    const credit = el('p'); credit.append(el('span', `${work.artist}《${work.title}》／${work.dateLabel}／${work.museum}／${work.rights}（原仕様の確認日：${work.rightsVerifiedAt}）。${work.captionNote}。${work.acquisitionNote} `),
      link('作品・利用条件', work.sourceUrl), el('span', ' ／ '), link('画像取得先', work.downloadUrl)); append('image-credits', credit);
  }
  document.getElementById('lookup').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('exhibition-input'); const result = document.getElementById('lookup-result');
    if (matchesExhibition(input.value, exhibition)) {
      result.textContent = '登録展示が見つかりました。';
      location.hash = 'exhibition'; document.getElementById('exhibition').focus({preventScroll:true}); document.getElementById('exhibition').scrollIntoView();
    } else {
      result.replaceChildren(el('span', 'まだ予習ページを用意していません。'));
      const fallback = el('a', 'まずはこの展示を見てみる'); fallback.href = '#exhibition'; result.append(el('span', ' '), fallback);
    }
  });
  document.querySelectorAll('#lookup input, #lookup button').forEach(node => {node.disabled = false;});
  document.getElementById('load-status').hidden = true; document.getElementById('article').hidden = false;
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
async function init() {
  try {
    const data = await Promise.all(['content/exhibitions.json','content/knowledge.json'].map(async path => {
      const response = await fetch(path); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json();
    }));
    render(data[0].exhibitions[0], data[1]);
  } catch (error) {
    document.getElementById('article').hidden = true;
    const status = document.getElementById('load-status'); status.hidden = false;
    status.replaceChildren(el('span', '予習データを読み込めませんでした。HTTPサーバーで開き、再読み込みしてください。 '), link('公式の開催案内を見る ↗', 'https://hokusai-museum.jp/best/'));
    console.error('Preview data could not be loaded', error);
  }
}
if (typeof document !== 'undefined') init();

