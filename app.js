'use strict';

const $ = (query, scope = document) => scope.querySelector(query);
const $$ = (query, scope = document) => [...scope.querySelectorAll(query)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const reducedPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedPreference.matches;
try { const stored = localStorage.getItem('cr-reduced-motion'); if (stored !== null) reduced = stored === 'true'; } catch {}
let content;
let activeProject = null;
let projectOrigin = null;
let returnFocus = null;
let toastTimer;
let lastManual = 0;
const gifStates = new Map();
const videoStates = new Map();
const projectDialog = $('#project-dialog');
const lightbox = $('#lightbox');
const mediaLimit = () => matchMedia('(max-width: 760px)').matches ? 1 : 2;
const asset = id => content.assets[id];
const isVisibleSurface = el => !document.hidden && !lightbox.open && (projectDialog.open ? projectDialog.contains(el) : !el.closest('dialog'));

function picture(id, alt, options = {}) {
  const a = asset(id);
  if (!a) return '';
  const source = a.kind === 'image' ? a.src : a.poster;
  const srcset = a.kind === 'image' ? `srcset="${a.variants.map(v => `${v.src} ${v.width}w`).join(', ')}" sizes="${options.sizes || '(max-width: 760px) 90vw, 85vw'}"` : '';
  return `<img src="${source}" ${srcset} width="${a.width}" height="${a.height}" alt="${escapeHTML(alt)}" loading="${options.eager ? 'eager' : 'lazy'}" decoding="async" ${options.className ? `class="${options.className}"` : ''}>`;
}

function gif(id, title, {auto = true, link = false} = {}) {
  const a = asset(id);
  return `<figure class="motion-figure" data-gif="${id}" data-auto="${auto}" style="--ratio:${a.width}/${a.height}"><div class="motion-frame"><img src="${a.poster}" width="${a.width}" height="${a.height}" loading="lazy" decoding="async" alt="${escapeHTML(title)}"><button type="button" class="gif-control" aria-label="播放 ${escapeHTML(title)}" aria-pressed="false">▶ 播放 GIF</button></div><figcaption class="motion-label"><span>${escapeHTML(title)} · GIF</span>${link ? `<a href="${a.src}" download>原始 GIF ↓</a>` : '<span>原始动态</span>'}</figcaption></figure>`;
}

function showToast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
}

function setGIF(state, playing) {
  if (state.playing === playing) return;
  state.playing = playing;
  const a = asset(state.id);
  state.image.src = playing ? a.src : a.poster;
  state.button.textContent = playing ? 'Ⅱ 暂停 GIF' : '▶ 播放 GIF';
  state.button.setAttribute('aria-pressed', String(playing));
  state.button.setAttribute('aria-label', `${playing ? '暂停' : '播放'} ${state.image.alt}`);
  state.element.dataset.playing = String(playing);
}

function updateMedia() {
  document.documentElement.classList.toggle('page-hidden', document.hidden);
  const playingVideos = [];
  for (const [video, state] of videoStates) {
    if (!video.isConnected) { videoStates.delete(video); continue; }
    // A layout toggle may precede the observer callback; read the current box.
    const rect = video.getBoundingClientRect();
    const visibleArea = Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0)) * Math.max(0,Math.min(rect.right,innerWidth)-Math.max(rect.left,0));
    state.visible = rect.width > 0 && rect.height > 0 && visibleArea / (rect.width * rect.height) > .12;
    if (!video.paused && (!isVisibleSurface(video) || !state.visible || video.hidden || video.closest('[hidden]'))) video.pause();
    if (!video.paused) playingVideos.push(video);
  }
  playingVideos.sort((a,b) => (videoStates.get(b).sequence || 0) - (videoStates.get(a).sequence || 0));
  playingVideos.slice(mediaLimit()).forEach(video => video.pause());
  const slots = mediaLimit() - Math.min(playingVideos.length, mediaLimit());
  const candidates = [];
  for (const [el, state] of gifStates) {
    if (!el.isConnected) { gifStates.delete(el); continue; }
    if (state.visible && isVisibleSurface(el) && !state.failed && !state.paused && (state.manual || (state.auto && !reduced))) candidates.push(state);
  }
  candidates.sort((a, b) => b.manual - a.manual || b.visibility - a.visibility);
  const allowed = new Set(candidates.slice(0, Math.max(0, slots)));
  for (const state of gifStates.values()) setGIF(state, allowed.has(state));
}

const mediaObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const state = gifStates.get(entry.target) || videoStates.get(entry.target);
    if (!state) continue;
    state.visible = entry.isIntersecting && entry.intersectionRatio > .12;
    state.visibility = entry.intersectionRatio;
    if (!state.visible) state.manual = 0;
  }
  updateMedia();
}, {threshold: [0, .13, .4, .75, 1]});

function initMedia(scope) {
  for (const element of $$('.motion-figure', scope)) {
    if (gifStates.has(element)) continue;
    const image = $('img', element);
    const button = $('.gif-control', element);
    const state = {element, image, button, id: element.dataset.gif, auto: element.dataset.auto === 'true', visible: false, visibility: 0, playing: false, paused: false, manual: 0, failed: false};
    gifStates.set(element, state);
    button.addEventListener('click', () => {
      if (state.playing) { state.paused = true; state.manual = 0; }
      else {
        state.paused = false;
        state.failed = false;
        state.manual = ++lastManual;
        state.visible = true;
        for (const video of videoStates.keys()) video.pause();
      }
      updateMedia();
    });
    image.addEventListener('error', () => {
      state.failed = true;
      setGIF(state, false);
      button.textContent = '↻ 重试 GIF';
      button.setAttribute('aria-label', `重新加载 ${image.alt}`);
      showToast('动态暂未加载，点击重试');
    });
    mediaObserver.observe(element);
  }
  for (const video of $$('video', scope)) {
    if (videoStates.has(video)) continue;
    videoStates.set(video, {visible: false});
    mediaObserver.observe(video);
    video.addEventListener('play', () => {
      videoStates.get(video).sequence = ++lastManual;
      const playing = [...videoStates.keys()].filter(v => v !== video && !v.paused);
      while (playing.length >= mediaLimit()) playing.shift().pause();
      updateMedia();
    });
    video.addEventListener('pause', updateMedia);
    video.addEventListener('ended', updateMedia);
    video.addEventListener('error', () => {
      const unit = video.closest('.video-unit');
      if (!unit.querySelector('.media-error')) unit.insertAdjacentHTML('beforeend', `<p class="media-error">视频暂未加载。<a href="${video.getAttribute('src')}" target="_blank" rel="noopener">打开原始视频 ↗</a></p>`);
    });
  }
  for (const audio of $$('audio', scope)) {
    audio.addEventListener('play', () => {
      for (const el of $$('audio, video')) if (el !== audio) el.pause();
    });
  }
}

function setReduced(value, persist = true) {
  reduced = value;
  document.documentElement.classList.toggle('reduced-motion', reduced);
  document.documentElement.classList.toggle('js-motion', !reduced);
  $('#motion-toggle').setAttribute('aria-pressed', String(reduced));
  $('#motion-toggle').setAttribute('aria-label', reduced ? '开启自动动效' : '减少自动动效');
  $('#motion-label').textContent = reduced ? '动效已减少' : '动效开启';
  if (reduced) {
    for (const state of gifStates.values()) state.manual = 0;
    for (const video of videoStates.keys()) video.pause();
    $$('[data-depth]').forEach(el => { el.style.setProperty('--px', '0px'); el.style.setProperty('--py', '0px'); });
  }
  if (persist) { try { localStorage.setItem('cr-reduced-motion', String(value)); } catch {} }
  updateMedia();
}

function artLayer(id, alt, depth = 16) {
  return `<span class="art-layer" data-depth="${depth}">${picture(id, alt)}</span>`;
}

