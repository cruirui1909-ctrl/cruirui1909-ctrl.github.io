/* Seasonal Web Audio ambience; water, bubbles, rain and thunder use local CC0 recordings. */
window.CloudSound = (() => {
  'use strict';
  const presets=[
    {name:'光厅 · 回廊浅水',layers:[['water',.11],['breeze',.09]],drops:3.8},
    {name:'白羊 · 春风、海潮与春鸟',layers:[['breeze',.19],['grass',.09],['surf',.12]],bird:'spring',insects:.35},
    {name:'金牛 · 细雨、浅洼与湿叶',layers:[['water',.09],['breeze',.08]],bird:'distant',drops:.9,insects:.15},
    {name:'双子 · 双向春风与鸟语',layers:[['breeze',.17],['grass',.13]],bird:'spring',insects:.40},
    {name:'巨蟹 · 月夜海潮',layers:[['surf',.26],['breeze',.13]],bird:'gull',insects:.18},
    {name:'狮子 · 夏风、细沙与蝉鸣',layers:[['breeze',.21],['sand',.10],['cicada',.035]],insects:.75},
    {name:'处女 · 秋初麦浪与草虫',layers:[['breeze',.16],['grass',.17]],bird:'field',insects:.85},
    {name:'天秤 · 秋叶、湖水与远鸟',layers:[['breeze',.14],['leaves',.12],['water',.10]],bird:'distant',insects:.30,leaves:true},
    {name:'天蝎 · 雨幕、阵风与触碰雷光',layers:[['breeze',.22],['water',.11]],drops:.55},
    {name:'射手 · 雨后长风与远鸟',layers:[['breeze',.24],['grass',.13]],bird:'field',drops:2.5,insects:.25},
    {name:'摩羯 · 冬风、飘雪与冷海',layers:[['breeze',.27],['snow',.075],['surf',.14]]},
    {name:'水瓶 · 逆向水滴与空中水流',layers:[['water',.17],['breeze',.10]],drops:1.2,reverse:true},
    {name:'双鱼 · 夜虫、微风与双湾水声',layers:[['water',.16],['surf',.11],['breeze',.09]],insects:.65,drops:3.0}
  ];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const interactionGaps={bubble:0,ripple:.30,halo:.65,brush:.24,pulse:.18,travel:.30,uiHover:.12,uiClick:.07};
  function create(context,output,onCue,onForeground){
    const rate=context.sampleRate,master=context.createGain(),compressor=context.createDynamicsCompressor(),analyser=context.createAnalyser();
    compressor.threshold.value=-15;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.004;compressor.release.value=.18;
    analyser.fftSize=1024;master.gain.value=0;master.connect(compressor);compressor.connect(analyser);analyser.connect(output);
    const white=context.createBuffer(2,rate*6,rate),pink=context.createBuffer(2,rate*6,rate);
    let seed=73219;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let channel=0;channel<2;channel++){
      const w=white.getChannelData(channel),p=pink.getChannelData(channel);let a=0,b=0,c=0;
      for(let i=0;i<w.length;i++){const n=random()*2-1;w[i]=n;a=.997*a+n*.029;b=.985*b+n*.067;c=.89*c+n*.16;p[i]=(a+b+c+n*.06)*.48;}
      for(const data of [w,p])for(let i=0;i<512;i++){const blend=i/512;data[i]=data[i]*blend+data[data.length-512+i]*(1-blend);}
    }
    const impulse=context.createBuffer(2,Math.floor(rate*1.35),rate),reverb=context.createConvolver(),send=context.createGain(),wet=context.createGain();
    for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=(random()*2-1)*Math.exp(-i/rate*6.6)*.10;for(const t of [.019,.043,.073])data[Math.floor(t*rate)]+=.24;}
    reverb.buffer=impulse;send.gain.value=.14;wet.gain.value=.16;send.connect(reverb);reverb.connect(wet);wet.connect(master);
    const interactionBoost=context.createGain();interactionBoost.gain.value=1.72;
    const interactionMeter=context.createAnalyser();interactionMeter.fftSize=1024;interactionBoost.connect(interactionMeter);interactionMeter.connect(master);
    const groups=new Set(),events={},lastEvents={},levels=new Float32Array(analyser.fftSize),interactionLevels=new Float32Array(interactionMeter.fftSize);
    let enabled=false,index=0,current=null,mechanism=null,previousAngle=0,nextRoll=0,nextBird=0,nextInsect=0,nextDrop=0,nextLeaf=0;
    let gestures=null,motionAir=null,inputInside=false,inputX=0,inputY=0,lastInput=-100,inputSpeed=0,inputSurface='air',cameraMoving=false,cameraMotion=0;
    function register(group,source,nodes,end=Infinity){
      const item={source,end};group.sources.add(item);
      source.onended=()=>{group.sources.delete(item);for(const node of nodes)node.disconnect();};return source;
    }
    function retire(group,seconds){
      if(!group||group.retired)return;group.retired=true;const now=context.currentTime;
      group.bus.gain.cancelScheduledValues(now);group.bus.gain.setValueAtTime(group.bus.gain.value,now);group.bus.gain.linearRampToValueAtTime(0,now+seconds);
      for(const item of group.sources)item.source.stop(Math.min(item.end,now+seconds+.03));
      setTimeout(()=>{group.bus.disconnect();groups.delete(group);},(seconds+.15)*1000);
    }
    function group(){const bus=context.createGain();bus.connect(master);const g={bus,sources:new Set(),retired:false};groups.add(g);return g;}
    function noiseLayer(g,kind,level){
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),high=context.createBiquadFilter(),gain=context.createGain(),lfo=context.createOscillator(),depth=context.createGain();
      const settings={breeze:[pink,480,.48,.11],grass:[white,1900,.65,.28],water:[pink,640,.55,.72],surf:[pink,620,.55,.13],rain:[white,4400,.45,.17],leaves:[white,2700,.85,.45],sand:[white,1700,.55,.20],snow:[white,2500,.48,.16],cicada:[white,5700,2.1,37]};
      const [buffer,frequency,q,speed]=settings[kind];source.buffer=buffer;source.loop=true;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;
      high.type='highpass';high.frequency.value=kind==='rain'?950:kind==='breeze'?45:85;
      gain.gain.value=level*.68;depth.gain.value=level*.30;lfo.frequency.value=speed*(.85+random()*.3);
      source.connect(high);high.connect(filter);filter.connect(gain);gain.connect(g.bus);lfo.connect(depth);depth.connect(gain.gain);
      const now=context.currentTime;register(g,source,[source,high,filter,gain]);register(g,lfo,[lfo,depth]);source.start(now,random()*5);lfo.start(now);return gain;
    }
    function voice(source,filter,level,when,duration,pan,g=current,attack=.004,soft=false){
      if(!g||g.retired)return;
      const gain=context.createGain(),stereo=context.createStereoPanner(),now=Math.max(context.currentTime,when);
      gain.gain.setValueAtTime(.00001,now);gain.gain.linearRampToValueAtTime(Math.max(.00002,level),now+attack);
      if(soft){gain.gain.linearRampToValueAtTime(level*.42,now+duration*.48);gain.gain.linearRampToValueAtTime(.00001,now+duration);}
      else gain.gain.exponentialRampToValueAtTime(.00001,now+duration);
      stereo.pan.value=clamp(pan,-.85,.85);source.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(g.bus);stereo.connect(send);
      register(g,source,[source,filter,gain,stereo],now+duration+.025);source.start(now);source.stop(now+duration+.025);
    }
    function noise(frequency,q,level,when,duration,pan,g=current,attack,soft=false){
      const source=context.createBufferSource(),filter=context.createBiquadFilter();source.buffer=soft?pink:white;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;
      voice(source,filter,level,when,duration,pan,g,attack,soft);
    }
    function tone(from,to,level,when,duration,pan,g=current,type='sine'){
      const source=context.createOscillator(),filter=context.createBiquadFilter();source.type=type;source.frequency.setValueAtTime(from,when);source.frequency.exponentialRampToValueAtTime(Math.max(30,to),when+duration);
      filter.type='lowpass';filter.frequency.value=8000;voice(source,filter,level,when,duration,pan,g);
    }
    function waterRipple(when,level,pan,g){
      noise(420,.58,.22*level,when,.88,pan,g,.065,true);
      noise(740,.65,.15*level,when+.12,.92,pan*.84,g,.085,true);
      noise(510,.75,.09*level,when+.32,.86,pan*.65,g,.09,true);
      tone(270,245,.016*level,when+.045,.40,pan,g);
    }
    function bird(kind,when,day){
      const pan=(random()-.5)*1.5,base=kind==='gull'?710:kind==='field'?2050:2450,amount=kind==='distant'?.018:.034,gain=amount*(.45+day*.55);
      for(let i=0;i<(kind==='gull'?2:3+Math.floor(random()*3));i++){
        const at=when+i*(kind==='gull'?.40:.13+random()*.055),f=base*(.85+random()*.45),length=kind==='gull'?.38:.075+random()*.06;
        tone(f,f*(i%2?.72:1.40),gain,at,length,pan,current,kind==='gull'?'triangle':'sine');
        tone(f*2,f*(i%2?1.44:2.8),gain*.12,at,length*.8,pan);noise(4200,.7,gain*.17,at,length*.65,pan);
      }
      events.bird=(events.bird||0)+1;
    }
    function insect(when,amount){
      const pan=(random()-.5)*1.7,f=3850+random()*1300;
      for(let i=0;i<5;i++)tone(f,f*.985,.010*amount,when+i*.056,.032,pan);
      events.insect=(events.insect||0)+1;
    }
    function droplet(when,reverse=false){
      const pan=(random()-.5)*1.4,f=680+random()*650;
      tone(reverse?f*.62:f,reverse?f*1.65:f*.61,.025,when,.15,pan);noise(1300,.5,.035,when,.09,pan);
      events.drop=(events.drop||0)+1;
    }
    function event(name,when=context.currentTime,{pan=0,strength=1,depth=0,radius=.26,surface='air'}={}){
      if(!enabled)return;
      const key=name==='ripple'||name==='pulse'&&surface==='water'?'water':name,gap=key==='water'?.55:key==='thunder'?2.8:interactionGaps[name],g=name in interactionGaps?gestures:name==='ratchet'||name==='roll'?mechanism:current;if(!g||g.retired)return;
      if(gap&&when-(lastEvents[key]??-100)<gap)return;
      lastEvents[key]=when;events[name]=(events[name]||0)+1;
      if(onCue&&(key==='bubble'||key==='water'||key==='thunder')){onCue(key);return;}
      onForeground?.(name);
      const power=clamp(strength,0,1)*clamp(1/(1+depth*.012),.4,1),note=440*2**([0,2,4,7,9][index%5]/12);
      if(name==='ratchet'){noise(2350,1.3,.23,when,.037,0,g);tone(1050,530,.027,when,.035,0,g,'triangle');}
      else if(name==='roll'){noise(720,.8,.18,when,.085,(random()-.5)*.3,g);tone(410,285,.028,when,.075,0,g);}
      else if(name==='release'){noise(1900,.9,.34,when,.15,0,g);tone(185,105,.10,when,.13,0,g);noise(840,.6,.14,when+.10,.22,0,g);}
      else if(name==='land'){tone(315,150,.14,when,.16,0,g);noise(560,.55,.19,when,.20,0,g);noise(1850,.6,.07,when+.04,.13,.1,g);}
      else if(name==='open'){noise(2500,1.0,.24,when,.055,-.12,g);noise(1600,.7,.17,when+.035,.08,.12,g);noise(980,.6,.10,when+.06,.55,0,g,.10);}
      else if(name==='thunder'){noise(120,.38,.78,when,.95,-.25,g,.055);noise(220,.40,.51,when+.22,2.4,.20,g,.16);noise(510,.50,.12,when+.10,.65,0,g,.025);}
      else if(name==='bubble'){
        const f=980*.26/radius,level=power*(.35+.65/(1+depth*.13));
        noise(3200,.6,.31*level,when,.050,pan,g);noise(6200,.75,.085*level,when+.006,.092,pan,g);
        tone(f,f*.34,.125*level,when,.15,pan,g);tone(f*1.75,f*.82,.052*level,when+.025,.18,pan*.8,g);
        tone(f*2.9,f*1.08,.026*level,when+.045,.22,pan*.65,g);noise(760,.48,.065*level,when+.08,.25,pan,g,.016);
      }else if(name==='ripple'){
        waterRipple(when,power*(.92+random()*.16),pan,g);
      }else if(name==='halo'){
        noise(2800,.6,.033*power,when,.55,pan,g,.08);tone(note*2,note*2.016,.031*power,when,.72,pan,g);
        tone(note*4,note*4.012,.011*power,when+.055,.62,pan*.6,g);
      }else if(name==='brush'){
        const f=note*[2.5,3,4][Math.floor(random()*3)];
        tone(f,f,.036*power,when,.23,pan,g);
        tone(f*2.73,f*2.73,.007*power,when+.008,.14,pan*.82,g);
        noise(5200,.75,.014*power,when,.045,pan,g);
      }else if(name==='pulse'){
        if(surface==='water')waterRipple(when,power*1.18,pan,g);
        else{noise(2400,.65,.12*power,when,.50,pan,g,.022);tone(note*2,note*1.98,.095*power,when,.68,pan,g);tone(note*3,note*3.015,.023*power,when+.07,.88,pan*.7,g);}
      }else if(name==='travel')noise(730,.48,.085*power,when,.45,pan,g,.055);
      else if(name==='uiHover')tone(1320,1450,.024,when,.085,pan,g);
      else if(name==='uiClick'){tone(880,660,.045,when,.13,pan,g);noise(2300,.9,.035,when,.055,pan,g);}
    }
    function leave(){
      inputInside=false;inputSpeed=0;lastInput=-100;cameraMotion=0;cameraMoving=false;
      motionAir?.gain.setTargetAtTime(0,context.currentTime,.065);
    }
    function pointer({x,y,surface='air',ripple=false,depth=0,lightning=false}){
      if(!enabled||!gestures)return;
      const now=context.currentTime,entering=!inputInside,distance=entering?.02:Math.hypot(x-inputX,y-inputY);
      if(surface==='lightning'){
        inputInside=true;inputSurface=surface;inputSpeed=0;inputX=x;inputY=y;
        if(lightning)event('thunder',now,{pan:x,depth});return;
      }
      if(entering&&surface!=='water')event('halo',now,{pan:x,strength:.8});
      inputInside=true;inputSurface=surface;
      if(surface==='water'&&(ripple||distance>.0005))event('ripple',now,{pan:x,depth});
      if(distance>.0005){
        inputSpeed=clamp(distance/clamp(now-lastInput,.012,.10)/2,.04,1);lastInput=now;
        if(surface!=='water')event('brush',now,{pan:x,surface,strength:.3+inputSpeed*.7,depth});
      }
      inputX=x;inputY=y;
    }
    function startScene(){
      leave();retire(gestures,.14);
      const now=context.currentTime;retire(current,1.65);current=group();current.bus.gain.setValueAtTime(0,now);current.bus.gain.linearRampToValueAtTime(1,now+1.65);
      for(const [kind,level] of presets[index].layers)noiseLayer(current,kind,level);
      gestures=group();gestures.bus.disconnect();gestures.bus.connect(interactionBoost);
      motionAir=noiseLayer(gestures,'breeze',0);
      for(const name in lastEvents)delete lastEvents[name];
      nextBird=now+1+random()*1.4;nextInsect=now+1.7+random();nextDrop=now+.7+random();nextLeaf=now+1.1+random();
    }
    return {
      setEnabled(value){
        const next=Boolean(value);if(next===enabled)return;enabled=next;const now=context.currentTime;
        master.gain.cancelScheduledValues(now);master.gain.setTargetAtTime(enabled?1:0,now,.055);
        if(enabled){startScene();mechanism=group();mechanism.bus.gain.value=0;noiseLayer(mechanism,'grass',.24);}
        else{leave();retire(current,.18);retire(mechanism,.18);retire(gestures,.18);current=null;mechanism=null;gestures=null;motionAir=null;previousAngle=0;}
      },
      setScene(scene){const next=scene===null?0:scene+1;if(!Number.isInteger(next)||next<0||next>=presets.length)throw new RangeError('Unknown sound scene');if(next===index)return;index=next;previousAngle=0;if(enabled)startScene();},
      event,pointer,leave,
      update({angle=0,hopperSpeed=0,daylight=0,cameraSpeed=0}={}){
        if(!enabled)return;const now=context.currentTime,preset=presets[index];
        const motion=inputInside?inputSpeed*Math.exp(-Math.max(0,now-lastInput-.035)*14):0;
        cameraMotion=clamp(Math.abs(cameraSpeed),0,1);
        motionAir?.gain.setTargetAtTime(.012*motion*(inputSurface==='water'?0:1)+.085*cameraMotion,now,.055);
        if(cameraMotion>.04&&!cameraMoving)event('travel',now,{strength:.5+cameraMotion*.5});
        cameraMoving=cameraMotion>.04;
        if(cameraMoving)onForeground?.('travel');
        if(mechanism)mechanism.bus.gain.setTargetAtTime(index===0?clamp(Math.abs(hopperSpeed)/1.4,0,1):0,now,.065);
        if(index===0){
          if(angle>=previousAngle){for(let i=Math.floor(previousAngle/9)+1;i<=Math.floor(angle/9);i++)event('ratchet',now+(i-Math.floor(previousAngle/9)-1)*.008);}
          previousAngle=angle;
          if(Math.abs(hopperSpeed)>.14&&now>nextRoll){event('roll');nextRoll=now+.16+random()*.15;}
        }
        if(preset.bird&&now>=nextBird){bird(preset.bird,now,.20+daylight*.80);nextBird=now+3.0+random()*5.2;}
        if(preset.insects&&now>=nextInsect){insect(now,preset.insects*(1-daylight*.65));nextInsect=now+1.8+random()*2.2;}
        if(preset.drops&&now>=nextDrop){droplet(now,preset.reverse);nextDrop=now+preset.drops*(.6+random()*.8);}
        if(preset.leaves&&now>=nextLeaf){noise(2200,.65,.11,now,.55,(random()-.5)*1.5,current,.11);nextLeaf=now+2.8+random()*3.5;events.leaf=(events.leaf||0)+1;}
      },
      stats(){
        analyser.getFloatTimeDomainData(levels);let sum=0,peak=0;for(const value of levels){sum+=value*value;peak=Math.max(peak,Math.abs(value));}
        interactionMeter.getFloatTimeDomainData(interactionLevels);let interactionSum=0,interactionPeak=0;for(const value of interactionLevels){interactionSum+=value*value;interactionPeak=Math.max(interactionPeak,Math.abs(value));}
        return {enabled,scene:index,name:presets[index].name,layers:presets[index].layers.map(([name])=>name),context:context.state,groups:groups.size,sources:[...groups].reduce((n,g)=>n+g.sources.size,0),mechanism:mechanism?.bus.gain.value||0,events:{...events},rms:Math.sqrt(sum/levels.length),peak,interactionRms:Math.sqrt(interactionSum/interactionLevels.length),interactionPeak,pointer:{inside:inputInside,surface:inputSurface,movement:motionAir?.gain.value||0,camera:cameraMotion}};
      }
    };
  }
  return {create,presets};
})();
