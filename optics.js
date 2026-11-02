/* Hall HDR glow and a shared, softly feathered day/night lens for the zodiac worlds. */
window.CloudOptics = (() => {
  'use strict';
  const T=THREE;
  const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const daylightGLSL=`uniform vec2 uDayCenter,uDayViewport;uniform float uDayRadius,uDayStrength;
    float cloudDayAmount(vec2 uv){vec2 p=(uv-uDayCenter)*uDayViewport/min(uDayViewport.x,uDayViewport.y);return (1.-smoothstep(uDayRadius*.62,uDayRadius*1.37,length(p)))*uDayStrength;}`;
  function create(){
    const full=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});
    const smallA=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}),smallB=smallA.clone();
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),plane=new T.Mesh(new T.PlaneGeometry(2,2));scene.add(plane);
    const bright=new T.ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,uniforms:{uImage:{value:full.texture}},vertexShader:vertex,fragmentShader:'varying vec2 vUv;uniform sampler2D uImage;void main(){vec3 c=texture2D(uImage,vUv).rgb;float l=max(max(c.r,c.g),c.b);gl_FragColor=vec4(c*smoothstep(.8,2.1,l),1.);}'});
    const blur=new T.ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,uniforms:{uImage:{value:null},uStep:{value:new T.Vector2()}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D uImage;uniform vec2 uStep;void main(){vec3 c=texture2D(uImage,vUv).rgb*.227027;c+=(texture2D(uImage,vUv+uStep*1.384615).rgb+texture2D(uImage,vUv-uStep*1.384615).rgb)*.316216;c+=(texture2D(uImage,vUv+uStep*3.230769).rgb+texture2D(uImage,vUv-uStep*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`});
    const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uImage:{value:full.texture},uBloom:{value:smallA.texture},uTime:{value:0}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D uImage,uBloom;uniform float uTime;
      void main(){vec3 c=texture2D(uImage,vUv).rgb+texture2D(uBloom,vUv).rgb*.14;c*=vec3(1.035,1.,1.015);float v=1.-smoothstep(.34,.92,length((vUv-.5)*vec2(.85,1.)));c*=.94+.06*v;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    let w=1,h=1;
    function pass(renderer,material,target){plane.material=material;renderer.setRenderTarget(target);renderer.render(scene,camera);}
    return {
      resize(width,height){w=Math.max(1,Math.round(width/4));h=Math.max(1,Math.round(height/4));full.setSize(width,height);smallA.setSize(w,h);smallB.setSize(w,h);},
      render(renderer,source,view){
        const previous=renderer.getRenderTarget();renderer.setRenderTarget(full);renderer.render(source,view);
        pass(renderer,bright,smallA);
        blur.uniforms.uImage.value=smallA.texture;blur.uniforms.uStep.value.set(1.9/w,0);pass(renderer,blur,smallB);
        blur.uniforms.uImage.value=smallB.texture;blur.uniforms.uStep.value.set(0,1.9/h);pass(renderer,blur,smallA);
        pass(renderer,composite,previous);
      }
    };
  }
  function createDaylight({reducedMotion=false}={}){
    const full=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});
    const mask={uDayCenter:{value:new T.Vector2(.5,.5)},uDayViewport:{value:new T.Vector2(1,1)},uDayRadius:{value:.28},uDayStrength:{value:0}};
    const uniforms={...mask,uImage:{value:full.texture},uTime:{value:0},uNightTint:{value:new T.Color()},uDayLift:{value:0}};
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    const material=new T.ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,uniforms,vertexShader:vertex,fragmentShader:`
      varying vec2 vUv;uniform sampler2D uImage;uniform vec3 uNightTint;uniform float uTime,uDayLift;${daylightGLSL}
      void main(){
        vec3 source=max(texture2D(uImage,vUv).rgb,vec3(0.));float luminance=dot(source,vec3(.2126,.7152,.0722));
        vec3 day=pow(source,vec3(.90))*vec3(1.055,1.018,.97)+vec3(.020,.017,.012)*uDayLift;
        vec3 night=mix(source*vec3(.12,.19,.38),vec3(luminance)*uNightTint,.34)+vec3(.0018,.0035,.009);
        night+=max(source-vec3(.65),vec3(0.))*vec3(.035,.055,.085);
        float daylight=cloudDayAmount(vUv);vec3 c=mix(night,day,daylight);
        float distanceToLight=length((vUv-uDayCenter)*uDayViewport/min(uDayViewport.x,uDayViewport.y));
        float penumbra=exp(-pow((distanceToLight-uDayRadius*.99)/(uDayRadius*.26),2.))*uDayStrength;
        c+=vec3(.008,.005,.0025)*penumbra;
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`});
    const plane=new T.Mesh(new T.PlaneGeometry(2,2),material);scene.add(plane);
    let index=-1;const target=new T.Vector2();
    return {
      mask,
      resize(width,height){full.setSize(width,height);mask.uDayViewport.value.set(width,height);},
      reset(sceneIndex,ndc){
        index=sceneIndex;mask.uDayCenter.value.set(ndc.x*.5+.5,ndc.y*.5+.5);mask.uDayStrength.value=0;
        const tints=['#677dba','#677ca0','#647faa','#7083bb','#8776a2','#707fa4','#7b72a4','#66669c','#6b7eaf','#6e84ad','#5e8aa6','#7a70b0'];
        // Grading coefficients are linear gains, not display colors.
        const tint=new T.Color(tints[index]);uniforms.uNightTint.value.setRGB(.10+tint.r*.20,.14+tint.g*.20,.29+tint.b*.20);
        uniforms.uDayLift.value=[1,3,11].includes(index)?1:0;
      },
      render(renderer,source,view,ndc,active,time,dt){
        const follow=reducedMotion?1:1-Math.exp(-dt*13);mask.uDayCenter.value.lerp(target.set(ndc.x*.5+.5,ndc.y*.5+.5),follow);
        mask.uDayStrength.value=T.MathUtils.damp(mask.uDayStrength.value,active?1:0,active?6:3,dt);
        mask.uDayRadius.value=.28*(reducedMotion?1:1+.012*Math.sin(time*.46));uniforms.uTime.value=time;
        const previous=renderer.getRenderTarget();renderer.setRenderTarget(full);renderer.render(source,view);
        renderer.setRenderTarget(previous);renderer.render(scene,camera);
      },
      stats(){return {index,center:mask.uDayCenter.value.toArray(),radius:mask.uDayRadius.value,strength:mask.uDayStrength.value,viewport:mask.uDayViewport.value.toArray(),innerRadius:mask.uDayRadius.value*.62,outerRadius:mask.uDayRadius.value*1.37};}
    };
  }
  return {create,createDaylight,daylightGLSL};
})();