function featuredMarkup(project, index) {
  let art;
  switch (project.id) {
    case 'comic-opening': art = `<a class="feature-art" href="#work/comic-opening" aria-label="观看完整漫剧片头">${picture('comic-opening', '漫剧片头中的人物画面')}<span class="feature-overlay" aria-hidden="true">↗</span></a>`; break;
    case 'mirror': art = `<a class="feature-art kinetic-art mirror-stage" href="#work/mirror" aria-label="观看欲望之镜">${artLayer('mirror-sphere', '欲望之镜球体拼贴', 24)}<span class="feature-overlay" aria-hidden="true">↗</span></a>`; break;
    case 'water': art = `<div class="water-layout">${gif('image18', '水的诗篇 01')}${gif('image20', '水的诗篇 03')}</div>`; break;
    case 'alchemy': art = `<a class="feature-art kinetic-art alchemy-stage" href="#work/alchemy" aria-label="观看生物炼金术">${artLayer('alchemy-rhino', '背着鸟的奇异犀牛', 20)}${artLayer('alchemy-antler', '生物炼金术中的角兽', -14)}${artLayer('alchemy-shell', '生物炼金术中的甲壳生物', 28)}<span class="feature-overlay" aria-hidden="true">↗</span></a>`; break;
    case 'upstream': art = `<div class="upstream-layout">${picture('image31', '逆流交互影像展览现场')}${gif('image32', '逆流 · 身体与影像')}</div>`; break;
    case 'ocean': art = `<a class="feature-art ocean-layout" href="#work/ocean" aria-label="观看观海赞">${picture('image98', '观海赞角色故事', {className:'ocean-main'})}${picture('image103', '观海赞祈福插画', {className:'ocean-secondary'})}<span class="feature-overlay" aria-hidden="true">↗</span></a>`; break;
    case 'yangliuqing': art = `<a class="feature-art kinetic-art year-stage" href="#work/yangliuqing" aria-label="观看新杨柳青创研">${['image68','image69','image70'].map((id,i) => artLayer(id+'-figure', '杨柳青年画中的人物与花卉', [18,-12,24][i])).join('')}<span class="feature-overlay" aria-hidden="true">↗</span></a>`; break;
  }
  const dynamic = project.media.some(m => ['gif','video','audio'].includes(asset(m.asset).kind));
  return `<article class="featured-project feature-${project.id} reveal">${art}<div class="feature-caption"><span class="feature-no">0${index + 1}</span><div><h3><a href="#work/${project.id}">${project.title} <small>${project.en}</small></a></h3><p>${project.summary}</p></div><a class="feature-meta" href="#work/${project.id}"><span>${dynamic ? '● 动态作品' : project.medium.split(' / ')[0]}</span>查看作品 ↗</a></div></article>`;
}

