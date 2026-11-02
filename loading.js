/* Offline script milestones, scene preparation, then real rendered frames. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),overlay=$('loading');
  let progress=0,finished=false,failed=false;
  // Animation frames may be throttled in another tab; this fallback only yields
  // between completed jobs. Completion still waits for actual scene renders.
  const paint=()=>new Promise(resolve=>{
    let frame=0;const done=()=>{clearTimeout(timer);cancelAnimationFrame(frame);resolve();};
    const timer=setTimeout(done,120);frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(done);});
  });
  function set(value,label){
    if(failed||finished||value<progress)return;
    progress=Math.max(progress,Math.min(100,Math.round(value)));
    $('loading-progress').setAttribute('aria-valuenow',String(progress));
    $('loading-progress').setAttribute('aria-valuetext',progress+'%，'+label);
    $('loading-percent').textContent=String(progress).padStart(2,'0')+'%';
    $('loading-progress-fill').style.width=progress+'%';
    $('loading-cloud-fill').style.transform='translateY('+(108-progress*.98)+'px)';
    $('loading-stage').textContent=label;
  }
  function fail(error){
    if(failed)return;failed=true;overlay.hidden=true;$('experience').setAttribute('aria-busy','false');
    $('error').hidden=false;$('error-message').textContent='星馆还没准备好。请保留完整文件夹，并用开启图形加速的新版浏览器打开。'+(error?.message?'（'+error.message+'）':'');
  }
  async function finish(){
    if(failed||finished)return;
    set(100,'云彩已经就位，欢迎来到星馆');finished=true;
    $('experience').setAttribute('aria-busy','false');await paint();
    if(failed)return;
    overlay.classList.add('done');
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||getComputedStyle(overlay).display==='none'){overlay.hidden=true;return;}
    overlay.addEventListener('transitionend',event=>{if(event.target===overlay&&event.propertyName==='opacity')overlay.hidden=true;});
  }
  window.CloudLoading={set,paint,finish,fail};
  function script(src,exportName){
    return new Promise((resolve,reject)=>{
      const element=document.createElement('script');element.src=src+'?v=clouds-v26-20261102';
      element.onload=()=>exportName&&!window[exportName]?reject(new Error('资源未能准备：'+src)):resolve();
      element.onerror=()=>reject(new Error('资源未能载入：'+src));document.body.append(element);
    });
  }
  (async()=>{
    await paint();
    for(const [src,name,value,label] of [
      ['vendor/three.min.js','THREE',10,'推开星馆的大门'],
      ['art-data.js','ART_DATA',32,'收集十二场天气'],
      ['bubbles.js','CloudBubbles',36,'轻轻吹起气泡'],
      ['optics.js','CloudOptics',43,'唤醒水面上的光'],
      ['hall.js','CloudHall',53,'搭起夕阳下的琴廊'],
      ['worlds.js','ZodiacWorlds',61,'铺开十二片梦境'],
      ['music-catalog.js','PIANO_TRACKS',63,'翻开古老的琴谱'],
      ['music.js','CloudMusic',67,'让钢琴醒来'],
      ['sounds.js','CloudSound',70,'留住风与水的声音']
    ]){await script(src,name);set(value,label);await paint();}
    await script('app.js');
  })().catch(fail);
})();
