/* Cover orb — a noise-displaced sphere lit like the PDF's gold sphere.
 * three.js (WebGL) with a custom GLSL vertex/fragment pair, plus a plate-like
 * ring carrying the four stress-eating-loop nodes. three is imported
 * lazily, after the guards, so static mode, reduced motion and no-WebGL
 * visitors never download it. Renders only while the cover is on screen and
 * falls back to the CSS gradient sphere whenever anything is unavailable.
 */
const html = document.documentElement;
const host = document.querySelector('[data-cover-orb]');
const canvas = host && host.querySelector('[data-cover-canvas]');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fallback() { if (host) host.classList.remove('is-webgl'); }
function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

if (!host || !canvas || html.classList.contains('static') || reduced || !webglAvailable()) {
  fallback();
} else {
  const load = () => import('three').then(init).catch(fallback);
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 1500 }); else setTimeout(load, 150);
}

function init(THREE) {
  // The shader writes design-palette values straight to the framebuffer, so keep
  // three from converting the uniform colours to linear space.
  THREE.ColorManagement.enabled = false;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    renderer = null;
  }
  if (!renderer) {
    fallback();
  } else {
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // palette values pass through untouched

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.z = 5.9;

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const geometry = new THREE.IcosahedronGeometry(1.0, coarse ? 28 : 48);

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.045 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uCream: { value: new THREE.Color('#f2dcb6') },
      uGold: { value: new THREE.Color('#c6a77b') },
      uCocoa: { value: new THREE.Color('#6d4a32') },
      uEspresso: { value: new THREE.Color('#2c170e') },
    };

    const NOISE = /* glsl */`
      vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
      float snoise(vec3 v){
        const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
        vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
        vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
        vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
        i=mod289(i);
        vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
        float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
        vec4 j=p-49.0*floor(p*ns.z*ns.z);
        vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
        vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
        vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
        vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
        vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
        vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
        vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
        vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }`;

    const vertexShader = /* glsl */`
      uniform float uTime; uniform float uAmp; uniform vec2 uPointer;
      varying vec3 vNormal; varying vec3 vView; varying float vDisp;
      ${NOISE}
      float disp(vec3 p){
        float n = snoise(p * 0.9 + vec3(uTime * 0.12, uTime * 0.09, uTime * 0.05));
        float n2 = snoise(p * 2.2 - vec3(0.0, uTime * 0.16, 0.0)) * 0.12;
        float push = dot(normalize(p), normalize(vec3(uPointer.x, -uPointer.y, 0.6))) * 0.5;
        return (n + n2 + push * 0.18) * uAmp;
      }
      void main(){
        vec3 n = normalize(normal);
        vec3 t = normalize(cross(n, abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
        vec3 b = cross(n, t);
        float e = 0.025;
        vec3 p0 = position + n * disp(position);
        vec3 pt = position + t * e; pt += normalize(pt) * disp(pt);
        vec3 pb = position + b * e; pb += normalize(pb) * disp(pb);
        vec3 nn = normalize(cross(pt - p0, pb - p0));
        vDisp = disp(position);
        vec4 mv = modelViewMatrix * vec4(p0, 1.0);
        vView = -mv.xyz;
        vNormal = normalize(normalMatrix * nn);
        gl_Position = projectionMatrix * mv;
      }`;

    const fragmentShader = /* glsl */`
      precision highp float;
      uniform vec3 uCream; uniform vec3 uGold; uniform vec3 uCocoa; uniform vec3 uEspresso;
      varying vec3 vNormal; varying vec3 vView; varying float vDisp;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vView);
        vec3 L = normalize(vec3(-0.55, 0.75, 0.9));   // key light: upper left, like the PDF sphere
        vec3 L2 = normalize(vec3(0.8, -0.4, 0.3));    // faint warm fill from lower right
        float diff = max(dot(N, L), 0.0);
        float fill = max(dot(N, L2), 0.0) * 0.18;
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 48.0) * 0.45;
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
        float shade = smoothstep(0.0, 1.0, diff);
        vec3 col = mix(uEspresso, uCocoa, smoothstep(0.0, 0.35, shade));
        col = mix(col, uGold, smoothstep(0.25, 0.9, shade));
        col = mix(col, uCream, pow(diff, 3.0) * 0.55);
        col += uCream * spec;
        col += uGold * fill;
        col = mix(col, uGold * 0.9, fres * 0.35);
        col += vDisp * 0.6;                                   // ridges catch a little more light
        col += (hash(gl_FragCoord.xy) - 0.5) * 0.025;         // film grain
        gl_FragColor = vec4(col, 1.0);
      }`;

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    const orb = new THREE.Mesh(geometry, material);

    /* The system: the gold orb is the psyche; a thin plate-like ring carries the four
       stress-eating-loop nodes (same colours and order as the diagram), orbiting slowly. */
    const system = new THREE.Group();
    scene.add(system);
    system.add(orb);
    const tilt = new THREE.Group();
    tilt.rotation.set(1.08, 0, -0.42);
    system.add(tilt);
    const spin = new THREE.Group();
    tilt.add(spin);
    const RING_R = 1.55;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.007, 8, 240), new THREE.MeshBasicMaterial({ color: 0xd4b483, transparent: true, opacity: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    spin.add(ring);
    scene.add(new THREE.AmbientLight(0xf5ebda, 0.7));
    const key = new THREE.DirectionalLight(0xffe9c4, 1.4);
    key.position.set(-2.2, 3, 4);
    scene.add(key);
    const NODES = [['Stress', 0x3d2417], ['Craving', 0x16223e], ['Relief', 0x553b28], ['Guilt', 0xd4b483]];
    const nodeGeo = new THREE.SphereGeometry(0.11, 32, 24);
    const nodes = NODES.map(([name, color], i) => {
      const m = new THREE.Mesh(nodeGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.08 }));
      const a = i * Math.PI / 2;
      m.position.set(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R);
      spin.add(m);
      return m;
    });
    const labels = Array.from(host.querySelectorAll('[data-orb-label]'));
    const world = new THREE.Vector3();
    const view = new THREE.Vector3();

    // size to the host box
    let W = 1, H = 1;
    const resize = () => {
      const r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);

    // pointer → gentle tilt of the whole system + a soft push on the orb's surface
    const target = new THREE.Vector2(0, 0);
    window.addEventListener('pointermove', (e) => {
      target.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    }, { passive: true });

    const placeLabels = () => {
      camera.updateMatrixWorld();
      const orbDepth = orb.getWorldPosition(world).applyMatrix4(camera.matrixWorldInverse).z;
      nodes.forEach((node, i) => {
        const label = labels[i];
        if (!label) return;
        node.getWorldPosition(world);
        view.copy(world).applyMatrix4(camera.matrixWorldInverse);
        const behind = view.z < orbDepth - 0.15;
        world.project(camera);
        const x = (world.x * 0.5 + 0.5) * W;
        const y = (-world.y * 0.5 + 0.5) * H;
        const dx = world.x * (W / 2), dy = world.y * (H / 2);
        const occluded = behind && Math.hypot(dx, dy) < Math.min(W, H) * 0.19;
        label.style.transform = `translate(${x.toFixed(1)}px, ${(y - 22).toFixed(1)}px) translate(-50%, -50%)`;
        label.style.opacity = occluded ? '0' : behind ? '0.42' : '1';
      });
    };

    // render only while visible
    let visible = true;
    let lost = false;
    let dead = false;
    let raf = 0;
    let t = 0;
    let slowFrames = 0, sampled = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      raf = 0;
      if (!visible || document.hidden || lost || dead) return;
      const rawDt = clock.getDelta();
      // frame-budget guard: a software renderer that cannot hold ~20 fps would stall scrolling and focus
      if (sampled < 90) { sampled += 1; if (rawDt > 0.05) slowFrames += 1; if (sampled === 90 && slowFrames > 45) { dead = true; fallback(); return; } }
      const dt = Math.min(rawDt, 0.05);
      t += dt;
      uniforms.uTime.value = t;
      // a slow heartbeat: the surface tenses and settles like a craving building and easing
      const beat = Math.pow(Math.max(0, Math.sin(t * 1.15)), 6);
      uniforms.uAmp.value = 0.045 + 0.02 * beat;
      orb.scale.setScalar(1 + 0.014 * beat);
      uniforms.uPointer.value.lerp(target, 0.04);
      orb.rotation.y += dt * 0.06;
      system.rotation.y += ((target.x * 0.55) - system.rotation.y) * 0.03;
      system.rotation.x += ((target.y * 0.35) - system.rotation.x) * 0.03;
      spin.rotation.y -= dt * 0.17;
      renderer.render(scene, camera);
      placeLabels();
      if (!host.classList.contains('is-webgl')) host.classList.add('is-webgl');
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf && !dead) { clock.getDelta(); raf = requestAnimationFrame(tick); } };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(host);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      lost = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      fallback();
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => { lost = false; start(); });
    start();
  }
}