function renderHome() {
  $('#hero-water').innerHTML = gif('image19', '马远的意境诗篇');
  $('#study-grid').innerHTML = [
    ['study-orbit', '碎片的轨道', '欲望之镜 / 球体拼贴'],
    ['study-tide', '一小片潮汐', '马远的意境诗篇 / 水墨再构'],
    ['study-menagerie', '纸上漫游', '生物炼金术 / 剪贴剧场']
  ].map(([id,title,note],i) => `<article class="study-item">${gif(id,title,{link:true})}<div class="study-caption"><span>0${i+1}</span><div><h3>${title}</h3><p>${note}</p></div><a href="${asset(id).poster.replace('.webp','.png')}" download aria-label="下载${title}静帧">PNG ↓</a></div></article>`).join('');
  $('#featured-works').innerHTML = content.projects.filter(p => p.featured).map(featuredMarkup).join('');
  $('#filters').innerHTML = [{id:'all', label:'全部作品'}, ...content.categories].map((c,i) => `<button type="button" data-filter="${c.id}" aria-pressed="${i === 0}">${c.label}${i === 0 ? ` ${content.projects.length}` : ''}</button>`).join('');
  $('.archive-total').textContent = `${content.projects.length} 个项目，持续生长中`;
  $('#archive-grid').innerHTML = content.projects.map((p,i) => {
    const kinds = p.media.map(m => asset(m.asset).kind);
    const label = kinds.includes('video') ? 'VIDEO' : kinds.includes('gif') ? 'GIF' : kinds.includes('audio') ? 'SOUND' : '';
    return `<a class="archive-card" data-category="${p.category}" href="#work/${p.id}"><div class="archive-image">${picture(p.cover, p.title, {sizes:'(max-width: 760px) 44vw, 28vw'})}${label ? `<span class="archive-badge">● ${label}</span>` : ''}<span class="archive-arrow" aria-hidden="true">↗</span></div><h3>${p.title}<span class="card-number">${String(i+1).padStart(2,'0')}</span></h3><p>${p.medium}${p.year ? ' / ' + p.year : ''}</p></a>`;
  }).join('');
  const profile = content.profile;
  $('#bio').textContent = profile.intro;
  $('#education').innerHTML = profile.education.map(e => `<p>${e.school}<span>${e.subject}</span></p>`).join('');
  $('#awards').innerHTML = profile.awards.map(([date,name,note]) => `<div class="credential-row"><time>${date}</time><p>${name}<small>${note}</small></p></div>`).join('');
  $('#exhibitions').innerHTML = profile.exhibitions.map(([date,name]) => `<div class="credential-row"><time>${date}</time><p>${name}</p></div>`).join('');
  $('#experience-list').innerHTML = profile.experience.map(([date,name,role,note]) => `<div class="credential-row"><time>${date}</time><p>${name}<small>${role}${note ? ' · ' + note : ''}</small></p></div>`).join('');
  $('#year').textContent = new Date().getFullYear();
  $('#filters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    const category = button.dataset.filter;
    $$('#filters button').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    $$('.archive-card').forEach(el => el.hidden = category !== 'all' && el.dataset.category !== category);
    $('#filter-status').textContent = `显示 ${$$('.archive-card:not([hidden])').length} 个项目`;
  });
  initMedia($('#site'));
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target.matches('.kinetic-art')) entry.target.classList.toggle('in-view', entry.isIntersecting);
      else if (entry.isIntersecting) { entry.target.classList.add('revealed'); revealObserver.unobserve(entry.target); }
    }
  }, {threshold:.04});
  $$('.reveal, .kinetic-art').forEach(el => revealObserver.observe(el));
  let frame;
  for (const surface of $$('.hero, .kinetic-art')) {
  surface.addEventListener('pointermove', event => {
    if (reduced || event.pointerType !== 'mouse') return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = surface.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      $$('[data-depth]', surface).forEach(el => { el.style.setProperty('--px', `${x * +el.dataset.depth}px`); el.style.setProperty('--py', `${y * +el.dataset.depth}px`); });
    });
  });
  surface.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    $$('[data-depth]', surface).forEach(el => { el.style.setProperty('--px','0px'); el.style.setProperty('--py','0px'); });
  });
  }
}

function videoMarkup(id, title) {
  const a = asset(id);
  return `<figure class="video-unit" data-video-unit="${id}"><video class="project-video" src="${a.src}" poster="${a.poster || ''}" width="${a.width}" height="${a.height}" controls muted playsinline preload="none" aria-label="${escapeHTML(title)}"></video><figcaption class="video-caption"><span>${title}</span><div class="video-tools"><button type="button" data-sound="${id}">开启声音</button><button type="button" data-fullscreen="${id}">全屏 ↗</button></div></figcaption></figure>`;
}

