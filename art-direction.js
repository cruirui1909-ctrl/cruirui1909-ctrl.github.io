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
    const response = await fetch('atelier.json?v=paper-theatre-1');
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
    let drag = null;
    let dragged = false;
    const visited = new Set();
    const actionCounts = new Map();
    const replyCounts = new Map();
    section.innerHTML = `
      <div class="atelier-heading"><div><span class="eyebrow">AFTER HOURS / THE MUSEUM CLUB</span><h2 id="playground-title"><span>${escape(collection.title).replace('，','，</span><span>')}</span></h2></div><p><span class="atelier-hours">18:01 <i></i></span>${escape(collection.subtitle)}</p></div>
      <div class="atelier-stage" id="atelier-scene" role="tabpanel" tabindex="0">
        <div class="atelier-canvas">
          <img class="atelier-image" alt="" width="1600" height="1100" decoding="async">
          <div class="atelier-artwork">
            <button class="atelier-portrait" type="button" aria-label="和画中人聊聊" title="和画中人聊聊" disabled><img alt="" draggable="false"></button>
            <span class="atelier-layers"></span>
            <span class="atelier-effects" aria-hidden="true"><b></b><b></b><b></b></span>
          </div>
          <p class="atelier-error" role="status" hidden>画面暂未加载，<button type="button">再试一次 ↗</button></p>
        </div>
        <div class="atelier-copy"><div class="atelier-copy-top"><span class="atelier-number">01 / 06</span><div class="atelier-switch"><button type="button" class="atelier-prev" aria-label="上一个名画场景" title="上一个名画场景">←</button><button type="button" class="atelier-next" aria-label="下一个名画场景" title="下一个名画场景">→</button></div></div><span class="atelier-kicker">A DIFFERENT KIND<br>OF STILL LIFE.</span><h3></h3><p class="atelier-subtitle"></p><p class="atelier-note" aria-live="polite"></p><button class="atelier-play" type="button"><span></span><i>↗</i></button><button class="atelier-talk" type="button" disabled>和画中人聊聊 <span aria-hidden="true">↗</span></button><span class="atelier-credit"></span></div>
      </div>
      <div class="atelier-tools" role="group" aria-label="展厅设置"><label><input class="atelier-original" type="checkbox">只看原画</label><label><input class="atelier-night" type="checkbox">夜间展灯</label><button class="atelier-reset" type="button" title="道具归位" aria-label="道具归位" disabled>↺</button><button class="atelier-save" type="button" disabled>保存明信片 <span aria-hidden="true">↓</span></button><span class="atelier-passport" role="status">今夜足迹 0 / 6</span></div>
      <div class="atelier-tabs" role="tablist" aria-label="选择名画场景">${collection.scenes.map((scene,i)=>`<button type="button" role="tab" id="scene-tab-${scene.id}" aria-controls="atelier-scene" aria-selected="${i===0}" tabindex="${i===0 ? 0 : -1}" data-scene="${i}"><img src="${escape(scene.thumbnail)}" width="360" height="288" alt="" loading="lazy"><span><small>0${i+1}</small>${escape(scene.subtitle.split(' × ')[0])}</span></button>`).join('')}</div>
      <div class="atelier-colophon"><span>THE AFTER-HOURS COLLECTION / 六个寻常的异想</span><details><summary>原画与拼贴来源 ↗</summary><p>原画图像经 WikiArt 获取，保留画面与笔触；日常物件以独立剪贴图层加入展厅。<a href="${escape(collection.backdrop.source)}" target="_blank" rel="noopener noreferrer">风景 / ${escape(collection.backdrop.reference)} ↗</a>${collection.scenes.map(s=>`<a href="${escape(s.source)}" target="_blank" rel="noopener noreferrer">${escape(s.reference)} ↗</a>`).join('')}<a href="https://www.wikiart.org/en/vincent-van-gogh/the-starry-night-1889" target="_blank" rel="noopener noreferrer">梵高《星月夜》杯身图案 ↗</a><a href="https://pngimg.com/images/technic/megaphone" target="_blank" rel="noopener noreferrer">喇叭剪贴素材：PNGimg ↗</a></p></details></div>`;
    const stage = section.querySelector('.atelier-stage');
    const canvas = section.querySelector('.atelier-canvas');
    const picture = section.querySelector('.atelier-image');
    const layers = section.querySelector('.atelier-layers');
    const portrait = section.querySelector('.atelier-portrait');
    const note = section.querySelector('.atelier-note');
    const play = section.querySelector('.atelier-play');
    const talk = section.querySelector('.atelier-talk');
    const save = section.querySelector('.atelier-save');
    const reset = section.querySelector('.atelier-reset');
    const original = section.querySelector('.atelier-original');
    const tabs = [...section.querySelectorAll('[data-scene]')];
    const error = section.querySelector('.atelier-error');

    function stamp() {
      visited.add(active);
      tabs[active].classList.add('visited');
      section.querySelector('.atelier-passport').textContent = visited.size===6 ? '今夜足迹 6 / 6 · 全部相遇' : `今夜足迹 ${visited.size} / 6`;
    }
    function chat() {
      if (!ready) return;
      const replies=collection.scenes[active].replies;
      const count=replyCounts.get(active)||0;
      note.textContent=`「${replies[count%replies.length]}」`;
      replyCounts.set(active,count+1);
      stamp();
    }
    function resetProps() {
      resetAction();
      for (const prop of layers.children) {
        prop.style.left=prop.dataset.homeX+'%';
        prop.style.top=prop.dataset.homeY+'%';
      }
      note.textContent=collection.scenes[active].note;
    }

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
      drag = null;
      dragged = false;
      resetAction();
      stage.dataset.effect = scene.effect;
      stage.style.setProperty('--scene-accent',scene.accent);
      section.querySelector('.atelier-number').textContent = `0${active+1} / 06`;
      section.querySelector('.atelier-copy h3').innerHTML = scene.titleLines.map(line=>`<span>${escape(line)}</span>`).join('');
      section.querySelector('.atelier-subtitle').textContent = scene.subtitle;
      section.querySelector('.atelier-credit').textContent = `原画 / ${scene.reference}`;
      play.querySelector('span').textContent = scene.action;
      portrait.setAttribute('aria-label',`${scene.reference}。和画中人聊聊`);
      note.textContent = scene.note;
      tabs.forEach((tab,i) => { tab.setAttribute('aria-selected',String(i===active));tab.tabIndex=i===active ? 0 : -1; });
      stage.setAttribute('aria-labelledby',tabs[active].id);
      if (focus) tabs[active].focus({preventScroll:true});
      error.hidden = true;
      play.disabled = portrait.disabled = talk.disabled = save.disabled = reset.disabled = true;
      stage.classList.add('loading');
      stage.setAttribute('aria-busy','true');
      picture.removeAttribute('src');
      picture.alt = '';
      layers.replaceChildren();
      try {
        const images = [scene.image,scene.figure.src,scene.original,...scene.layers.flatMap(p=>[p.src,...(p.activeSrc?[p.activeSrc]:[])])];
        await Promise.all(images.map(src=>{ const img=new Image();img.src=src;return img.decode(); }));
        if (sequence !== loadSequence) return;
        portrait.querySelector('img').src = scene.figure.src;
        const figure=scene.figure;
        portrait.style.cssText=`left:${figure.x}%;top:${figure.y}%;width:${figure.width}%;height:${figure.height}%;`;
        picture.src = original.checked ? scene.original : scene.image;
        picture.alt = original.checked ? scene.reference : collection.backdrop.reference;
        layers.innerHTML = scene.layers.map(p=>`<button type="button" class="atelier-prop prop-${escape(p.name)}" data-home-x="${p.x}" data-home-y="${p.y}" data-rotation="${p.rotate}" style="left:${p.x}%;top:${p.y}%;width:${p.width}%;--prop-r:${p.rotate}deg" aria-label="${escape(scene.action)}：${escape(p.label)}" title="${escape(p.label)}" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home"><img src="${escape(p.src)}" alt="" draggable="false" ${p.activeSrc ? `data-rest-src="${escape(p.src)}" data-active-src="${escape(p.activeSrc)}"` : ''}></button>`).join('');
        layers.inert=original.checked;
        ready = true;
        talk.disabled = save.disabled = reset.disabled = false;
        portrait.disabled = original.checked;
        play.disabled = original.checked;
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
      if (!ready || original.checked) return;
      resetAction();
      const scene=collection.scenes[active];
      const count=actionCounts.get(active)||0;
      note.textContent=scene.responses[count%scene.responses.length];
      actionCounts.set(active,count+1);
      stamp();
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
      else if (event.target.closest('.atelier-play,.atelier-prop')) { if (!dragged || !event.target.closest('.atelier-prop') || event.detail===0) performScene();dragged=false; }
      else if (event.target.closest('.atelier-talk,.atelier-portrait')) chat();
      else if (event.target.closest('.atelier-reset')) resetProps();
      else if (event.target.closest('.atelier-error button')) showScene(active);
    });
    original.addEventListener('change',()=>{
      resetAction();
      stage.classList.toggle('original-view',original.checked);
      const scene=collection.scenes[active];
      picture.src=original.checked ? scene.original : scene.image;
      picture.alt=original.checked ? scene.reference : collection.backdrop.reference;
      layers.inert=original.checked;
      portrait.disabled=!ready||original.checked;
      play.disabled=!ready||original.checked;
    });
    canvas.addEventListener('pointermove',event=>{
      if (event.pointerType!=='mouse'||quiet()||drag||project.open) return;
      const box=canvas.getBoundingClientRect();
      portrait.style.setProperty('--parallax-x',`${(event.clientX-box.left-box.width/2)*.012}px`);
      portrait.style.setProperty('--parallax-y',`${(event.clientY-box.top-box.height/2)*.008}px`);
    },{passive:true});
    canvas.addEventListener('pointerleave',()=>{
      portrait.style.setProperty('--parallax-x','0px');
      portrait.style.setProperty('--parallax-y','0px');
    });
    section.querySelector('.atelier-night').addEventListener('change',event=>stage.classList.toggle('night-view',event.target.checked));
    function moveProp(prop, dx, dy) {
      const bounds=canvas.getBoundingClientRect(),box=prop.getBoundingClientRect(),plane=layers.getBoundingClientRect();
      const x=Math.max(bounds.left+3-box.left,Math.min(bounds.right-3-box.right,dx));
      const y=Math.max(bounds.top+3-box.top,Math.min(bounds.bottom-3-box.bottom,dy));
      prop.style.left=(parseFloat(prop.style.left)+x/plane.width*100)+'%';
      prop.style.top=(parseFloat(prop.style.top)+y/plane.height*100)+'%';
    }
    layers.addEventListener('pointerdown',event=>{
      const prop=event.target.closest('.atelier-prop');
      if (!prop||event.button!==0) return;
      resetAction();
      dragged=false;
      drag={prop,id:event.pointerId,x:event.clientX,y:event.clientY,distance:0};
      prop.setPointerCapture(event.pointerId);
      prop.classList.add('dragging');
    });
    layers.addEventListener('pointermove',event=>{
      if (!drag||drag.id!==event.pointerId) return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      drag.distance+=Math.hypot(dx,dy);
      if (drag.distance>5) { moveProp(drag.prop,dx,dy);dragged=true; }
      drag.x=event.clientX;drag.y=event.clientY;
    });
    function endDrag(event) {
      if (!drag||drag.id!==event.pointerId) return;
      drag.prop.classList.remove('dragging');
      if (dragged) { note.textContent=collection.scenes[active].moveNote;stamp(); }
      drag=null;
    }
    layers.addEventListener('pointerup',endDrag);
    layers.addEventListener('pointercancel',endDrag);
    layers.addEventListener('lostpointercapture',endDrag);
    layers.addEventListener('keydown',event=>{
      const prop=event.target.closest('.atelier-prop');
      if (!prop||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home'].includes(event.key)) return;
      event.preventDefault();resetAction();
      if (event.key==='Home') { prop.style.left=prop.dataset.homeX+'%';prop.style.top=prop.dataset.homeY+'%'; }
      else {
        moveProp(prop,event.key==='ArrowLeft'?-8:event.key==='ArrowRight'?8:0,event.key==='ArrowUp'?-8:event.key==='ArrowDown'?8:0);
        note.textContent=collection.scenes[active].moveNote;stamp();
      }
    });
    save.addEventListener('click',async()=>{
      if (!ready) return;
      const scene=collection.scenes[active];
      save.disabled=true;
      try {
        const bounds=canvas.getBoundingClientRect(),scale=1200/bounds.width,artHeight=Math.round(bounds.height*scale);
        const postcard=document.createElement('canvas');postcard.width=1200;postcard.height=artHeight+160;
        const ctx=postcard.getContext('2d');
        ctx.fillStyle='#edf1e9';ctx.fillRect(0,0,1200,postcard.height);
        ctx.save();ctx.beginPath();ctx.rect(0,0,1200,artHeight);ctx.clip();
        ctx.fillStyle='#18291f';ctx.fillRect(0,0,1200,artHeight);
        ctx.filter=stage.classList.contains('night-view')?'brightness(.72)':'none';
        function fitImage(image,x,y,w,h,cover=false) {
          const ratio=(cover?Math.max:Math.min)(w/image.naturalWidth,h/image.naturalHeight);
          const iw=image.naturalWidth*ratio,ih=image.naturalHeight*ratio;
          ctx.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
        }
        fitImage(picture,0,0,1200,artHeight,!original.checked);
        if (!original.checked) {
          const person=portrait.getBoundingClientRect(),plane=layers.getBoundingClientRect();
          fitImage(portrait.querySelector('img'),(person.left-bounds.left)*scale,(person.top-bounds.top)*scale,person.width*scale,person.height*scale);
          for (const prop of layers.children) {
            const image=prop.querySelector('img'),w=parseFloat(prop.style.width)/100*plane.width*scale,h=w*image.naturalHeight/image.naturalWidth;
            ctx.save();ctx.translate((plane.left-bounds.left+parseFloat(prop.style.left)/100*plane.width)*scale+w/2,(plane.top-bounds.top+parseFloat(prop.style.top)/100*plane.height)*scale+h);
            ctx.rotate(+prop.dataset.rotation*Math.PI/180);ctx.drawImage(image,-w/2,-h,w,h);ctx.restore();
          }
        }
        ctx.restore();ctx.fillStyle='#272d29';ctx.font='28px sans-serif';ctx.fillText(scene.title,42,artHeight+52);
        ctx.fillStyle='#6d746d';ctx.font='18px sans-serif';ctx.fillText(scene.reference,42,artHeight+90);
        ctx.font='15px sans-serif';ctx.fillText('CHANG RUI / AFTER HOURS · changrui.online',42,artHeight+130);
        const blob=await new Promise(resolve=>postcard.toBlob(resolve,'image/png'));
        if (!blob) throw new Error('Postcard export failed');
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download=`after-hours-${scene.id}.png`;link.click();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      } catch { note.textContent='明信片暂未保存，请再试一次。'; }
      finally { save.disabled=!ready; }
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

