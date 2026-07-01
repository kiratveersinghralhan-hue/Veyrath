(function () {
  'use strict';
  const KEYS = { products: 'veyrath_products_v3', site: 'veyrath_site_data_v3', inquiries: 'veyrath_inquiries_v3', newsletter: 'veyrath_newsletter_v3' };
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const read = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? clone(fallback); } catch (_) { return clone(fallback); } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const safeImage = (v = '') => /^(https?:\/\/|data:image\/|[a-z0-9_.-]+\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?)$/i.test(String(v).trim()) ? String(v).trim() : '';
  const safeLink = (v = '') => /^(https?:\/\/|[a-z0-9_.-]+\.html(?:[?#].*)?|#[a-z0-9_-]+)$/i.test(String(v).trim()) ? String(v).trim() : '';
  const split = (v) => Array.isArray(v) ? v : String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  let remoteProducts = null; let remoteSite = null; let supabaseClient = null;
  const products = () => (Array.isArray(remoteProducts) ? remoteProducts : read(KEYS.products, window.VEYRATH_PRODUCTS || [])).filter((p) => p && p.is_published !== false);
  const site = () => remoteSite || read(KEYS.site, window.VEYRATH_SITE_DATA || {});
  async function connectRemote() {
    const cfg = window.VEYRATH_SUPABASE || {}; if (!/^https:\/\//.test(cfg.url || '') || !cfg.anonKey || cfg.anonKey.includes('YOUR_')) return;
    if (!window.supabase) { try { await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); }); } catch (_) { return; } }
    try { supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey); const [catalogue, settings, slides] = await Promise.all([supabaseClient.from('products').select('*').eq('is_published', true).order('sort_order', { ascending: false }), supabaseClient.from('site_settings').select('value').eq('key', 'site_data').maybeSingle(), supabaseClient.from('hero_slides').select('*').eq('is_published', true).order('sort_order')]); if (!catalogue.error) remoteProducts = catalogue.data || []; const base = read(KEYS.site, window.VEYRATH_SITE_DATA || {}); remoteSite = settings.data?.value ? { ...base, ...settings.data.value } : base; if (!slides.error && slides.data?.length) remoteSite.banners = slides.data.map((s) => ({ id: s.id, image_url: s.image_url, eyebrow: s.eyebrow, heading: s.heading, text: s.body, align: s.align || 'left' })); } catch (_) { supabaseClient = null; }
  }

  function header() {
    const page = document.body.dataset.page || '';
    return `<a class="skip-link" href="#main">Skip to content</a><div class="announcement">Born After Dark <span>•</span> Made after order <span>•</span> Built in India</div><header class="site-header"><a class="brand" href="index.html" aria-label="VEYRATH home"><img src="logo.svg" alt="VEYRATH"><span>Born After Dark</span></a><button class="menu-button" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="siteNav"><span></span><span></span><span></span><b>Menu</b></button><nav class="site-nav" id="siteNav" aria-label="Main navigation"><p class="nav-kicker">VEYRATH / MENU</p><a ${page === 'home' ? 'aria-current="page"' : ''} href="index.html">Home</a><a ${page === 'shop' ? 'aria-current="page"' : ''} href="shop.html">Shop</a><a ${page === 'about' ? 'aria-current="page"' : ''} href="about.html">Our story</a><a ${page === 'support' ? 'aria-current="page"' : ''} href="support.html">Support</a><a href="faq.html">FAQ</a><a href="admin.html">Admin</a><a class="nav-accent" href="shop.html">Enter the drop <span>↗</span></a><small>Born After Dark / India</small></nav><button class="nav-scrim" type="button" aria-label="Close menu"></button></header>`;
  }

  function footer() {
    return `<footer class="site-footer"><div class="footer-lead"><p class="eyebrow">VEYRATH / 2026</p><h2>Move quiet.<br>Leave a signal.</h2></div><div class="footer-grid"><div><h3>Shop</h3><a href="shop.html?gender=Men">Men</a><a href="shop.html?gender=Women">Women</a><a href="shop.html?category=Accessories">Accessories</a><a href="shop.html?sort=newest">New arrivals</a></div><div><h3>About</h3><a href="about.html">Our story</a><a href="about.html#responsibility">Sustainability</a><a href="about.html#philosophy">Brand philosophy</a></div><div><h3>Customer care</h3><a href="faq.html#size">Size guide</a><a href="returns.html">Returns & exchanges</a><a href="shipping.html">Shipping info</a><a href="support.html#track">Track order</a><a href="faq.html">FAQ</a><a href="support.html">Support</a></div><form class="footer-newsletter newsletter-form"><h3>Join the Inner Circle</h3><p>Get early access to new drops and exclusive offers.</p><label><span class="sr-only">Email address</span><input name="email" type="email" autocomplete="email" placeholder="Email address" required><button aria-label="Join newsletter" type="submit">→</button></label><small class="form-message" aria-live="polite"></small></form></div><div class="footer-bottom"><strong>VEYRATH</strong><div><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="admin.html">Admin</a></div><span>© ${new Date().getFullYear()} VEYRATH</span></div></footer>`;
  }

  function chrome() {
    $('[data-site-header]')?.replaceChildren(document.createRange().createContextualFragment(header()));
    $('[data-site-footer]')?.replaceChildren(document.createRange().createContextualFragment(footer()));
    if (!$('#productModal')) document.body.insertAdjacentHTML('beforeend', `<dialog class="product-modal" id="productModal"><button class="modal-close" type="button" aria-label="Close product details">×</button><div id="productModalBody"></div></dialog><div class="toast" role="status" aria-live="polite"></div>`);
    const menu = $('.menu-button'); const nav = $('#siteNav'); const closeMenu = () => { nav.classList.remove('is-open'); menu?.setAttribute('aria-expanded', 'false'); menu?.setAttribute('aria-label', 'Open menu'); document.body.classList.remove('menu-open'); };
    menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') === 'true'; if (open) return closeMenu(); menu.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-label', 'Close menu'); nav.classList.add('is-open'); document.body.classList.add('menu-open'); });
    $('.nav-scrim')?.addEventListener('click', closeMenu); $$('.site-nav a').forEach((a) => a.addEventListener('click', closeMenu)); document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    let previousY = scrollY; let ticking = false; addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { const currentY = scrollY; $('.site-header')?.classList.toggle('is-hidden', currentY > previousY && currentY > 180 && !document.body.classList.contains('menu-open')); previousY = currentY; ticking = false; }); }, { passive: true });
  }

  function productCard(p) {
    const image = safeImage(p.image_url || p.front_image_url) || 'veyrath-tee.jpg';
    const tags = split(p.tags || p.style).slice(0, 2);
    const price = Number(p.sale_price || p.price || 0); const compare = Number(p.compare_at_price || p.compare_at || 0);
    const direct = safeLink(p.external_url || p.checkout_url || p.printrove_url);
    return `<article class="product-card reveal"><button class="product-media" type="button" data-product-view="${esc(p.id)}"><img src="${esc(image)}" alt="${esc(p.name)}" loading="lazy"><span class="product-state">${p.fulfilment_status === 'ready' ? 'Made after order' : 'Limited release'}</span><span class="quick-label">Quick view</span></button><div class="product-info"><div><p>${esc(p.category || 'VEYRATH')}</p><h3>${esc(p.name)}</h3></div><div class="price"><strong>${money(price)}</strong>${compare > price ? `<s>${money(compare)}</s>` : ''}</div>${tags.length ? `<ul>${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}<div class="product-actions"><button type="button" data-product-view="${esc(p.id)}">Details</button>${direct ? `<a href="${esc(direct)}" target="_blank" rel="noopener">Buy now ↗</a>` : `<a href="contact.html?product=${encodeURIComponent(p.name)}">Enquire</a>`}</div></div></article>`;
  }

  function emptyState() {
    return `<div class="empty-state"><span class="orbit-mark" aria-hidden="true"></span><p class="eyebrow">Drop in progress</p><h2>The next VEYRATH pieces are being prepared after dark.</h2><p>Join the Inner Circle to know when the signal goes live.</p><a class="btn btn-gold" href="#inner-circle">Join the circle</a></div>`;
  }

  function bindProducts(list) {
    $$('[data-product-view]').forEach((button) => button.addEventListener('click', () => openProduct(list.find((p) => String(p.id) === String(button.dataset.productView)))));
  }

  function openProduct(p) {
    if (!p) return;
    const modal = $('#productModal'); const image = safeImage(p.image_url || p.front_image_url) || 'veyrath-tee.jpg';
    const secondary = safeImage(p.back_design_url || p.back_image_url || p.front_design_url);
    const direct = safeLink(p.external_url || p.checkout_url || p.printrove_url);
    $('#productModalBody').innerHTML = `<div class="modal-grid"><div class="modal-images"><img src="${esc(image)}" alt="${esc(p.name)} front view">${secondary ? `<img src="${esc(secondary)}" alt="${esc(p.name)} alternate view" loading="lazy">` : ''}</div><div class="modal-copy"><p class="eyebrow">${esc(p.category || 'VEYRATH')}</p><h2>${esc(p.name)}</h2><div class="price price-large"><strong>${money(p.sale_price || p.price)}</strong>${Number(p.compare_at_price || 0) > Number(p.sale_price || p.price || 0) ? `<s>${money(p.compare_at_price)}</s>` : ''}</div><p>${esc(p.description || 'A VEYRATH piece shaped for silent movement.')}</p><dl><div><dt>Sizes</dt><dd>${esc(split(p.sizes).join(' / ') || 'Confirm on enquiry')}</dd></div><div><dt>Colours</dt><dd>${esc(split(p.colours).join(' / ') || 'After dark')}</dd></div><div><dt>Made</dt><dd>${esc(p.fulfilment_status || 'After order')}</dd></div></dl>${direct ? `<a class="btn btn-gold" href="${esc(direct)}" target="_blank" rel="noopener">Continue to product ↗</a>` : `<a class="btn btn-gold" href="contact.html?product=${encodeURIComponent(p.name)}">Enquire about this piece</a><small>Checkout is opening soon.</small>`}</div></div>`;
    modal.showModal();
  }

  function home() {
    const data = site(); const hero = data.hero || {};
    const heroEl = $('.hero'); if (heroEl) heroEl.style.setProperty('--hero-image', `url("${safeImage(hero.image_url) || 'veyrath-hero.jpg'}")`);
    $('[data-hero-eyebrow]').textContent = hero.eyebrow || 'VEYRATH / BORN AFTER DARK';
    $('[data-hero-heading]').textContent = hero.heading || 'Own every. silent. move.';
    $('[data-hero-subheading]').textContent = hero.subheading || '';
    const primary = $('[data-hero-primary]'); primary.textContent = hero.primary_label || 'Shop collection'; primary.href = safeLink(hero.primary_link) || 'shop.html';
    const secondary = $('[data-hero-secondary]'); secondary.textContent = hero.secondary_label || 'Join inner circle'; secondary.href = safeLink(hero.secondary_link) || '#inner-circle';
    const fallbackOffers = [{ kicker: 'FIRST SIGNAL', text: '10% OFF WITH CODE AFTERDARK10' }, { kicker: 'FREE SHIPPING', text: 'ON ORDERS ABOVE ₹1,999' }, { kicker: 'INNER CIRCLE', text: 'EARLY ACCESS TO EVERY DROP' }]; const offers = data.offers?.length ? data.offers : fallbackOffers; const offerSet = offers.map((o) => `<article><small>${esc(o.kicker || 'VEYRATH')}</small><strong>${esc(o.text || 'BORN AFTER DARK')}</strong><span>✦</span></article>`).join(''); $('[data-offer-rail]').innerHTML = `<div class="offer-set">${offerSet}</div><div class="offer-set" aria-hidden="true">${offerSet}</div>`;
    $('[data-category-intro]').textContent = data.category_intro || '';
    const categories = data.categories || [];
    $('[data-categories]').innerHTML = categories.map((c, i) => `<a class="category-card reveal" href="shop.html?category=${encodeURIComponent(c.query || c.name)}"><img src="${esc(safeImage(c.image) || 'veyrath-tee.jpg')}" alt="VEYRATH ${esc(c.name)} category placeholder" loading="${i < 2 ? 'eager' : 'lazy'}"><span><small>0${i + 1}</small><strong>${esc(c.name)}</strong><em>${esc(c.note || '')}</em></span></a>`).join('');
    $('[data-about-text]').textContent = data.about_text || '';
    const list = products().filter((p) => p.is_featured).slice(0, 4);
    $('[data-featured-products]').innerHTML = list.length ? list.map(productCard).join('') : emptyState(); bindProducts(list);
    setupCarousel(data.banners || []);
  }

  function setupCarousel(banners) {
    const host = $('[data-banners]'); if (!host) return; if (!banners.length) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="campaign-track">${banners.map((b, i) => `<article class="campaign-slide campaign-slide--${esc(b.align || 'left')}" data-slide="${i}" aria-hidden="${i ? 'true' : 'false'}" style="--campaign:url('${esc(safeImage(b.image_url) || 'veyrath-hero.jpg')}')"><div class="campaign-copy"><p class="eyebrow">${esc(b.eyebrow || '')}</p><h2>${esc(b.heading || '')}</h2><p>${esc(b.text || '')}</p><a class="btn btn-ghost" href="shop.html">Explore the collection</a></div><span class="campaign-number">${String(i + 1).padStart(2, '0')} / ${String(banners.length).padStart(2, '0')}</span></article>`).join('')}</div><div class="carousel-ui"><div class="carousel-dots">${banners.map((_, i) => `<button type="button" data-carousel-dot="${i}" aria-label="Show campaign ${i + 1}" aria-current="${i === 0 ? 'true' : 'false'}"><span></span></button>`).join('')}</div><div class="carousel-progress"><span></span></div><div class="carousel-arrows"><button type="button" data-carousel-prev aria-label="Previous campaign">←</button><button type="button" data-carousel-next aria-label="Next campaign">→</button></div></div>`;
    const track = $('.campaign-track', host); const slides = $$('.campaign-slide', host); const dots = $$('[data-carousel-dot]', host); let current = 0; let timer = null; let startX = 0; const reduced = false;
    const move = (next, user = false) => { current = (next + slides.length) % slides.length; track.style.transform = `translate3d(-${current * 100}%,0,0)`; slides.forEach((s, i) => s.setAttribute('aria-hidden', String(i !== current))); dots.forEach((d, i) => d.setAttribute('aria-current', String(i === current))); const progress = $('.carousel-progress span', host); progress.classList.remove('is-running'); void progress.offsetWidth; if (!reduced) progress.classList.add('is-running'); if (user) restart(); };
    const stop = () => { clearInterval(timer); timer = null; host.classList.add('is-paused'); }; const start = () => { if (reduced || timer || slides.length < 2) return; host.classList.remove('is-paused'); timer = setInterval(() => move(current + 1), 5600); }; const restart = () => { stop(); start(); };
    $('[data-carousel-prev]', host).addEventListener('click', () => move(current - 1, true)); $('[data-carousel-next]', host).addEventListener('click', () => move(current + 1, true)); dots.forEach((d) => d.addEventListener('click', () => move(Number(d.dataset.carouselDot), true))); host.addEventListener('mouseenter', stop); host.addEventListener('mouseleave', start); host.addEventListener('focusin', stop); host.addEventListener('focusout', start); host.addEventListener('pointerdown', (e) => { startX = e.clientX; }); host.addEventListener('pointerup', (e) => { const delta = e.clientX - startX; if (Math.abs(delta) > 50) move(current + (delta < 0 ? 1 : -1), true); }); document.addEventListener('visibilitychange', () => document.hidden ? stop() : start()); move(0); start();
  }

  function optionValues(list, key) { return [...new Set(list.flatMap((p) => split(p[key])).filter(Boolean))].sort(); }
  function fillSelect(id, values) { const el = $(id); if (!el) return; values.forEach((v) => el.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`)); }
  function shop() {
    const all = products(); const form = $('#catalogueFilters'); const grid = $('#productGrid');
    fillSelect('#filterCategory', optionValues(all, 'category')); fillSelect('#filterGender', optionValues(all, 'gender')); fillSelect('#filterSize', optionValues(all, 'sizes')); fillSelect('#filterColour', optionValues(all, 'colours')); fillSelect('#filterStyle', optionValues(all, 'style').concat(optionValues(all, 'tags')));
    const maxPrice = Math.max(1000, ...all.map((p) => Number(p.sale_price || p.price || 0))); $('#filterPrice').max = String(Math.ceil(maxPrice / 500) * 500); $('#filterPrice').value = $('#filterPrice').max; $('#priceLabel').textContent = money($('#filterPrice').value);
    const params = new URLSearchParams(location.search); ['category', 'gender', 'sort'].forEach((key) => { const target = $(`#filter${key[0].toUpperCase()}${key.slice(1)}`); if (target && params.get(key)) target.value = params.get(key); });
    function render() {
      const f = Object.fromEntries(new FormData(form)); const ceiling = Number($('#filterPrice').value); $('#priceLabel').textContent = money(ceiling);
      let list = all.filter((p) => { const haystack = [p.name, p.description, p.category, p.gender, ...split(p.tags), ...split(p.style)].join(' ').toLowerCase(); const price = Number(p.sale_price || p.price || 0); return (!f.search || haystack.includes(f.search.toLowerCase())) && (!f.category || p.category === f.category) && (!f.gender || p.gender === f.gender || p.gender === 'Unisex') && (!f.size || split(p.sizes).includes(f.size)) && (!f.colour || split(p.colours).includes(f.colour)) && (!f.style || split(p.style).concat(split(p.tags)).includes(f.style)) && (!f.rating || Number(p.rating || 0) >= Number(f.rating)) && price <= ceiling; });
      if (f.sort === 'price-low') list.sort((a, b) => Number(a.sale_price || a.price) - Number(b.sale_price || b.price)); else if (f.sort === 'price-high') list.sort((a, b) => Number(b.sale_price || b.price) - Number(a.sale_price || a.price)); else if (f.sort === 'rating') list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)); else list.sort((a, b) => Number(b.sort_order || 0) - Number(a.sort_order || 0));
      $('#resultCount').textContent = `${list.length} ${list.length === 1 ? 'piece' : 'pieces'}`; grid.innerHTML = list.length ? list.map(productCard).join('') : emptyState(); bindProducts(list); reveal();
    }
    form.addEventListener('input', render); form.addEventListener('change', render); $('#clearFilters').addEventListener('click', () => { form.reset(); $('#filterPrice').value = $('#filterPrice').max; render(); }); render();
  }

  function forms() {
    $$('.newsletter-form').forEach((form) => form.addEventListener('submit', async (event) => { event.preventDefault(); const email = new FormData(form).get('email').trim().toLowerCase(); try { if (supabaseClient) { const { error } = await supabaseClient.from('newsletter_signups').insert({ email, source: location.pathname || 'website' }); if (error && error.code !== '23505') throw error; } else { const entries = read(KEYS.newsletter, []); if (!entries.some((x) => x.email === email)) { entries.unshift({ id: crypto.randomUUID(), email, created_at: new Date().toISOString() }); write(KEYS.newsletter, entries); } } form.reset(); $('.form-message', form).textContent = 'You are inside the circle.'; toast('Welcome to the Inner Circle.'); } catch (_) { $('.form-message', form).textContent = 'Could not join right now. Please try again.'; } }));
    $('#contactForm')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const payload = Object.fromEntries(new FormData(form)); try { if (supabaseClient) { const { error } = await supabaseClient.from('inquiries').insert(payload); if (error) throw error; } else { const list = read(KEYS.inquiries, []); list.unshift({ id: crypto.randomUUID(), ...payload, status: 'new', created_at: new Date().toISOString() }); write(KEYS.inquiries, list); } form.reset(); $('.form-message', form).textContent = 'Signal received. We will reply soon.'; toast('Your message reached VEYRATH.'); } catch (_) { $('.form-message', form).textContent = 'Message could not be sent. Please try again.'; } });
    const queryProduct = new URLSearchParams(location.search).get('product'); if (queryProduct && $('#contactProduct')) $('#contactProduct').value = queryProduct;
  }

  function toast(message) { const el = $('.toast'); if (!el) return; el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2800); }
  function reveal() { const candidates = $$('.reveal,.section-head,.value-card,.support-card,.prose>*,.footer-grid>*,.product-card'); candidates.forEach((el, i) => { el.classList.add('reveal'); if (!el.dataset.reveal) el.dataset.reveal = i % 3 === 0 ? 'left' : i % 3 === 1 ? 'up' : 'right'; }); if (!('IntersectionObserver' in window)) return candidates.forEach((el) => el.classList.add('is-visible')); const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-visible', e.isIntersecting)), { threshold: .1, rootMargin: '-4% 0px -4%' }); candidates.forEach((el) => io.observe(el)); }
  function intro() { if (document.body.dataset.page !== 'home') return; document.body.classList.add('intro-lock'); document.body.insertAdjacentHTML('afterbegin', `<div class="luxury-intro" role="presentation"><button class="intro-skip" type="button">Skip intro</button><div class="intro-lines" aria-hidden="true"><i></i><i></i></div><div class="luxury-mark" aria-hidden="true"><div class="luxury-orbit"><i></i><i></i><i></i></div><div class="intro-word"><span>V</span><span>E</span><span>Y</span><span>R</span><span>A</span><span>T</span><span>H</span></div><small>Born After Dark</small></div><div class="intro-curtain intro-curtain-left"></div><div class="intro-curtain intro-curtain-right"></div></div>`); const el = $('.luxury-intro'); const finish = () => { if (!el || el.classList.contains('is-leaving')) return; el.classList.add('is-leaving'); document.body.classList.remove('intro-lock'); setTimeout(() => el.remove(), 1450); }; requestAnimationFrame(() => el.classList.add('is-ready')); $('.intro-skip', el).addEventListener('click', finish); setTimeout(finish, 2850); }
  function schema() { const s = document.createElement('script'); const base = location.origin + location.pathname.replace(/[^/]+$/, ''); s.type = 'application/ld+json'; s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', '@id': `${base}#organization`, name: 'VEYRATH', url: base, logo: new URL('logo.svg', location.href).href, slogan: 'Born After Dark', description: 'Premium Indian oversized streetwear with astrology-coded minimal design.' }, { '@type': 'WebSite', '@id': `${base}#website`, name: 'VEYRATH', url: base, publisher: { '@id': `${base}#organization` }, inLanguage: 'en-IN' }] }); document.head.appendChild(s); }
  async function init() { intro(); chrome(); await connectRemote(); const page = document.body.dataset.page; if (page === 'home') home(); if (page === 'shop') shop(); forms(); reveal(); schema(); $('.modal-close')?.addEventListener('click', () => $('#productModal').close()); $('#productModal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }); }
  window.VeyrathStore = { KEYS, read, write, products, site };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