function renderProject(project) {
  stopDetailMedia();
  activeProject = project;
  const category = content.categories.find(c => c.id === project.category).label;
  const dynamic = project.media.filter(m => ['gif','video','audio'].includes(asset(m.asset).kind));
  const stills = project.media.filter(m => asset(m.asset).kind === 'image');
  let dynamicMarkup = '';
  const gifs = dynamic.filter(m => asset(m.asset).kind === 'gif');
  if (gifs.length) dynamicMarkup += `<section class="dynamic-section"><div class="dynamic-heading"><h3>原始动态 · ${gifs.length} GIF</h3><span>点击播放，可下载原始 GIF</span></div><div class="gif-grid">${gifs.map((m,i) => gif(m.asset, `${project.title} ${String(i+1).padStart(2,'0')}`, {link:true})).join('')}</div></section>`;
  if (project.comparison) dynamicMarkup += `<section class="dynamic-section"><div class="dynamic-heading"><h3>年画风格转化</h3><span>两段完整原始视频 · 各约 1 分钟</span></div><div class="comparison-tools" role="group" aria-label="视频对照布局"><button type="button" data-compare="both" class="active" aria-pressed="true">并排观看</button><button type="button" data-compare="original" aria-pressed="false">只看原视频</button><button type="button" data-compare="generated" aria-pressed="false">只看生成视频</button><button type="button" id="play-pair">一起播放 ▶</button></div><div class="comparison-videos">${videoMarkup(project.comparison.original, '原视频')}${videoMarkup(project.comparison.generated, '生成视频')}</div></section>`;
  else for (const m of dynamic.filter(m => asset(m.asset).kind === 'video')) dynamicMarkup += `<section class="dynamic-section"><div class="dynamic-heading"><h3>${project.title} · 完整视频</h3><span>点击播放 · 声音默认关闭</span></div>${videoMarkup(m.asset, `${project.title} · 完整视频`)}</section>`;
  for (const m of dynamic.filter(m => asset(m.asset).kind === 'audio')) dynamicMarkup += `<section class="dynamic-section audio-unit"><p>把声音交给想象。</p><audio src="${asset(m.asset).src}" controls preload="none" aria-label="AI 音乐原始音频"></audio></section>`;
  const nextProject = content.projects[(content.projects.indexOf(project)+1) % content.projects.length];
  $('#project-content').innerHTML = `<header class="project-heading"><span class="eyebrow">${category} / ${project.medium}</span><h2 id="project-title" tabindex="-1">${project.title}</h2><p class="english-title">${project.en}</p><div class="project-description"><div class="project-facts">作者 / ${project.authors}<br>${project.year ? '年份 / ' + project.year + '<br>' : ''}媒介 / ${project.medium}</div><p>${project.description}</p></div></header><div class="project-gallery">${dynamicMarkup}${stills.length ? `<h3 class="gallery-title">作品与过程 / ${stills.length} 张图像</h3>` : ''}<div class="gallery-grid">${stills.map((m,i) => { const a = asset(m.asset); return `<figure class="gallery-item ${a.width/a.height > 1.65 || (i === 0 && stills.length < 6) ? 'wide' : ''}"><button type="button" data-enlarge="${m.asset}" aria-label="放大 ${project.title} 第 ${i+1} 张图像">${picture(m.asset, `${project.title} · 图像 ${i+1}`)}<span class="image-expand" aria-hidden="true">＋</span></button><figcaption><span>${project.title} / ${String(i+1).padStart(2,'0')}</span><span>查看大图 ↗</span></figcaption></figure>`; }).join('')}</div></div><a class="detail-next" href="#work/${nextProject.id}"><div><span>NEXT PROJECT / 继续漫游</span><h3>${nextProject.title}</h3></div><span aria-hidden="true">↗</span></a>`;
  document.title = `${project.title} — 常睿 CHANG RUI`;
  projectDialog.scrollTop = 0;
  initMedia(projectDialog);
  requestAnimationFrame(() => { $('#project-title').focus({preventScroll:true}); updateMedia(); });
}

function stopDetailMedia() {
  $$('video,audio', projectDialog).forEach(el => el.pause());
  for (const [el,state] of gifStates) if (projectDialog.contains(el)) { setGIF(state,false); mediaObserver.unobserve(el); gifStates.delete(el); }
  for (const video of videoStates.keys()) if (projectDialog.contains(video)) { video.pause(); mediaObserver.unobserve(video); videoStates.delete(video); }
}

function handleRoute() {
  const match = location.hash.match(/^#work\/([a-z0-9-]+)$/);
  const project = match && content.projects.find(p => p.id === match[1]);
  if (project) {
    if (!projectDialog.open) {
      returnFocus = document.activeElement;
      if (!projectOrigin) projectOrigin = {scrollY:window.scrollY, hash:'#archive', local:false};
      projectDialog.showModal();
      document.body.style.overflow = 'hidden';
    }
    if (activeProject !== project) renderProject(project);
    updateMedia();
  } else {
    if (match) showToast('未找到这个作品，已返回作品索引');
    if (projectDialog.open) {
      if (lightbox.open) lightbox.close();
      stopDetailMedia();
      projectDialog.close();
      document.body.style.overflow = '';
      activeProject = null;
      document.title = '常睿 CHANG RUI — 在想象之间';
      if (projectOrigin?.local) {
        const y = projectOrigin.scrollY;
        requestAnimationFrame(() => { window.scrollTo({top:y,behavior:'instant'}); returnFocus?.focus({preventScroll:true}); });
      } else if (location.hash) $(location.hash)?.scrollIntoView();
      projectOrigin = null;
      updateMedia();
    }
  }
}

function closeProject() {
  if (projectOrigin?.local) history.back();
  else { history.replaceState(null,'',`${location.pathname}${location.search}#archive`); handleRoute(); }
}

document.addEventListener('click', event => {
  const workLink = event.target.closest('a[href^="#work/"]');
  if (workLink && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
    event.preventDefault();
    if (!projectDialog.open) {
      projectOrigin = {scrollY:window.scrollY, hash:location.hash, local:true};
      returnFocus = workLink;
      history.pushState({project:true},'',workLink.getAttribute('href'));
    } else history.replaceState({project:true},'',workLink.getAttribute('href'));
    handleRoute();
  }
});
window.addEventListener('hashchange', () => content && handleRoute());
window.addEventListener('popstate', () => content && handleRoute());
$('#close-project').addEventListener('click', closeProject);
projectDialog.addEventListener('cancel', event => { event.preventDefault(); closeProject(); });
$('#share-project').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); showToast('作品链接已复制'); }
  catch { showToast('请从浏览器地址栏复制当前作品链接'); }
});

