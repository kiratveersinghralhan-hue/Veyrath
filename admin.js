(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const seed = () => window.VEYRATH_SEED || { defaultProducts: [], defaultSlides: [], defaultSettings: {} };
  const localKey = 'veyrath_admin_local_session';
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fallback = {
    status: { available: false, isAdmin: false, mode: 'local', email: '' }, mode: 'local', init: async () => fallback.status,
    signIn: async () => { throw new Error('Supabase is unavailable. Use the local demo PIN.'); }, signOut: async () => {},
    getProducts: async () => clone(seed().defaultProducts), getHeroSlides: async () => clone(seed().defaultSlides), getSettings: async () => clone(seed().defaultSettings),
    saveProduct: async (item) => item, deleteProduct: async () => true, saveHeroSlides: async (items) => items, deleteHeroSlide: async () => true,
    saveSettings: async (value) => value, getAdminRecords: async () => [], importProducts: (items) => items
  };
  /* A second defensive boundary: admin stays usable even if both CDN and supabase.js fail. */
  const db = window.VeyrathDB || (window.VeyrathDB = fallback);

  let products = [];
  let slides = [];
  let settings = {};
  let localMode = sessionStorage.getItem(localKey) === 'yes';

  const statusText = (form, message) => { const node = $('.form-status', form); if (node) node.textContent = message; };
  const split = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const formObject = (form) => Object.fromEntries(new FormData(form));
  const mode = () => db.status?.isAdmin ? 'supabase' : 'local';

  function showMode() {
    const live = mode() === 'supabase';
    const badge = $('#modeBadge'); badge.textContent = live ? 'Supabase live mode' : 'Local demo mode'; badge.classList.toggle('is-live', live);
    $('#adminModeText').textContent = live ? `Changes publish to Supabase${db.status.email ? ` as ${db.status.email}` : ''}.` : 'Changes stay in this browser until you export or configure Supabase.';
  }

  function openDashboard() {
    $('#adminLogin').hidden = true; $('#adminDashboard').hidden = false; $('#adminSignOut').hidden = false; showMode(); loadAll();
  }

  function openLogin() {
    $('#adminLogin').hidden = false; $('#adminDashboard').hidden = true; $('#adminSignOut').hidden = true;
    const badge = $('#modeBadge'); badge.textContent = db.status?.available ? 'Supabase ready' : 'Local fallback ready'; badge.classList.toggle('is-live', Boolean(db.status?.available));
  }

  async function loadAll() {
    try {
      [products, slides, settings] = await Promise.all([db.getProducts({ includeUnpublished: true }), db.getHeroSlides({ includeUnpublished: true }), db.getSettings()]);
      renderProducts(); renderSlides(); fillSettings(); await loadRecords(); updateStats();
    } catch (error) { console.error(error); alert(`Could not load admin data: ${error.message}`); }
  }

  function updateStats() {
    $('#statProducts').textContent = products.length; $('#statPublished').textContent = products.filter((item) => item.is_published !== false).length; $('#statFeatured').textContent = products.filter((item) => item.is_featured).length;
  }

  function activateTab(name) {
    $$('.admin-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.adminTab === name));
    $$('.admin-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.adminPanel === name));
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderProducts() {
    $('#productsTable').innerHTML = products.map((item) => `<tr><td>${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : '—'}</td><td><strong>${esc(item.name)}</strong><br><small>${esc(item.category)} · ${esc(item.style || '')}</small></td><td>₹${Number(item.sale_price || item.price || 0).toLocaleString('en-IN')}</td><td><small>${item.is_published !== false ? 'Published' : 'Draft'}${item.is_featured ? ' · Featured' : ''}</small></td><td><div class="table-actions"><button class="icon-btn" type="button" data-edit-product="${esc(item.id)}" title="Edit">✎</button><button class="icon-btn" type="button" data-toggle-product="${esc(item.id)}" title="Publish or unpublish">◐</button><button class="icon-btn" type="button" data-delete-product="${esc(item.id)}" title="Delete">×</button></div></td></tr>`).join('') || '<tr><td colspan="5">No products yet.</td></tr>';
    $$('[data-edit-product]').forEach((button) => button.addEventListener('click', () => editProduct(button.dataset.editProduct)));
    $$('[data-toggle-product]').forEach((button) => button.addEventListener('click', async () => { const item = products.find((p) => String(p.id) === button.dataset.toggleProduct); if (!item) return; item.is_published = item.is_published === false; await db.saveProduct(item); await loadAll(); }));
    $$('[data-delete-product]').forEach((button) => button.addEventListener('click', async () => { const item = products.find((p) => String(p.id) === button.dataset.deleteProduct); if (!item || !confirm(`Delete “${item.name}”? This cannot be undone in live mode.`)) return; await db.deleteProduct(item.id); await loadAll(); }));
    const select = $('#showcaseProduct'); select.innerHTML = products.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join(''); if (settings.showcase?.product_id) select.value = settings.showcase.product_id;
  }

  function editProduct(id) {
    const item = products.find((product) => String(product.id) === String(id)); if (!item) return;
    const form = $('#productForm'); Object.entries(item).forEach(([key, value]) => { const field = form.elements[key]; if (!field) return; if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = Array.isArray(value) ? value.join(', ') : (value ?? ''); });
    $('#productFormTitle').textContent = `Edit ${item.name}`; activateTab('products'); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetProductForm() { const form = $('#productForm'); form.reset(); form.elements.id.value = ''; form.elements.rating.value = '4.5'; form.elements.sort_order.value = '0'; form.elements.is_published.checked = true; $('#productFormTitle').textContent = 'Add product'; statusText(form, ''); }

  async function saveProduct(event) {
    event.preventDefault(); const form = event.currentTarget; const raw = formObject(form);
    const old = products.find((item) => String(item.id) === String(raw.id)) || {};
    const item = { ...old, id: raw.id || undefined, name: raw.name.trim(), slug: raw.slug.trim() || slugify(raw.name), price: Number(raw.price), sale_price: raw.sale_price ? Number(raw.sale_price) : null, rating: Number(raw.rating || 0), sort_order: Number(raw.sort_order || 0), category: raw.category, gender: raw.gender, sizes: split(raw.sizes), colours: split(raw.colours), style: raw.style.trim(), image_url: raw.image_url.trim(), front_image_url: raw.front_image_url.trim(), back_image_url: raw.back_image_url.trim(), blinkstore_url: raw.blinkstore_url.trim(), description: raw.description.trim(), is_published: form.elements.is_published.checked, is_featured: form.elements.is_featured.checked };
    statusText(form, 'Saving…');
    try { await db.saveProduct(item); resetProductForm(); statusText(form, 'Saved. The catalogue data is current.'); await loadAll(); }
    catch (error) { statusText(form, error.message || 'Could not save product.'); }
  }

  function renderSlides() {
    $('#heroList').innerHTML = slides.map((slide, index) => `<div class="data-row"><small>${String(index + 1).padStart(2, '0')} · ${slide.is_published !== false ? 'Published' : 'Draft'}</small><strong>${esc(slide.title)}</strong><span>${esc(slide.eyebrow || '')}</span><div class="table-actions"><button class="btn btn--small btn--outline" type="button" data-edit-slide="${esc(slide.id)}">Edit</button><button class="icon-btn" type="button" data-slide-up="${esc(slide.id)}" title="Move up">↑</button><button class="icon-btn" type="button" data-delete-slide="${esc(slide.id)}" title="Delete">×</button></div></div>`).join('') || '<p>No hero slides yet.</p>';
    $$('[data-edit-slide]').forEach((button) => button.addEventListener('click', () => editSlide(button.dataset.editSlide)));
    $$('[data-slide-up]').forEach((button) => button.addEventListener('click', async () => { const index = slides.findIndex((s) => String(s.id) === button.dataset.slideUp); if (index <= 0) return; [slides[index - 1], slides[index]] = [slides[index], slides[index - 1]]; await db.saveHeroSlides(slides); await loadAll(); }));
    $$('[data-delete-slide]').forEach((button) => button.addEventListener('click', async () => { const slide = slides.find((s) => String(s.id) === button.dataset.deleteSlide); if (!slide || !confirm(`Delete hero slide “${slide.title}”?`)) return; await db.deleteHeroSlide(slide.id); await loadAll(); }));
  }

  function editSlide(id) {
    const item = slides.find((slide) => String(slide.id) === String(id)); if (!item) return;
    const form = $('#heroForm'); Object.entries(item).forEach(([key, value]) => { const field = form.elements[key]; if (!field) return; if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = value ?? ''; });
    $('#heroFormTitle').textContent = 'Edit hero slide'; activateTab('hero');
  }
  function resetHeroForm() { const form = $('#heroForm'); form.reset(); form.elements.id.value = ''; form.elements.is_published.checked = true; $('#heroFormTitle').textContent = 'Add slide'; statusText(form, ''); }
  async function saveSlide(event) {
    event.preventDefault(); const form = event.currentTarget; const raw = formObject(form); const existing = slides.find((item) => String(item.id) === String(raw.id));
    const item = { ...(existing || {}), id: raw.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), eyebrow: raw.eyebrow.trim(), title: raw.title.trim(), text: raw.text.trim(), cta_label: raw.cta_label.trim(), cta_link: raw.cta_link.trim(), is_published: form.elements.is_published.checked, sort_order: existing?.sort_order || slides.length + 1 };
    if (existing) slides[slides.indexOf(existing)] = item; else slides.push(item); statusText(form, 'Saving…');
    try { await db.saveHeroSlides(slides); resetHeroForm(); statusText(form, 'Hero slide saved.'); await loadAll(); }
    catch (error) { statusText(form, error.message || 'Could not save slide.'); }
  }

  function fillSettings() {
    const showcase = settings.showcase || {};
    const sForm = $('#showcaseForm'); Object.entries(showcase).forEach(([key, value]) => { if (sForm.elements[key]) sForm.elements[key].value = value ?? ''; });
    if (showcase.product_id && sForm.elements.product_id) sForm.elements.product_id.value = showcase.product_id;
    const general = $('#siteSettingsForm'); ['collection_title', 'hero_media_url', 'announcement'].forEach((key) => { general.elements[key].value = typeof settings[key] === 'string' ? settings[key] : ''; });
  }

  async function saveShowcase(event) { event.preventDefault(); const form = event.currentTarget; settings.showcase = formObject(form); statusText(form, 'Saving…'); try { await db.saveSettings(settings); statusText(form, 'Showcase saved. Front/back rotation will use these images.'); } catch (error) { statusText(form, error.message); } }
  async function saveSiteSettings(event) { event.preventDefault(); const form = event.currentTarget; settings = { ...settings, ...formObject(form) }; statusText(form, 'Saving…'); try { await db.saveSettings(settings); statusText(form, 'Site settings saved.'); } catch (error) { statusText(form, error.message); } }

  async function loadRecords() {
    try {
      const [inquiries, newsletter, events] = await Promise.all([db.getAdminRecords('inquiries'), db.getAdminRecords('newsletter_signups'), db.getAdminRecords('event_logs')]);
      $('#statInquiries').textContent = inquiries.length;
      $('#inquiryList').innerHTML = inquiries.map((item) => `<div class="data-row"><small>${esc(formatDate(item.created_at))} · ${esc(item.subject || 'Inquiry')}</small><strong>${esc(item.name || 'Anonymous')} · ${esc(item.email || '')}</strong><span>${esc(item.message || item.product || '')}</span></div>`).join('') || '<p>No inquiries yet.</p>';
      $('#newsletterList').innerHTML = newsletter.map((item) => `<div class="data-row"><small>${esc(formatDate(item.created_at))} · ${esc(item.source || 'Website')}</small><strong>${esc(item.email)}</strong></div>`).join('') || '<p>No signups yet.</p>';
      $('#eventList').innerHTML = events.map((item) => `<div class="data-row"><small>${esc(formatDate(item.created_at))} · ${esc(item.page_path || '')}</small><strong>${esc(item.event_name)}</strong><span>${esc(JSON.stringify(item.metadata || {}))}</span></div>`).join('') || '<p>No events yet.</p>';
    } catch (error) { console.info('Admin records unavailable:', error.message); }
  }
  function formatDate(value) { return value ? new Date(value).toLocaleString('en-IN') : 'Local record'; }

  function exportProducts() {
    const source = `/* VEYRATH catalogue export — ${new Date().toISOString()} */\n(function(){\n  const defaultProducts = ${JSON.stringify(products, null, 2)};\n  const defaultSlides = ${JSON.stringify(slides, null, 2)};\n  const defaultSettings = ${JSON.stringify(settings, null, 2)};\n  window.VEYRATH_SEED = Object.freeze({ defaultProducts, defaultSlides, defaultSettings });\n})();\n`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' })); const link = document.createElement('a'); link.href = url; link.download = 'products.js'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function importProducts(event) {
    event.preventDefault(); const form = event.currentTarget; const status = $('.form-status', form);
    try {
      const items = JSON.parse($('#importJson').value); if (!Array.isArray(items)) throw new Error('JSON must be an array.');
      const normalized = items.map((item) => ({ is_published: true, is_featured: false, ...item, id: item.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())) }));
      if (mode() === 'supabase') for (const item of normalized) await db.saveProduct(item); else db.importProducts(normalized);
      status.textContent = `${normalized.length} products imported.`; await loadAll();
    } catch (error) { status.textContent = `Import failed: ${error.message}`; }
  }

  function bind() {
    $$('.admin-tab').forEach((tab) => tab.addEventListener('click', () => activateTab(tab.dataset.adminTab)));
    $$('[data-tab-target]').forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.tabTarget)));
    $('#productForm').addEventListener('submit', saveProduct); $('#productReset').addEventListener('click', resetProductForm);
    $('#heroForm').addEventListener('submit', saveSlide); $('#heroReset').addEventListener('click', resetHeroForm);
    $('#showcaseForm').addEventListener('submit', saveShowcase); $('#siteSettingsForm').addEventListener('submit', saveSiteSettings);
    $('#exportProducts').addEventListener('click', exportProducts); $('#importForm').addEventListener('submit', importProducts); $('#seedJson').addEventListener('click', () => { $('#importJson').value = JSON.stringify(seed().defaultProducts, null, 2); });
    $('#supabaseLoginForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; statusText(form, 'Checking Supabase access…'); try { await db.signIn($('#adminEmail').value, $('#adminPassword').value); localMode = false; sessionStorage.removeItem(localKey); statusText(form, 'Access accepted.'); openDashboard(); } catch (error) { statusText(form, error.message || 'Sign-in failed.'); } });
    $('#localLoginForm').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; if ($('#localPin').value === 'veyrath-admin') { localMode = true; sessionStorage.setItem(localKey, 'yes'); openDashboard(); } else statusText(form, 'That local PIN is not correct.'); });
    $('#adminSignOut').addEventListener('click', async () => { await db.signOut(); localMode = false; sessionStorage.removeItem(localKey); openLogin(); });
  }

  async function init() {
    bind(); await db.init();
    if (db.status?.isAdmin || localMode) openDashboard(); else openLogin();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
