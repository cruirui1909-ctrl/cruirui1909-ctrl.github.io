/* A small pool of real, depth-tested soap bubbles and short-lived film bursts. */
window.CloudBubbles = (() => {
  'use strict';
  const T=THREE;
  const vertex=`varying vec3 vNormal;varying vec3 vEye;varying vec3 vWorld;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vEye=-mv.xyz;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*mv;}`;
  const fragment=`varying vec3 vNormal;varying vec3 vEye;varying vec3 vWorld;uniform float uTime,uFade,uSeed;
    void main(){vec3 n=normalize(vNormal),eye=normalize(vEye);float f=1.-abs(dot(n,eye));
      float rim=pow(f,3.4);vec3 film=.57+.43*cos(vec3(0.,2.1,4.2)+f*14.+vWorld.y*.75+uSeed*9.);
      float crescent=pow(max(dot(n,normalize(vec3(-.48,.72,.58))),0.),42.);
      float second=pow(max(dot(n,normalize(vec3(.65,-.2,.72))),0.),65.);
      vec3 col=film*(.55+rim*1.0)+vec3(1.,.87,.72)*crescent*1.5+vec3(.7,.93,1.)*second;
      float alpha=(.008+rim*.48+crescent*.52+second*.22)*uFade;
      gl_FragColor=vec4(col,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function create(scene,occluder,onPop){
    const root=new T.Group();root.name='floating-soap-bubbles';scene.add(root);
    const sphere=new T.SphereGeometry(1,32,24),bubbles=[];
    let popCount=0,lastHit=-1,lastCamera=null;const mouse=new T.Vector2(9,9),ray=new T.Raycaster();
    const seeded=n=>{const x=Math.sin(n*127.1+31.7)*43758.5453;return x-Math.floor(x);};
    for(let i=0;i<68;i++){
      const material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{uTime:{value:0},uFade:{value:0},uSeed:{value:seeded(i+2)}},transparent:true,depthWrite:false,side:T.FrontSide});
      const object=new T.Mesh(sphere,material);object.name='soap-bubble-'+i;object.renderOrder=6;root.add(object);
      const z=i%34<9?5+seeded(i+90)*23:-43+seeded(i+53)*47;
      const base=new T.Vector3((seeded(i+12)-.5)*10.5,.7+seeded(i+63)*8.0,z);
      const radius=.22+seeded(i+22)*.075;
      object.scale.setScalar(radius);
      bubbles.push({object,base,radius,seed:seeded(i+44),born:-2,respawn:0,popped:false});
    }
    const particleGeometry=new T.BufferGeometry(),positions=[],seeds=[];
    for(let i=0;i<27;i++){
      const a=seeded(i+3)*Math.PI*2,z=seeded(i+39)*2-1,s=Math.sqrt(1-z*z);
      positions.push(Math.cos(a)*s,Math.sin(a)*s,z);seeds.push(seeded(i+60));
    }
    particleGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));particleGeometry.setAttribute('aSeed',new T.Float32BufferAttribute(seeds,1));
    const filmGeometry=new T.PlaneGeometry(1,1),bursts=[];
    for(let i=0;i<8;i++){
      const group=new T.Group();group.name='bubble-film-burst';group.visible=false;scene.add(group);
      const common={uAge:{value:2},uRadius:{value:.26}};
      const film=new T.Mesh(filmGeometry,new T.ShaderMaterial({uniforms:common,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float uAge;
        void main(){vec2 p=vUv-.5;float a=atan(p.y,p.x),d=length(p)*2.;float edge=.65+.07*sin(a*7.+uAge*13.);float ring=exp(-pow((d-edge)*33.,2.));float fragments=smoothstep(-.35,.65,sin(a*13.+uAge*21.));float fade=pow(max(0.,1.-uAge/.50),1.6);vec3 hue=.65+.35*cos(vec3(0.,2.1,4.2)+a*2.);gl_FragColor=vec4(hue*1.8,ring*fragments*fade*.72);}`}));
      film.renderOrder=7;group.add(film);
      const droplets=new T.Points(particleGeometry,new T.ShaderMaterial({uniforms:common,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:`attribute float aSeed;uniform float uAge,uRadius;varying float vAlpha;
        void main(){vec3 p=position*uRadius*(1.+uAge*(3.8+aSeed*3.));p.y-=uAge*uAge*.7;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.8+aSeed*2.)*12./max(2.,-mv.z),1.,5.);vAlpha=pow(max(0.,1.-uAge/.65),1.8);}`,fragmentShader:`varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(1.,.91,.78,pow(max(0.,1.-d),2.)*vAlpha);}`}));
      droplets.renderOrder=7;group.add(droplets);bursts.push({group,film,common,start:-10});
    }
    let burstCursor=0;
    function pop(bubble,time,camera){
      bubble.popped=true;bubble.respawn=time+3.0+bubble.seed*3.0;bubble.object.visible=false;popCount++;
      const burst=bursts[burstCursor++%bursts.length];burst.start=time;burst.group.position.copy(bubble.object.position);burst.group.visible=true;
      burst.common.uAge.value=0;burst.common.uRadius.value=bubble.radius;burst.film.quaternion.copy(camera.quaternion);burst.film.scale.setScalar(bubble.radius*2.4);
      onPop?.({pan:bubble.object.position.clone().project(camera).x,depth:bubble.object.position.distanceTo(camera.position),radius:bubble.radius});
    }
    function hit(ndc,camera,time){
      if(!camera)return false;mouse.copy(ndc);lastCamera=camera;
      ray.setFromCamera(ndc,camera);
      const contacts=ray.intersectObjects(bubbles.filter(b=>!b.popped&&b.object.material.uniforms.uFade.value>.45).map(b=>b.object),false);
      if(!contacts.length)return false;
      const first=contacts[0];
      const blocked=ray.intersectObjects(occluder,true)[0];
      if(blocked&&blocked.distance<first.distance)return false;
      const bubble=bubbles.find(b=>b.object===first.object);if(!bubble)return false;pop(bubble,time,camera);return true;
    }
    return {
      root,hit,leave(){mouse.set(9,9);},
      update(time,dt,camera){
        lastCamera=camera||lastCamera;
        for(const b of bubbles){
          if(b.popped){if(time<b.respawn)continue;b.popped=false;b.born=time;b.base.y=.6;b.base.x=(seeded(time+b.seed*80)-.5)*10.5;b.object.visible=true;}
          const age=Math.max(0,time-b.born);
          b.object.position.set(b.base.x+Math.sin(time*.16+b.seed*40)*.33,(b.base.y+time*(.065+b.seed*.045))%10.5+.45,b.base.z+Math.sin(time*.12+b.seed*19)*.35);
          const breath=1+Math.sin(time*.7+b.seed*40)*.018;b.object.scale.set(b.radius*breath,b.radius/breath,b.radius);
          b.object.material.uniforms.uTime.value=time;b.object.material.uniforms.uFade.value=Math.min(1,age/1.3);
        }
        for(const burst of bursts){const age=time-burst.start;burst.common.uAge.value=age;burst.group.visible=age>=0&&age<.7;if(burst.group.visible){burst.film.scale.setScalar(burst.common.uRadius.value*(2.4+age*3.2));if(camera)burst.film.quaternion.copy(camera.quaternion);}}
        root.updateMatrixWorld(true);
        if(lastCamera&&Math.abs(mouse.x)<=1&&Math.abs(mouse.y)<=1&&time-lastHit>.045){lastHit=time;hit(mouse,lastCamera,time);}
      },
      stats(){
        const visible=[];
        if(lastCamera){lastCamera.updateMatrixWorld();for(const b of bubbles){
          if(b.popped||!b.object.visible)continue;
          const p=b.object.position.clone().project(lastCamera);const view=b.object.position.clone().applyMatrix4(lastCamera.matrixWorldInverse);
          if(view.z<-.8&&Math.abs(p.x)<.82&&Math.abs(p.y)<.8)visible.push({id:b.object.name,screen:[(p.x*.5+.5)*innerWidth,(-p.y*.5+.5)*innerHeight],radius:b.radius,depth:-view.z});
        }}
        return {count:bubbles.length,alive:bubbles.filter(b=>!b.popped).length,popCount,bursts:bursts.filter(b=>b.group.visible).length,visible};
      }
    };
  }
  return {create};
})();
