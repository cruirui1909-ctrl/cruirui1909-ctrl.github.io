/* Source-colored, independently addressable 3D oil strokes; twelve distinct weather systems. */
window.ZodiacWorlds = (() => {
  'use strict';
  const T=THREE,PI=Math.PI;
  const definitions=[
    {name:'白羊座',en:'ARIES',glyph:'♈',title:'春风双岬',color:'#efb088',horizon:.47,weather:'春日初晴 · 晨风强劲',line:'春风越过双岬，把第一朵花吹向海。',effects:['逆风低云','珊瑚花瓣','逐层白浪','草坡风浪'],particle:'petal'},
    {name:'金牛座',en:'TAURUS',glyph:'♉',title:'雨月青谷',color:'#a6c2a3',horizon:.48,weather:'暮春阴雨 · 一轮低月',line:'雨落进浅洼，月亮在圆环里轻晃。',effects:['垂直细雨','浅洼叠环','草叶滑露','低云移动'],particle:'rain'},
    {name:'双子座',en:'GEMINI',glyph:'♊',title:'双丘云间',color:'#c6d7ad',horizon:.65,weather:'多云午后 · 晴影交替',line:'两团云各自漂流，在风里交换心事。',effects:['双云错移','云影扫坡','双股草浪','交汇风流'],particle:'pollen'},
    {name:'巨蟹座',en:'CANCER',glyph:'♋',title:'月弯潮汐',color:'#b7c8f0',horizon:.50,weather:'有风月夜 · 薄云缓行',line:'海湾轻轻合拢，把月光留在潮线。',effects:['向岸卷浪','飞沫抛落','月影伸缩','月夜薄云'],particle:'spray'},
    {name:'狮子座',en:'LEO',glyph:'♌',title:'日晕旷野',color:'#f6c36f',horizon:.63,weather:'盛夏晴空 · 干热之风',line:'风穿过金色沙原，太阳也有回声。',effects:['沙丘流沙','低掠扬沙','地平热浪','日晕呼吸'],particle:'sand'},
    {name:'处女座',en:'VIRGO',glyph:'♍',title:'蒲风麦原',color:'#dfd18b',horizon:.53,weather:'初秋晨光 · 薄雾渐退',line:'蒲公英从麦浪里起飞，露水缓缓落下。',effects:['蒲种旋飞','整齐麦浪','露滴滑落','渐退晨雾'],particle:'seed'},
    {name:'天秤座',en:'LIBRA',glyph:'♎',title:'秋分双湖',color:'#e2a878',horizon:.52,weather:'秋日多云 · 零星落叶',line:'一片叶子的重量，让两座湖轮流泛光。',effects:['枫叶翻转','触水漂叶','双湖交替涟漪','低云湖影'],particle:'leaf'},
    {name:'天蝎座',en:'SCORPIO',glyph:'♏',title:'雷雨回湾',color:'#ab9cd2',horizon:.47,weather:'雷云低垂 · 斜雨掠过',line:'雷光照亮回钩的河，暗处也有柔软的水。',effects:['斜向雨幕','叠加水圈','沿岸薄雾','枝状闪电'],particle:'storm'},
    {name:'射手座',en:'SAGITTARIUS',glyph:'♐',title:'逐风箭谷',color:'#d8c793',horizon:.52,weather:'雨后晴隙 · 长风未停',line:'风沿山谷奔跑，一道天光指向远方。',effects:['逐层草浪','低弧花瓣','后退雨帘','扩张光隙与彩虹'],particle:'petal'},
    {name:'摩羯座',en:'CAPRICORN',glyph:'♑',title:'雪峰入海',color:'#c1d2ea',horizon:.74,weather:'冬日阴天 · 低云飘雪',line:'雪脊伸向冷海，山脚的云慢慢游走。',effects:['近远分层斜雪','山脚游雾','海面潮纹','低云缓行'],particle:'snow'},
    {name:'水瓶座',en:'AQUARIUS',glyph:'♒',title:'天河悬雨',color:'#b6e2e1',horizon:.56,weather:'晴空逆雨 · 天河悬起',line:'雨滴离开湖面，向天空写一条河。',effects:['湖面逆雨上升','离水圆环','平行云带','雨滴汇入天河'],particle:'up'},
    {name:'双鱼座',en:'PISCES',glyph:'♓',title:'星河双湾',color:'#c0b2e0',horizon:.45,weather:'清澈星夜 · 银河轻悬',line:'两道潮流反向回旋，在同一场梦里相逢。',effects:['双湾反向涡流','连通水道','随流漂瓣','银河星点闪烁'],particle:'vortex'}
  ];
  const vertexShader=`
    attribute vec3 aCenter,aNormal;attribute vec3 aColor;attribute vec4 aMeta;attribute vec4 aBrush;
    uniform float uTime,uTheme,uReveal,uHover,uZoom,uMotion;uniform vec2 uMouse;uniform vec3 uPointer;uniform vec4 uPulse;
    varying vec3 vColor;varying vec2 vUv,vPaint;varying float vDistance,vDepth;varying float vSeed;varying float vLight;
    void main(){
      vec2 uv=aMeta.xy;float kind=aMeta.z;float seed=aMeta.w;float t=uTime;vec3 p=aCenter;
      float lower=smoothstep(.45,1.,uv.y);float wave=sin(uv.x*37.-t*.82+uv.y*23.);
      if(kind<.5){p.x+=sin(t*.08+uv.y*7.)*.07;}
      else if(kind<1.5){
        float speed=.055;
        if(uTheme==2.)speed=mix(.07,-.055,step(.5,uv.x));
        if(uTheme==0.)speed=-.065;
        if(uTheme==10.)speed=.075;
        p.x+=sin(t*speed+uv.y*16.)*1.1;
        p.y+=sin(t*.11+uv.x*3.)*.035;
      }else if(kind>2.5&&kind<3.5){
        p.y+=sin(p.x*.76+t*.64+sin(p.z*.32))*.042+sin(p.z*.91-t*.82)*.034;
        float distanceToPointer=length(p.xz-uPointer.xz);p.y+=sin(distanceToPointer*3.8-t*3.)*exp(-distanceToPointer*.32)*uHover*.055;
        if(uTheme==3.)p.y+=sin(p.z*.91-t*.82)*.015;
        if(uTheme==6.)p.y+=sin(t*.7+step(0.,p.x)*3.14)*.012;
        if(uTheme==11.){float side=step(0.,p.x),a=atan(p.z+16.,p.x-mix(-24.,24.,side));p.y+=sin(a*7.+length(p.xz-vec2(mix(-24.,24.,side),-16.))*.7-t*mix(1.,-1.,side))*.045;}
      }else{
        float wind=sin(uv.x*17.+uv.y*29.-t*1.3)*sin(t*.5+uv.y*7.);
        if(uTheme==2.)wind=sin(abs(uv.x-.5)*22.-t+uv.y*17.);
        if(uTheme==5.)wind=sin(uv.x*29.+uv.y*18.-t*1.5);
        if(uTheme==8.)wind=sin(uv.y*30.-t*2.2+uv.x*8.);
        p.x+=wind*lower*.06;p.y+=wind*lower*.025;
        if(uTheme==4.){float heat=exp(-pow((uv.y-.62)*15.,2.));p.x+=sin(uv.y*190.+t*2.7)*heat*.06;p.y+=sin(uv.x*80.+t*2.)*heat*.018;}
      }
      vec2 d=uv-uMouse;float influence=exp(-dot(p-uPointer,p-uPointer)*.13)*uHover;
      p.y+=influence*.35;p.xy+=normalize(d+vec2(.0001))*influence*.15;
      float scatter=(1.-uReveal);p.xy+=vec2(sin(seed*99.),cos(seed*71.))*scatter*(2.+seed*6.);p.z+=scatter*(seed-.5)*12.;
      float angle=aBrush.x+influence*sin(t*.8+seed*19.)*.10;
      mat2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
      vec2 brush=rot*(position.xy*aBrush.yz);
      float age=t-uPulse.w;float pulse=exp(-pow((length(p-uPulse.xyz)-age*5.5)*1.15,2.))*exp(-max(0.,age)*1.2)*step(0.,age);p.y+=pulse*.5;
      p.x+=sin(seed*19.+t*.4)*uMotion*.07;
      vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]),up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);if(kind>1.5){right=normalize(vec3(1.,-aNormal.x/max(.1,aNormal.y),0.));up=normalize(cross(right,aNormal));p+=right*brush.x+up*brush.y*2.1;}else p+=right*brush.x+up*brush.y;
      vPaint=position.xy+.5;vDistance=length(cameraPosition-p);vDepth=-(modelViewMatrix*vec4(p,1.)).z;
      vColor=aColor;vUv=uv;vSeed=seed;vLight=influence+pulse*.7;
      if(uTheme==2.&&kind>1.5)vColor*=.94+.06*sin(uv.x*12.-t*.18+sin(uv.y*8.));
      if(uTheme==4.&&kind<1.5)vColor*=1.+.055*sin(t*.42)*exp(-length(uv-vec2(.65,.16))*8.);
      if(uTheme==8.&&kind<1.5){float width=.02+.025*(.5+.5*sin(t*.18));float gap=exp(-pow((uv.y-(.57-.47*uv.x))/width,2.));vColor*=1.+gap*.10;}
      if(kind>2.5&&kind<3.5)vColor*=.96+.12*pow(max(0.,wave),3.);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }`;
  const fragmentShader=`
    uniform float uTime,uFlash;uniform vec3 uSkyColor;varying vec3 vColor;varying vec2 vUv,vPaint;varying float vDistance,vDepth;varying float vSeed,vLight;
    void main(){
      if(smoothstep(1.8,7.,vDepth)<vSeed)discard;vec2 dab=(vPaint-.5)*2.;float edge=1.04+.12*sin(atan(dab.y,dab.x)*5.+vSeed*19.);if(dot(dab,dab)>edge)discard;
      vec3 col=vColor*(.97+.045*sin(gl_FragCoord.x*1.2+vSeed*60.)*sin(gl_FragCoord.y*1.7));
      col+=vec3(.035,.025,.009)*vLight;col+=vec3(.16,.18,.25)*uFlash;
      col=mix(col,uSkyColor,smoothstep(90.,220.,vDistance)*.17);gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
    }`;

  function decode(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
  function random(seed){const x=Math.sin(seed*127.1+311.7)*43758.5453;return x-Math.floor(x);}
  const wetScenes=[0,1,3,6,7,9,10,11];
  const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
  function hill(x,z,cx,cz,rx,rz){return Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));}
  function terrainHeight(index,x,z){
    const undulation=Math.sin(x*.071+z*.024)*.28+Math.cos(z*.083-x*.019)*.20;
    switch(index){
      case 0:return -.9+Math.max(0,Math.abs(x-5-Math.sin(z*.045)*6)-15)*.22+2.1*hill(x,z,-2,33,48,13)+7*hill(x,z,-31,-65,20,25)+6*hill(x,z,35,-77,25,27);
      case 1:return .55+undulation+7*hill(x,z,-35,-68,27,45)+8*hill(x,z,38,-75,30,40)-2.1*hill(x,z,4,-6,20,38);
      case 2:return 1+undulation+10*hill(x,z,-26,-59,22,29)+9*hill(x,z,28,-65,25,32);
      case 3:return -1.2+Math.max(0,x-20+Math.sin(z*.045)*8)*.13+7*hill(x,z,-47,-89,23,31)+3*hill(x,z,47,-100,30,25);
      case 4:return 2+Math.sin(x*.095+z*.055)*1.1+Math.sin(z*.13-x*.047)*.9+10*hill(x,z,-28,-74,29,28)+5*hill(x,z,37,-101,32,36);
      case 5:return 1+undulation+2.5*hill(x,z,-37,-93,48,45)+Math.sin(x*.7+z*.025)*.045;
      case 6:return 1.15+undulation*.25-3.4*hill(x,z,-23,-20,17,53)-3.4*hill(x,z,23,-20,17,53)+4*hill(x,z,0,-120,90,20);
      case 7:return -.85+Math.abs(x-Math.sin(z*.053)*9)*.105+undulation*.3+5*hill(x,z,-43,-115,35,24)+6*hill(x,z,45,-113,33,24);
      case 8:return .9+undulation+11*hill(x,z,-35,-82,27,37)+12*hill(x,z,37,-91,30,37);
      case 9:return -1.6+34*hill(x,z,19,-113,18,24)+17*hill(x,z,-7,-119,21,21)+11*hill(x,z,44,-124,26,27);
      case 10:return .85+undulation*.4-2.4*Math.exp(-(((x-1)/25)**4+((z+14)/36)**4))+3*hill(x,z,-51,-119,42,28);
      default:return .85+undulation*.25-3.1*hill(x,z,-24,-16,20,37)-3.1*hill(x,z,24,-16,20,37)-Math.max(0,-z-68)*.045;
    }
  }
  function surfaceHeight(index,x,z){const h=terrainHeight(index,x,z);return wetScenes.includes(index)?Math.max(.04,h):h;}
  function traceSurface(index,origin,direction){
    let previous=0,above=origin.y-surfaceHeight(index,origin.x,origin.z);
    for(let distance=1;distance<=225;distance+=2.4+distance*.018){
      const x=origin.x+direction.x*distance,y=origin.y+direction.y*distance,z=origin.z+direction.z*distance;
      if(Math.abs(x)>150||z< -180||z>40)break;
      const difference=y-surfaceHeight(index,x,z);
      if(difference<=0&&above>0){
        let lo=previous,hi=distance;
        for(let j=0;j<9;j++){const mid=(lo+hi)/2,mx=origin.x+direction.x*mid,mz=origin.z+direction.z*mid;if(origin.y+direction.y*mid>surfaceHeight(index,mx,mz))lo=mid;else hi=mid;}
        return origin.clone().addScaledVector(direction,(lo+hi)/2);
      }
      previous=distance;above=difference;
    }
    return null;
  }
  // ponytail: reference-view colors suit the guided route; free orbit would need authored textures for unseen sides.
  function sourceSpace(index){
    const data=ART_DATA[index],rgb=decode(data.rgb),kinds=decode(data.kinds),camera=new T.PerspectiveCamera(48,16/9,.08,300);
    const pitch=Math.atan((definitions[index].horizon-.5)*2*Math.tan(24*PI/180));
    camera.position.set(0,surfaceHeight(index,0,30)+4.8,30);camera.lookAt(0,camera.position.y+Math.tan(pitch)*90,-60);camera.updateMatrixWorld();
    const temp=new T.Vector3(),landTint=new T.Color(['#86b765','#5f9a70','#9fbc67','#d8b7b0','#e7b166','#d8b857','#c09045','#7c709f','#b3b06d','#c1d2ea','#91bb71','#6e7894'][index]);
    function sample(u,v,out=new T.Color()){
      const i=(Math.floor(clamp(v,0,.9999)*data.rows)*data.cols+Math.floor(clamp(u,0,.9999)*data.cols))*3;
      return out.setRGB(Math.pow(rgb[i]/255,2.2),Math.pow(rgb[i+1]/255,2.2),Math.pow(rgb[i+2]/255,2.2));
    }
    return {data,rgb,kinds,camera,pitch,sample,projectColor(x,y,z,out){temp.set(x,y,z).project(camera);const v=.5-temp.y*.5,c=sample(temp.x*.5+.5,v,out);if(index!==9&&y>.12)c.lerp(landTint,T.MathUtils.smoothstep(data.horizon-v,-.02,.12)*.40);return c;}};
  }
  function makeTerrain(index,uniforms,source){
    const material=(water)=>new T.ShaderMaterial({uniforms:{...uniforms,uWater:{value:water?1:0},uWaterColor:{value:new T.Color(index===11?'#143d80':index===3?'#254e91':'#348eb1')}},toneMapped:false,side:T.DoubleSide,vertexColors:true,
      vertexShader:`uniform float uTime,uWater,uTheme;uniform vec3 uPointer;uniform float uHover;varying vec3 vColor,vWorld,vNormal;varying float vWave;
        void main(){vec3 p=position;float t=uTime;float w=sin(p.x*.76+t*.64+sin(p.z*.32))*.042+sin(p.z*.91-t*.82)*.034;
          float d=length(p.xz-uPointer.xz);w+=sin(d*3.8-t*3.)*exp(-d*.32)*uHover*.055;
          if(uTheme==11.){float side=step(0.,p.x),a=atan(p.z+16.,p.x-mix(-24.,24.,side));w+=sin(a*7.+length(p.xz-vec2(mix(-24.,24.,side),-16.))*.7-t*mix(1.,-1.,side))*.045;}
          if(uWater>.5)p.y+=w;vWave=w;vColor=color;vWorld=p;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`uniform float uTime,uWater,uHover,uFlash;uniform vec3 uPointer,uWaterColor,uSkyColor;uniform vec4 uPulse;varying vec3 vColor,vWorld,vNormal;varying float vWave;
        void main(){float grain=fract(sin(dot(floor(vWorld.xz*8.),vec2(127.1,311.7)))*43758.5);float lambert=.77+.23*max(0.,dot(normalize(vNormal),normalize(vec3(-.4,1.,.2))));vec3 c=vColor*lambert*(.94+.12*grain);
          if(uWater>.5){c=mix(c,uWaterColor,.13);float ripples=pow(max(0.,sin(vWorld.z*7.4+sin(vWorld.x*1.4+uTime*.5)*1.2-uTime*1.6)),14.);c+=vec3(.027,.041,.055)*ripples;float sparkle=pow(max(0.,sin(vWorld.x*1.7+vWorld.z*.82+vWave*24.)),22.);c+=vec3(.11,.14,.20)*sparkle*(.45+.55*sin(uTime*.6+vWorld.z*.1));}
          float glow=exp(-length(vWorld-uPointer)*.50)*uHover;float age=uTime-uPulse.w;float ring=exp(-pow((length(vWorld.xz-uPulse.xz)-age*5.5)*2.4,2.))*exp(-max(0.,age)*1.2)*step(0.,age);
          c+=vec3(.10,.075,.025)*(glow+ring);c+=vec3(.12,.14,.22)*uFlash;c=mix(c,uSkyColor,smoothstep(70.,210.,length(cameraPosition-vWorld))*.22);
          gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>

        }`});
    const objects=[];
    for(const water of [false,...(wetScenes.includes(index)?[true]:[])]){
      const g=new T.PlaneGeometry(300,220,154,160);g.rotateX(-PI/2);g.translate(0,0,-70);
      const p=g.attributes.position,colors=new Float32Array(p.count*3),c=new T.Color();
      for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=water?.045:terrainHeight(index,x,z);p.setY(i,y);source.projectColor(x,y,z,c);colors.set(c.toArray(),i*3);}
      g.setAttribute('color',new T.BufferAttribute(colors,3));g.computeVertexNormals();
      const object=new T.Mesh(g,material(water));object.name=water?'three-dimensional-water':'sculpted-zodiac-terrain';object.frustumCulled=false;objects.push(object);
    }
    return objects;
  }
  function makeBrushes(index,uniforms,source){
    const {data,rgb,kinds,camera}=source,n=data.cols*data.rows;
    const centers=new Float32Array(n*3),normals=new Float32Array(n*3),colors=new Float32Array(n*3),meta=new Float32Array(n*4),brush=new Float32Array(n*4),direction=new T.Vector3(),point=new T.Vector3(),forward=new T.Vector3();camera.getWorldDirection(forward);
    const spacingY=2*Math.tan(24*PI/180)/data.rows,spacingX=spacingY*data.rows/data.cols*16/9;
    let minDepth=Infinity,maxDepth=-Infinity;
    for(let i=0;i<n;i++){
      const seed=random(i+index*200000),u=((i%data.cols)+.5+(random(i+45)-.5)*.85)/data.cols,v=(Math.floor(i/data.cols)+.5+(random(i+56)-.5)*.85)/data.rows;let kind=kinds[i];
      direction.set(u*2-1,1-v*2,.5).unproject(camera).sub(camera.position).normalize();
      const hit=(kind>1||v>data.horizon)?traceSurface(index,camera.position,direction):null;
      if(hit){point.copy(hit);kind=wetScenes.includes(index)&&terrainHeight(index,point.x,point.z)<.04?3:(v>.8?4:2);point.y+=.105;}
      else {const distance=kind===1?88+seed*29:175+seed*10;point.copy(camera.position).addScaledVector(direction,distance);if(kind>1)kind=0;}
      const normal=new T.Vector3(0,1,0);if(hit&&kind!==3){const e=.25;normal.set(terrainHeight(index,point.x-e,point.z)-terrainHeight(index,point.x+e,point.z),2*e,terrainHeight(index,point.x,point.z-e)-terrainHeight(index,point.x,point.z+e)).normalize();}normals.set(normal.toArray(),i*3);
      const depth=point.clone().sub(camera.position).dot(forward);centers.set(point.toArray(),i*3);minDepth=Math.min(minDepth,point.z);maxDepth=Math.max(maxDepth,point.z);
      for(let c=0;c<3;c++)colors[i*3+c]=Math.pow(rgb[i*3+c]/255,2.2);
      meta.set([u,v,kind,seed],i*4);const maxSize=hit?.27:3.;brush.set([kind===3?(seed-.5)*.3:(seed-.5)*1.4,Math.min(maxSize,spacingX*depth*(1.58+seed*.25)),Math.min(maxSize*.78,spacingY*depth*(1.48+random(i+9)*.3)),0],i*4);
    }
    const base=new T.PlaneGeometry(1,1),g=new T.InstancedBufferGeometry();g.index=base.index;g.attributes.position=base.attributes.position;g.attributes.uv=base.attributes.uv;
    g.setAttribute('aCenter',new T.InstancedBufferAttribute(centers,3));g.setAttribute('aNormal',new T.InstancedBufferAttribute(normals,3));g.setAttribute('aColor',new T.InstancedBufferAttribute(colors,3));g.setAttribute('aMeta',new T.InstancedBufferAttribute(meta,4));g.setAttribute('aBrush',new T.InstancedBufferAttribute(brush,4));g.instanceCount=n;
    const m=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,toneMapped:false,side:T.DoubleSide});const o=new T.Mesh(g,m);o.frustumCulled=false;o.name='independent-spatial-oil-brushes';o.userData={brushCount:n,depthRange:[minDepth,maxDepth]};return o;
  }
  function makePlants(index,uniforms,source){
    const group=new T.Group();group.name='volumetric-foreground-plants';if([3,4,9].includes(index))return group;
    const n=7800,g=new T.PlaneGeometry(.09,.85,1,3);g.translate(0,.425,0);
    const mat=new T.ShaderMaterial({uniforms,side:T.DoubleSide,toneMapped:false,vertexColors:true,
      vertexShader:`uniform float uTime,uHover,uMotion;uniform vec3 uPointer;varying vec3 vColor;varying float vTip;
        void main(){vec3 p=position;vec3 root=instanceMatrix[3].xyz;float top=clamp(position.y/.85,0.,1.);float sway=sin(uTime*1.1+root.x*.29+root.z*.18)*.11;
          float push=exp(-length(root-uPointer)*.40)*uHover;p.x+=(sway+push*.5+uMotion*.05)*top*top;vec4 world=instanceMatrix*vec4(p,1.);vColor=instanceColor;vTip=top;gl_Position=projectionMatrix*modelViewMatrix*world;}`,
      fragmentShader:`varying vec3 vColor;varying float vTip;void main(){gl_FragColor=vec4(vColor*(.62+vTip*.50),1.);
#include <colorspace_fragment>
}`});
    const grass=new T.InstancedMesh(g,mat,n),headGeometry=new T.IcosahedronGeometry(.095,0),headMaterial=new T.MeshBasicMaterial({vertexColors:false,toneMapped:false});
    const flowers=new T.InstancedMesh(headGeometry,headMaterial,1800),dummy=new T.Object3D(),c=new T.Color();let count=0,heads=0;
    for(let i=0;i<22000&&count<n;i++){
      const x=(random(i*3+1200+index*50)-.5)*90,z=25-random(i*3+1201)*112,h=terrainHeight(index,x,z);if(h<.10)continue;
      const height=.45+random(i+33)*1.1;dummy.position.set(x,h+.01,z);dummy.rotation.set(0,random(i+71)*PI,0);dummy.scale.set(1,height,1);dummy.updateMatrix();grass.setMatrixAt(count,dummy.matrix);
      source.projectColor(x,h,z,c);c.lerp(new T.Color(index===6?'#bd8b45':'#7b9c49'),.30);grass.setColorAt(count,c);count++;
      if(heads<1800&&i%2===0){dummy.position.y=h+height*.85;dummy.scale.setScalar(.65+random(i+90));dummy.updateMatrix();flowers.setMatrixAt(heads,dummy.matrix);c.set(index===6?'#ed9f55':index===5?'#f4e9b0':heads%3?'#f4d982':'#f4b9a1');flowers.setColorAt(heads,c);heads++;}
    }
    grass.count=count;flowers.count=heads;grass.name='wind-responsive-grass';flowers.name='separate-flower-heads';grass.frustumCulled=false;flowers.frustumCulled=false;group.add(grass,flowers);return group;
  }
  const particleModes={rain:0,storm:1,snow:2,petal:3,pollen:4,seed:5,leaf:6,sand:7,spray:8,up:9,vortex:10};
  const weatherFragment=`uniform float uMode,uTime;uniform vec3 uTint;varying float vSeed,vAlpha,vSpin;varying vec2 vRainDirection;
        void main(){vec2 p=gl_PointCoord-.5;float a=0.;vec3 tint=uTint;
        if(uMode<1.5){if(uMode>.5)p=vec2(dot(p,vec2(vRainDirection.y,-vRainDirection.x)),dot(p,vRainDirection));a=exp(-pow(p.x*30.,2.))*smoothstep(.5,.18,abs(p.y));}
        else if(uMode==2.){float d=length(p);a=smoothstep(.5,.04,d);}
        else if(uMode==3.||uMode==6.){float c=cos(vSpin),s=sin(vSpin);p=mat2(c,-s,s,c)*p;p.x/=max(.22,abs(cos(vSpin*.7)));float angle=atan(p.y,p.x);float d=length(p);float r=uMode==6.?(.30+.12*cos(angle*5.)):.34;a=smoothstep(r,r-.045,d);tint*=.82+.18*vSeed;}
        else if(uMode==5.){vec2 q=p-vec2(0.,-.12);float d=length(q);float rays=pow(abs(cos(atan(q.y,q.x)*11.)),14.);a=smoothstep(.36,.1,d)*(.24+rays*.7);a+=exp(-pow((p.x-p.y*.25)*38.,2.))*step(-.02,p.y)*.7;}
        else{a=pow(max(0.,1.-length(p)*2.),2.);}
        if(a<.015)discard;gl_FragColor=vec4(tint,a*vAlpha);
        #include <colorspace_fragment>
        }`;
  function makeRings(scene,uniforms) {
    const n=32,centers=new Float32Array(n*3),phases=new Float32Array(n),amplitude=new Float32Array(n);
    for(let i=0;i<n;i++){centers.set([0,0,-50],i*3);phases[i]=-100;amplitude[i]=0;}
    const plane=new T.PlaneGeometry(1,1),geo=new T.InstancedBufferGeometry();geo.index=plane.index;geo.attributes.position=plane.attributes.position;geo.attributes.uv=plane.attributes.uv;
    geo.setAttribute('aCenter',new T.InstancedBufferAttribute(centers,3));geo.setAttribute('aStart',new T.InstancedBufferAttribute(phases,1));geo.setAttribute('aStrength',new T.InstancedBufferAttribute(amplitude,1));geo.instanceCount=n;
    const mat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,vertexShader:`attribute vec3 aCenter;attribute float aStart,aStrength;uniform float uTime;varying vec2 vUv;varying float vAge,vStrength;
      void main(){float age=uTime-aStart;float size=age*2.8+.12;vec3 p=aCenter+vec3(position.x*size,0.,position.y*size);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);vUv=uv;vAge=age;vStrength=aStrength;}`,
      fragmentShader:`varying vec2 vUv;varying float vAge,vStrength;void main(){float d=length(vUv-.5)*2.;float ring=exp(-pow((d-.68)*32.,2.))*.65+exp(-pow((d-.9)*38.,2.))*.3;float fade=exp(-vAge*1.2)*smoothstep(0.,.15,vAge)*step(vAge,4.);gl_FragColor=vec4(.8,.92,1.,ring*fade*vStrength);}`});
    const object=new T.Mesh(geo,mat);object.frustumCulled=false;object.renderOrder=4;scene.add(object);let cursor=0;
    return {object,emit(x,y,z,time,strength=.6){centers.set([x,y,z],cursor*3);phases[cursor]=time;amplitude[cursor]=strength;for(const k of ['aCenter','aStart','aStrength'])geo.attributes[k].needsUpdate=true;cursor=(cursor+1)%n;}};
  }
  function makeMist(scene,uniforms,index) {
    const layers=[];
    for(let i=0;i<3;i++){
      const mat=new T.ShaderMaterial({uniforms:{uTime:uniforms.uTime,uIndex:{value:i},uFade:{value:1},uColor:{value:new T.Color(index===7?'#a9a4d5':'#e8e2d2')}},transparent:true,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float uTime,uIndex,uFade;uniform vec3 uColor;void main(){float center=.49+sin(vUv.x*8.+uTime*.12+uIndex)*.15;float a=exp(-pow((vUv.y-center)*8.,2.))*(.5+.5*sin(vUv.x*9.-uTime*.15+uIndex));gl_FragColor=vec4(uColor,a*.032*uFade);}`});
      const fog=new T.Mesh(new T.PlaneGeometry(32,3.0),mat);fog.position.set(0,index===9?-2.4:-1.5,-1+i*.8);fog.renderOrder=2;scene.add(fog);layers.push(fog);
    }
    return layers;
  }
  function makeDew(scene) {
    const group=new T.Group();group.name='sliding-dewdrops';scene.add(group);
    const mat=new T.MeshBasicMaterial({color:'#e7faff',transparent:true,opacity:.66});
    for(let i=0;i<9;i++){
      const bead=new T.Mesh(new T.SphereGeometry(.035+i*.002,8,6),mat);bead.position.set(-10.5+i*.23,-4.+i*.24,7+i*.1);group.add(bead);
    }
    return group;
  }
  function makeLightning(scene,uniforms) {
    const group=new T.Group();group.name='branching-lightning';scene.add(group);
    const mat=new T.LineBasicMaterial({color:'#e8eaff',transparent:true,opacity:0});
    const main=[new T.Vector3(7,5,-2),new T.Vector3(6.5,4,-1.8),new T.Vector3(7.3,3.2,-1.7),new T.Vector3(6.6,2,-1.5),new T.Vector3(7.1,.8,-1.3)];
    const paths=[main];
    group.add(new T.Line(new T.BufferGeometry().setFromPoints(main),mat));
    for(let i=1;i<4;i++){
      const p=main[i],q=p.clone().add(new T.Vector3(1.3,-.4,0)),r=q.clone().add(new T.Vector3(.8,-1.1,0));
      group.add(new T.Line(new T.BufferGeometry().setFromPoints([p,q,r]),mat));
      paths.push([p,q,r]);
    }
    const positions=[],seeds=[];
    for(const path of paths)for(let i=1;i<path.length;i++)for(let j=0;j<18;j++){
      const n=seeds.length,p=path[i-1].clone().lerp(path[i],j/18);
      p.x+=(random(n+911)-.5)*.18;p.y+=(random(n+912)-.5)*.12;p.z+=(random(n+913)-.5)*.16;
      positions.push(...p.toArray());seeds.push(random(n+914));
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('aSeed',new T.Float32BufferAttribute(seeds,1));
    const glow={uTime:uniforms.uTime,uSpark:{value:0}},material=new T.ShaderMaterial({uniforms:glow,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,
      vertexShader:`attribute float aSeed;uniform float uTime,uSpark;varying float vGlow;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=(2.5+aSeed*3.5)*(1.+uSpark*1.8)*clamp(130./-p.z,.6,1.8);vGlow=.12+.10*sin(uTime*.8+aSeed*30.)+uSpark*(.45+.55*pow(.5+.5*sin(uTime*8.+aSeed*60.),3.));}`,
      fragmentShader:`varying float vGlow;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(vec3(.76,.83,1.)*(1.+vGlow),pow(1.-r,1.4)*vGlow);}`});
    const particles=new T.Points(geometry,material);particles.name='touchable-lightning-particles';particles.frustumCulled=false;group.add(particles);
    let hovered=false,lastTrigger=-100,activations=0;
    const position=geometry.attributes.position,projected=new T.Vector3(),point=new T.Vector3(),closest=new T.Vector3();
    return {group,material:mat,glow,lastTrigger:()=>lastTrigger,
      touch(ndc,camera,time){
        group.updateMatrixWorld(true);let nearest=(36/innerHeight)**2,found=false;
        for(let i=0;i<position.count;i++){
          point.fromBufferAttribute(position,i).applyMatrix4(group.matrixWorld);projected.copy(point).project(camera);
          if(projected.z< -1||projected.z>1)continue;
          const distance=((projected.x-ndc.x)*camera.aspect)**2+(projected.y-ndc.y)**2;
          if(distance<nearest){nearest=distance;closest.copy(point);found=true;}
        }
        if(found){const direction=closest.clone().sub(camera.position).normalize(),blocked=traceSurface(7,camera.position,direction);if(blocked&&blocked.distanceTo(camera.position)<closest.distanceTo(camera.position)-1)found=false;}
        const triggered=found&&!hovered&&time-lastTrigger>2.8;hovered=found;
        if(triggered){lastTrigger=time;activations++;}
        return found?{surface:'lightning',lightning:triggered,ripple:false,depth:closest.distanceTo(camera.position)}:null;
      },
      leave(){hovered=false;},
      stats(camera){
        const targets=[];group.updateMatrixWorld(true);
        if(camera)for(let i=9;i<position.count;i+=18){projected.fromBufferAttribute(position,i).applyMatrix4(group.matrixWorld).project(camera);if(projected.z>-1&&projected.z<1)targets.push([(projected.x*.5+.5)*innerWidth,(-projected.y*.5+.5)*innerHeight]);}
        return {particles:position.count,hovered,activations,sparkle:glow.uSpark.value,opacity:mat.opacity,targets};
      }
    };
  }
  function weatherParticles(index,uniforms){
    const def=definitions[index],mode=particleModes[def.particle],counts=[1800,2200,1300,430,650,500,430,1200,850,1000,950],n=counts[mode];
    const positions=new Float32Array(n*3),seeds=new Float32Array(n),ground=new Float32Array(n);
    for(let i=0;i<n;i++){
      const x=(random(i*3+11)-.5)*116,z=30-random(i*3+57)*160,y=surfaceHeight(index,x,z);
      positions.set([x,y+1+random(i*3+20)*25,z],i*3);seeds[i]=random(i+77);ground[i]=y;
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('aSeed',new T.BufferAttribute(seeds,1));g.setAttribute('aGround',new T.BufferAttribute(ground,1));
    const u={...uniforms,uMode:{value:mode},uTint:{value:new T.Color(mode===3?'#ffc28d':mode===6?'#ffa466':mode===7?'#ffe1a1':index===11?'#c8b8f5':'#f3efda')},uPixel:{value:1}};
    const m=new T.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,toneMapped:false,blending:[0,1,2,4,5,7,8,9,10].includes(mode)?T.AdditiveBlending:T.NormalBlending,
      vertexShader:`attribute float aSeed,aGround;uniform float uTime,uMode,uPixel,uHover,uMotion;uniform vec3 uPointer;uniform vec4 uPulse;varying float vSeed,vAlpha,vSpin;varying vec2 vRainDirection;
        void main(){float t=uTime,seed=aSeed;vec3 p=position;float speed=1.+seed*1.2;vAlpha=.55;float size=3.;vRainDirection=vec2(0.,1.);
          if(uMode<1.5){float fall=mod(position.y-t*(5.+speed),28.);p.y=aGround+fall;p.x=position.x+(uMode>.5?fall*.30:sin(t*.2+seed*50.)*.15);size=10.+seed*9.;vAlpha=.30;}
          else if(uMode==2.){p.y=aGround+mod(position.y-t*(.7+seed),29.);p.x=position.x+sin(t*.2+seed*40.)*2.0;size=3.+seed*8.;vAlpha=.8;}
          else if(uMode==3.){p.x=mod(position.x+t*(1.+seed)+58.,116.)-58.;p.y=aGround+1.+fract(seed*13.)*7.+sin(t*.6+seed*19.)*1.1;size=7.+seed*12.;vAlpha=.8;}
          else if(uMode==4.){p.x+=sin(t*.3+seed*44.)*1.4;p.y+=cos(t*.4+seed*33.)*.6;size=2.+seed*3.;vAlpha=.4;}
          else if(uMode==5.){p.x=mod(position.x+t*(.6+seed*.7)+58.,116.)-58.;p.y=aGround+2.+sin(t*.3+seed*37.)*2.+fract(seed*17.)*7.;size=10.+seed*13.;vAlpha=.8;}
          else if(uMode==6.){float f=fract(t*(.025+seed*.015)+seed),fall=min(f/.73,1.);p.y=aGround+10.-fall*9.8;if(f>.73)p.y+=sin(t*.8+seed*17.)*.04;p.x=position.x+sin(t*.6+seed*20.)*1.5;size=12.+seed*15.;vAlpha=.9*smoothstep(1.,.92,f);}
          else if(uMode==7.){p.x=mod(position.x+t*(1.8+seed*2.)+58.,116.)-58.;p.y=aGround+.25+sin(t*.9+seed*40.)*.20;size=2.+seed*3.;vAlpha=.4;}
          else if(uMode==8.){float f=fract(t*(.35+seed*.3)+seed);p.x=position.x*.6;p.y=.10+sin(f*3.14159)*(seed*1.5+.3);size=2.+seed*4.;vAlpha=(1.-f)*.65;}
          else if(uMode==9.){float f=fract(t*(.06+seed*.04)+seed);p.y=.12+f*30.;p.x=position.x*.40*(1.-f*.88)+sin(f*6.+seed*12.)*(1.-f);p.z=-14.+(position.z+14.)*.40;size=3.+seed*6.;vAlpha=sin(f*3.14159)*.7;}
          else{float side=step(.5,seed),a=t*mix(.12,-.12,side)+seed*60.,r=3.+fract(seed*11.)*16.;p=vec3(mix(-24.,24.,side)+cos(a)*r,.16+sin(a)*.08,-16.+sin(a)*r*1.5);size=3.+fract(seed*13.)*7.;vAlpha=.65;}
          vec3 away=p-uPointer;float push=exp(-dot(away,away)*.075)*uHover;p+=normalize(away+vec3(.001))*push*1.25;
          float age=uTime-uPulse.w,ring=exp(-pow((length(p-uPulse.xyz)-age*5.5)*1.2,2.))*exp(-max(0.,age));p.y+=ring*.8;p.x+=sin(seed*60.+t)*uMotion*.12;
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
          if(uMode>.5&&uMode<1.5){
            // Project the fall direction in pixels; point-sprite Y runs downward.
            vec4 nextClip=projectionMatrix*(mv+modelViewMatrix*vec4(-.30,-1.,0.,0.));
            vec2 direction=nextClip.xy/nextClip.w-gl_Position.xy/gl_Position.w;
            direction.x*=projectionMatrix[1][1]/projectionMatrix[0][0];
            vRainDirection=normalize(vec2(direction.x,-direction.y));
          }
          gl_PointSize=clamp(size*23./max(2.,-mv.z)*uPixel,1.,38.);vAlpha*=smoothstep(.6,3.5,-mv.z);vSeed=seed;vSpin=t*(.4+seed)+seed*60.;}`,
      fragmentShader:weatherFragment});
    const points=new T.Points(g,m);points.frustumCulled=false;points.name='weather-'+def.particle;points.renderOrder=3;return points;
  }
  function makeNightStars(index,source,uniforms,daylight){
    const count=[150,45,100,190,125,100,125,22,100,110,175,320][index],positions=[],seeds=[],tints=[],direction=new T.Vector3();
    for(let i=0;i<count*8&&seeds.length<count;i++){
      const u=.035+random(i+index*1913)*.93,v=.025+random(i+index*1357+131)*Math.min(.55,definitions[index].horizon-.06);
      const k=Math.floor(v*source.data.rows)*source.data.cols+Math.floor(u*source.data.cols);
      if(source.kinds[k]!==0)continue;
      direction.set(u*2-1,1-v*2,.5).unproject(source.camera).sub(source.camera.position).normalize();
      const p=source.camera.position.clone().addScaledVector(direction,143+random(i+62)*9);positions.push(...p.toArray());seeds.push(random(i+315));
      tints.push(...new T.Color(i%5===0?'#ffd9aa':i%3===0?'#c7c0ff':'#d5edff').toArray());
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('aSeed',new T.Float32BufferAttribute(seeds,1));geometry.setAttribute('aTint',new T.Float32BufferAttribute(tints,3));
    const mask=daylight||{uDayCenter:{value:new T.Vector2(.5,.5)},uDayViewport:{value:new T.Vector2(1,1)},uDayRadius:{value:.28},uDayStrength:{value:0}};
    const material=new T.ShaderMaterial({uniforms:{...mask,uTime:uniforms.uTime},transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,
      vertexShader:`attribute float aSeed;attribute vec3 aTint;uniform float uTime;varying float vTwinkle;varying vec3 vTint;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.4+aSeed*2.4)*clamp(145./-mv.z,.7,1.65);vTwinkle=.55+.45*pow(.5+.5*sin(uTime*(.23+aSeed*.32)+aSeed*89.),2.);vTint=aTint;}`,
      fragmentShader:`varying float vTwinkle;varying vec3 vTint;${CloudOptics.daylightGLSL}
        void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float night=1.-cloudDayAmount(gl_FragCoord.xy/uDayViewport);float alpha=pow(1.-d,1.7)*vTwinkle*night*night;gl_FragColor=vec4(vTint*3.2,alpha);}`});
    const stars=new T.Points(geometry,material);stars.name='depth-occluded-night-stars';stars.renderOrder=2;stars.frustumCulled=false;return stars;
  }
  function create(index,options={}){
    if(!Number.isInteger(index)||index<0||index>=12)throw new RangeError('Unknown zodiac');
    const def=definitions[index],source=sourceSpace(index),scene=new T.Scene(),skyColor=source.sample(.5,.08);scene.background=skyColor;
    const uniforms={uTime:{value:0},uTheme:{value:index},uReveal:{value:0},uHover:{value:0},uZoom:{value:0},uMotion:{value:0},uMouse:{value:new T.Vector2(.5,.5)},uPointer:{value:new T.Vector3(0,-100,0)},uPulse:{value:new T.Vector4(0,-100,0,-100)},uSkyColor:{value:skyColor},uFlash:{value:0}};
    const terrain=makeTerrain(index,uniforms,source);terrain.forEach(o=>scene.add(o));
    const brushes=makeBrushes(index,uniforms,source);scene.add(brushes);
    const plants=makePlants(index,uniforms,source);scene.add(plants);
    const weather=weatherParticles(index,uniforms);scene.add(weather);
    const rings=makeRings(scene,uniforms);let lastRing=0;
    const mist=[1,5,7,9].includes(index)?makeMist(scene,uniforms,index):[];
    mist.forEach((o,i)=>{o.scale.set(5,2,1);o.position.set(0,1.4,-35-i*32);});
    const dew=[1,5].includes(index)?makeDew(scene):null;
    if(dew)dew.children.forEach((o,i)=>{const x=-18+i*.55,z=10-i*2;o.userData.base=surfaceHeight(index,x,z)+.7;o.position.set(x,o.userData.base,z);});
    const lightning=index===7?makeLightning(scene,uniforms):null;if(lightning){lightning.group.position.set(8,13,-95);lightning.group.scale.setScalar(3);}
    let curtain=null;
    if(index===8){curtain=weatherParticles(7,uniforms);curtain.scale.set(.35,.6,.3);curtain.position.set(-38,1,-85);curtain.material.uniforms.uTint.value.set('#d4ddff');scene.add(curtain);}
    const nightStars=makeNightStars(index,source,uniforms,options.daylight);scene.add(nightStars);
    const targetPointer=new T.Vector3(0,-100,0),touchUniform=new T.Vector2(.5,.5),ray=new T.Raycaster(),cameraPosition=new T.Vector3();
    let pointerHits=0,clicks=0,travel=0,lastTravel=0,liveCamera=null;const initialCamera=source.camera.position.clone();
    function pointAt(ndc,camera){ray.setFromCamera(ndc,camera);return traceSurface(index,ray.ray.origin,ray.ray.direction)||ray.ray.at(65,new T.Vector3());}
    function surfaceAt(point){
      if(point.y>surfaceHeight(index,point.x,point.z)+.2)return 'air';
      if(wetScenes.includes(index)&&terrainHeight(index,point.x,point.z)<.04)return 'water';
      return ['grass','grass','grass','sand','sand','grass','leaves','rain','grass','snow','grass','leaves'][index];
    }
    return {
      scene,index,definition:def,brushes,weather,uniforms,rings,
      setCamera(camera,progress,pointer,dt){
        liveCamera=camera;
        travel=progress;const f=T.MathUtils.smoothstep(progress,0,1),z=30-f*36;
        let x=Math.sin(f*PI)*([0,2,6,11].includes(index)?1.6:2.8);if(index===7)x=Math.sin(z*.053)*4*f;
        const y=surfaceHeight(index,x,z)+4.8;
        // Fit the source frustum on wide screens, leaving room for pointer parallax at every depth.
        camera.fov=2*Math.atan(Math.tan(24*PI/180)*Math.min(1,(16/9)/camera.aspect)*.92)*180/PI;camera.position.set(x+pointer.x*.7,y+pointer.y*.28,z);
        camera.lookAt(x+pointer.x*.18,y+Math.tan(source.pitch)*90+pointer.y*.14,z-90);camera.updateProjectionMatrix();camera.updateMatrixWorld();cameraPosition.copy(camera.position);
        uniforms.uZoom.value=progress;const velocity=dt>0?(progress-lastTravel)/dt:0;uniforms.uMotion.value=T.MathUtils.damp(uniforms.uMotion.value,clamp(velocity*2,-1,1),4,dt);lastTravel=progress;
      },
      pointer(ndc,camera,time,active){
        const strike=lightning?.touch(ndc,camera,time);if(strike){targetPointer.set(0,-100,0);return strike;}
        touchUniform.set(ndc.x*.5+.5,.5-ndc.y*.5);targetPointer.copy(pointAt(ndc,camera));pointerHits++;
        const ripple=active&&time-lastRing>.13&&targetPointer.y<surfaceHeight(index,targetPointer.x,targetPointer.z)+.2;
        if(ripple){rings.emit(targetPointer.x,targetPointer.y+.10,targetPointer.z,time,.65);lastRing=time;}
        return {surface:surfaceAt(targetPointer),ripple,depth:targetPointer.distanceTo(camera.position)};
      },
      click(ndc,camera,time){
        const point=pointAt(ndc,camera);uniforms.uPulse.value.set(point.x,point.y,point.z,time);targetPointer.copy(point);clicks++;
        rings.emit(point.x,point.y+.14,point.z,time,1.0);rings.emit(point.x,point.y+.16,point.z,time-.20,.55);
        return {surface:surfaceAt(point),depth:point.distanceTo(camera.position)};
      },
      leave(){lightning?.leave();},
      update(time,dt,hover,reveal,viewport){
        uniforms.uTime.value=time;uniforms.uReveal.value=T.MathUtils.damp(uniforms.uReveal.value,reveal,4,dt);
        uniforms.uMouse.value.lerp(touchUniform,Math.min(1,dt*5));uniforms.uPointer.value.lerp(targetPointer,Math.min(1,dt*6));uniforms.uHover.value=T.MathUtils.damp(uniforms.uHover.value,hover?1:0,3,dt);
        weather.material.uniforms.uPixel.value=Math.min(1.6,viewport/900);
        if(index===5)mist.forEach((m,i)=>{m.material.uniforms.uFade.value=.38+.42*(.5+.5*Math.cos(time*.10+i*.4));m.position.x=Math.sin(time*.06+i)*2;});
        if(curtain){curtain.position.z=-85-(Math.sin(time*.10)*.5+.5)*9;curtain.position.x=-38-Math.sin(time*.08)*2;}
        if(dew)dew.children.forEach((b,i)=>{const p=(time*.10+i/9)%1;b.position.y=b.userData.base-p*.5;b.material.opacity=.7*(1-p);});
        if(lightning){
          const phase=time%9.7,automatic=options.reducedMotion?0:(phase>3.0&&phase<3.13?1:phase>3.35&&phase<3.47?.65:0),age=time-lightning.lastTrigger(),spark=age>=0?Math.exp(-age*2.8):0;
          lightning.glow.uSpark.value=T.MathUtils.damp(lightning.glow.uSpark.value,spark,18,dt);
          const flash=Math.max(automatic,spark*(options.reducedMotion?.22:.85));lightning.material.opacity=flash;uniforms.uFlash.value=T.MathUtils.damp(uniforms.uFlash.value,flash*.42,12,dt);
        }
        if(wetScenes.includes(index)&&time-lastRing>(index===7?.10:index===1?.22:.50)){
          const n=Math.floor(time*10),x=index===6?(n%2?-23:23):index===11?(n%2?-24:24)+(random(n)-.5)*18:(random(n)-.5)*44,z=-70+random(n+3)*91;
          if(terrainHeight(index,x,z)<.04)rings.emit(x,.13,z,time,index===7?.32:.42);lastRing=time;
        }
      },
      dispose(){scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const list=Array.isArray(o.material)?o.material:[o.material];list.forEach(m=>m.dispose());}});},
      stats(){return {index,title:def.title,brushCount:brushes.userData.brushCount,depthRange:brushes.userData.depthRange,depthLayers:5,terrainVertices:terrain[0].geometry.attributes.position.count,water:terrain.some(o=>o.name==='three-dimensional-water'),plantInstances:plants.children.reduce((sum,o)=>sum+(o.count||0),0),nightStars:nightStars.geometry.attributes.position.count,effects:def.effects.slice(),time:uniforms.uTime.value,hover:uniforms.uHover.value,weatherParticles:weather.geometry.attributes.position.count,travel,camera:cameraPosition.toArray(),initialCamera:initialCamera.toArray(),pointerHits,clicks,pulseTime:uniforms.uPulse.value.w,motion:uniforms.uMotion.value,lightning:lightning?.stats(liveCamera)||null};}
    };
  }
  return {definitions,create};
})();
