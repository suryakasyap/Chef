/* Plates & Psyche — scroll choreography.
 * GSAP + ScrollTrigger + SplitText drive every reveal; Lenis smooths the
 * scroll. Everything degrades: no GSAP, reduced motion, or ?static → the
 * page is simply visible and the light-weight fallbacks below run instead.
 */
(() => {
  const html = document.documentElement;
  const isStatic = html.classList.contains('static');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger && window.SplitText);
  const motion = hasGsap && !reduced && !isStatic;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const CIRC = 2 * Math.PI * 48;

  /* ---------- shared: donut geometry + loop arrows (both modes) ---------- */
  function donutFinal() {
    let offset = 0;
    return $$('[data-donut-seg]').map((seg) => {
      const len = (Number(seg.dataset.share) / 100) * CIRC;
      const s = { seg, len, offset };
      seg.setAttribute('stroke-dasharray', `${len} ${CIRC}`);
      seg.setAttribute('stroke-dashoffset', String(-offset));
      offset += len;
      return s;
    });
  }

  /* ------------------------------ fallback ------------------------------ */
  if (!motion) {
    html.classList.remove('motion');
    donutFinal();
    const topbar = $('[data-topbar]');
    const label = $('[data-chapter-label]');
    const progress = $('[data-progress]');
    const cover = $('[data-cover]');
    const sections = $$('[data-chapter]');
    const onScroll = () => {
      const y = window.scrollY;
      if (cover && topbar) topbar.classList.toggle('is-visible', y > cover.offsetHeight - 80);
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      }
      if (label) {
        const mid = window.innerHeight * 0.45;
        let current = sections[0];
        for (const s of sections) if (s.getBoundingClientRect().top <= mid) current = s;
        const text = current?.dataset.chapter || '';
        if (label.textContent !== text) label.textContent = text;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return;
  }

  /* ------------------------------- motion ------------------------------- */
  html.classList.add('motion-ready');
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: 'power3.out' });

  // Smooth scroll (desktop pointer devices only; touch keeps native scrolling)
  let lenis = null;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (window.Lenis && finePointer) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -48, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: 'smooth' });
    history.pushState(null, '', id);
  });

  const fontsReady = Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  const once = (trigger, start = 'top 85%') => ({ trigger, start, once: true });

  function initCover() {
    const cover = $('[data-cover]');
    const title = $('[data-cover-title]');
    if (!cover || !title) return;
    const fades = $$('[data-cover-fade]');
    gsap.set(fades, { opacity: 0, y: 26 });
    const tl = gsap.timeline({ delay: 0.15 });
    SplitText.create(title, {
      type: 'lines,chars', mask: 'lines', linesClass: 'line', charsClass: 'char',
      onSplit(self) {
        gsap.set(self.chars, { yPercent: 115, rotate: 4 });
        gsap.set(title, { opacity: 1 });
        return gsap.to(self.chars, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'power4.out', stagger: 0.03 });
      },
    });
    tl.to(fades, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0.55);

    // parallax: text drifts up, orb sinks and fades as the cover scrolls away
    gsap.to('.cover__inner', { yPercent: -10, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('[data-cover-orb]', { yPercent: 28, opacity: 0, ease: 'none', scrollTrigger: { trigger: cover, start: 'top top', end: '80% top', scrub: true } });
  }

  function initTopbar() {
    const topbar = $('[data-topbar]');
    const label = $('[data-chapter-label]');
    const cover = $('[data-cover]');
    if (topbar && cover) {
      ScrollTrigger.create({
        trigger: cover, start: 'bottom top+=90',
        onEnter: () => topbar.classList.add('is-visible'),
        onLeaveBack: () => topbar.classList.remove('is-visible'),
      });
    }
    gsap.to('[data-progress]', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '#magazine', start: 'top top', end: 'bottom bottom', scrub: 0.4 } });
    if (label) {
      let current = label.textContent;
      const setChapter = (text) => {
        if (text === current) return;
        current = text;
        gsap.timeline()
          .to(label, { y: -8, opacity: 0, duration: 0.22, ease: 'power2.in' })
          .add(() => { label.textContent = text; })
          .fromTo(label, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 });
      };
      $$('[data-chapter]').forEach((s) => {
        ScrollTrigger.create({
          trigger: s, start: 'top 45%', end: 'bottom 45%',
          onEnter: () => setChapter(s.dataset.chapter), onEnterBack: () => setChapter(s.dataset.chapter),
        });
      });
    }
  }

  function initHeadlines() {
    $$('[data-reveal="lines"]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true,
        onSplit(self) {
          if (el.dataset.revealed) { gsap.set(el, { opacity: 1 }); return; }
          gsap.set(self.lines, { yPercent: 110 });
          gsap.set(el, { opacity: 1 });
          return gsap.to(self.lines, {
            yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.085,
            scrollTrigger: once(el, 'top 88%'), onStart: () => { el.dataset.revealed = '1'; },
          });
        },
      });
    });
  }

  function initReveals() {
    $$('[data-reveal="up"]').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1, scrollTrigger: once(el, 'top 90%') });
    });
    $$('[data-reveal="quote"]').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 1.2, scrollTrigger: once(el) });
    });
    $$('[data-reveal="banner"]').forEach((el) => {
      const mark = $('.banner__mark', el);
      const tl = gsap.timeline({ scrollTrigger: once(el, 'top 82%') });
      tl.fromTo(el, { opacity: 0, scale: 0.97, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: 'power4.out' });
      if (mark) tl.fromTo(mark, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(2)' }, 0.25);
    });
    const staggered = (selector, fromVars, toVars) => {
      $$(selector).forEach((container) => {
        const kids = Array.from(container.children);
        gsap.set(kids, fromVars);
        gsap.set(container, { opacity: 1 });
        gsap.to(kids, { ...toVars, scrollTrigger: once(container, 'top 88%') });
      });
    };
    staggered('[data-reveal="stagger"]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.95, stagger: 0.08 });
    staggered('[data-reveal="pills"]', { opacity: 0, scale: 0.7, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'back.out(1.8)' });
    staggered('[data-reveal="cards"]', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 1, stagger: 0.12 });
    $$('[data-compare]').forEach((el) => {
      const tl = gsap.timeline({ scrollTrigger: once(el) });
      tl.fromTo('[data-compare-left]', { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 1 }, 0)
        .fromTo('[data-compare-right]', { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 1 }, 0.1);
    });
  }

  function initFigures() {
    $$('[data-reveal-img]').forEach((fig) => {
      const frame = $('.figure__frame', fig);
      const img = $('img', fig);
      if (!frame || !img) return;
      gsap.set(img, { scale: 1.25 });
      const tl = gsap.timeline({ scrollTrigger: once(fig, 'top 82%') });
      tl.to(frame, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.out' }, 0)
        .to(img, { scale: 1.1, duration: 1.6, ease: 'expo.out' }, 0);
      // slow parallax inside the frame; 1.1 scale keeps edges covered
      gsap.fromTo(img, { yPercent: -4.5 }, { yPercent: 4.5, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  function initLoop() {
    const loop = $('[data-loop]');
    if (!loop) return;
    const arcs = $$('[data-loop-arc]', loop);
    const nodes = $$('[data-loop-node]', loop);
    const ring = $('[data-loop-ring]', loop);
    const caption = $('.loop__caption', loop);
    arcs.forEach((p) => {
      const len = p.getTotalLength();
      p.dataset.marker = p.getAttribute('marker-end');
      p.removeAttribute('marker-end');
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
    });
    gsap.set(nodes, { scale: 0, opacity: 1, transformOrigin: '50% 50%' });
    const tl = gsap.timeline({ scrollTrigger: once(loop, 'top 72%') });
    if (ring) tl.fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0);
    nodes.forEach((node, i) => {
      const at = i * 0.55;
      tl.to(node, { scale: 1, duration: 0.6, ease: 'back.out(1.8)' }, at);
      const arc = arcs[i];
      if (arc) tl.to(arc, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut', onComplete: () => arc.setAttribute('marker-end', arc.dataset.marker) }, at + 0.3);
    });
    if (caption) tl.fromTo(caption, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9 }, '-=0.2');
  }

  function initCharts() {
    const bars = $('[data-chart="bars"]');
    if (bars) {
      const fills = $$('[data-bar-fill]', bars);
      const vals = $$('[data-bar-val]', bars);
      const tl = gsap.timeline({ scrollTrigger: once(bars, 'top 75%') });
      tl.to(fills, { scaleY: 1, duration: 1.1, ease: 'expo.out', stagger: 0.09 }, 0);
      vals.forEach((v, i) => {
        const n = { x: 0 };
        const target = Number(v.dataset.barVal);
        tl.to(v, { opacity: 1, duration: 0.4 }, 0.15 + i * 0.09);
        tl.to(n, { x: target, duration: 1, ease: 'power2.out', snap: { x: 1 }, onUpdate: () => { v.textContent = `${n.x}%`; } }, 0.15 + i * 0.09);
      });
    }
    const donut = $('[data-chart="donut"]');
    if (donut) {
      const segs = donutFinal();
      const tl = gsap.timeline({ scrollTrigger: once(donut, 'top 75%') });
      segs.forEach(({ seg, len }, i) => {
        tl.fromTo(seg, { strokeDasharray: `0 ${CIRC}` }, { strokeDasharray: `${len} ${CIRC}`, duration: 0.9, ease: 'power2.inOut' }, i * 0.45);
      });
    }
    $$('[data-count]').forEach((el) => {
      const target = Number(el.dataset.count);
      const n = { x: 0 };
      gsap.to(n, { x: target, duration: 1.8, ease: 'power3.out', snap: { x: 1 }, scrollTrigger: once(el, 'top 85%'), onUpdate: () => { el.textContent = n.x.toLocaleString('en-US'); } });
    });
  }

  function initTheme() {
    const dark = $('[data-theme="dark"]');
    if (!dark) return;
    ScrollTrigger.create({
      trigger: dark, start: 'top 60%', end: 'bottom 40%',
      onEnter: () => html.classList.add('theme-dark'),
      onEnterBack: () => html.classList.add('theme-dark'),
      onLeave: () => html.classList.remove('theme-dark'),
      onLeaveBack: () => html.classList.remove('theme-dark'),
    });
  }

  fontsReady.then(() => {
    initCover();
    initTopbar();
    initHeadlines();
    initReveals();
    initFigures();
    initLoop();
    initCharts();
    initTheme();
    ScrollTrigger.refresh();
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