projectDialog.addEventListener('click', async event => {
  const enlarge = event.target.closest('[data-enlarge]');
  if (enlarge) {
    const a = asset(enlarge.dataset.enlarge);
    $('#lightbox-image').src = a.src;
    $('#lightbox-image').alt = $('img',enlarge).alt;
    $('#lightbox-caption').textContent = activeProject.title;
    lightbox.classList.remove('zoomed');
    $('#zoom-image').textContent = '查看细节 ＋';
    lightbox.showModal();
    updateMedia();
    return;
  }
  const sound = event.target.closest('[data-sound]');
  if (sound) {
    const video = $(`[data-video-unit="${sound.dataset.sound}"] video`,projectDialog);
    video.muted = !video.muted;
    sound.textContent = video.muted ? '开启声音' : '关闭声音';
    return;
  }
  const fullscreen = event.target.closest('[data-fullscreen]');
  if (fullscreen) {
    const video = $(`[data-video-unit="${fullscreen.dataset.fullscreen}"] video`,projectDialog);
    try { if (video.requestFullscreen) await video.requestFullscreen(); else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); else showToast('请使用播放器的全屏按钮'); } catch { showToast('请使用播放器的全屏按钮'); }
    return;
  }
  const compare = event.target.closest('[data-compare]');
  if (compare) {
    const mode = compare.dataset.compare;
    $$('.comparison-tools [data-compare]',projectDialog).forEach(el => { el.classList.toggle('active',el === compare); el.setAttribute('aria-pressed',String(el === compare)); });
    $('.comparison-videos',projectDialog).classList.toggle('single',mode !== 'both');
    for (const [kind,id] of Object.entries(activeProject.comparison)) {
      const unit = $(`[data-video-unit="${id}"]`,projectDialog);
      unit.hidden = mode !== 'both' && mode !== kind;
      if (unit.hidden) $('video',unit).pause();
    }
    updateMedia();
    return;
  }
  if (event.target.closest('#play-pair')) {
    const videos = $$('.comparison-videos .video-unit:not([hidden]) video',projectDialog);
    if (videos.length > mediaLimit()) { showToast('手机上每次播放一段，点击“只看生成视频”切换'); return; }
    for (const video of videos) { video.currentTime = 0; try { await video.play(); } catch { showToast('请点击播放器中的播放按钮'); } }
  }
});

$('#close-lightbox').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('close',updateMedia);
$('#zoom-image').addEventListener('click', () => { const zoom = lightbox.classList.toggle('zoomed'); $('#zoom-image').textContent = zoom ? '适应屏幕 −' : '查看细节 ＋'; });
$('#motion-toggle').addEventListener('click', () => setReduced(!reduced));
reducedPreference.addEventListener('change', event => setReduced(event.matches,false));
document.addEventListener('visibilitychange', () => { if (document.hidden) $$('audio,video').forEach(el => el.pause()); updateMedia(); });
window.addEventListener('resize', updateMedia);

async function init() {
  setReduced(reduced,false);
  try {
    const response = await fetch('content.json');
    if (!response.ok) throw new Error(`Content HTTP ${response.status}`);
    content = await response.json();
    renderHome();
    handleRoute();
  } catch (error) {
    console.error(error);
    $('#featured-works').innerHTML = '<p class="site-error">作品暂未加载，请刷新页面重试。</p>';
  }
}
init();
