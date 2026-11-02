/* Local piano recordings. Two native media elements provide a short crossfade. */
window.CloudMusic = (() => {
  'use strict';
  function create(onChange,onError){
    const tracks=window.PIANO_TRACKS,players=[new Audio(),new Audio()];
    players.forEach(p=>{p.loop=true;p.preload='auto';p.volume=0;});
    let enabled=false,scene=0,active=-1,generation=0,animation=0,error=null,waitingForGesture=false;
    const level=1;
    const rain=new Audio('assets/sounds/rain.mp3'),rainLevels={2:.50,8:.62,9:.18,11:.20};rain.loop=true;rain.preload='auto';rain.volume=0;
    let rainAnimation=0,rainError=null;
    const base=[0,0],cueBanks=new Map(),cueEvents={},cueHistory=[];
    let duck=1,duckUntil=0,mixAnimation=0,cueError=null,lastMix=0;
    for(const [name,file,count] of [['bubble','bubble.wav',3],['water','water.wav',3],['thunder','thunder.wav',2],...Array.from({length:22},(_,i)=>['piano-'+(48+i),'piano/'+(48+i)+'.mp3',1])]){
      cueBanks.set(name,Array.from({length:count},()=>{const p=new Audio('assets/sounds/'+file);p.preload='auto';return p;}));
    }
    function applyVolume(){players.forEach((p,i)=>{p.volume=Math.max(0,Math.min(1,base[i]*duck));});}
    function updateRain(){
      cancelAnimationFrame(rainAnimation);const target=enabled?(rainLevels[scene]||0):0,from=rain.volume,start=performance.now();
      if(target>0)rain.play().catch(e=>{if(e.name==='AbortError'||!enabled)return;rainError=e.name;onError?.('雨声暂未播放，请再次点击声音开关');});
      function fade(now){
        const t=Math.max(0,Math.min(1,(now-start)/450));rain.volume=from+(target-from)*t*t*(3-2*t);
        if(t<1)rainAnimation=requestAnimationFrame(fade);else if(!target){rain.pause();rain.currentTime=0;}
      }
      rainAnimation=requestAnimationFrame(fade);
    }
    function balanceCues(){
      const playing=[...cueBanks.values()].flat().filter(p=>!p.paused&&!p.ended),gain=1/Math.sqrt(Math.max(1,playing.length));
      for(const p of playing)p.volume=Number(p.dataset.level||0)*gain;
    }
    for(const bank of cueBanks.values())for(const p of bank)p.addEventListener('ended',balanceCues);
    function duckMusic(seconds){
      duckUntil=Math.max(duckUntil,performance.now()+seconds*1000);
      if(mixAnimation)return;lastMix=performance.now();
      function mix(now){
        const target=now<duckUntil?.40:1;duck+=(target-duck)*(1-Math.exp(-(now-lastMix)/(target<duck?45:320)));lastMix=now;applyVolume();
        if(now<duckUntil||1-duck>.001)mixAnimation=requestAnimationFrame(mix);else{duck=1;mixAnimation=0;applyVolume();}
      }
      mixAnimation=requestAnimationFrame(mix);
    }
    function notify(){onChange?.({enabled,track:tracks[scene]});}
    function fade(targets,seconds,finished){
      cancelAnimationFrame(animation);
      const start=performance.now(),from=base.slice();
      function step(now){
        const t=Math.min(1,(now-start)/(seconds*1000)),ease=t*t*(3-2*t);
        players.forEach((p,i)=>{base[i]=Math.max(0,Math.min(1,from[i]+(targets[i]-from[i])*ease));});applyVolume();
        if(t<1)animation=requestAnimationFrame(step);else finished?.();
      }
      animation=requestAnimationFrame(step);
    }
    async function start(){
      const ticket=++generation,next=active<0?0:1-active,player=players[next];
      cancelAnimationFrame(animation);player.pause();base[next]=0;applyVolume();
      player.src=tracks[scene].file;player.dataset.scene=String(scene);player.dataset.generation=String(ticket);
      active=next;error=null;waitingForGesture=false;
      try{
        await player.play();
        if(ticket!==generation||!enabled)return;
        fade(players.map((_,i)=>i===next?level:0),1.8,()=>{players[1-next].pause();});
      }catch(e){
        if(ticket!==generation)return;
        if(e.name==='NotAllowedError'){waitingForGesture=true;notify();return;}
        error=e.name+': '+e.message;enabled=false;players.forEach((p,i)=>{p.pause();base[i]=0;});for(const bank of cueBanks.values())for(const p of bank)p.pause();updateRain();applyVolume();notify();onError?.(error);
      }
    }
    return {
      setScene(index){
        const next=index===null?0:index+1;
        if(!Number.isInteger(next)||next<0||next>=tracks.length)throw new RangeError('Unknown music scene');
        if(scene===next)return;scene=next;for(const bank of cueBanks.values())for(const p of bank){p.pause();p.currentTime=0;}notify();updateRain();if(enabled)return start();
      },
      setEnabled(value){
        enabled=Boolean(value);waitingForGesture=false;notify();updateRain();
        if(enabled)return start();
        for(const bank of cueBanks.values())for(const p of bank){p.pause();p.currentTime=0;}
        cancelAnimationFrame(mixAnimation);mixAnimation=0;duck=1;duckUntil=0;
        ++generation;fade([0,0],.55,()=>players.forEach(p=>p.pause()));
      },
      resume(){if(enabled&&waitingForGesture)return start();},
      playCue(name){
        if(!enabled)return false;const bank=cueBanks.get(name);if(!bank)return false;
        const p=bank.find(p=>p.paused||p.ended)||bank.reduce((a,b)=>a.currentTime>b.currentTime?a:b);
        const active=[...cueBanks.values()].flat().filter(active=>!active.paused&&!active.ended&&active!==p);
        if(active.length>=8)active.sort((a,b)=>Number(a.dataset.started)-Number(b.dataset.started))[0].pause();
        p.pause();p.currentTime=0;p.dataset.level=String(name==='bubble'?.95:name==='water'?.88:name==='thunder'?.82:.68);p.dataset.started=String(performance.now());p.muted=false;
        cueEvents[name]=(cueEvents[name]||0)+1;cueHistory.push(name);if(cueHistory.length>16)cueHistory.shift();
        const played=p.play();balanceCues();played?.catch(e=>{if(e.name==='AbortError'||!enabled)return;cueError=name+': '+e.name;onError?.('音效暂未播放，请再次点击声音开关');});
        duckMusic(name==='water'?.9:name==='bubble'?.55:name==='thunder'?1.8:.65);return true;
      },
      stats(){return {enabled,scene,track:tracks[scene],error,duck,rain:{playing:!rain.paused,currentTime:rain.currentTime,volume:rain.volume,loop:rain.loop,readyState:rain.readyState,error:rainError||rain.error?.code||null},cues:{error:cueError,events:{...cueEvents},history:cueHistory.slice(),players:[...cueBanks].flatMap(([name,bank])=>bank.filter(p=>!p.paused||p.currentTime>0).map(p=>({name,playing:!p.paused,currentTime:p.currentTime,duration:Number.isFinite(p.duration)?p.duration:null,volume:p.volume,readyState:p.readyState,error:p.error?.code||null})))},players:players.map(p=>({scene:Number(p.dataset.scene??-1),playing:!p.paused,currentTime:p.currentTime,duration:Number.isFinite(p.duration)?p.duration:null,volume:p.volume,readyState:p.readyState,ended:p.ended,loop:p.loop,error:p.error?.code||null}))};}
    };
  }
  return {create};
})();
