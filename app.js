(function () {
  'use strict';

  const KEYS = {
    products: 'veyrath_products_v3',
    site: 'veyrath_site_data_v3',
    inquiries: 'veyrath_inquiries_v3',
    newsletter: 'veyrath_newsletter_v3',
    sizeCharts: 'veyrath_size_charts_v1',
    collections: 'veyrath_collections_v1',
    collectionProducts: 'veyrath_collection_products_v1'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? clone(fallback);
    } catch (_) {
      return clone(fallback);
    }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
  const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const safeImage = (value = '') => /^(https?:\/\/[^\s"'<>]+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+|[a-z0-9_.-]+\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?)$/i.test(String(value).trim()) ? String(value).trim() : '';
  const safeLink = (value = '') => /^(https?:\/\/|[a-z0-9_.-]+\.html(?:[?#].*)?|#[a-z0-9_-]+)$/i.test(String(value).trim()) ? String(value).trim() : '';
  const split = (value) => Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const productImages = (product = {}) => [...new Set([
    product.image_url,
    ...(Array.isArray(product.images) ? product.images : []),
    product.back_image_url,
    product.front_image_url
  ].map(safeImage).filter(Boolean))];
  const productPrice = (product = {}) => Number(product.sale_price || product.selling_price || product.price || 0);
  const slugText = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let remoteProducts = null;
  let remoteSite = null;
  let remoteSizeCharts = null;
  let remoteCollections = null;
  let remoteCollectionProducts = null;
  let supabaseClient = null;
  let remoteConfigured = false;

  const products = () => (Array.isArray(remoteProducts)
    ? remoteProducts
    : remoteConfigured
      ? []
      : read(KEYS.products, window.VEYRATH_PRODUCTS || []))
    .filter((product) => product && product.is_published !== false);
  const site = () => remoteSite || read(KEYS.site, window.VEYRATH_SITE_DATA || {});
  const sizeCharts = () => (Array.isArray(remoteSizeCharts)
    ? remoteSizeCharts
    : read(KEYS.sizeCharts, window.VEYRATH_SIZE_CHARTS || []))
    .filter((chart) => chart && chart.is_published !== false);
  const collections = () => (Array.isArray(remoteCollections)
    ? remoteCollections
    : read(KEYS.collections, window.VEYRATH_COLLECTIONS || []))
    .filter((collection) => collection && collection.is_published !== false);
  const collectionProducts = () => Array.isArray(remoteCollectionProducts)
    ? remoteCollectionProducts
    : read(KEYS.collectionProducts, window.VEYRATH_COLLECTION_PRODUCTS || []);

  async function fetchPublicProducts(config) {
    const endpoint = `${String(config.url).replace(/\/$/, '')}/rest/v1/storefront_products?select=*&order=sort_order.desc`;
    const response = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        Accept: 'application/json'
      }
    });
    if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Catalogue response was not a list');
    return rows;
  }

  async function connectRemote() {
    const config = window.VEYRATH_SUPABASE || {};
    if (!/^https:\/\//.test(config.url || '') || !config.anonKey || config.anonKey.includes('YOUR_')) return;
    remoteConfigured = true;

    try {
      remoteProducts = await fetchPublicProducts(config);
      write(KEYS.products, remoteProducts);
    } catch (_) {
      /* Supabase JS below provides a second catalogue path. */
    }

    if (!window.supabase) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch (_) {
        remoteProducts ||= [];
        remoteSizeCharts ||= [];
        remoteCollections ||= [];
        remoteCollectionProducts ||= [];
        return;
      }
    }

    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
      const requests = [
        supabaseClient.from('site_settings').select('value').eq('key', 'site_data').maybeSingle(),
        supabaseClient.from('hero_slides').select('*').eq('is_published', true).order('sort_order'),
        supabaseClient.from('size_charts').select('*').eq('is_published', true).order('sort_order'),
        supabaseClient.from('collections').select('*').eq('is_published', true).order('sort_order'),
        supabaseClient.from('collection_products').select('collection_id,product_id,sort_order').order('sort_order')
      ];
      if (!Array.isArray(remoteProducts)) {
        requests.push(supabaseClient.from('storefront_products').select('*').order('sort_order', { ascending: false }));
      }
      const [settings, slides, chartRows, collectionRows, membershipRows, catalogue] = await Promise.all(requests);

      if (catalogue && !catalogue.error) {
        remoteProducts = catalogue.data || [];
        write(KEYS.products, remoteProducts);
      }

      const base = read(KEYS.site, window.VEYRATH_SITE_DATA || {});
      remoteSite = settings.data?.value ? { ...base, ...settings.data.value } : base;
      if (!slides.error && slides.data?.length) {
        remoteSite.banners = slides.data.map((slide) => ({
          id: slide.id,
          image_url: slide.image_url,
          eyebrow: slide.eyebrow,
          heading: slide.heading,
          text: slide.body,
          align: slide.align || 'left'
        }));
      }

      remoteSizeCharts = chartRows.error ? [] : (chartRows.data || []);
      remoteCollections = collectionRows.error ? [] : (collectionRows.data || []);
      remoteCollectionProducts = membershipRows.error ? [] : (membershipRows.data || []);
      write(KEYS.sizeCharts, remoteSizeCharts);
      write(KEYS.collections, remoteCollections);
      write(KEYS.collectionProducts, remoteCollectionProducts);
    } catch (_) {
      supabaseClient = null;
    }

    remoteProducts ||= [];
    remoteSizeCharts ||= [];
    remoteCollections ||= [];
    remoteCollectionProducts ||= [];
  }

  function header() {
    const page = document.body.dataset.page || '';
    return `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="announcement">Born After Dark <span>•</span> Made after order <span>•</span> Built in India</div>
      <header class="site-header">
        <a class="brand" href="index.html" aria-label="VEYRATH home"><img src="logo.svg" alt="VEYRATH"><span>Born After Dark</span></a>
        <button class="menu-button" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="siteNav"><span></span><span></span><span></span><b>Menu</b></button>
        <nav class="site-nav" id="siteNav" aria-label="Main navigation">
          <p class="nav-kicker">VEYRATH / MENU</p>
          <a ${page === 'home' ? 'aria-current="page"' : ''} href="index.html">Home</a>
          <a ${page === 'shop' ? 'aria-current="page"' : ''} href="shop.html">Shop</a>
          <a ${page === 'collections' ? 'aria-current="page"' : ''} href="collections.html">Collections</a>
          <a ${page === 'size-charts' ? 'aria-current="page"' : ''} href="size-charts.html">Size guide</a>
          <a ${page === 'about' ? 'aria-current="page"' : ''} href="about.html">Our story</a>
          <a ${page === 'support' ? 'aria-current="page"' : ''} href="support.html">Support</a>
          <a href="admin.html">Admin</a>
          <a class="nav-accent" href="shop.html">Enter the drop <span>↗</span></a>
          <small>Born After Dark / India</small>
        </nav>
        <button class="nav-scrim" type="button" aria-label="Close menu"></button>
      </header>`;
  }

  function footer() {
    return `
      <footer class="site-footer">
        <div class="footer-lead"><p class="eyebrow">VEYRATH / ${new Date().getFullYear()}</p><h2>Move quiet.<br>Leave a signal.</h2></div>
        <div class="footer-grid">
          <div><h3>Shop</h3><a href="shop.html">All products</a><a href="collections.html">Collections</a><a href="shop.html?sort=newest">New arrivals</a><a href="size-charts.html">Size guide</a></div>
          <div><h3>About</h3><a href="about.html">Our story</a><a href="about.html#responsibility">Sustainability</a><a href="about.html#philosophy">Brand philosophy</a></div>
          <div><h3>Customer care</h3><a href="size-charts.html">Size charts</a><a href="returns.html">Returns & exchanges</a><a href="shipping.html">Shipping info</a><a href="support.html#track">Track order</a><a href="faq.html">FAQ</a><a href="support.html">Support</a></div>
          <form class="footer-newsletter newsletter-form"><h3>Join the Inner Circle</h3><p>Get early access to new drops and exclusive offers.</p><label><span class="sr-only">Email address</span><input name="email" type="email" autocomplete="email" placeholder="Email address" required><button aria-label="Join newsletter" type="submit">→</button></label><small class="form-message" aria-live="polite"></small></form>
        </div>
        <div class="footer-bottom"><strong>VEYRATH</strong><div><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="admin.html">Admin</a></div><span>© ${new Date().getFullYear()} VEYRATH</span></div>
      </footer>`;
  }

  function chrome() {
    $('[data-site-header]')?.replaceChildren(document.createRange().createContextualFragment(header()));
    $('[data-site-footer]')?.replaceChildren(document.createRange().createContextualFragment(footer()));
    if (!$('#productModal')) {
      document.body.insertAdjacentHTML('beforeend', '<dialog class="product-modal" id="productModal"><button class="modal-close" type="button" aria-label="Close product details">×</button><div id="productModalBody"></div></dialog><div class="toast" role="status" aria-live="polite"></div>');
    }

    const menu = $('.menu-button');
    const nav = $('#siteNav');
    const closeMenu = () => {
      nav.classList.remove('is-open');
      menu?.setAttribute('aria-expanded', 'false');
      menu?.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('menu-open');
    };
    menu?.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') === 'true';
      if (open) return closeMenu();
      menu.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-label', 'Close menu');
      nav.classList.add('is-open');
      document.body.classList.add('menu-open');
    });
    $('.nav-scrim')?.addEventListener('click', closeMenu);
    $$('.site-nav a').forEach((anchor) => anchor.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    let previousY = scrollY;
    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = scrollY;
        $('.site-header')?.classList.toggle('is-hidden', currentY > previousY && currentY > 180 && !document.body.classList.contains('menu-open'));
        previousY = currentY;
        ticking = false;
      });
    }, { passive: true });
  }

  function membershipsForProduct(productId) {
    return collectionProducts()
      .filter((item) => String(item.product_id) === String(productId))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }

  function collectionsForProduct(productId) {
    const activeCollections = collections();
    return membershipsForProduct(productId)
      .map((membership) => activeCollections.find((collection) => String(collection.id) === String(membership.collection_id)))
      .filter(Boolean);
  }

  function productsForCollection(collectionId) {
    const order = collectionProducts()
      .filter((item) => String(item.collection_id) === String(collectionId))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    const catalogue = products();
    return order
      .map((item) => catalogue.find((product) => String(product.id) === String(item.product_id)))
      .filter(Boolean);
  }

  function productCard(product) {
    const image = productImages(product)[0] || 'veyrath-tee.jpg';
    const tags = split(product.tags || product.style).slice(0, 2);
    const price = productPrice(product);
    const compare = Number(product.compare_at_price || product.compare_at || 0);
    const collection = collectionsForProduct(product.id)[0];
    return `
      <article class="product-card reveal">
        <button class="product-media" type="button" data-product-view="${esc(product.id)}">
          <img src="${esc(image)}" alt="${esc(product.name)}" loading="lazy">
          <span class="product-state">${product.fulfilment_status === 'ready' ? 'Made after order' : 'Limited release'}</span>
          ${collection ? `<span class="product-collection-badge">${esc(collection.title)}</span>` : ''}
          <span class="quick-label">Quick view</span>
        </button>
        <div class="product-info">
          <div><p>${esc(product.category || 'VEYRATH')}</p><h3>${esc(product.name)}</h3></div>
          <div class="price"><strong>${money(price)}</strong>${compare > price ? `<s>${money(compare)}</s>` : ''}</div>
          ${tags.length ? `<ul>${tags.map((tag) => `<li>${esc(tag)}</li>`).join('')}</ul>` : ''}
          <div class="product-actions"><button type="button" data-product-view="${esc(product.id)}">Details</button><button type="button" data-buy-now="${esc(product.id)}">Buy now</button></div>
        </div>
      </article>`;
  }

  function emptyState(heading = 'The next VEYRATH pieces are being prepared after dark.', copy = 'Join the Inner Circle to know when the signal goes live.') {
    return `<div class="empty-state"><span class="orbit-mark" aria-hidden="true"></span><p class="eyebrow">Drop in progress</p><h2>${esc(heading)}</h2><p>${esc(copy)}</p><a class="btn btn-gold" href="#inner-circle">Join the circle</a></div>`;
  }

  function bindProducts(list = products()) {
    $$('[data-product-view]').forEach((button) => button.addEventListener('click', () => {
      openProduct(list.find((product) => String(product.id) === String(button.dataset.productView)) || products().find((product) => String(product.id) === String(button.dataset.productView)));
    }));
  }

  function collectionSwitcher(product) {
    const productCollections = collectionsForProduct(product.id);
    if (!productCollections.length) return '';
    const activeCollection = productCollections[0];
    const siblings = productsForCollection(activeCollection.id);
    if (!siblings.length) return '';
    return `
      <div class="collection-switcher">
        <p class="eyebrow">Part of collection</p>
        <div>
          <strong>${esc(activeCollection.title)}</strong>
          <a href="collections.html#${esc(activeCollection.slug || activeCollection.id)}">View collection →</a>
        </div>
        <label>
          <span>Switch piece</span>
          <select data-collection-jump>
            ${siblings.map((item) => `<option value="${esc(item.id)}" ${String(item.id) === String(product.id) ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
          </select>
        </label>
      </div>`;
  }

  function openProduct(product) {
    if (!product) return;
    const modal = $('#productModal');
    const gallery = productImages(product);
    if (!gallery.length) gallery.push('veyrath-tee.jpg');
    const galleryMarkup = gallery.map((image, index) => `<img src="${esc(image)}" alt="${esc(product.name)} gallery image ${index + 1}" ${index ? 'loading="lazy"' : ''}>`).join('');
    const price = productPrice(product);

    $('#productModalBody').innerHTML = `
      <div class="modal-grid">
        <div class="modal-gallery">
          <div class="modal-images" data-modal-track>${galleryMarkup}</div>
          ${gallery.length > 1 ? `<div class="modal-gallery-controls"><button type="button" data-gallery-prev aria-label="Previous product image">←</button><span><b data-gallery-current>1</b> / ${gallery.length}</span><button type="button" data-gallery-next aria-label="Next product image">→</button></div>` : ''}
        </div>
        <div class="modal-copy">
          <p class="eyebrow">${esc(product.category || 'VEYRATH')}</p>
          <h2>${esc(product.name)}</h2>
          <div class="price price-large"><strong>${money(price)}</strong>${Number(product.compare_at_price || 0) > price ? `<s>${money(product.compare_at_price)}</s>` : ''}</div>
          <p>${esc(product.description || 'A VEYRATH piece shaped for silent movement.')}</p>
          <dl>
            <div><dt>Sizes</dt><dd>${esc(split(product.sizes).join(' / ') || 'One size')}</dd></div>
            <div><dt>Colours</dt><dd>${esc(split(product.colours).join(' / ') || 'As shown')}</dd></div>
            <div><dt>Made</dt><dd>${esc(product.fulfilment_status || 'After order')}</dd></div>
          </dl>
          ${collectionSwitcher(product)}
          <div class="modal-actions">
            <button class="btn btn-gold" type="button" data-buy-now="${esc(product.id)}">Buy securely</button>
            <a class="btn btn-ghost" href="size-charts.html">Size guide</a>
          </div>
          <small>Payment protected by Razorpay.</small>
        </div>
      </div>`;

    const track = $('[data-modal-track]', modal);
    const counter = $('[data-gallery-current]', modal);
    let activeImage = 0;
    const moveGallery = (next) => {
      activeImage = (next + gallery.length) % gallery.length;
      track.scrollTo({
        left: activeImage * track.clientWidth,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
      if (counter) counter.textContent = String(activeImage + 1);
    };
    $('[data-gallery-prev]', modal)?.addEventListener('click', () => moveGallery(activeImage - 1));
    $('[data-gallery-next]', modal)?.addEventListener('click', () => moveGallery(activeImage + 1));
    track?.addEventListener('scroll', () => {
      const next = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (next !== activeImage && next >= 0 && next < gallery.length) {
        activeImage = next;
        if (counter) counter.textContent = String(activeImage + 1);
      }
    }, { passive: true });
    $('[data-collection-jump]', modal)?.addEventListener('change', (event) => {
      const next = products().find((item) => String(item.id) === String(event.currentTarget.value));
      openProduct(next);
    });
    if (!modal.open) modal.showModal();
  }

  function home() {
    const data = site();
    const hero = data.hero || {};
    const heroEl = $('.hero');
    if (heroEl) heroEl.style.setProperty('--hero-image', `url("${safeImage(hero.image_url) || 'veyrath-hero.jpg'}")`);
    $('[data-hero-eyebrow]').textContent = hero.eyebrow || 'VEYRATH / BORN AFTER DARK';
    $('[data-hero-heading]').textContent = hero.heading || 'Own every. silent. move.';
    $('[data-hero-subheading]').textContent = hero.subheading || '';
    const primary = $('[data-hero-primary]');
    primary.textContent = hero.primary_label || 'Shop collection';
    primary.href = safeLink(hero.primary_link) || 'shop.html';
    const secondary = $('[data-hero-secondary]');
    secondary.textContent = hero.secondary_label || 'Join inner circle';
    secondary.href = safeLink(hero.secondary_link) || '#inner-circle';

    const fallbackOffers = [
      { kicker: 'FIRST SIGNAL', text: '10% OFF WITH CODE AFTERDARK10' },
      { kicker: 'FREE SHIPPING', text: 'ON ORDERS ABOVE ₹1,999' },
      { kicker: 'INNER CIRCLE', text: 'EARLY ACCESS TO EVERY DROP' }
    ];
    const offers = data.offers?.length ? data.offers : fallbackOffers;
    const offerSet = offers.map((offer) => `<article><small>${esc(offer.kicker || 'VEYRATH')}</small><strong>${esc(offer.text || 'BORN AFTER DARK')}</strong><span>✦</span></article>`).join('');
    $('[data-offer-rail]').innerHTML = `<div class="offer-set">${offerSet}</div><div class="offer-set" aria-hidden="true">${offerSet}</div>`;

    $('[data-category-intro]').textContent = data.category_intro || '';
    $('[data-categories]').innerHTML = (data.categories || []).map((category, index) => `
      <a class="category-card reveal" href="shop.html?category=${encodeURIComponent(category.query || category.name)}">
        <img src="${esc(safeImage(category.image) || 'veyrath-tee.jpg')}" alt="VEYRATH ${esc(category.name)} category" loading="${index < 2 ? 'eager' : 'lazy'}">
        <span><small>0${index + 1}</small><strong>${esc(category.name)}</strong><em>${esc(category.note || '')}</em></span>
      </a>`).join('');
    $('[data-about-text]').textContent = data.about_text || '';

    const catalogue = products();
    const pinned = catalogue
      .filter((product) => product.is_home_pinned)
      .sort((a, b) => Number(b.home_sort_order || 0) - Number(a.home_sort_order || 0) || Number(b.sort_order || 0) - Number(a.sort_order || 0));
    const featured = (pinned.length ? pinned : catalogue.filter((product) => product.is_featured))
      .sort((a, b) => Number(b.home_sort_order || 0) - Number(a.home_sort_order || 0) || Number(b.sort_order || 0) - Number(a.sort_order || 0))
      .slice(0, 12);
    const homeGrid = $('[data-featured-products]');
    homeGrid?.classList.add('home-product-grid');
    homeGrid.innerHTML = featured.length ? featured.map(productCard).join('') : emptyState();
    bindProducts(featured);
    setupCarousel(data.banners || []);
  }

  function setupCarousel(banners) {
    const host = $('[data-banners]');
    if (!host) return;
    if (!banners.length) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML = `
      <div class="campaign-track">
        ${banners.map((banner, index) => `<article class="campaign-slide campaign-slide--${esc(banner.align || 'left')}" data-slide="${index}" aria-hidden="${index ? 'true' : 'false'}" style="--campaign:url('${esc(safeImage(banner.image_url) || 'veyrath-hero.jpg')}')"><div class="campaign-copy"><p class="eyebrow">${esc(banner.eyebrow || '')}</p><h2>${esc(banner.heading || '')}</h2><p>${esc(banner.text || '')}</p><a class="btn btn-ghost" href="shop.html">Explore the collection</a></div><span class="campaign-number">${String(index + 1).padStart(2, '0')} / ${String(banners.length).padStart(2, '0')}</span></article>`).join('')}
      </div>
      <div class="carousel-ui">
        <div class="carousel-dots">${banners.map((_, index) => `<button type="button" data-carousel-dot="${index}" aria-label="Show campaign ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"><span></span></button>`).join('')}</div>
        <div class="carousel-progress"><span></span></div>
        <div class="carousel-arrows"><button type="button" data-carousel-prev aria-label="Previous campaign">←</button><button type="button" data-carousel-next aria-label="Next campaign">→</button></div>
      </div>`;
    const track = $('.campaign-track', host);
    const slides = $$('.campaign-slide', host);
    const dots = $$('[data-carousel-dot]', host);
    let current = 0;
    let timer = null;
    let startX = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const move = (next, user = false) => {
      current = (next + slides.length) % slides.length;
      track.style.transform = `translate3d(-${current * 100}%,0,0)`;
      slides.forEach((slide, index) => slide.setAttribute('aria-hidden', String(index !== current)));
      dots.forEach((dot, index) => dot.setAttribute('aria-current', String(index === current)));
      const progress = $('.carousel-progress span', host);
      progress.classList.remove('is-running');
      void progress.offsetWidth;
      if (!reduced) progress.classList.add('is-running');
      if (user) restart();
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
      host.classList.add('is-paused');
    };
    const start = () => {
      if (reduced || timer || slides.length < 2) return;
      host.classList.remove('is-paused');
      timer = setInterval(() => move(current + 1), 5600);
    };
    const restart = () => {
      stop();
      start();
    };
    $('[data-carousel-prev]', host).addEventListener('click', () => move(current - 1, true));
    $('[data-carousel-next]', host).addEventListener('click', () => move(current + 1, true));
    dots.forEach((dot) => dot.addEventListener('click', () => move(Number(dot.dataset.carouselDot), true)));
    host.addEventListener('mouseenter', stop);
    host.addEventListener('mouseleave', start);
    host.addEventListener('focusin', stop);
    host.addEventListener('focusout', start);
    host.addEventListener('pointerdown', (event) => { startX = event.clientX; });
    host.addEventListener('pointerup', (event) => {
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 50) move(current + (delta < 0 ? 1 : -1), true);
    });
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    move(0);
    start();
  }

  function optionValues(list, key) {
    return [...new Set(list.flatMap((product) => split(product[key])).filter(Boolean))].sort();
  }

  function fillSelect(id, values) {
    const element = $(id);
    if (!element) return;
    values.forEach((value) => element.insertAdjacentHTML('beforeend', `<option value="${esc(value)}">${esc(value)}</option>`));
  }

  function shop() {
    const all = products();
    const form = $('#catalogueFilters');
    const grid = $('#productGrid');
    fillSelect('#filterCategory', optionValues(all, 'category'));
    fillSelect('#filterGender', optionValues(all, 'gender'));
    fillSelect('#filterSize', optionValues(all, 'sizes'));
    fillSelect('#filterColour', optionValues(all, 'colours'));
    fillSelect('#filterStyle', optionValues(all, 'style').concat(optionValues(all, 'tags')));

    const maxPrice = Math.max(1000, ...all.map(productPrice));
    $('#filterPrice').max = String(Math.ceil(maxPrice / 500) * 500);
    $('#filterPrice').value = $('#filterPrice').max;
    $('#priceLabel').textContent = money($('#filterPrice').value);

    const params = new URLSearchParams(location.search);
    ['category', 'gender', 'sort'].forEach((key) => {
      const target = $(`#filter${key[0].toUpperCase()}${key.slice(1)}`);
      if (target && params.get(key)) target.value = params.get(key);
    });

    const collectionParam = params.get('collection');
    const activeCollection = collectionParam ? collections().find((collection) => collection.slug === collectionParam || String(collection.id) === collectionParam) : null;
    const collectionIds = activeCollection ? new Set(productsForCollection(activeCollection.id).map((product) => String(product.id))) : null;

    function render() {
      const filters = Object.fromEntries(new FormData(form));
      const ceiling = Number($('#filterPrice').value);
      $('#priceLabel').textContent = money(ceiling);
      let list = all.filter((product) => {
        const haystack = [product.name, product.description, product.category, product.gender, ...split(product.tags), ...split(product.style)].join(' ').toLowerCase();
        const price = productPrice(product);
        return (!collectionIds || collectionIds.has(String(product.id)))
          && (!filters.search || haystack.includes(filters.search.toLowerCase()))
          && (!filters.category || product.category === filters.category)
          && (!filters.gender || product.gender === filters.gender || product.gender === 'Unisex')
          && (!filters.size || split(product.sizes).includes(filters.size))
          && (!filters.colour || split(product.colours).includes(filters.colour))
          && (!filters.style || split(product.style).concat(split(product.tags)).includes(filters.style))
          && (!filters.rating || Number(product.rating || 0) >= Number(filters.rating))
          && price <= ceiling;
      });
      if (filters.sort === 'price-low') list.sort((a, b) => productPrice(a) - productPrice(b));
      else if (filters.sort === 'price-high') list.sort((a, b) => productPrice(b) - productPrice(a));
      else if (filters.sort === 'rating') list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
      else list.sort((a, b) => Number(b.sort_order || 0) - Number(a.sort_order || 0));
      $('#resultCount').textContent = `${list.length} ${list.length === 1 ? 'piece' : 'pieces'}${activeCollection ? ` in ${activeCollection.title}` : ''}`;
      grid.innerHTML = list.length ? list.map(productCard).join('') : emptyState('No pieces match this signal.', 'Clear filters or explore another VEYRATH collection.');
      bindProducts(list);
      reveal();
    }

    form.addEventListener('input', render);
    form.addEventListener('change', render);
    $('#clearFilters').addEventListener('click', () => {
      form.reset();
      $('#filterPrice').value = $('#filterPrice').max;
      render();
    });
    render();
  }

  function sizeFacts() {
    const configuredFacts = site().size_facts;
    return Array.isArray(configuredFacts) && configuredFacts.length ? configuredFacts : [
      'Measure a T-shirt you already love, then compare shoulder, chest and length.',
      'Oversized fit is designed to fall relaxed. Size up only if you want extra drape.',
      'Wash inside-out in cold water to protect print depth and fabric hand-feel.',
      'If you are between sizes, choose by shoulder width first, then chest.'
    ];
  }

  function sizeChartsPage() {
    const factHost = $('[data-size-chart-facts]');
    if (factHost) {
      const facts = sizeFacts().map((fact, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><p>${esc(fact)}</p></article>`).join('');
      factHost.innerHTML = `<div class="fit-facts-track"><div class="fit-facts-set">${facts}</div><div class="fit-facts-set" aria-hidden="true">${facts}</div></div>`;
    }

    const host = $('[data-size-charts]');
    if (!host) return;
    const charts = sizeCharts().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    host.innerHTML = charts.length ? charts.map((chart, index) => {
      const facts = split(chart.facts).length ? split(chart.facts) : split(chart.fit_notes);
      return `
        <article class="size-chart-card reveal" id="${esc(chart.slug || slugText(chart.title) || chart.id)}">
          <div class="size-chart-copy">
            <p class="eyebrow">${esc(chart.category || chart.product_type || 'VEYRATH fit')}</p>
            <h2>${esc(chart.title || 'Size chart')}</h2>
            <p>${esc(chart.description || 'Use this chart as your starting point before checkout.')}</p>
            ${facts.length ? `<ul>${facts.slice(0, 5).map((fact) => `<li>${esc(fact)}</li>`).join('')}</ul>` : ''}
          </div>
          <div class="size-chart-image">
            ${safeImage(chart.image_url) ? `<img src="${esc(safeImage(chart.image_url))}" alt="${esc(chart.image_alt || chart.title || 'VEYRATH size chart')}" loading="${index ? 'lazy' : 'eager'}">` : '<div class="chart-placeholder"><span>VEYRATH</span><strong>Chart coming soon</strong></div>'}
          </div>
        </article>`;
    }).join('') : emptyState('Size charts are being polished.', 'Upload oversized T-shirt, polo, lower and future fit charts from the admin panel.');
  }

  function collectionsPage() {
    const host = $('[data-collections]');
    const nav = $('[data-collection-nav]');
    if (!host) return;
    const activeCollections = collections().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    if (nav) {
      nav.innerHTML = activeCollections.map((collection) => `<a href="#${esc(collection.slug || collection.id)}">${esc(collection.title)}</a>`).join('');
    }
    host.innerHTML = activeCollections.length ? activeCollections.map((collection) => {
      const items = productsForCollection(collection.id);
      const cover = safeImage(collection.cover_image_url) || productImages(items[0] || {})[0] || 'veyrath-tee.jpg';
      const firstItem = items[0];
      const collectionKey = collection.slug || collection.id;
      return `
        <article class="collection-drop reveal" id="${esc(collection.slug || collection.id)}">
          <div class="collection-drop-hero">
            <img src="${esc(cover)}" alt="${esc(collection.title)} collection cover" loading="lazy">
            <div>
              <p class="eyebrow">${esc(collection.drop_label || 'VEYRATH collection')}</p>
              <h2>${esc(collection.title)}</h2>
              <p>${esc(collection.subtitle || collection.description || 'A connected set of VEYRATH pieces designed around one signal.')}</p>
              <span class="collection-piece-count">${items.length ? `${items.length} piece${items.length === 1 ? '' : 's'} inside` : 'Drop being arranged'}</span>
              ${items.length ? `
                <div class="collection-piece-picker">
                  <label>
                    <span>Choose from this collection</span>
                    <select data-collection-piece-select>
                      ${items.map((item) => {
                        const meta = [split(item.colours)[0], split(item.sizes).slice(0, 3).join('/')].filter(Boolean).join(' · ');
                        return `<option value="${esc(item.id)}">${esc(item.name)}${meta ? ` — ${esc(meta)}` : ''}</option>`;
                      }).join('')}
                    </select>
                  </label>
                  <div class="collection-piece-actions">
                    <button class="btn btn-gold" type="button" data-collection-open-piece="${esc(firstItem.id)}">View selected piece</button>
                    <a class="btn btn-ghost" href="shop.html?collection=${encodeURIComponent(collectionKey)}">Shop all pieces</a>
                  </div>
                  <small>Use the dropdown to view one shirt at a time. All variants stay available in Shop.</small>
                </div>` : `
                <p class="collection-empty-note">Products will enter this collection soon. Add pieces from the admin panel.</p>
                <a class="btn btn-ghost" href="shop.html?collection=${encodeURIComponent(collectionKey)}">Visit shop</a>`}
            </div>
          </div>
        </article>`;
    }).join('') : emptyState('Collections are being arranged.', 'Create astrology, essentials or drop-based collections from the admin panel.');
    $$('[data-collection-piece-select]', host).forEach((select) => {
      select.addEventListener('change', () => {
        const wrapper = select.closest('.collection-piece-picker');
        const button = $('[data-collection-open-piece]', wrapper);
        if (button) button.dataset.collectionOpenPiece = select.value;
      });
    });
    $$('[data-collection-open-piece]', host).forEach((button) => {
      button.addEventListener('click', () => {
        const product = products().find((item) => String(item.id) === String(button.dataset.collectionOpenPiece));
        openProduct(product);
      });
    });
  }

  function forms() {
    $$('.newsletter-form').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = new FormData(form).get('email').trim().toLowerCase();
      try {
        if (supabaseClient) {
          const { error } = await supabaseClient.from('newsletter_signups').insert({ email, source: location.pathname || 'website' });
          if (error && error.code !== '23505') throw error;
        } else {
          const entries = read(KEYS.newsletter, []);
          if (!entries.some((entry) => entry.email === email)) {
            entries.unshift({ id: crypto.randomUUID(), email, created_at: new Date().toISOString() });
            write(KEYS.newsletter, entries);
          }
        }
        form.reset();
        $('.form-message', form).textContent = 'You are inside the circle.';
        toast('Welcome to the Inner Circle.');
      } catch (_) {
        $('.form-message', form).textContent = 'Could not join right now. Please try again.';
      }
    }));

    $('#contactForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form));
      try {
        if (supabaseClient) {
          const { error } = await supabaseClient.from('inquiries').insert(payload);
          if (error) throw error;
        } else {
          const list = read(KEYS.inquiries, []);
          list.unshift({ id: crypto.randomUUID(), ...payload, status: 'new', created_at: new Date().toISOString() });
          write(KEYS.inquiries, list);
        }
        form.reset();
        $('.form-message', form).textContent = 'Signal received. We will reply soon.';
        toast('Your message reached VEYRATH.');
      } catch (_) {
        $('.form-message', form).textContent = 'Message could not be sent. Please try again.';
      }
    });

    const queryProduct = new URLSearchParams(location.search).get('product');
    if (queryProduct && $('#contactProduct')) $('#contactProduct').value = queryProduct;
  }

  function toast(message) {
    const element = $('.toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 2800);
  }

  function reveal() {
    const candidates = $$('.reveal,.section-head,.value-card,.support-card,.prose>*,.footer-grid>*,.product-card,.size-chart-card,.collection-drop');
    candidates.forEach((element, index) => {
      element.classList.add('reveal');
      if (!element.dataset.reveal) element.dataset.reveal = index % 3 === 0 ? 'left' : index % 3 === 1 ? 'up' : 'right';
    });
    if (!('IntersectionObserver' in window)) {
      candidates.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.target.classList.toggle('is-visible', entry.isIntersecting)), {
      threshold: 0.1,
      rootMargin: '-4% 0px -4%'
    });
    candidates.forEach((element) => observer.observe(element));
  }

  function intro() {
    if (document.body.dataset.page !== 'home') return;
    document.body.classList.add('intro-lock');
    document.body.insertAdjacentHTML('afterbegin', '<div class="luxury-intro" role="presentation"><button class="intro-skip" type="button">Skip intro</button><div class="intro-lines" aria-hidden="true"><i></i><i></i></div><div class="luxury-mark" aria-hidden="true"><div class="luxury-orbit"><i></i><i></i><i></i></div><div class="intro-word"><span>V</span><span>E</span><span>Y</span><span>R</span><span>A</span><span>T</span><span>H</span></div><small>Born After Dark</small></div><div class="intro-curtain intro-curtain-left"></div><div class="intro-curtain intro-curtain-right"></div></div>');
    const element = $('.luxury-intro');
    const finish = () => {
      if (!element || element.classList.contains('is-leaving')) return;
      element.classList.add('is-leaving');
      document.body.classList.remove('intro-lock');
      setTimeout(() => element.remove(), 1450);
    };
    requestAnimationFrame(() => element.classList.add('is-ready'));
    $('.intro-skip', element).addEventListener('click', finish);
    setTimeout(finish, 2850);
  }

  function schema() {
    const script = document.createElement('script');
    const base = location.origin + location.pathname.replace(/[^/]+$/, '');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${base}#organization`,
          name: 'VEYRATH',
          url: base,
          logo: new URL('logo.svg', location.href).href,
          slogan: 'Born After Dark',
          description: 'Premium Indian oversized streetwear with astrology-coded minimal design.'
        },
        {
          '@type': 'WebSite',
          '@id': `${base}#website`,
          name: 'VEYRATH',
          url: base,
          publisher: { '@id': `${base}#organization` },
          inLanguage: 'en-IN'
        }
      ]
    });
    document.head.appendChild(script);
  }

  async function init() {
    intro();
    chrome();
    await connectRemote();
    const page = document.body.dataset.page;
    if (page === 'home') home();
    if (page === 'shop') shop();
    if (page === 'size-charts') sizeChartsPage();
    if (page === 'collections') collectionsPage();
    forms();
    reveal();
    schema();
    $('.modal-close')?.addEventListener('click', () => $('#productModal').close());
    $('#productModal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
  }

  window.VeyrathStore = { KEYS, read, write, products, site, sizeCharts, collections, collectionProducts };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
