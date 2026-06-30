(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const safeUrl = (value = '', image = false) => {
    const url = String(value).trim();
    if (!url) return '';
    if (/^(https?:\/\/|\.\.?\/|[a-z0-9_./-]+\.(?:html|webp|png|jpe?g|gif|svg|mp4|webm)(?:[?#].*)?)$/i.test(url)) return url;
    if (image && /^data:image\//i.test(url)) return url;
    return '';
  };
  const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const effectivePrice = (product) => Number(product.sale_price || product.selling_price || product.price || 0);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.VeyrathUI = { esc, safeUrl, currency, toast, openModal, closeModal };
  window.VeyrathCheckout = {
    start(product, size, colour, quantity) {
      const item = { product_id: String(product.id), name: product.name, image_url: product.image_url || product.front_image_url || '', size: size || product.sizes?.[0] || 'One Size', colour: colour || product.colours?.[0] || 'Default', quantity: Math.max(1, Math.min(10, Number(quantity) || 1)), unit_price: effectivePrice(product) };
      localStorage.setItem('veyrath_checkout_items', JSON.stringify([item]));
      location.href = 'checkout.html';
    },
    read() { try { return JSON.parse(localStorage.getItem('veyrath_checkout_items') || '[]'); } catch (_) { return []; } },
    clear() { localStorage.removeItem('veyrath_checkout_items'); }
  };

  function toast(message) {
    let region = $('.toast-region');
    if (!region) { region = document.createElement('div'); region.className = 'toast-region'; region.setAttribute('aria-live', 'polite'); document.body.append(region); }
    const item = document.createElement('div'); item.className = 'toast'; item.textContent = message; region.append(item);
    setTimeout(() => item.remove(), 3600);
  }

  function pageName() { return document.body.dataset.page || location.pathname.split('/').pop()?.replace('.html', '') || 'home'; }

  function renderShell() {
    const active = pageName();
    const header = $('[data-site-header]');
    if (header) header.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <header class="site-header" aria-label="Primary navigation">
        <nav class="navbar">
          <a class="nav-brand" href="index.html" aria-label="VEYRATH home"><img src="logo.svg" alt="VEYRATH"></a>
          <div class="nav-links">
            <a href="index.html" ${active === 'home' ? 'aria-current="page"' : ''}>Home</a>
            <a href="shop.html" ${active === 'shop' ? 'aria-current="page"' : ''}>Catalogue</a>
            <a href="about.html" ${active === 'about' ? 'aria-current="page"' : ''}>Story</a>
            <a href="support.html" ${active === 'support' ? 'aria-current="page"' : ''}>Support</a>
          </div>
          <div class="nav-actions">
            <button class="nav-icon" type="button" data-newsletter-open aria-label="Open member and launch access">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-4.1 2.9-6.2 7-6.2s6.4 2.1 7 6.2"/></svg>
            </button>
            <a class="btn btn--small btn--accent" href="shop.html">Shop</a>
            <button class="nav-icon menu-toggle" type="button" aria-label="Open menu" aria-expanded="false">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>
            </button>
          </div>
        </nav>
      </header>
      <div class="menu-panel" aria-hidden="true">
        <div class="menu-panel__links">
          <a href="index.html">Home</a><a href="shop.html">Catalogue</a><a href="about.html">Our story</a><a href="contact.html">Contact</a>
        </div>
      </div>`;

    const footer = $('[data-site-footer]');
    if (footer) footer.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div><img class="footer-brand" src="logo.svg" alt="VEYRATH"><p class="footer-note">Indian print-on-demand streetwear, shaped after dark and made after you order.</p></div>
            <div class="footer-col"><strong>Explore</strong><a href="shop.html">Catalogue</a><a href="about.html">Our story</a><a href="contact.html">Contact</a><a href="admin.html">Admin</a></div>
            <div class="footer-col"><strong>Help</strong><a href="support.html">Support</a><a href="shipping.html">Shipping</a><a href="returns.html">Returns</a><a href="cancellation.html">Cancellation</a></div>
            <div class="footer-col"><strong>Legal</strong><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><button class="text-link" type="button" data-newsletter-open>Join launch list</button></div>
          </div>
          <div class="footer-bottom"><span>© <span data-year></span> VEYRATH. Born After Dark.</span><span>Built in India · Made on demand</span></div>
        </div>
      </footer>`;
    $$('[data-year]').forEach((item) => { item.textContent = new Date().getFullYear(); });
  }

  function setupNavigation() {
    const header = $('.site-header');
    const toggle = $('.menu-toggle');
    const panel = $('.menu-panel');
    const setScrolled = () => header?.classList.toggle('is-scrolled', scrollY > 18);
    addEventListener('scroll', setScrolled, { passive: true }); setScrolled();
    toggle?.addEventListener('click', () => {
      const open = !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', open); document.body.classList.toggle('menu-open', open);
      panel.setAttribute('aria-hidden', String(!open)); toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  function setupReveal() {
    const items = $$('[data-reveal]');
    if (reducedMotion || !('IntersectionObserver' in window)) return items.forEach((item) => item.classList.add('is-visible'));
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    items.forEach((item) => observer.observe(item));
  }

  function openModal(modal) {
    if (typeof modal === 'string') modal = $(modal);
    if (!modal) return;
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open');
    setTimeout(() => $('.modal__close, input, button', modal)?.focus(), 80);
  }

  function closeModal(modal) {
    if (typeof modal === 'string') modal = $(modal);
    if (!modal) return;
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
    if (!$('.modal.is-open')) document.body.classList.remove('modal-open');
  }

  function renderGlobalUX() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal" id="accessModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="accessTitle">
        <div class="modal__card newsletter-card">
          <button class="modal__close" type="button" aria-label="Close modal">×</button>
          <div class="newsletter-card__art" aria-hidden="true"></div>
          <div class="newsletter-card__copy">
            <div class="modal-tabs" role="tablist"><button class="modal-tab is-active" data-pane="launchPane" role="tab">Launch list</button><button class="modal-tab" data-pane="loginPane" role="tab">Access</button></div>
            <div class="modal-pane is-active" id="launchPane">
              <p class="eyebrow">First signal</p><h2 id="accessTitle">Get the night note.</h2>
              <p class="lead">Early product signals, launch pricing, and no daily inbox noise.</p>
              <form id="newsletterForm"><div class="field"><label for="newsletterEmail">Email address</label><input id="newsletterEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div><button class="btn btn--accent" type="submit">Join the list</button><p class="form-status" aria-live="polite"></p></form>
            </div>
            <div class="modal-pane" id="loginPane">
              <p class="eyebrow">Private access</p><h2>Admin sign in.</h2><p class="lead">Catalogue management is available to approved VEYRATH admins.</p>
              <form id="memberLoginForm"><div class="field"><label for="memberEmail">Email</label><input id="memberEmail" type="email" required></div><div class="field"><label for="memberPassword">Password</label><input id="memberPassword" type="password" required></div><button class="btn" type="submit">Sign in</button><p class="form-status" aria-live="polite"></p></form>
            </div>
          </div>
        </div>
      </div>
      <div class="modal" id="quickViewModal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Product quick view"><div class="modal__card"><button class="modal__close" type="button" aria-label="Close quick view">×</button><div data-quick-content></div></div></div>
      <div class="cookie-banner" role="region" aria-label="Cookie notice"><p>We use essential browser storage for preferences and anonymous site events. No ad tracking is added here.</p><div class="cookie-banner__actions"><button class="btn btn--small btn--light" type="button" data-cookie-accept>Accept</button><a href="privacy.html">Privacy details</a></div></div>`);

    $$('[data-newsletter-open]').forEach((button) => button.addEventListener('click', () => openModal('#accessModal')));
    $$('.modal__close').forEach((button) => button.addEventListener('click', () => closeModal(button.closest('.modal'))));
    $$('.modal').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); }));
    addEventListener('keydown', (event) => { if (event.key === 'Escape') $$('.modal.is-open').forEach(closeModal); });
    $$('.modal-tab').forEach((tab) => tab.addEventListener('click', () => {
      const card = tab.closest('.newsletter-card__copy');
      $$('.modal-tab', card).forEach((item) => item.classList.toggle('is-active', item === tab));
      $$('.modal-pane', card).forEach((pane) => pane.classList.toggle('is-active', pane.id === tab.dataset.pane));
    }));

    $('#newsletterForm')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget; const status = $('.form-status', form); const email = form.email.value.trim();
      status.textContent = 'Joining…';
      try { await window.VeyrathDB.subscribe(email, 'launch-modal'); localStorage.setItem('veyrath_newsletter_seen', 'joined'); status.textContent = 'You’re on the list. Welcome after dark.'; form.reset(); window.VeyrathDB.logEvent('newsletter_signup'); }
      catch (_) { status.textContent = 'Could not save that yet. Please try again.'; }
    });
    $('#memberLoginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget; const status = $('.form-status', form); status.textContent = 'Checking access…';
      try { await window.VeyrathDB.signIn($('#memberEmail').value, $('#memberPassword').value); location.href = 'admin.html'; }
      catch (error) { status.textContent = error.message || 'Sign-in was not accepted.'; }
    });

    const cookie = $('.cookie-banner');
    if (!localStorage.getItem('veyrath_cookie_ok')) setTimeout(() => cookie.classList.add('is-visible'), 900);
    $('[data-cookie-accept]')?.addEventListener('click', () => { localStorage.setItem('veyrath_cookie_ok', 'yes'); cookie.classList.remove('is-visible'); });
    if (!localStorage.getItem('veyrath_newsletter_seen') && !reducedMotion && pageName() === 'home') {
      setTimeout(() => { if (!document.body.classList.contains('modal-open')) { openModal('#accessModal'); localStorage.setItem('veyrath_newsletter_seen', 'shown'); } }, 9000);
    }
  }

  function productCard(product) {
    const image = safeUrl(product.image_url || product.front_image_url, true);
    const buyUrl = safeUrl(product.blinkstore_url);
    const sale = product.sale_price && Number(product.sale_price) < Number(product.price);
    return `<article class="product-card" data-product-id="${esc(product.id)}">
      <div class="product-card__media">
        ${image ? `<img src="${esc(image)}" alt="${esc(product.name)} product mockup" loading="lazy">` : '<div class="empty-state">Image coming soon</div>'}
        ${sale ? '<span class="product-card__badge">Launch price</span>' : ''}
        <button class="product-card__quick" type="button" data-quick-view="${esc(product.id)}" aria-label="Quick view ${esc(product.name)}">↗</button>
      </div>
      <div class="product-card__body">
        <div class="product-card__kicker"><span>${esc(product.category)}</span><span>★ ${esc(product.rating || 'New')}</span></div>
        <h3>${esc(product.name)}</h3>
        <div class="product-card__price"><span>${currency(effectivePrice(product))}</span>${sale ? `<s>${currency(product.price)}</s>` : ''}</div>
        <div class="product-card__actions">
          <button class="btn btn--small btn--accent" type="button" data-quick-view="${esc(product.id)}">Buy now</button>
          ${buyUrl ? `<a class="btn btn--small btn--outline" href="${esc(buyUrl)}" target="_blank" rel="noopener" aria-label="Open external fulfilment page for ${esc(product.name)}">External ↗</a>` : `<button class="btn btn--small btn--outline" type="button" data-quick-view="${esc(product.id)}">View</button>`}
        </div>
      </div>
    </article>`;
  }

  let allProducts = [];
  function attachQuickViews(products = allProducts) {
    $$('[data-quick-view]').forEach((button) => button.addEventListener('click', () => {
      const product = products.find((item) => String(item.id) === button.dataset.quickView);
      if (!product) return;
      const image = safeUrl(product.image_url || product.front_image_url, true);
      const buy = safeUrl(product.blinkstore_url);
      const sizes = (product.sizes?.length ? product.sizes : ['One Size']);
      const colours = (product.colours?.length ? product.colours : ['Default']);
      $('[data-quick-content]').innerHTML = `<div class="quick-view"><div class="quick-view__media">${image ? `<img src="${esc(image)}" alt="${esc(product.name)} product mockup">` : ''}</div><div class="quick-view__copy"><p class="eyebrow">${esc(product.category)}</p><h2>${esc(product.name)}</h2><div class="product-card__price"><span>${currency(effectivePrice(product))}</span>${product.sale_price ? `<s>${currency(product.price)}</s>` : ''}</div><p>${esc(product.description || '')}</p><div class="quick-buy-grid"><div class="field"><label for="quickSize">Size</label><select id="quickSize">${sizes.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></div><div class="field"><label for="quickColour">Colour</label><select id="quickColour">${colours.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></div><div class="field"><label for="quickQuantity">Quantity</label><select id="quickQuantity">${[1,2,3,4,5].map((item) => `<option value="${item}">${item}</option>`).join('')}</select></div></div><button class="btn btn--accent quick-buy-button" id="quickBuyButton" type="button">Continue to secure checkout</button>${buy ? `<a class="text-link quick-external-link" href="${esc(buy)}" target="_blank" rel="noopener">Use external fulfilment page</a>` : ''}<p class="micro-copy">Payment remains pending until it is verified by the configured payment provider.</p></div></div>`;
      $('#quickBuyButton')?.addEventListener('click', () => window.VeyrathCheckout.start(product, $('#quickSize').value, $('#quickColour').value, $('#quickQuantity').value));
      openModal('#quickViewModal'); window.VeyrathDB.logEvent('product_quick_view', { product_id: product.id });
    }));
  }

  async function initHome() {
    const [products, slides, settings] = await Promise.all([window.VeyrathDB.getProducts(), window.VeyrathDB.getHeroSlides(), window.VeyrathDB.getSettings()]);
    allProducts = products;
    renderHero(slides, settings);
    renderShowcase(products, settings.showcase || {});
    const featured = products.filter((product) => product.is_featured).slice(0, 8);
    const track = $('#featuredTrack');
    if (track) { track.innerHTML = (featured.length ? featured : products.slice(0, 6)).map(productCard).join(''); attachQuickViews(products); }
    setupCarouselControls();
    window.VeyrathDB.logEvent('page_view', { page: 'home' });
  }

  function renderHero(slides, settings) {
    const slider = $('#heroSlider'); if (!slider) return;
    const validSlides = slides.length ? slides : window.VEYRATH_SEED.defaultSlides;
    slider.innerHTML = validSlides.map((slide, index) => `<article class="hero-slide ${index === 0 ? 'is-active' : ''}"><p class="eyebrow">${esc(slide.eyebrow || 'VEYRATH')}</p><h1>${esc(slide.title)}</h1><p>${esc(slide.text)}</p><div class="button-row"><a class="btn btn--light" href="${esc(safeUrl(slide.cta_link) || 'shop.html')}">${esc(slide.cta_label || 'Explore')}</a><button class="btn btn--ghost-light" type="button" data-newsletter-open>Get launch discount</button></div></article>`).join('');
    $$('[data-newsletter-open]', slider).forEach((button) => button.addEventListener('click', () => openModal('#accessModal')));

    const mediaUrl = safeUrl(settings.hero_media_url, true) || safeUrl(settings.hero_media_url);
    const media = $('.hero__media');
    if (mediaUrl) {
      const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(mediaUrl);
      media.insertAdjacentHTML('afterbegin', isVideo ? `<video src="${esc(mediaUrl)}" autoplay muted loop playsinline aria-label="VEYRATH atmospheric background"></video>` : `<img src="${esc(mediaUrl)}" alt="VEYRATH atmospheric campaign background">`);
    }
    let index = 0; let timer;
    const current = $('#heroCurrent'); const total = $('#heroTotal'); const progress = $('#heroProgress');
    if (total) total.textContent = String(validSlides.length).padStart(2, '0');
    const show = (next) => {
      index = (next + validSlides.length) % validSlides.length;
      $$('.hero-slide', slider).forEach((slide, i) => slide.classList.toggle('is-active', i === index));
      if (current) current.textContent = String(index + 1).padStart(2, '0');
      if (progress) { progress.style.transition = 'none'; progress.style.transform = 'scaleX(0)'; requestAnimationFrame(() => { progress.style.transition = 'transform 5s linear'; progress.style.transform = 'scaleX(1)'; }); }
      clearTimeout(timer); if (!reducedMotion && validSlides.length > 1) timer = setTimeout(() => show(index + 1), 5000);
    };
    $('#heroPrev')?.addEventListener('click', () => show(index - 1)); $('#heroNext')?.addEventListener('click', () => show(index + 1)); show(0);
  }

  function renderShowcase(products, showcase) {
    const stage = $('#showcaseStage'); if (!stage) return;
    const product = products.find((item) => String(item.id) === String(showcase.product_id)) || products.find((item) => item.is_featured) || products[0] || {};
    const front = safeUrl(showcase.front_image_url || product.front_image_url || product.image_url, true);
    const back = safeUrl(showcase.back_image_url || product.back_image_url || product.image_url, true) || front;
    $('#showcaseName').textContent = showcase.product_name || product.name || 'VEYRATH rotating piece';
    $('#showcaseHighlight').textContent = showcase.highlight_text || 'Designed to be seen from both sides.';
    $('#showcaseLink').href = safeUrl(showcase.cta_link) || 'shop.html';
    stage.innerHTML = `<div class="showcase__stage-media"></div><span class="showcase__badge">Interactive product view</span><div class="product-orbit"><div class="product-orbit__inner" id="productOrbit"><div class="product-orbit__face"><img src="${esc(front)}" alt="Front of ${esc(showcase.product_name || product.name)}"></div><div class="product-orbit__face product-orbit__face--back"><img src="${esc(back)}" alt="Back of ${esc(showcase.product_name || product.name)}"></div></div></div><div class="showcase__toggle"><button class="is-active" type="button" data-face="0">Front</button><button type="button" data-face="180">Back</button></div><span class="showcase__hint">Drag / swipe to rotate</span>`;
    const bg = safeUrl(showcase.background_media_url, true) || safeUrl(showcase.background_media_url);
    if (bg) $('.showcase__stage-media', stage).innerHTML = /\.(mp4|webm)(\?.*)?$/i.test(bg) ? `<video src="${esc(bg)}" autoplay muted loop playsinline></video>` : `<img src="${esc(bg)}" alt="" aria-hidden="true">`;
    const orbit = $('#productOrbit'); let rotation = 0; let dragging = false; let startX = 0; let startRotation = 0; let auto;
    const setRotation = (value) => { rotation = value; orbit.style.transform = `rotateY(${rotation}deg) rotateX(${Math.sin(rotation * Math.PI / 180) * 2}deg)`; $$('[data-face]', stage).forEach((button) => button.classList.toggle('is-active', Math.abs(((rotation % 360) + 360) % 360 - Number(button.dataset.face)) < 70)); };
    const restart = () => { clearInterval(auto); if (!reducedMotion) auto = setInterval(() => setRotation(rotation + 180), 4200); };
    stage.addEventListener('pointerdown', (event) => { dragging = true; startX = event.clientX; startRotation = rotation; stage.classList.add('is-dragging'); stage.setPointerCapture(event.pointerId); clearInterval(auto); });
    stage.addEventListener('pointermove', (event) => { if (dragging) setRotation(startRotation + (event.clientX - startX) * .75); });
    const end = () => { if (!dragging) return; dragging = false; stage.classList.remove('is-dragging'); setRotation(Math.round(rotation / 180) * 180); restart(); };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    $$('[data-face]', stage).forEach((button) => button.addEventListener('click', () => { setRotation(Number(button.dataset.face)); restart(); }));
    restart();
  }

  function setupCarouselControls() {
    $$('[data-carousel]').forEach((controls) => {
      const track = document.getElementById(controls.dataset.carousel);
      $$('button', controls).forEach((button) => button.addEventListener('click', () => track?.scrollBy({ left: (button.dataset.direction === 'next' ? 1 : -1) * Math.min(track.clientWidth * .8, 420), behavior: 'smooth' })));
    });
  }

  async function initShop() {
    allProducts = await window.VeyrathDB.getProducts();
    const settings = await window.VeyrathDB.getSettings();
    const collection = $('#collectionTitle');
    if (collection && settings.collection_title) { collection.textContent = typeof settings.collection_title === 'string' ? settings.collection_title : String(settings.collection_title); collection.hidden = false; }
    buildFilters(allProducts); renderCatalogue(allProducts); renderProductSchema(allProducts); window.VeyrathDB.logEvent('page_view', { page: 'shop' });
  }

  function renderProductSchema(products) {
    $('#dynamicProductSchema')?.remove();
    const schema = document.createElement('script'); schema.id = 'dynamicProductSchema'; schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: products.map((product, index) => ({ '@type': 'ListItem', position: index + 1, item: { '@type': 'Product', name: product.name, description: product.description || '', image: safeUrl(product.image_url || product.front_image_url, true) || undefined, category: product.category, brand: { '@type': 'Brand', name: 'VEYRATH' }, offers: { '@type': 'Offer', priceCurrency: 'INR', price: Number(product.sale_price || product.price || 0), availability: product.blinkstore_url ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder', url: safeUrl(product.blinkstore_url) || './shop.html' } } })) });
    document.head.append(schema);
  }

  const filterState = { search: '', sort: 'featured', category: [], gender: [], rating: [], colour: [], size: [], style: [], min: 0, max: Infinity };
  function unique(products, field) { return [...new Set(products.flatMap((item) => Array.isArray(item[field]) ? item[field] : [item[field]]).filter(Boolean))].sort(); }
  function checkGroup(label, key, values) { return `<div class="filter-group"><strong>${label}</strong><div class="filter-options">${values.map((value) => `<label class="check"><input type="checkbox" value="${esc(value)}" data-filter="${key}"><span>${esc(value)}</span></label>`).join('')}</div></div>`; }

  function buildFilters(products) {
    const panel = $('#filterPanel'); if (!panel) return;
    panel.innerHTML = `<div class="filter-head"><strong>Refine catalogue</strong><div class="filter-head__actions"><button type="button" data-clear-filters>Clear all</button><button class="filter-close" type="button" data-close-filters>Close</button></div></div>
      ${checkGroup('Category', 'category', ['T-Shirts', 'Hoodies', 'Lowers', 'Accessories'])}
      ${checkGroup('Gender', 'gender', unique(products, 'gender'))}
      <div class="filter-group"><strong>Budget (₹)</strong><div class="budget-row"><input type="number" min="0" placeholder="Min" data-budget="min"><input type="number" min="0" placeholder="Max" data-budget="max"></div></div>
      ${checkGroup('Rating', 'rating', ['4+', '4.5+'])}
      ${checkGroup('Colour', 'colour', unique(products, 'colours'))}
      ${checkGroup('Size', 'size', unique(products, 'sizes'))}
      ${checkGroup('Style / vibe', 'style', unique(products, 'style'))}`;
    $$('[data-filter]', panel).forEach((input) => input.addEventListener('change', () => { filterState[input.dataset.filter] = $$(`[data-filter="${input.dataset.filter}"]:checked`, panel).map((item) => item.value); applyFilters(); }));
    $$('[data-budget]', panel).forEach((input) => input.addEventListener('input', () => { filterState[input.dataset.budget] = input.value === '' ? (input.dataset.budget === 'max' ? Infinity : 0) : Number(input.value); applyFilters(); }));
    $('[data-clear-filters]', panel).addEventListener('click', () => { $$('input', panel).forEach((input) => { input.checked = false; input.value = ''; }); Object.assign(filterState, { category: [], gender: [], rating: [], colour: [], size: [], style: [], min: 0, max: Infinity }); applyFilters(); });
    $('#filterToggle')?.addEventListener('click', () => panel.classList.toggle('is-open'));
    $('[data-close-filters]', panel)?.addEventListener('click', () => panel.classList.remove('is-open'));
    $('#catalogueSearch')?.addEventListener('input', (event) => { filterState.search = event.target.value.toLowerCase().trim(); applyFilters(); });
    $('#catalogueSort')?.addEventListener('change', (event) => { filterState.sort = event.target.value; applyFilters(); });
  }

  function applyFilters() {
    const matchesAny = (item, selected, field) => !selected.length || selected.some((value) => (Array.isArray(item[field]) ? item[field] : [item[field]]).map(String).includes(value));
    let items = allProducts.filter((product) => {
      const haystack = [product.name, product.category, product.style, product.description].join(' ').toLowerCase();
      const ratingOk = !filterState.rating.length || filterState.rating.some((r) => Number(product.rating || 0) >= Number(r.replace('+', '')));
      const price = Number(product.sale_price || product.price || 0);
      return (!filterState.search || haystack.includes(filterState.search)) && matchesAny(product, filterState.category, 'category') && matchesAny(product, filterState.gender, 'gender') && matchesAny(product, filterState.colour, 'colours') && matchesAny(product, filterState.size, 'sizes') && matchesAny(product, filterState.style, 'style') && ratingOk && price >= filterState.min && price <= filterState.max;
    });
    const sorters = { 'price-low': (a, b) => Number(a.sale_price || a.price) - Number(b.sale_price || b.price), 'price-high': (a, b) => Number(b.sale_price || b.price) - Number(a.sale_price || a.price), rating: (a, b) => Number(b.rating) - Number(a.rating), newest: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0), featured: (a, b) => Number(b.is_featured) - Number(a.is_featured) || Number(a.sort_order) - Number(b.sort_order) };
    items.sort(sorters[filterState.sort] || sorters.featured); renderCatalogue(items);
  }

  function renderCatalogue(products) {
    const grid = $('#catalogueGrid'); if (!grid) return;
    grid.innerHTML = products.length ? products.map(productCard).join('') : '<div class="empty-state"><p class="eyebrow">No match</p><h3>Nothing in this orbit yet.</h3><p>Try clearing a filter or searching a broader term.</p></div>';
    $('#productCount').textContent = `${products.length} ${products.length === 1 ? 'piece' : 'pieces'}`; attachQuickViews(allProducts);
  }

  function setupForms() {
    const form = $('#inquiryForm'); if (!form) return;
    const queryProduct = new URLSearchParams(location.search).get('product'); if (queryProduct && form.product) form.product.value = queryProduct;
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); const status = $('.form-status', form); const data = Object.fromEntries(new FormData(form)); status.textContent = 'Sending your note…';
      try { await window.VeyrathDB.submitInquiry(data); status.textContent = 'Your note is in. We’ll reply as soon as we can.'; form.reset(); window.VeyrathDB.logEvent('inquiry_submit', { subject: data.subject }); }
      catch (_) { status.textContent = 'That did not send. Please try again in a moment.'; }
    });
  }

  function hideIntro() {
    const intro = $('.intro'); if (!intro) return;
    const seen = sessionStorage.getItem('veyrath_intro_seen');
    const delay = seen || reducedMotion ? 80 : 1550;
    setTimeout(() => { intro.classList.add('is-hidden'); sessionStorage.setItem('veyrath_intro_seen', 'yes'); setTimeout(() => intro.remove(), 800); }, delay);
  }

  async function init() {
    renderShell(); setupNavigation(); renderGlobalUX(); setupForms(); hideIntro();
    if (pageName() === 'home') await initHome();
    if (pageName() === 'shop') await initShop();
    setupReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
