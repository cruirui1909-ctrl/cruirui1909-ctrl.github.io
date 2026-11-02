/* Real geometry, reflected water, and a fixed machine with a geared rotating hopper. */
window.CloudHall = (() => {
  'use strict';
  const T = THREE, PI = Math.PI;
  const uniforms = { time: { value: 0 }, pointer: { value: new T.Vector3(0, 0, 100) }, glow: { value: 0 } };
  const color = hex => new T.Color(hex);
  const v3 = (x,y,z) => new T.Vector3(x,y,z);
  const sunlight=v3(-1,-.38,.23);
  const ray = new T.Raycaster();

  function roundedGeometry(w,h,d,r=.12,opening=null) {
    r=Math.min(r,w/2-.001,h/2-.001);
    const bevel=Math.min(.025,Math.min(w,h,d)*.22);
    const s = new T.Shape(), x=-w/2, y=-h/2;
    s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
    if(opening){
      const [cx,cy,ow,oh,cr]=opening,ox=cx-ow/2,oy=cy-oh/2,p=new T.Path();
      p.moveTo(ox+cr,oy);p.lineTo(ox+ow-cr,oy);p.quadraticCurveTo(ox+ow,oy,ox+ow,oy+cr);p.lineTo(ox+ow,oy+oh-cr);p.quadraticCurveTo(ox+ow,oy+oh,ox+ow-cr,oy+oh);p.lineTo(ox+cr,oy+oh);p.quadraticCurveTo(ox,oy+oh,ox,oy+oh-cr);p.lineTo(ox,oy+cr);p.quadraticCurveTo(ox,oy,ox+cr,oy);s.holes.push(p);
    }
    const g=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:10});
    g.translate(0,0,-d/2); return g;
  }
  function mesh(g,m,parent,x=0,y=0,z=0) {
    const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;
  }
  function canvasTexture(w,h,draw) {
    const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
  }
  function cloudPath(ctx,x,y,s) {
    ctx.beginPath();ctx.moveTo(x-s*.55,y+s*.17);ctx.bezierCurveTo(x-s,y+s*.16,x-s,y-s*.35,x-s*.48,y-s*.30);
    ctx.bezierCurveTo(x-s*.5,y-s*.8,x+s*.24,y-s*.87,x+s*.35,y-s*.32);ctx.bezierCurveTo(x+s*.9,y-s*.40,x+s,y+s*.2,x+s*.45,y+s*.2);ctx.closePath();ctx.stroke();
  }
  function makeLabel() {
    return canvasTexture(1536,490,(c,w,h)=>{
      const paper=c.createLinearGradient(0,0,w,h);paper.addColorStop(0,'#fff5df');paper.addColorStop(.5,'#f9ebcc');paper.addColorStop(1,'#fff4da');c.fillStyle=paper;c.fillRect(0,0,w,h);c.strokeStyle='#80613f';c.lineWidth=3;
      c.strokeRect(23,20,w-46,h-40);c.lineWidth=1.5;c.strokeRect(34,31,w-68,h-62);
      c.textAlign='center';c.textBaseline='middle';c.fillStyle='#263747';
      c.font='600 105px "SimSun","Songti SC",serif';c.fillText('云 彩 没 有 尾 巴',w/2,174);
      c.font='32px Georgia,serif';c.fillText('C L O U D   C A P S U L E S',w/2,310);
      c.strokeStyle='#a17a49';c.lineWidth=2.5;cloudPath(c,135,385,60);cloudPath(c,w-135,385,60);
      c.beginPath();c.moveTo(235,381);c.lineTo(w/2-38,381);c.moveTo(w/2+38,381);c.lineTo(w-235,381);c.stroke();
      cloudPath(c,w/2,389,22);
    });
  }
  function envMap(renderer) {
    const s=new T.Scene();s.background=color('#173747');
    const strip=canvasTexture(128,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#050709');g.addColorStop(.18,'#9fbbc5');g.addColorStop(.42,'#ffffff');g.addColorStop(.64,'#f5e5cf');g.addColorStop(1,'#050709');c.fillStyle=g;c.fillRect(0,0,w,h);});
    const panelGeometry=new T.PlaneGeometry(1,1);
    for(let i=0;i<7;i++){
      const warm=i<3,m=new T.MeshBasicMaterial({map:strip,color:new T.Color().setRGB(warm?4.2:1.8,warm?2.5:2.1,warm?1.7:2.6),side:T.DoubleSide});
      const p=new T.Mesh(panelGeometry,m),a=i*PI*.31;p.position.set(Math.cos(a)*8,3.5+Math.sin(a*1.6)*2,Math.sin(a)*8);p.scale.set(i===0?4.5:1.25,9,1);p.lookAt(0,1.5,0);s.add(p);
    }
    const pm=new T.PMREMGenerator(renderer);const map=pm.fromScene(s,.05).texture;pm.dispose();
    s.traverse(o=>{if(o.isMesh)o.material.dispose();});panelGeometry.dispose();strip.dispose();return map;
  }
  function windowTexture(){
    return canvasTexture(256,512,(c,w,h)=>{
      const gradient=c.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#976d9d');gradient.addColorStop(.30,'#ec947b');gradient.addColorStop(.67,'#ffbd70');gradient.addColorStop(1,'#ffe5aa');c.fillStyle=gradient;c.fillRect(0,0,w,h);
      const sunset=c.createRadialGradient(w*.45,h*.72,0,w*.45,h*.72,h*.26);sunset.addColorStop(0,'rgba(255,247,207,.9)');sunset.addColorStop(.14,'rgba(255,232,167,.72)');sunset.addColorStop(.44,'rgba(255,190,116,.28)');sunset.addColorStop(1,'rgba(255,155,103,0)');c.fillStyle=sunset;c.fillRect(0,0,w,h);
      for(let i=0;i<95;i++){const x=Math.sin(i*71.3)*w,y=(Math.sin(i*39.7)*.5+.5)*h,r=20+(i%9)*8;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%2?'rgba(255,233,207,.23)':'rgba(233,158,185,.18)');g.addColorStop(1,'rgba(255,208,181,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
    });
  }
  function stoneMaterial(base) {
    const m=new T.MeshStandardMaterial({color:base,roughness:.26,metalness:.18,envMapIntensity:.62});
    m.onBeforeCompile=s=>{
      s.uniforms.uHallTime=uniforms.time;s.uniforms.uHallPointer=uniforms.pointer;s.uniforms.uHallGlow=uniforms.glow;s.uniforms.uHallSun={value:sunlight};
      s.vertexShader='varying vec3 vHallWorld,vHallNormal;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvHallWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vHallNormal=normalize(mat3(modelMatrix)*normal);');
      s.fragmentShader='varying vec3 vHallWorld,vHallNormal;uniform float uHallTime;uniform vec3 uHallPointer;uniform vec3 uHallSun;uniform float uHallGlow;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec3 p=vHallWorld; float t=uHallTime*.25;
        float grain=sin(p.x*9.2+sin(p.y*6.4+p.z*.73))*sin(p.z*8.3+p.y*2.9);
        float marble=sin(p.x*2.1+p.y*1.6+sin(p.z*.7+p.y*2.3)*2.7+grain*.3);
        diffuseColor.rgb*=.92+.06*grain+.035*smoothstep(.76,.97,abs(marble));
        vec2 waterPoint=p.xz-uHallSun.xz*p.y/abs(uHallSun.y);
        vec2 flow=waterPoint*.94+vec2(sin(p.z*.64+t*.7),cos(p.x*.58-t*.6))*.42;
        float ca=sin(flow.x+sin(flow.y*1.13+t*.8)*.92+t*.35)*sin(flow.y+sin(flow.x*.91-t*.65)*.84-t*.23);
        vec3 fringe=pow(max(vec3(0.),1.-abs(vec3(ca)+vec3(.075,0.,-.075))),vec3(22.));
        vec3 hue=.63+.37*cos(vec3(0.0,2.1,4.2)+p.y*.31+p.z*.19+t*.5);
        float lightPatch=.28+.72*pow(.5+.5*sin(p.z*.29+p.y*.34),2.0);
        float causticPool=pow(max(0.,sin(flow.x*1.7+t*.7)*cos(flow.y*1.5-t*.6)),4.0);
        float mouse=exp(-length(p.xz-uHallPointer.xz)*.19)*uHallGlow;
        totalEmissiveRadiance+=(fringe*hue*.68+hue*causticPool*.38)*lightPatch+vec3(.09,.20,.18)*mouse;
        float rayDistance=(p.x-11.57)/uHallSun.x;vec3 atWindow=p-uHallSun*rayDistance;
        float paneZ=mod(atWindow.z-18.+5.,10.)-5.;float windowMask=(1.-smoothstep(2.38,2.70,abs(paneZ)))*smoothstep(7.35,7.75,atWindow.y)*(1.-smoothstep(13.35,13.75,atWindow.y));
        float bars=smoothstep(.025,.085,abs(mod(paneZ+2.5,.825)-.4125));
        float sunFacing=max(0.,dot(normalize(vHallNormal),-normalize(uHallSun)));
        totalEmissiveRadiance+=vec3(.26,.105,.027)*windowMask*bars*sunFacing;
      `);
    };
    m.customProgramCacheKey=()=> 'sunset-window-caustics-v4';return m;
  }
  function archGeometry(r,band,depth) {
    const s=new T.Shape();s.absarc(0,0,r+band,0,PI,false);s.lineTo(-r,0);s.absarc(0,0,r,PI,0,true);s.closePath();
    return new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,bevelSize:.03,bevelThickness:.03,curveSegments:38});
  }
  function buildArchitecture(scene,stone,gold) {
    const root=new T.Group(),windows=[],keys=[];root.name='clean-arcade';scene.add(root);
    const whiteKeyGeo=roundedGeometry(.91,7.9,.94,.07),blackKeyGeo=roundedGeometry(.73,7.9,.80,.06),footGeo=new T.CylinderGeometry(.72,.8,.3,20),ringGeo=new T.CylinderGeometry(.53,.53,.10,20);
    const capGeo=new T.BoxGeometry(1.3,.4,1.25),arcGeo=archGeometry(6.65,.42,.58);
    const plinth=new T.BoxGeometry(1.4,.62,1.4);
    for(let i=0;i<11;i++){
      const z=23-i*10;
      for(const sign of [-1,1]){
        const x=sign*6.65,midi=48+i*2+(sign>0?1:0),black=[1,3,6,8,10].includes(midi%12);
        const name=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][midi%12]+(Math.floor(midi/12)-1);
        const group=new T.Group();group.name='piano-column-'+midi;group.position.set(x,0,z);root.add(group);
        const material=new T.MeshPhysicalMaterial({color:black?'#18242d':'#fff5df',roughness:black?.19:.24,metalness:.12,clearcoat:1,clearcoatRoughness:.10,emissive:'#ffbd70',emissiveIntensity:0});
        mesh(plinth,stone,group,0,.13);mesh(footGeo,stone,group,0,.57);mesh(black?blackKeyGeo:whiteKeyGeo,material,group,0,4.55);
        mesh(capGeo,stone,group,0,8.5);
        for(const y of [.87,1.05,8.20,8.70])mesh(ringGeo,gold,group,0,y);
        const label=canvasTexture(192,96,(c,w,h)=>{c.fillStyle=black?'#f6dbab':'#8b704d';c.textAlign='center';c.textBaseline='middle';c.font='40px Georgia,serif';c.fillText(name,w/2,h/2);});
        mesh(new T.PlaneGeometry(.56,.28),new T.MeshBasicMaterial({map:label,transparent:true}),group,0,1.40,black?.415:.485);
        const key={midi,name,black,group,material,glow:0};group.userData.pianoKey=key;keys.push(key);
      }
      mesh(arcGeo,stone,root,0,8.7,z-.29);
      // Thin intact architectural gold beading follows the same vault.
      const trim=new T.Mesh(new T.TorusGeometry(6.84,.025,6,64,PI),gold);trim.position.set(0,8.7,z+.34);root.add(trim);
    }
    const sideGeo=archGeometry(4.65,.34,.50);
    for(const sign of [-1,1])for(let i=0;i<10;i++){
      const z=18-i*10;
      const a=mesh(sideGeo,stone,root,sign*6.72,7.1,z);a.rotation.y=PI/2;
      for(const dz of [-4.65,4.65]){
        const pillar=mesh(new T.BoxGeometry(.6,7.1,.65),stone,root,sign*11.5,3.55,z+dz);
        mesh(new T.BoxGeometry(.72,.12,.78),gold,root,pillar.position.x,7.0,pillar.position.z);
      }
      const end=mesh(sideGeo,stone,root,sign*11.5,7.1,z);end.rotation.y=PI/2;
    }
    const pos=[],uv=[],inds=[];
    for(let j=0;j<=10;j++)for(let i=0;i<=40;i++){
      const theta=i/40*PI;pos.push(Math.cos(theta)*7.05,8.7+Math.sin(theta)*7.05,28-j*11);uv.push(i/40,j/10);
    }
    for(let j=0;j<10;j++)for(let i=0;i<40;i++){let a=j*41+i;inds.push(a,a+1,a+41,a+1,a+42,a+41);}
    const vault=new T.BufferGeometry();vault.setAttribute('position',new T.Float32BufferAttribute(pos,3));vault.setAttribute('uv',new T.Float32BufferAttribute(uv,2));vault.setIndex(inds);vault.computeVertexNormals();
    const vaultMat=stone.clone();vaultMat.side=T.DoubleSide;vaultMat.onBeforeCompile=stone.onBeforeCompile;mesh(vault,vaultMat,root);
    const back=mesh(new T.BoxGeometry(40,26,.5),stone,root,0,11,-82);
    const opening=new T.Mesh(new T.PlaneGeometry(5,10),new T.MeshBasicMaterial({color:'#ffe8c0'}));opening.position.set(0,5,-81.68);root.add(opening);
    // Tall translucent window panels and pristine stairs at the right aisle.
    const glass=new T.MeshBasicMaterial({map:windowTexture(),color:new T.Color().setRGB(2.05,1.26,.81),side:T.DoubleSide});
    for(let i=0;i<9;i++){
      const z=18-i*10;
      const window=mesh(new T.PlaneGeometry(5.4,6),glass,root,11.6,10.6,z);window.rotation.y=-PI/2;window.name='sunlit-window-'+i;windows.push(window);
      for(let k=0;k<4;k++)mesh(new T.BoxGeometry(.09,6.3,.06),gold,root,11.57,10.6,z-2.5+k*1.65);
      for(const sign of [-1,1]){
        mesh(new T.BoxGeometry(.6,7.0,10),stone,root,sign*12.0,3.5,z);
        mesh(new T.BoxGeometry(.65,5.3,2.5),stone,root,sign*12.0,9.65,z-4.0);
        mesh(new T.BoxGeometry(.65,2.4,10),stone,root,sign*12.0,14.2,z);
        mesh(new T.BoxGeometry(.64,.12,10),gold,root,sign*11.65,7.10,z);
      }
    }
    for(let i=0;i<19;i++)mesh(new T.BoxGeometry(4.6,.24*(i+1),.52),stone,root,9.0,.12*(i+1),-18-i*.52);
    return {root,windows,keys};
  }
  function makeBeam(scene,window,pane,opacity) {
    const source=window.position.clone().add(v3(-.06,-.60,pane*1.65)),width=1.30,height=2.20;
    // A parallel bundle starts inside one window pane and ends at the water plane.
    const corners=[v3(0,-height/2,-width/2),v3(0,-height/2,width/2),v3(0,height/2,width/2),v3(0,height/2,-width/2)];
    const ends=corners.map(p=>p.clone().addScaledVector(sunlight,Math.min((source.y+p.y-.08)/-sunlight.y,(source.x+11.55)/-sunlight.x)));
    const positions=[],uv=[],indices=[];
    for(let i=0;i<4;i++){
      const j=(i+1)%4,start=positions.length/3;
      for(const p of [corners[i],corners[j],ends[j],ends[i]])positions.push(...p.toArray());
      uv.push(0,1,1,1,1,0,0,0);indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const shade=pane===0?'#ffb857':pane<0?'#ffa26b':'#ffcd7b';
    const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,blending:T.AdditiveBlending,uniforms:{uTime:uniforms.time,uGlow:uniforms.glow,uTint:{value:color(shade)},uAlpha:{value:opacity}},vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vE;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vE=-mv.xyz;gl_Position=projectionMatrix*mv;}',fragmentShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vE;uniform float uTime;uniform float uGlow;uniform vec3 uTint;uniform float uAlpha;
      void main(){float facing=pow(abs(dot(normalize(vN),normalize(vE))),1.5);float edge=pow(max(0.,sin(vUv.x*3.14159265)),.8);float shafts=.94+.06*sin(vUv.x*42.+sin(vUv.y*13.+uTime*.18));float dust=.96+.04*sin(vUv.y*51.-uTime*.25);float fade=smoothstep(0.,.16,vUv.y)*(1.-smoothstep(.97,1.,vUv.y));float alpha=facing*edge*shafts*dust*fade*uAlpha*(1.+uGlow*.12);
        vec3 edgeTint=mix(vec3(1.,.25,.30),vec3(1.,.61,.18),vUv.x);float dispersion=pow(abs(vUv.x-.5)*2.,2.8)*.34;
        gl_FragColor=vec4(mix(uTint,edgeTint,dispersion)*1.55,alpha);}`});
    const beam=new T.Mesh(geo,mat);beam.name='daylight-from-'+window.name+'-pane-'+pane;beam.position.copy(source);beam.renderOrder=4;scene.add(beam);
    return {beam,window:window.name,source:source.toArray(),direction:sunlight.clone().normalize().toArray(),windowCenter:window.position.toArray(),windowSize:[5.4,6]};
  }
  function buildMachine(scene,env) {
    const root=new T.Group();root.name='machine-body';root.userData.initialRotation=0;scene.add(root);
    const ivory=new T.MeshPhysicalMaterial({color:'#fff5e5',metalness:.08,roughness:.22,clearcoat:1,clearcoatRoughness:.09,envMap:env,envMapIntensity:1.05});
    const pink=new T.MeshPhysicalMaterial({color:'#e6a1bd',metalness:.11,roughness:.24,clearcoat:1,clearcoatRoughness:.08,envMap:env,envMapIntensity:1.1});
    const chrome=new T.MeshStandardMaterial({color:'#f4e9d9',metalness:.86,roughness:.22,envMap:env,envMapIntensity:1.1});
    const brushed=new T.MeshStandardMaterial({color:'#ddcdb9',metalness:.85,roughness:.29,envMap:env,envMapIntensity:1.0});
    const dark=new T.MeshStandardMaterial({color:'#202733',roughness:.45,metalness:.12});
    mesh(roundedGeometry(1.78,2.17,1.26,.15,[0,-.69,.64,.50,.09]),ivory,root,0,1.25,0);
    mesh(roundedGeometry(1.90,.16,1.38,.14),pink,root,0,.19,0);
    mesh(roundedGeometry(1.91,.025,1.39,.14),chrome,root,0,.285,0);
    mesh(roundedGeometry(1.90,.12,1.40,.14),pink,root,0,2.32,0);
    mesh(roundedGeometry(1.91,.025,1.40,.14),chrome,root,0,2.39,0);
    mesh(roundedGeometry(1.66,.58,.055,.075),chrome,root,0,2.04,.695);
    const label=new T.MeshStandardMaterial({map:makeLabel(),roughness:.50,metalness:.02,envMapIntensity:.2});mesh(new T.PlaneGeometry(1.57,.49),label,root,0,2.04,.755);
    mesh(roundedGeometry(.84,.89,.035,.09),chrome,root,0,1.30,.693);
    mesh(roundedGeometry(.73,.78,.012,.07),brushed,root,0,1.30,.746);
    mesh(roundedGeometry(.33,.073,.015,.018),dark,root,0,1.58,.790);
    mesh(new T.BoxGeometry(.245,.014,.012),chrome,root,0,1.60,.811);
    const disc=mesh(new T.CylinderGeometry(.283,.283,.075,64),chrome,root,0,1.19,.823);disc.rotation.x=PI/2;
    mesh(new T.TorusGeometry(.251,.010,8,64),brushed,root,0,1.19,.865);
    mesh(new T.CircleGeometry(.228,64),ivory,root,0,1.19,.865);
    for(let i=0;i<=12;i++){
      const a=i*PI/12,tick=mesh(new T.BoxGeometry(.008,i%3===0?.038:.022,.006),chrome,root,Math.cos(a)*.308,1.19+Math.sin(a)*.308,.799);tick.rotation.z=a-PI/2;
    }
    const crank=new T.Group();crank.name='crank-only';crank.position.set(0,1.19,.919);root.add(crank);
    mesh(roundedGeometry(.58,.115,.095,.046),chrome,crank);
    for(const x of [-.205,.205])mesh(roundedGeometry(.145,.143,.13,.043),pink,crank,x,0,.017);
    const hub=mesh(new T.SphereGeometry(.082,24,16),chrome,crank,0,0,.061);hub.scale.z=.35;
    crank.rotation.z=-PI*.15;const startRotation=crank.rotation.z;
    mesh(roundedGeometry(.82,.67,.055,.13,[0,0,.64,.50,.09]),pink,root,0,.56,.703);
    mesh(roundedGeometry(.57,.43,.025,.075),dark,root,0,.56,-.47);
    for(const x of [-.303,.303])mesh(new T.BoxGeometry(.018,.43,1.10),brushed,root,x,.56,.10);
    mesh(roundedGeometry(.62,.033,.86,.07),brushed,root,0,.294,.59);
    mesh(roundedGeometry(.68,.06,.26,.05),pink,root,0,.277,.94);
    for(const x of [-.32,.32])for(const y of [.963,1.635]){
      const screw=mesh(new T.SphereGeometry(.018,12,8),chrome,root,x,y,.795);screw.scale.z=.35;
      mesh(new T.BoxGeometry(.019,.003,.003),dark,root,x,y,.802);
    }
    const hopperPoints=[new T.Vector2(.77,2.36),new T.Vector2(.88,2.53),new T.Vector2(.98,2.85),new T.Vector2(1.01,3.30),new T.Vector2(.94,3.78),new T.Vector2(.83,3.98)];
    const hopperRoot=new T.Group();hopperRoot.name='geared-hopper';root.add(hopperRoot);
    const glass=new T.MeshPhysicalMaterial({color:'#effbff',metalness:.02,roughness:.045,transparent:true,opacity:.17,side:T.FrontSide,envMap:env,envMapIntensity:1.7,clearcoat:1,clearcoatRoughness:.03,depthWrite:false});
    glass.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float glassEdge=pow(1.-max(dot(normalize(normal),normalize(vViewPosition)),0.),3.);
      totalEmissiveRadiance+=vec3(.24,.40,.42)*glassEdge;diffuseColor.a+=glassEdge*.20;`);};
    glass.customProgramCacheKey=()=> 'clear-hopper-edge';
    const hopper=mesh(new T.LatheGeometry(hopperPoints,64),glass,hopperRoot);hopper.renderOrder=5;
    const innerGlass=glass.clone();innerGlass.side=T.BackSide;innerGlass.opacity=.04;innerGlass.customProgramCacheKey=()=> 'clear-hopper-back';const innerShell=mesh(hopper.geometry,innerGlass,hopperRoot);innerShell.renderOrder=3;
    // Fine structural seams reveal the glass drum's rotation; reflected glints stay in the light.
    for(let i=0;i<3;i++){
      const a=i*PI*2/3,points=hopperPoints.map(p=>v3(Math.sin(a)*(p.x+.003),p.y,Math.cos(a)*(p.x+.003)));
      mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.005,5,false),chrome,hopperRoot);
    }
    const glintMaterial=new T.MeshBasicMaterial({color:'#fff7e6',transparent:true,opacity:.25,depthWrite:false});
    for(const a of [-.62,.83]){
      const points=hopperPoints.slice(1,-1).map(p=>v3(Math.sin(a)*p.x,p.y,Math.cos(a)*p.x+.009));
      const glint=mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.006,5,false),glintMaterial,root);glint.renderOrder=6;
    }
    const lid=mesh(new T.SphereGeometry(.86,64,24,0,PI*2,0,PI/2),pink,hopperRoot,0,4.0,0);lid.scale.y=.18;
    mesh(new T.CylinderGeometry(.86,.86,.04,48),pink,hopperRoot,0,4.0,0);
    for(const y of [2.40,3.98,4.025]){const band=mesh(new T.TorusGeometry(y>3?.86:.79,y===3.98?.014:.023,12,64),chrome,y===2.40?root:hopperRoot,0,y,0);band.rotation.x=PI/2;}
    const bolt=mesh(new T.SphereGeometry(.055,12,12),chrome,hopperRoot,0,4.17,0);bolt.scale.y=.45;
    const balls=[];const hues=['#e8a9d6','#a7e7e2','#ffc582','#bdb9ee','#e7c6f6','#f1d7a7'];
    for(let i=0;i<23;i++){
      const a=i*2.39996,rr=.28+((i*7)%10)/10*.29;
      const capsule=makeCapsule(hues[i%hues.length],env,.21);
      capsule.position.set(Math.cos(a)*rr,2.65+Math.floor(i/7)*.35,Math.sin(a)*rr);capsule.rotation.set(i*.6,i*.27,i*.82);capsule.userData.velocity=v3(0,0,0);root.add(capsule);balls.push(capsule);
    }
    const machine={root,crank,startRotation,balls,glass,env,hopper:hopperRoot,hopperPoints,hopperMotion:{crankAngle:0,target:0,speed:0}};
    for(let i=0;i<150;i++)updateHopper(machine,0,1/90);
    return machine;
  }
  function hopperRadius(machine,y){
    const points=machine.hopperPoints;
    for(let i=1;i<points.length;i++)if(y<=points[i].y){const a=points[i-1],b=points[i];return T.MathUtils.lerp(a.x,b.x,T.MathUtils.clamp((y-a.y)/(b.y-a.y),0,1))-.245;}
    return points[points.length-1].x-.245;
  }
  function updateHopper(machine,angle,dt){
    if(dt<=0)return;
    const motion=machine.hopperMotion,advance=angle-motion.crankAngle,previous=machine.hopper.rotation.y;
    // A reset starts a new crank cycle without rewinding the glass drum.
    if(advance>0)motion.target-=T.MathUtils.degToRad(advance)*.75;
    motion.crankAngle=angle;machine.hopper.rotation.y=T.MathUtils.damp(previous,motion.target,12,dt);
    motion.speed=(machine.hopper.rotation.y-previous)/dt;
    const balls=machine.balls,steps=Math.max(1,Math.ceil(dt*90)),step=dt/steps;
    const constrain=b=>{
      const p=b.position,v=b.userData.velocity;
      if(p.y<2.62){p.y=2.62;v.y=Math.max(0,-v.y*.10);}
      if(p.y>3.73){p.y=3.73;v.y=Math.min(0,v.y);}
      const radius=Math.hypot(p.x,p.z),limit=hopperRadius(machine,p.y);
      if(radius>limit){const nx=p.x/radius,nz=p.z/radius,outward=v.x*nx+v.z*nz;p.x=nx*limit;p.z=nz*limit;if(outward>0){v.x-=nx*outward*1.1;v.z-=nz*outward*1.1;}}
    };
    // ponytail: sphere contacts cover these 23 capsules; use a rigid-body solver for arbitrary shapes.
    for(let s=0;s<steps;s++){
      for(const b of balls){
        const p=b.position,v=b.userData.velocity,grip=T.MathUtils.clamp(1-(p.y-2.62)*.65,.3,1),spin=motion.speed*.82*grip,friction=1-Math.exp(-step*4);
        v.x+=(spin*p.z-v.x)*friction;v.z+=(-spin*p.x-v.z)*friction;v.y-=5.2*step;p.addScaledVector(v,step);
      }
      for(let pass=0;pass<4;pass++){
        for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
          const a=balls[i],b=balls[j],dx=b.position.x-a.position.x,dy=b.position.y-a.position.y,dz=b.position.z-a.position.z,d=Math.hypot(dx,dy,dz);
          if(d>=.45||d<1e-8)continue;
          const nx=dx/d,ny=dy/d,nz=dz/d,correction=(.45-d)*.5;
          a.position.x-=nx*correction;a.position.y-=ny*correction;a.position.z-=nz*correction;b.position.x+=nx*correction;b.position.y+=ny*correction;b.position.z+=nz*correction;
          const va=a.userData.velocity,vb=b.userData.velocity,closing=(vb.x-va.x)*nx+(vb.y-va.y)*ny+(vb.z-va.z)*nz;
          if(closing<0){const impulse=-closing*.54;va.x-=nx*impulse;va.y-=ny*impulse;va.z-=nz*impulse;vb.x+=nx*impulse;vb.y+=ny*impulse;vb.z+=nz*impulse;}
        }
        balls.forEach(constrain);
      }
      for(const b of balls){const v=b.userData.velocity;b.rotation.x+=v.z*step/.225;b.rotation.z-=v.x*step/.225;b.rotation.y+=motion.speed*step*.22;}
    }
  }
  function makeCapsule(shade,env,r=.26,glyph='') {
    const root=new T.Group();root.name='capsule';
    const topMat=new T.MeshPhysicalMaterial({color:'#f5fcff',metalness:.04,roughness:.09,transparent:true,opacity:.46,clearcoat:1,envMap:env,envMapIntensity:1.15,depthWrite:false});
    const bottomMat=new T.MeshPhysicalMaterial({color:shade,metalness:.14,roughness:.22,clearcoat:1,clearcoatRoughness:.10,envMap:env,envMapIntensity:1.15});
    const top=new T.Group(),bottom=new T.Group();root.add(top,bottom);
    mesh(new T.SphereGeometry(r,32,18,0,PI*2,0,PI/2),topMat,top);
    const lower=mesh(new T.SphereGeometry(r,32,18,0,PI*2,PI/2,PI/2),bottomMat,bottom);
    const rim=mesh(new T.TorusGeometry(r,.010,6,32),new T.MeshStandardMaterial({color:'#eee8db',metalness:.8,roughness:.2,envMap:env}),bottom);rim.rotation.x=PI/2;
    if(glyph){
      const tex=canvasTexture(128,128,(c,w,h)=>{c.fillStyle='#ffe9bb';c.textAlign='center';c.textBaseline='middle';c.font='82px Georgia,serif';c.fillText(glyph,w/2,h*.52);});
      mesh(new T.PlaneGeometry(r*.9,r*.9),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide}),bottom,0,-r*.18,r*.94);
    }
    const inner=mesh(new T.SphereGeometry(r*.47,20,12),new T.MeshBasicMaterial({color:'#fff3b5',transparent:true,opacity:.5}),root);inner.name='dream-core';
    root.userData={top,bottom,inner,radius:r};return root;
  }
  function makeWater(scene,reflection) {
    const ripples=Array.from({length:12},()=>new T.Vector4(0,0,-100,0));
    const mat=new T.ShaderMaterial({uniforms:{uTime:uniforms.time,uMouse:uniforms.pointer,uGlow:uniforms.glow,uSun:{value:sunlight},uCamera:{value:new T.Vector3()},uReflect:{value:reflection.texture},uTextureMatrix:{value:new T.Matrix4()},uRipples:{value:ripples}},vertexShader:`varying vec3 vWorld;varying vec4 vReflection;uniform float uTime;uniform mat4 uTextureMatrix;
      void main(){vec3 p=position;vec4 world=modelMatrix*vec4(p,1.);world.y+=.018*sin(world.x*1.9+uTime*.8)+.023*sin(world.z*1.4+uTime*.6);vWorld=world.xyz;vReflection=uTextureMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`,fragmentShader:`precision highp float;
      uniform float uTime;uniform vec3 uCamera;uniform vec3 uMouse,uSun;uniform float uGlow;uniform sampler2D uReflect;uniform vec4 uRipples[12];varying vec3 vWorld;varying vec4 vReflection;
      float heightAt(vec2 p){float h=sin(p.x*1.5+p.y*2.1+uTime*.8)*.031+sin(p.x*2.7-p.y*1.3+uTime*1.1)*.023+sin(p.y*5.3+p.x*3.7+sin(p.x*2.)+uTime*1.3)*.014+sin(p.x*6.1-p.y*4.8-uTime*.6)*.007;
        for(int i=0;i<12;i++){float age=uTime-uRipples[i].z;float d=length(p-uRipples[i].xy);float front=d-age*1.45;float envelope=exp(-front*front*2.6)*exp(-age*.54)*step(0.,age)*uRipples[i].w;h+=sin(front*12.)*envelope*.055;}return h;}
      void main(){vec2 p=vWorld.xz;float h=heightAt(p);float dx=heightAt(p+vec2(.06,0.))-h;float dz=heightAt(p+vec2(0.,.06))-h;vec3 normal=normalize(vec3(-dx*7.,1.,-dz*7.));vec3 eye=normalize(uCamera-vWorld);float fresnel=pow(1.-max(dot(eye,normal),0.),2.);
        vec2 uv=vReflection.xy/vReflection.w;uv+=normal.xz*(.017+.02*fresnel);vec3 reflected=texture2D(uReflect,clamp(uv,.001,.999)).rgb;
        vec3 deep=vec3(.011,.12,.16);vec3 col=mix(deep,reflected,.66+fresnel*.31);
        vec2 contact=p-vec2(-.16,.28);float contactShadow=exp(-dot(contact*vec2(.95,.76),contact*vec2(.95,.76))*2.0);col*=1.-contactShadow*.24;
        float ca=sin(p.x*2.5+p.y*1.9+sin(p.y*2.+uTime*.27))*sin(p.y*2.7-p.x*1.2+sin(p.x*1.6-uTime*.3));float lines=pow(1.-abs(ca),28.);
        vec3 spectrum=.5+.5*cos(vec3(0.,2.1,4.2)+p.x*.16+p.y*.31+uTime*.12);col+=lines*spectrum*.075;
        float glow=exp(-length(p-uMouse.xz)*.9)*uGlow;col+=vec3(.18,.30,.25)*glow;
        float spec=pow(max(dot(reflect(normalize(uSun),normal),eye),0.),44.);col+=vec3(1.,.43,.14)*spec*.92;
        float rayDistance=(vWorld.x-11.57)/uSun.x;vec3 atWindow=vWorld-uSun*rayDistance;float paneZ=mod(atWindow.z-18.+5.,10.)-5.;float sunsetPatch=(1.-smoothstep(2.35,2.8,abs(paneZ)))*smoothstep(7.4,7.9,atWindow.y)*(1.-smoothstep(13.3,13.8,atWindow.y));
        col+=vec3(.11,.038,.009)*sunsetPatch*(.48+lines*.52);
        gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>
      }`});
    // Shader preprocessor directives have to start on their own line.
    mat.fragmentShader=mat.fragmentShader.replace(';#include',';\n#include');
    const water=new T.Mesh(new T.PlaneGeometry(240,240,100,100),mat);water.rotation.x=-PI/2;water.position.y=.02;water.name='interactive-water';scene.add(water);
    return {mesh:water,material:mat,ripples,index:0};
  }
  function dust(scene,beams) {
    const n=1800,litCount=1560,positions=new Float32Array(n*3),seeds=new Float32Array(n),tints=new Float32Array(n*3),lit=new Float32Array(n);
    const palette=['#ed91ca','#f1c76c','#6cdbd1','#83b4f2','#b99bed'],shades=palette.map(color);
    const seeded=i=>{const x=Math.sin(i*127.1+43.7)*43758.5453;return x-Math.floor(x);};
    for(let i=0;i<n;i++){
      const seed=seeded(i+1);seeds[i]=seed;
      if(i<litCount){
        const beam=beams[i%beams.length],source=v3(...beam.source),direction=v3(...beam.direction);
        const f=.23+seeded(i+8)*.67,y=source.y+(seeded(i+18)-.5)*1.92;
        const distance=Math.min((y-.08)/-direction.y,(source.x+11.55)/-direction.x);
        const point=v3(source.x,y,source.z+(seeded(i+38)-.5)*1.08).addScaledVector(direction,distance*f);
        positions.set(point.toArray(),i*3);lit[i]=1;
      }else positions.set([(seeded(i+5)-.5)*20,.4+seeded(i+7)*11,seeded(i+9)*86-60],i*3);
      tints.set(shades[i%shades.length].toArray(),i*3);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('aSeed',new T.BufferAttribute(seeds,1));g.setAttribute('aTint',new T.BufferAttribute(tints,3));g.setAttribute('aLit',new T.BufferAttribute(lit,1));
    const m=new T.ShaderMaterial({uniforms:{uTime:uniforms.time,uGlow:uniforms.glow},transparent:true,depthWrite:false,blending:T.NormalBlending,vertexShader:`attribute float aSeed,aLit;attribute vec3 aTint;uniform float uTime;varying float vA;varying vec3 vTint;
      void main(){vec3 p=position;float phase=aSeed*93.;p.x+=sin(uTime*.16+phase)*.17;p.y+=sin(uTime*.21+phase*1.3)*.13;p.z+=cos(uTime*.13+phase*.8)*.11;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        float glint=pow(.5+.5*sin(uTime*(.32+aSeed*.28)+phase),2.);
        gl_PointSize=clamp((1.6+aSeed*3.8)*36./max(1.,-mv.z),1.25,9.0);
        vA=(.25+.63*aLit)*(.42+.58*glint);vTint=aTint*(.95+.18*glint);
      }`,fragmentShader:`varying float vA;varying vec3 vTint;uniform float uGlow;
      void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;
        float halo=exp(-d*d*4.8)*.15,core=exp(-d*d*18.)*.87;
        vec3 refraction=vTint*1.38+vec3(.14,.11,.09)*exp(-d*d*80.);
        gl_FragColor=vec4(refraction,(halo+core)*vA*(1.+uGlow*.12));
      }`});
    const p=new T.Points(g,m);p.name='prismatic-dust-in-window-light';p.renderOrder=5;p.userData={litCount,palette};scene.add(p);return p;
  }
  function create(renderer,onBubblePop,onPianoKey) {
    const scene=new T.Scene();scene.background=color('#2c394b');scene.fog=new T.FogExp2('#526774',.011);
    const env=envMap(renderer);scene.environment=env;
    scene.add(new T.HemisphereLight('#b7bbd9','#70625f',.76));
    const sun=new T.DirectionalLight('#ffb56b',3.6);sun.position.copy(sunlight).multiplyScalar(-20);scene.add(sun);
    const fill=new T.PointLight('#a8c3e0',17,21,2);fill.position.set(-4,5,6);scene.add(fill);
    const warm=new T.PointLight('#ffc089',26,25,2);warm.position.set(10.9,10,-2);scene.add(warm);
    const softbox=new T.DirectionalLight('#f1dbd0',.62);softbox.position.set(-2,6,10);scene.add(softbox);
    const pointerLight=new T.PointLight('#bbffe7',0,7,2);scene.add(pointerLight);
    const stone=stoneMaterial('#248496'),gold=new T.MeshStandardMaterial({color:'#d8af72',metalness:.85,roughness:.22,envMap:env,envMapIntensity:1.3});
    const {root:architecture,windows,keys}=buildArchitecture(scene,stone,gold);
    const machine=buildMachine(scene,env);
    const bubbles=CloudBubbles.create(scene,[machine.root,architecture],onBubblePop),optics=CloudOptics.create();
    const reflection=new T.WebGLRenderTarget(800,450,{type:T.HalfFloatType,depthBuffer:true});
    const water=makeWater(scene,reflection),mirrorCamera=new T.PerspectiveCamera();
    const textureMatrix=new T.Matrix4(),bias=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
    const windowBeams=[];
    windows.forEach((window,i)=>{for(const pane of [-1,0,1])windowBeams.push(makeBeam(scene,window,pane,i===2?.041:i<2?.013:.020));});
    const motes=dust(scene,windowBeams);let frame=0;
    const targetPoint=new T.Vector3(),mirrorTarget=new T.Vector3();
    const plane=new T.Plane(v3(0,1,0),-.02),hit=new T.Vector3();let hoveredKey=null,lastCamera=null;
    return {
      scene,machine,water,reflection,pointerLight,
      ripple(x,z,strength=1,time=uniforms.time.value){water.ripples[water.index].set(x,z,time,strength);water.index=(water.index+1)%water.ripples.length;},
      pointer(ndc,camera,active,time){
        bubbles.hit(ndc,camera,time);
        ray.setFromCamera(ndc,camera);
        const contact=ray.intersectObjects([machine.root,architecture],true)[0];let object=contact?.object,key=null;
        while(object){if(object.userData.pianoKey){key=object.userData.pianoKey;break;}object=object.parent;}
        if(key){if(hoveredKey!==key){key.glow=1;onPianoKey?.({midi:key.midi,name:key.name,pan:ndc.x});}hoveredKey=key;return {surface:'piano',ripple:false,depth:contact.distance};}
        hoveredKey=null;
        if(ray.ray.intersectPlane(plane,hit)&&hit.distanceTo(camera.position)<85&&(!contact||hit.distanceTo(camera.position)<contact.distance+.02)){uniforms.pointer.value.lerp(hit,.22);if(active)this.ripple(hit.x,hit.z,.7,time);return {surface:'water',ripple:active,depth:hit.distanceTo(camera.position)};}
        return {surface:'air',ripple:false,depth:0};
      },
      leave(){bubbles.leave();hoveredKey=null;},
      update(time,dt,hover,angle,camera){
        lastCamera=camera;
        uniforms.time.value=time;uniforms.glow.value=T.MathUtils.damp(uniforms.glow.value,hover?1:0,2.0,dt);
        bubbles.update(time,dt,camera);
        for(const key of keys){key.glow=T.MathUtils.damp(key.glow,hoveredKey===key?.40:0,5,dt);key.material.emissiveIntensity=key.glow*.65;}
        pointerLight.position.copy(uniforms.pointer.value);pointerLight.position.y=1.0;pointerLight.intensity=uniforms.glow.value*4;
        machine.crank.rotation.z=machine.startRotation-T.MathUtils.degToRad(angle);
        updateHopper(machine,angle,dt);
      },
      render(renderer,camera){
        water.material.uniforms.uCamera.value.copy(camera.position);
        if(frame++%2===0){
          camera.getWorldDirection(targetPoint);targetPoint.add(camera.position);mirrorTarget.copy(targetPoint);mirrorTarget.y=-mirrorTarget.y;
          mirrorCamera.copy(camera);mirrorCamera.position.copy(camera.position);mirrorCamera.position.y=-camera.position.y;mirrorCamera.up.set(0,-1,0);mirrorCamera.lookAt(mirrorTarget);mirrorCamera.updateMatrixWorld();
          textureMatrix.copy(bias).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);water.material.uniforms.uTextureMatrix.value.copy(textureMatrix);
          const old=renderer.getRenderTarget();water.mesh.visible=false;renderer.setRenderTarget(reflection);renderer.render(scene,mirrorCamera);renderer.setRenderTarget(old);water.mesh.visible=true;
        }
        optics.render(renderer,scene,camera);
      },
      resize(w,h){reflection.setSize(Math.min(900,w),Math.min(600,Math.round(900*h/w)));const ratio=renderer.getPixelRatio();optics.resize(Math.round(w*ratio),Math.round(h*ratio));},
      makeCapsule(shade,glyph){return makeCapsule(shade,env,.26,glyph);},
      project(local,camera){return local.clone().project(camera);},
      stats(){return {architecture:architecture.children.length,keys:keys.map(k=>{const p=k.group.position.clone().add(v3(0,4.5,0)),q=lastCamera?p.clone().project(lastCamera):null;return {midi:k.midi,name:k.name,black:k.black,glow:k.glow,position:p.toArray(),screen:q?[(q.x*.5+.5)*innerWidth,(-q.y*.5+.5)*innerHeight]:null};}),hoveredKey:hoveredKey?.midi??null,machineRotation:machine.root.rotation.y,crankRotation:machine.crank.rotation.z,hopper:{rotation:machine.hopper.rotation.y,target:machine.hopperMotion.target,speed:machine.hopperMotion.speed,balls:machine.balls.map(b=>({position:b.position.toArray(),rotation:b.rotation.toArray().slice(0,3)}))},rippleCount:water.ripples.filter(r=>r.z>-100).length,bubbles:bubbles.stats(),lighting:{sunDirection:sunlight.clone().normalize().toArray(),beams:windowBeams.map(({beam,...data})=>data),dust:{count:motes.geometry.attributes.position.count,litCount:motes.userData.litCount,palette:motes.userData.palette,time:uniforms.time.value}}};}
    };
  }
  return {create,canvasTexture,makeCapsule};
})();
