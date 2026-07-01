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
  const products = () => read(KEYS.products, window.VEYRATH_PRODUCTS || []).filter((p) => p && p.is_published !== false);
  const site = () => read(KEYS.site, window.VEYRATH_SITE_DATA || {});

  function header() {
    const page = document.body.dataset.page || '';
    return `<a class="skip-link" href="#main">Skip to content</a><div class="announcement">Born After Dark <span>•</span> Made after order <span>•</span> Built in India</div><header class="site-header"><a class="brand" href="index.html" aria-label="VEYRATH home"><img src="logo.svg" alt="VEYRATH"><span>Born After Dark</span></a><button class="menu-button" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="siteNav"><span></span><span></span><span></span><b>Menu</b></button><nav class="site-nav" id="siteNav" aria-label="Main navigation"><a ${page === 'home' ? 'aria-current="page"' : ''} href="index.html">Home</a><a ${page === 'shop' ? 'aria-current="page"' : ''} href="shop.html">Shop</a><a ${page === 'about' ? 'aria-current="page"' : ''} href="about.html">Our story</a><a ${page === 'support' ? 'aria-current="page"' : ''} href="support.html">Support</a><a class="nav-accent" href="shop.html">Enter the drop <span>↗</span></a></nav></header>`;
  }

  function footer() {
    return `<footer class="site-footer"><div class="footer-lead"><p class="eyebrow">VEYRATH / 2026</p><h2>Move quiet.<br>Leave a signal.</h2></div><div class="footer-grid"><div><h3>Shop</h3><a href="shop.html?gender=Men">Men</a><a href="shop.html?gender=Women">Women</a><a href="shop.html?category=Accessories">Accessories</a><a href="shop.html?sort=newest">New arrivals</a></div><div><h3>About</h3><a href="about.html">Our story</a><a href="about.html#responsibility">Sustainability</a><a href="about.html#philosophy">Brand philosophy</a></div><div><h3>Customer care</h3><a href="faq.html#size">Size guide</a><a href="returns.html">Returns & exchanges</a><a href="shipping.html">Shipping info</a><a href="support.html#track">Track order</a><a href="faq.html">FAQ</a><a href="support.html">Support</a></div><form class="footer-newsletter newsletter-form"><h3>Join the Inner Circle</h3><p>Get early access to new drops and exclusive offers.</p><label><span class="sr-only">Email address</span><input name="email" type="email" autocomplete="email" placeholder="Email address" required><button aria-label="Join newsletter" type="submit">→</button></label><small class="form-message" aria-live="polite"></small></form></div><div class="footer-bottom"><strong>VEYRATH</strong><div><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="admin.html">Admin</a></div><span>© ${new Date().getFullYear()} VEYRATH</span></div></footer>`;
  }

  function chrome() {
    $('[data-site-header]')?.replaceChildren(document.createRange().createContextualFragment(header()));
    $('[data-site-footer]')?.replaceChildren(document.createRange().createContextualFragment(footer()));
    if (!$('#productModal')) document.body.insertAdjacentHTML('beforeend', `<dialog class="product-modal" id="productModal"><button class="modal-close" type="button" aria-label="Close product details">×</button><div id="productModalBody"></div></dialog><div class="toast" role="status" aria-live="polite"></div>`);
    const menu = $('.menu-button'); const nav = $('#siteNav');
    menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') === 'true'; menu.setAttribute('aria-expanded', String(!open)); menu.setAttribute('aria-label', open ? 'Open menu' : 'Close menu'); nav.classList.toggle('is-open', !open); document.body.classList.toggle('menu-open', !open); });
    $$('.site-nav a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('is-open'); menu?.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open'); }));
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
    $('[data-marquee]').innerHTML = `<span>${esc(data.marquee_text || '')}</span><span aria-hidden="true">${esc(data.marquee_text || '')}</span>`;
    $('[data-category-intro]').textContent = data.category_intro || '';
    const categories = data.categories || [];
    $('[data-categories]').innerHTML = categories.map((c, i) => `<a class="category-card reveal" href="shop.html?category=${encodeURIComponent(c.query || c.name)}"><img src="${esc(safeImage(c.image) || 'veyrath-tee.jpg')}" alt="VEYRATH ${esc(c.name)} category placeholder" loading="${i < 2 ? 'eager' : 'lazy'}"><span><small>0${i + 1}</small><strong>${esc(c.name)}</strong><em>${esc(c.note || '')}</em></span></a>`).join('');
    $('[data-about-text]').textContent = data.about_text || '';
    const list = products().filter((p) => p.is_featured).slice(0, 4);
    $('[data-featured-products]').innerHTML = list.length ? list.map(productCard).join('') : emptyState(); bindProducts(list);
    const banners = data.banners || [];
    $('[data-banners]').innerHTML = banners.map((b, i) => `<article class="campaign-slide ${i === 0 ? 'is-active' : ''}" data-banner-index="${i}" style="--campaign:url('${esc(safeImage(b.image_url) || 'veyrath-hero.jpg')}')"><div><p class="eyebrow">${esc(b.eyebrow || '')}</p><h2>${esc(b.heading || '')}</h2><p>${esc(b.text || '')}</p><a class="text-link" href="shop.html">Explore the collection →</a></div></article>`).join('');
    if (banners.length > 1) { let current = 0; const advance = () => { const slides = $$('.campaign-slide'); slides[current]?.classList.remove('is-active'); current = (current + 1) % slides.length; slides[current]?.classList.add('is-active'); }; if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(advance, 6500); }
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
    $$('.newsletter-form').forEach((form) => form.addEventListener('submit', (event) => { event.preventDefault(); const email = new FormData(form).get('email').trim().toLowerCase(); const entries = read(KEYS.newsletter, []); if (!entries.some((x) => x.email === email)) { entries.unshift({ id: crypto.randomUUID(), email, created_at: new Date().toISOString() }); write(KEYS.newsletter, entries); } form.reset(); $('.form-message', form).textContent = 'You are inside the circle.'; toast('Welcome to the Inner Circle.'); }));
    $('#contactForm')?.addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; const payload = Object.fromEntries(new FormData(form)); const list = read(KEYS.inquiries, []); list.unshift({ id: crypto.randomUUID(), ...payload, status: 'new', created_at: new Date().toISOString() }); write(KEYS.inquiries, list); form.reset(); $('.form-message', form).textContent = 'Signal received. We will reply soon.'; toast('Your message reached VEYRATH.'); });
    const queryProduct = new URLSearchParams(location.search).get('product'); if (queryProduct && $('#contactProduct')) $('#contactProduct').value = queryProduct;
  }

  function toast(message) { const el = $('.toast'); if (!el) return; el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2800); }
  function reveal() { const els = $$('.reveal:not(.is-visible)'); if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('is-visible')); const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }), { threshold: .08 }); els.forEach((el) => io.observe(el)); }
  function intro() { if (document.body.dataset.page !== 'home' || matchMedia('(prefers-reduced-motion: reduce)').matches) return; try { if (sessionStorage.getItem('veyrath_intro_seen')) return; sessionStorage.setItem('veyrath_intro_seen', 'yes'); } catch (_) {} document.body.insertAdjacentHTML('afterbegin', `<div class="brand-intro" aria-hidden="true"><div class="intro-shutter intro-shutter-a"></div><div class="intro-shutter intro-shutter-b"></div><div class="intro-stage"><div class="intro-orbit intro-orbit-a"></div><div class="intro-orbit intro-orbit-b"></div><div class="intro-core"></div><strong>VEYRATH</strong><span>Born After Dark</span></div></div>`); const el = $('.brand-intro'); setTimeout(() => el?.classList.add('is-leaving'), 2350); setTimeout(() => el?.remove(), 3300); }
  function schema() { const s = document.createElement('script'); const base = location.origin + location.pathname.replace(/[^/]+$/, ''); s.type = 'application/ld+json'; s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', '@id': `${base}#organization`, name: 'VEYRATH', url: base, logo: new URL('logo.svg', location.href).href, slogan: 'Born After Dark', description: 'Premium Indian oversized streetwear with astrology-coded minimal design.' }, { '@type': 'WebSite', '@id': `${base}#website`, name: 'VEYRATH', url: base, publisher: { '@id': `${base}#organization` }, inLanguage: 'en-IN' }] }); document.head.appendChild(s); }
  function init() { intro(); chrome(); const page = document.body.dataset.page; if (page === 'home') home(); if (page === 'shop') shop(); forms(); reveal(); schema(); $('.modal-close')?.addEventListener('click', () => $('#productModal').close()); $('#productModal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }); }
  window.VeyrathStore = { KEYS, read, write, products, site };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
