'use strict';

// Native scroll and pointer effects keep the original media player independent.
(() => {
  const root = document.documentElement;
  const progress = document.querySelector('.reading-progress span');
  const kinetic = document.querySelector('.kinetic-type');
  const cursor = document.querySelector('.art-cursor');
  const chapters = document.querySelector('.chapter-nav');
  const links = [...chapters.querySelectorAll('a')];
  let scrollFrame = 0;
  let pointerFrame = 0;
  const quiet = () => root.classList.contains('reduced-motion');

  function paintScroll() {
    scrollFrame = 0;
    const extent = root.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${extent > 0 ? scrollY / extent : 0})`;
    const box = kinetic.getBoundingClientRect();
    const amount = Math.max(-1,Math.min(2,(innerHeight-box.top)/(innerHeight+box.height)));
    kinetic.style.setProperty('--type-x',quiet() ? '0px' : `${-amount * Math.min(innerWidth*.27,400)}px`);
    kinetic.style.setProperty('--type-r',quiet() ? '0deg' : `${amount*90}deg`);
    chapters.classList.toggle('visible',scrollY > innerHeight*.65 && !document.querySelector('dialog[open]'));
    let current = links[0];
    for (const link of links) if (document.querySelector(link.hash).getBoundingClientRect().top < innerHeight*.5) current = link;
    for (const link of links) { link.classList.toggle('current',link === current); if (link === current) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current'); }
  }
  function queueScroll() { if (!scrollFrame) scrollFrame = requestAnimationFrame(paintScroll); }
  addEventListener('scroll',queueScroll,{passive:true});
  addEventListener('resize',queueScroll);
  new MutationObserver(queueScroll).observe(root,{attributes:true,attributeFilter:['class']});
  const project = document.querySelector('#project-dialog');
  new MutationObserver(() => { cursor.classList.remove('active'); queueScroll(); }).observe(project,{attributes:true,attributeFilter:['open']});
  document.addEventListener('pointermove',event => {
    if (quiet() || event.pointerType !== 'mouse') { cursor.classList.remove('active'); return; }
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      const artwork = event.target.closest('.feature-art,.archive-image');
      cursor.classList.toggle('active',!!artwork && !document.querySelector('dialog[open]'));
      cursor.style.transform = `translate(${event.clientX-35}px,${event.clientY-35}px)`;
      if (artwork) {
        const box = artwork.getBoundingClientRect();
        artwork.style.setProperty('--light-x',`${(event.clientX-box.left)/box.width*100}%`);
        artwork.style.setProperty('--light-y',`${(event.clientY-box.top)/box.height*100}%`);
      }
    });
  },{passive:true});
  document.addEventListener('pointerleave',() => cursor.classList.remove('active'));
  document.addEventListener('keydown',() => cursor.classList.remove('active'));
  paintScroll();

  async function initAtelier() {
    const response = await fetch('atelier.json');
    if (!response.ok) return;
    const collection = await response.json();
    if (!collection.ready || collection.scenes.length !== 6) return;
    const section = document.querySelector('#playground');
    const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let active = 0;
    let loadSequence = 0;
    let effectTimer;
    let effectFrame;
    let started = false;
    let ready = false;
    section.innerHTML = `
      <div class="atelier-heading"><div><span class="eyebrow">AFTER HOURS / THE MUSEUM CLUB</span><h2 id="playground-title">${escape(collection.title)}</h2></div><p><span class="atelier-hours">18:01 <i></i></span>${escape(collection.subtitle)}</p></div>
      <div class="atelier-stage" id="atelier-scene" role="tabpanel" tabindex="0">
        <div class="atelier-canvas">
          <button class="atelier-artwork" type="button" aria-label="与画中人互动">
            <img class="atelier-image" alt="" width="1200" height="960" decoding="async">
            <span class="atelier-layers" aria-hidden="true"></span>
            <span class="atelier-effects" aria-hidden="true"><b></b><b></b><b></b></span>
          </button>
          <p class="atelier-error" role="status" hidden>画面暂未加载，<button type="button">再试一次 ↗</button></p>
        </div>
        <div class="atelier-copy"><div class="atelier-copy-top"><span class="atelier-number">01 / 06</span><div class="atelier-switch"><button type="button" class="atelier-prev" aria-label="上一个名画场景" title="上一个名画场景">←</button><button type="button" class="atelier-next" aria-label="下一个名画场景" title="下一个名画场景">→</button></div></div><span class="atelier-kicker">A DIFFERENT KIND<br>OF STILL LIFE.</span><h3></h3><p class="atelier-subtitle"></p><p class="atelier-note" aria-live="polite"></p><button class="atelier-play" type="button"><span></span><i>↗</i></button><span class="atelier-credit"></span></div>
      </div>
      <div class="atelier-tabs" role="tablist" aria-label="选择名画场景">${collection.scenes.map((scene,i)=>`<button type="button" role="tab" id="scene-tab-${scene.id}" aria-controls="atelier-scene" aria-selected="${i===0}" tabindex="${i===0 ? 0 : -1}" data-scene="${i}"><img src="${escape(scene.thumbnail)}" width="360" height="288" alt="" loading="lazy"><span><small>0${i+1}</small>${escape(scene.subtitle.split(' × ')[0])}</span></button>`).join('')}</div>
      <div class="atelier-colophon"><span>THE AFTER-HOURS COLLECTION / 六个寻常的异想</span><details><summary>原画与拼贴来源 ↗</summary><p>原画图像经 WikiArt 获取，保留画面与笔触；日常物件以独立剪贴图层加入展厅。${collection.scenes.map(s=>`<a href="${escape(s.source)}" target="_blank" rel="noopener noreferrer">${escape(s.reference)} ↗</a>`).join('')}<a href="https://www.wikiart.org/en/vincent-van-gogh/the-starry-night-1889" target="_blank" rel="noopener noreferrer">梵高《星月夜》杯身图案 ↗</a><a href="https://pngimg.com/images/technic/megaphone" target="_blank" rel="noopener noreferrer">喇叭剪贴素材：PNGimg ↗</a></p></details></div>`;
    const stage = section.querySelector('.atelier-stage');
    const canvas = section.querySelector('.atelier-canvas');
    const picture = section.querySelector('.atelier-image');
    const layers = section.querySelector('.atelier-layers');
    const artwork = section.querySelector('.atelier-artwork');
    const note = section.querySelector('.atelier-note');
    const play = section.querySelector('.atelier-play');
    const tabs = [...section.querySelectorAll('[data-scene]')];
    const error = section.querySelector('.atelier-error');

    function resetAction() {
      clearTimeout(effectTimer);
      cancelAnimationFrame(effectFrame);
      stage.classList.remove('acting');
      layers.querySelectorAll('[data-rest-src]').forEach(img=>img.src=img.dataset.restSrc);
    }
    async function showScene(index, focus = false) {
      active = (index + collection.scenes.length) % collection.scenes.length;
      const scene = collection.scenes[active];
      const sequence = ++loadSequence;
      started = true;
      ready = false;
      resetAction();
      stage.dataset.effect = scene.effect;
      stage.style.setProperty('--scene-accent',scene.accent);
      section.querySelector('.atelier-number').textContent = `0${active+1} / 06`;
      section.querySelector('.atelier-copy h3').innerHTML = scene.titleLines.map(line=>`<span>${escape(line)}</span>`).join('');
      section.querySelector('.atelier-subtitle').textContent = scene.subtitle;
      section.querySelector('.atelier-credit').textContent = `原画 / ${scene.reference}`;
      play.querySelector('span').textContent = scene.action;
      artwork.setAttribute('aria-label',`${scene.subtitle}。${scene.action}`);
      note.textContent = scene.note;
      tabs.forEach((tab,i) => { tab.setAttribute('aria-selected',String(i===active));tab.tabIndex=i===active ? 0 : -1; });
      stage.setAttribute('aria-labelledby',tabs[active].id);
      if (focus) tabs[active].focus({preventScroll:true});
      error.hidden = true;
      play.disabled = artwork.disabled = true;
      stage.classList.add('loading');
      stage.setAttribute('aria-busy','true');
      picture.removeAttribute('src');
      picture.alt = '';
      layers.replaceChildren();
      try {
        const images = [scene.image,...scene.layers.flatMap(p=>[p.src,...(p.activeSrc?[p.activeSrc]:[])])];
        await Promise.all(images.map(src=>{ const img=new Image();img.src=src;return img.decode(); }));
        if (sequence !== loadSequence) return;
        picture.src = scene.image;
        picture.alt = scene.reference+'与日常物件的展厅拼贴';
        layers.innerHTML = scene.layers.map(p=>`<span class="atelier-prop prop-${escape(p.name)}" style="left:${p.x}%;top:${p.y}%;width:${p.width}%;--prop-r:${p.rotate}deg"><img src="${escape(p.src)}" alt="" ${p.activeSrc ? `data-rest-src="${escape(p.src)}" data-active-src="${escape(p.activeSrc)}"` : ''}></span>`).join('');
        ready = true;
        play.disabled = artwork.disabled = false;
        canvas.getAnimations().forEach(animation=>animation.cancel());
        if (!quiet()) canvas.animate([{opacity:.2,clipPath:'inset(0 0 0 8%)',transform:'translateY(18px)'},{opacity:1,clipPath:'inset(0)',transform:'translateY(0)'}],{duration:550,easing:'cubic-bezier(.2,.75,.2,1)'});
      } catch {
        if (sequence !== loadSequence) return;
        error.hidden = false;
      } finally {
        if (sequence === loadSequence) { stage.setAttribute('aria-busy','false');stage.classList.remove('loading'); }
      }
    }
    function performScene() {
      if (!ready) return;
      resetAction();
      note.textContent = collection.scenes[active].note;
      layers.querySelectorAll('[data-active-src]').forEach(img=>img.src=img.dataset.activeSrc);
      if (!quiet()) effectFrame = requestAnimationFrame(() => {
        stage.classList.add('acting');
        effectTimer = setTimeout(()=>stage.classList.remove('acting'),2600);
      });
    }
    section.addEventListener('click',event => {
      const tab = event.target.closest('[data-scene]');
      if (tab) showScene(+tab.dataset.scene);
      else if (event.target.closest('.atelier-next')) showScene(active+1);
      else if (event.target.closest('.atelier-prev')) showScene(active-1);
      else if (event.target.closest('.atelier-play,.atelier-artwork')) performScene();
      else if (event.target.closest('.atelier-error button')) showScene(active);
    });
    section.querySelector('.atelier-tabs').addEventListener('keydown',event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      showScene(event.key==='Home' ? 0 : event.key==='End' ? 5 : active+(event.key==='ArrowRight' ? 1 : -1),true);
    });
    const pause = () => {
      const paused = document.hidden || project.open || quiet();
      stage.classList.toggle('paused',paused);
      if (paused) { resetAction();canvas.getAnimations().forEach(a=>a.cancel()); }
    };
    const pauseObserver = new MutationObserver(pause);
    pauseObserver.observe(project,{attributes:true,attributeFilter:['open']});
    pauseObserver.observe(root,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',pause);
    section.hidden = false;
    const teaser = document.createElement('a');
    teaser.href = '#playground';
    teaser.className = 'atelier-teaser';
    teaser.innerHTML = '名画也有下班时间 <span>↗</span>';
    document.querySelector('.hero-description').append(teaser);
    new IntersectionObserver(([entry])=>{
      if (entry.isIntersecting && !started) showScene(0);
    },{rootMargin:'350px'}).observe(section);
    new IntersectionObserver(([entry])=>{
      stage.classList.toggle('in-view',entry.isIntersecting);
      if (!entry.isIntersecting) resetAction();
    },{threshold:.05}).observe(stage);
    pause();
    // The section is populated asynchronously, so a direct anchor needs a final scroll.
    if (location.hash==='#playground') { showScene(0);section.scrollIntoView({behavior:'instant'}); }
  }
  initAtelier().catch(error=>console.error('Atelier content:',error));
})();

