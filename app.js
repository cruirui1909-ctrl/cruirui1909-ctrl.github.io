/* No server, CDN, framework, or build step is needed to open this experience. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),T=window.THREE;
  const ui={canvas:$('scene'),intro:$('intro'),knob:$('knob-hint'),capsule:$('capsule-hint'),angle:$('angle'),turn:$('turn-meter-fill'),instruction:$('instruction-text'),worldTitle:$('world-title'),back:$('back'),distance:$('distance-fill'),journey:$('journey')};
  const params=new URLSearchParams(location.search),testMode=params.has('test');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={phase:'approach',progress:0,progressTarget:0,angle:0,holding:false,chosen:-1,worldIndex:-1,worldZoom:0,worldZoomTarget:0,elapsed:0,dropStart:0,travelStart:0,returnStart:0,pointerActive:false,lastPointer:0,lastRipple:-1,draws:0,frames:0,averageFrameMs:0};
  const pointer={ndc:new T.Vector2(0,0),smooth:new T.Vector2(0,0),x:0,y:0,inside:false};
  let renderer,hall,camera,daylight,world=null,ball=null,ballLight=null,portal=null,ready=false,previous=performance.now(),lastTouch=null,noticeTimer=0;
  const defs=window.ZodiacWorlds?.definitions;
  let visited=[];
  try{const stored=JSON.parse(localStorage.getItem('cloud-capsules-v1')||'[]');if(Array.isArray(stored))visited=[...new Set(stored.filter(n=>Number.isInteger(n)&&n>=0&&n<12))];}catch{}
  let audio=null,audioOn=false,music=null,effects=null;
  function announce(message){$('announcement').textContent=message;$('announcement').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('announcement').classList.remove('visible'),2400);}
  function fail(error){$('loading').hidden=true;$('error').hidden=false;$('error-message').textContent='请用新版 Chrome 或 Edge 打开，并在浏览器设置中启用图形加速。'+(error?.message?'（'+error.message+'）':'');console.error(error);}
  function randomIndex(){
    const bytes=new Uint32Array(1),limit=Math.floor(0x100000000/12)*12;
    do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);
    return bytes[0]%12;
  }
  function saveCollection(){if(testMode)return;try{localStorage.setItem('cloud-capsules-v1',JSON.stringify(visited));}catch{}}
  function renderAtlas(){
    $('collection-count').textContent=String(visited.length).padStart(2,'0')+' / 12';
    const grid=$('atlas-grid');grid.replaceChildren();
    defs.forEach((d,i)=>{
      const unlocked=visited.includes(i),b=document.createElement('button');b.className='atlas-card';b.disabled=!unlocked;b.setAttribute('aria-label',d.name+'，'+d.title+(unlocked?'，再次进入':'，尚未遇见'));
      const img=document.createElement('img');img.src='assets/art/'+String(i+1).padStart(2,'0')+'.jpg';img.alt='';img.loading='lazy';b.append(img);
      const title=document.createElement('span');title.textContent=unlocked?d.title:'尚未遇见';b.append(title);const glyph=document.createElement('small');glyph.textContent=d.glyph;b.append(glyph);
      b.addEventListener('click',()=>{$('atlas').close();openWorld(i);});grid.append(b);
    });
  }
  function updateMusicUI({enabled,track}){
    audioOn=enabled;$('sound').setAttribute('aria-pressed',String(enabled));$('sound').setAttribute('aria-label',enabled?'关闭音乐与音效':'开启音乐与音效');$('sound-label').textContent=enabled?'声音开启':'声音关闭';
    $('sound').title=(enabled?'正在播放：':'本场曲目：')+track.composer+'《'+track.title+'》';
    $('music-track').textContent='♫ '+track.composer+' · '+track.title;$('music-track').hidden=!enabled;
    if(audio)audio.master.gain.setTargetAtTime(enabled?.65:0,audio.context.currentTime,.4);
    effects?.setEnabled(enabled);
  }
  function sound(){
    if(!audio){
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
      const context=new Context(),master=context.createGain();master.gain.value=0;master.connect(context.destination);
      audio={context,master};
      effects=CloudSound.create(context,master,name=>music.playCue(name));effects.setScene(state.worldIndex<0?null:state.worldIndex);
    }
    audio.context.resume();music.setEnabled(!audioOn);ui.canvas.focus({preventScroll:true});
  }
  function setProgress(value){
    if(!['approach','ready','turning'].includes(state.phase))return;
    if(state.holding)return;
    state.progressTarget=T.MathUtils.clamp(value,0,1);
    if(state.progressTarget<.97){state.holding=false;state.phase='approach';}
  }
  function disposeBall(){
    if(ball){hall.scene.remove(ball);ball.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});ball=null;}
    if(ballLight){hall.scene.remove(ballLight);ballLight=null;}
    if(portal){hall.scene.remove(portal);portal.geometry.dispose();portal.material.dispose();portal=null;}
  }
  function dropCapsule(){
    if(state.chosen!==-1)return;
    state.holding=false;state.angle=180;state.chosen=randomIndex();state.draws++;state.phase='dropping';state.dropStart=state.elapsed;
    const def=defs[state.chosen];ball=hall.makeCapsule(def.color,def.glyph);ball.position.set(0,.59,.98);hall.scene.add(ball);
    ballLight=new T.PointLight(def.color,1.5,3,2);ballLight.position.copy(ball.position);hall.scene.add(ballLight);ui.knob.hidden=true;
    ui.instruction.textContent='一颗梦，正在落下';effects?.event('release');
  }
  function beginTurn(){if(state.phase==='ready'||state.phase==='turning'){state.holding=true;state.phase='turning';ui.canvas.focus({preventScroll:true});}}
  function endTurn(){state.holding=false;}
  function createWorld(index){
    if(world)world.dispose();daylight.reset(index,pointer.ndc);world=ZodiacWorlds.create(index,{reducedMotion,daylight:daylight.mask});state.worldIndex=index;
    if(!visited.includes(index)){visited.push(index);saveCollection();renderAtlas();}
    const d=defs[index];$('world-sign').textContent=d.glyph+'  '+d.name+'  /  '+d.en;$('world-name').textContent=d.title;$('world-description').textContent=d.line;
    $('place').textContent=d.weather;$('place-sub').textContent='TWELVE WEATHERS · '+String(index+1).padStart(2,'0');
    state.worldZoom=0;state.worldZoomTarget=0;ui.instruction.textContent='移动点亮白昼 · 滚轮穿行 · 点击泛光';ui.journey.hidden=false;$('distance-label').textContent='入景';$('distance-end').textContent='深处';
    music.setScene(index);effects?.setScene(index);
  }
  function openWorld(index=state.chosen){
    if(!Number.isInteger(index)||index<0||index>11)return;
    if(['travel','returning'].includes(state.phase))return;
    state.holding=false;state.phase='travel';state.travelStart=state.elapsed;state.chosen=index;
    effects?.leave();
    ui.knob.hidden=true;ui.capsule.hidden=true;ui.intro.classList.add('departed');
    const rect=ui.canvas.getBoundingClientRect();if(ball){const p=ball.position.clone().project(camera);$('passage').style.setProperty('--portal-x',(p.x*.5+.5)*100+'%');$('passage').style.setProperty('--portal-y',(-p.y*.5+.5)*100+'%');}
    if(ball){
      portal=new T.Mesh(new T.TorusGeometry(.30,.012,8,64),new T.MeshBasicMaterial({color:'#fff1c0',transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false}));portal.position.copy(ball.position);portal.lookAt(camera.position);hall.scene.add(portal);
    }
    effects?.event('open');ui.instruction.textContent='把这场风，轻轻打开';
  }
  function returnToHall(){
    if(!ready||state.phase==='returning')return;
    if(state.phase==='world'||state.phase==='travel'){
      effects?.leave();
      state.phase='returning';state.returnStart=state.elapsed;ui.worldTitle.hidden=true;return;
    }
    resetHall(false);
  }
  function resetHall(near=true){
    if(world){world.dispose();world=null;}
    disposeBall();state.chosen=-1;state.worldIndex=-1;state.angle=0;state.holding=false;
    state.progressTarget=near?1:0;state.progress=near?1:0;state.phase=near?'ready':'approach';
    ui.worldTitle.hidden=true;ui.back.hidden=true;ui.journey.hidden=false;$('distance-label').textContent='远景';$('distance-end').textContent='近景';$('place').textContent='光与水的回廊';$('place-sub').textContent='THE HALL OF POSSIBILITIES';
    ui.instruction.textContent=near?'按住空格，旋转半圈': '向前滚动，慢慢走近';ui.intro.classList.toggle('departed',near);ui.canvas.focus({preventScroll:true});
    music.setScene(null);effects?.setScene(null);
  }
  function projectHint(element,position,offsetX,offsetY){
    const p=position.clone().project(camera),x=(p.x*.5+.5)*innerWidth+offsetX,y=(-p.y*.5+.5)*innerHeight+offsetY;
    element.style.left=T.MathUtils.clamp(x,innerWidth<600?95:120,innerWidth-(innerWidth<600?95:120))+'px';
    element.style.top=T.MathUtils.clamp(y,100,innerHeight-90)+'px';
  }
  function updateHall(dt){
    const previousProgress=state.progress;
    state.progress=T.MathUtils.damp(state.progress,state.progressTarget,4,dt);
    const p=T.MathUtils.smoothstep(state.progress,0,1),near=state.progress>.985&&state.progressTarget>.99;
    camera.fov=48;camera.position.set(T.MathUtils.lerp(4.2,.14,p)+pointer.smooth.x*(1-p)*.20,T.MathUtils.lerp(2.65,2.42,p)+pointer.smooth.y*.035,T.MathUtils.lerp(33,6.65,p));
    camera.lookAt(T.MathUtils.lerp(0,0,p),T.MathUtils.lerp(4.0,2.08,p),T.MathUtils.lerp(-18,0,p));camera.updateProjectionMatrix();camera.updateMatrixWorld();
    ui.distance.style.width=state.progress*100+'%';ui.intro.classList.toggle('departed',state.progressTarget>.07);
    if(near&&state.phase==='approach'){state.phase='ready';ui.instruction.textContent='按住空格，旋转半圈';}
    if(!near&&state.phase==='ready'){state.phase='approach';ui.instruction.textContent='向前滚动，慢慢走近';}
    ui.knob.hidden=!near||!['ready','turning'].includes(state.phase);
    if(!ui.knob.hidden){projectHint(ui.knob,new T.Vector3(0,1.2,1.0),innerWidth>700?190:0,innerWidth>700?-25:95);ui.angle.textContent=Math.floor(state.angle)+'° / 180°';ui.turn.style.width=state.angle/180*100+'%';$('knob-copy').textContent=state.holding?'让梦转过半圈':'按住，转动旋钮';}
    if(state.phase==='turning'&&state.holding){state.angle=Math.min(180,state.angle+dt*112);if(state.angle>=180)dropCapsule();}
    hall.update(state.elapsed,dt,state.pointerActive,state.angle,camera);
    effects?.update({angle:state.angle,hopperSpeed:hall.machine.hopperMotion.speed,cameraSpeed:document.hidden?0:Math.abs(state.progress-previousProgress)/Math.max(.001,dt)*2});
    if(ball){
      if(state.phase==='dropping'){
        const t=state.elapsed-state.dropStart,duration=1.22,f=T.MathUtils.clamp(t/duration,0,1);
        const y=f<.50?.58-.32*Math.pow(f/.5,2):.26+Math.abs(Math.sin((f-.5)*Math.PI*2.9))*.13*(1-f)*2;
        ball.position.set(Math.sin(f*Math.PI)*.035,y,1.0+1.18*T.MathUtils.smoothstep(f,0,1));ball.rotation.x=f*Math.PI*1.3;
        if(f>=.5&&!ball.userData.landed){ball.userData.landed=true;effects?.event('land');}
        if(f>=1){state.phase='capsule';ball.rotation.set(0,0,0);hall.ripple(ball.position.x,ball.position.z,1.1);ui.instruction.textContent='点击扭蛋，打开一场天气';announce('一颗小小的梦，落在你面前');}
      }else if(state.phase==='capsule'){ball.position.y=.26+Math.sin(state.elapsed*1.3)*.012;}
      if(ballLight)ballLight.position.copy(ball.position).add(new T.Vector3(0,.15,0));
      ui.capsule.hidden=state.phase!=='capsule';
      if(!ui.capsule.hidden)projectHint(ui.capsule,ball.position,0,-55);
    }else ui.capsule.hidden=true;
  }
  function updateWorld(dt){
    const previousZoom=state.worldZoom;
    state.worldZoom=T.MathUtils.damp(state.worldZoom,state.worldZoomTarget,3,dt);
    world.setCamera(camera,state.worldZoom,pointer.smooth,dt);
    ui.journey.hidden=false;ui.distance.style.width=state.worldZoom*100+'%';
    world.update(state.elapsed,dt,state.pointerActive,1,innerHeight*renderer.getPixelRatio());
    daylight.render(renderer,world.scene,camera,pointer.ndc,pointer.inside,state.elapsed,dt);
    effects?.update({daylight:daylight.mask.uDayStrength.value,flash:world.uniforms.uFlash.value,cameraSpeed:document.hidden?0:Math.abs(state.worldZoom-previousZoom)/Math.max(.001,dt)*2});
  }
  function tick(now){
    if(!ready)return;
    const raw=(now-previous)/1000,dt=Math.min(raw,.1);previous=now;
    if(!document.hidden)state.elapsed+=dt;
    state.frames++;state.averageFrameMs=state.averageFrameMs*.97+raw*1000*.03;
    pointer.smooth.lerp(pointer.ndc,Math.min(1,dt*3.5));state.pointerActive=now-state.lastPointer<1800;
    if(state.phase==='world')updateWorld(dt);
    else if(state.phase==='returning'){
      const f=(state.elapsed-state.returnStart)/1.05;$('passage').style.opacity=String(Math.sin(Math.min(1,f)*Math.PI));
      if(f<.5&&world)updateWorld(dt);else{if(world)resetHall(true);updateHall(dt);hall.render(renderer,camera);}
      if(f>=1){state.phase='ready';$('passage').style.opacity='0';}
      // resetHall changes the phase, so retain the return until its fade completes.
      else state.phase='returning';
    }else if(state.phase==='travel'){
      const f=(state.elapsed-state.travelStart)/1.35;
      const glow=Math.sin(Math.min(1,f)*Math.PI);$('passage').style.opacity=String(Math.pow(Math.max(0,glow),.65));
      if(f<.54){
        updateHall(dt);
        if(ball){ball.userData.top.position.y=Math.min(1,f*3)*.5;ball.userData.top.rotation.z=f*.7;ball.userData.bottom.position.y=-f*.15;}
        if(portal){portal.scale.setScalar(1+f*13);portal.rotation.z=state.elapsed;portal.material.opacity=1-f;}
        if(ball){camera.position.lerp(ball.position.clone().add(new T.Vector3(0,.25,1.2)),f*.55);camera.lookAt(ball.position);}
        hall.render(renderer,camera);
      }else{
        if(!world||state.worldIndex!==state.chosen){createWorld(state.chosen);disposeBall();ui.journey.hidden=false;}
        updateWorld(dt);
      }
      if(f>=1){state.phase='world';$('passage').style.opacity='0';ui.worldTitle.hidden=false;ui.back.hidden=false;ui.instruction.textContent='移动点亮白昼 · 滚轮穿行 · 点击泛光';ui.canvas.focus({preventScroll:true});}
    }else{updateHall(dt);hall.render(renderer,camera);}
    requestAnimationFrame(tick);
  }
  function leavePointer(){pointer.inside=false;hall?.leave();world?.leave();effects?.leave();}
  function movePointer(event){
    pointer.inside=true;pointer.x=event.clientX;pointer.y=event.clientY;pointer.ndc.set(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);state.lastPointer=performance.now();state.pointerActive=true;
    const active=state.elapsed-state.lastRipple>.07;
    if(state.phase==='world'&&world){
      const hit=world.pointer(pointer.ndc,camera,state.elapsed,active);
      effects?.pointer({x:pointer.ndc.x,y:pointer.ndc.y,...hit});
    }else if(hall&&camera){
      const hit=hall.pointer(pointer.ndc,camera,active,state.elapsed);
      if(!['travel','returning'].includes(state.phase)){if(hit.surface==='piano')effects?.leave();else effects?.pointer({x:pointer.ndc.x,y:pointer.ndc.y,...hit});}
    }
    if(active)state.lastRipple=state.elapsed;
    if(event.pointerType==='touch'&&lastTouch){
      const dy=lastTouch.y-event.clientY;if(Math.abs(dy)>1){if(state.phase==='world')state.worldZoomTarget=T.MathUtils.clamp(state.worldZoomTarget+dy*.0022,0,1);else setProgress(state.progressTarget+dy*.0022);}
      lastTouch={x:event.clientX,y:event.clientY};
    }
  }
  function onKey(event){
    if($('help').open||$('atlas').open)return;
    if(event.code==='Space'&&event.target!==ui.knob&&event.target.closest?.('button,a,input,textarea'))return;
    if(event.code==='Space'){event.preventDefault();if(event.repeat)return;beginTurn();}
    else if(event.code==='Enter'&&state.phase==='capsule'){event.preventDefault();openWorld();}
    else if(event.code==='Escape')returnToHall();
    else if(['ArrowUp','ArrowDown','PageUp','PageDown'].includes(event.code)){
      event.preventDefault();const direction=['ArrowUp','PageDown'].includes(event.code)?1:-1;
      if(state.phase==='world')state.worldZoomTarget=T.MathUtils.clamp(state.worldZoomTarget+direction*.12,0,1);else setProgress(state.progressTarget+direction*.1);
    }
  }
  function installEvents(){
    window.addEventListener('wheel',e=>{if($('help').open||$('atlas').open)return;e.preventDefault();const d=e.deltaY*(e.deltaMode===1?25:e.deltaMode===2?innerHeight:1);if(state.phase==='world')state.worldZoomTarget=T.MathUtils.clamp(state.worldZoomTarget+d*.00048,0,1);else setProgress(state.progressTarget+d*.00078);},{passive:false});
    window.addEventListener('keydown',onKey);window.addEventListener('keyup',e=>{if(e.code==='Space')endTurn();});window.addEventListener('blur',()=>{endTurn();leavePointer();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){endTurn();leavePointer();}previous=performance.now();});
    ui.canvas.addEventListener('pointermove',movePointer);
    ui.canvas.addEventListener('pointerleave',leavePointer);
    ui.canvas.addEventListener('pointerdown',e=>{if(!audio)sound();movePointer(e);if(e.pointerType==='touch'){lastTouch={x:e.clientX,y:e.clientY};ui.canvas.setPointerCapture(e.pointerId);}});
    ui.canvas.addEventListener('pointerup',e=>{lastTouch=null;if(e.pointerType==='touch'){hall.leave();effects?.leave();}});ui.canvas.addEventListener('pointercancel',()=>{lastTouch=null;endTurn();leavePointer();});
    ui.canvas.addEventListener('click',e=>{
      if(state.phase==='world'&&world){const ndc=new T.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),hit=world.click(ndc,camera,state.elapsed);effects?.event('pulse',undefined,{pan:ndc.x,...hit});return;}
      if(state.phase!=='capsule'||!ball)return;
      const ndc=new T.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),raycaster=new T.Raycaster();raycaster.setFromCamera(ndc,camera);
      if(raycaster.intersectObject(ball,true).length)openWorld();
    });
    ui.knob.addEventListener('pointerdown',e=>{e.preventDefault();ui.knob.setPointerCapture(e.pointerId);beginTurn();});
    ui.knob.addEventListener('pointerup',endTurn);ui.knob.addEventListener('pointercancel',endTurn);ui.knob.addEventListener('lostpointercapture',endTurn);
    ui.capsule.addEventListener('click',()=>openWorld());$('begin').addEventListener('click',()=>{if(!audio)sound();setProgress(.21);ui.canvas.focus({preventScroll:true});});
    $('brand-home').addEventListener('click',e=>{e.preventDefault();returnToHall();});ui.back.addEventListener('click',returnToHall);
    $('sound').addEventListener('click',sound);
    $('help-button').addEventListener('click',()=>{endTurn();$('help').showModal();});$('atlas-button').addEventListener('click',()=>{endTurn();renderAtlas();$('atlas').showModal();});
    document.querySelectorAll('.close-modal').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
    document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
    document.addEventListener('pointerover',e=>{const control=e.target.closest?.('button,a');if(control&&!control.disabled&&!control.contains(e.relatedTarget))effects?.event('uiHover',undefined,{pan:e.clientX/innerWidth*2-1});});
    document.addEventListener('click',e=>{const control=e.target.closest?.('button,a');if(control&&!control.disabled&&!['sound','knob-hint','capsule-hint'].includes(control.id))effects?.event('uiClick',undefined,{pan:e.clientX/innerWidth*2-1});},true);
    window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();hall.resize(innerWidth,innerHeight);daylight.resize(Math.round(innerWidth*renderer.getPixelRatio()),Math.round(innerHeight*renderer.getPixelRatio()));});
    ui.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;fail(new Error('图形上下文中断，请重新进入'));});
  }
  try{
    if(!T||!window.ART_DATA||!window.CloudHall||!window.ZodiacWorlds||!window.CloudMusic||!window.CloudSound||!window.PIANO_TRACKS)throw new Error('网页资源缺失，请保留整个文件夹');
    renderer=new T.WebGLRenderer({canvas:ui.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
    camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.08,240);hall=CloudHall.create(renderer,hit=>effects?.event('bubble',undefined,hit),key=>music?.playCue('piano-'+key.midi));hall.resize(innerWidth,innerHeight);daylight=CloudOptics.createDaylight({reducedMotion});daylight.resize(Math.round(innerWidth*renderer.getPixelRatio()),Math.round(innerHeight*renderer.getPixelRatio()));
    music=CloudMusic.create(updateMusicUI,message=>announce(message||'音乐暂未播放，请点击右上角重新开启'));updateMusicUI({enabled:false,track:PIANO_TRACKS[0]});
    installEvents();renderAtlas();ready=true;ui.canvas.focus({preventScroll:true});requestAnimationFrame(tick);
    setTimeout(()=>$('loading').classList.add('done'),450);setTimeout(()=>$('loading').hidden=true,1500);
    window.cloudExperience={
      getState(){const screen=ball?.position.clone().project(camera);return {phase:state.phase,progress:state.progress,target:state.progressTarget,angle:state.angle,chosen:state.chosen,world:state.worldIndex,worldTravel:state.worldZoom,worldTravelTarget:state.worldZoomTarget,draws:state.draws,frames:state.frames,averageFrameMs:state.averageFrameMs,visited:visited.slice(),hall:hall.stats(),worldStats:world?.stats()||null,daylight:world?daylight.stats():null,capsulePosition:ball?.position.toArray()||null,capsuleScreen:screen?[(screen.x*.5+.5)*innerWidth,(-screen.y*.5+.5)*innerHeight]:null,renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}};},
      getMusic(){return music.stats();},
      getSound(){return effects?.stats()||{enabled:false,scene:state.worldIndex+1,context:'not-started',rms:0,peak:0,events:{}};},
      definitions:defs.map(d=>({name:d.name,title:d.title,effects:d.effects.slice()}))
    };
    if(testMode)window.cloudExperience.test={enterWorld(index){createWorld(index);state.phase='world';ui.intro.classList.add('departed');ui.worldTitle.hidden=false;ui.back.hidden=false;ui.knob.hidden=true;ui.capsule.hidden=true;ui.journey.hidden=false;},returnHall(){resetHall(true);},randomIndex};
  }catch(error){fail(error);}
})();
