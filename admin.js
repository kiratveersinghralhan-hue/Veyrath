(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
  const split = (value) => Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  const lines = (value) => String(value || '').split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uuid = () => crypto.randomUUID();
  const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const slugify = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const safeImage = (value = '') => /^(https?:\/\/[^\s"'<>]+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+|[a-z0-9_.-]+\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?)$/i.test(String(value).trim()) ? String(value).trim() : '';
  const galleryOf = (product = {}) => [...new Set([product.image_url, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean))];
  const productPrice = (product = {}) => Number(product.sale_price || product.selling_price || product.price || 0);

  const config = window.VEYRATH_SUPABASE || {};
  const configured = Boolean(/^https:\/\//.test(config.url || '') && config.anonKey && !config.anonKey.includes('YOUR_'));
  const projectRef = (() => {
    try { return new URL(config.url).hostname.split('.')[0]; } catch (_) { return ''; }
  })();
  const storageKey = `veyrath-admin-${projectRef || 'unconfigured'}-auth`;

  let client = null;
  let products = [];
  let orders = [];
  let inquiries = [];
  let newsletter = [];
  let sizeCharts = [];
  let collections = [];
  let collectionProducts = [];
  let siteData = clone(window.VEYRATH_SITE_DATA || {});
  let featureSchemaReady = true;

  function message(form, text) {
    const node = $('.form-message', form);
    if (node) node.textContent = text;
  }

  function status(text, tone = '') {
    const node = $('#ordersStatus');
    if (node) {
      node.textContent = text;
      node.dataset.tone = tone;
    }
  }

  function activate(name) {
    $$('.admin-nav button').forEach((button) => button.classList.toggle('is-active', button.dataset.adminTab === name));
    $$('.admin-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.adminPanel === name));
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openLogin(note = '') {
    $('#adminApp').hidden = true;
    $('#adminLogin').hidden = false;
    if (note) message($('#loginForm'), note);
  }

  async function openApp() {
    $('#adminLogin').hidden = true;
    $('#adminApp').hidden = false;
    await loadAll();
  }

  function ensureLoginHelpers() {
    const form = $('#loginForm');
    const chip = document.createElement('p');
    chip.className = 'admin-project-chip';
    chip.id = 'adminProjectStatus';
    chip.textContent = configured ? `Connected Supabase project: ${projectRef}` : 'Supabase project is not configured.';
    form.querySelector('h1').insertAdjacentElement('afterend', chip);
    const button = document.createElement('button');
    button.className = 'admin-session-reset';
    button.id = 'adminClearSession';
    button.type = 'button';
    button.textContent = 'Clear saved Supabase session';
    $('#adminMagicLink').insertAdjacentElement('afterend', button);
  }

  async function connectClient() {
    if (!configured) return false;
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey }
    });
    return true;
  }

  async function isAdmin() {
    const { data: user } = await client.auth.getUser();
    if (!user?.user) return false;
    const { data } = await client.from('admin_users').select('user_id').eq('user_id', user.user.id).eq('is_active', true).maybeSingle();
    return Boolean(data);
  }

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    message(form, 'Verifying secure access…');
    const { error } = await client.auth.signInWithPassword({
      email: $('#adminEmail').value.trim(),
      password: $('#adminPassword').value
    });
    if (error) {
      return message(form, /invalid login credentials/i.test(error.message)
        ? `Supabase rejected this login inside project ${projectRef}. Verify the VEYRATH project and Auth user.`
        : error.message);
    }
    if (!(await isAdmin())) {
      await client.auth.signOut();
      return message(form, 'Login worked, but this user is not an active VEYRATH admin. Run admin-access.sql in this project.');
    }
    $('#adminPassword').value = '';
    await openApp();
  }

  async function magicLink() {
    const email = $('#adminEmail').value.trim();
    if (!email) return message($('#loginForm'), 'Enter your admin email first.');
    message($('#loginForm'), 'Requesting a secure sign-in link…');
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: new URL('admin.html', location.href).href, shouldCreateUser: false }
    });
    message($('#loginForm'), error ? error.message : `Secure sign-in link sent from project ${projectRef}.`);
  }

  function clearSession() {
    Object.keys(localStorage)
      .filter((key) => key === storageKey || key.startsWith('sb-') || key.startsWith('veyrath-admin-'))
      .forEach((key) => localStorage.removeItem(key));
    message($('#loginForm'), 'Saved Supabase sessions cleared. Refresh before signing in again.');
  }

  async function loadAll() {
    status('Refreshing secure data…');
    const [catalogue, orderData, settings, slides, inbox, audience, chartRows, collectionRows, membershipRows] = await Promise.all([
      client.from('admin_products').select('*').order('sort_order', { ascending: false }),
      client.from('orders').select('*,order_items(*)').order('created_at', { ascending: false }).limit(500),
      client.from('site_settings').select('value').eq('key', 'site_data').maybeSingle(),
      client.from('hero_slides').select('*').order('sort_order'),
      client.from('inquiries').select('*').order('created_at', { ascending: false }).limit(250),
      client.from('newsletter_signups').select('*').order('created_at', { ascending: false }).limit(500),
      client.from('size_charts').select('*').order('sort_order'),
      client.from('collections').select('*').order('sort_order'),
      client.from('collection_products').select('*').order('sort_order')
    ]);

    const firstCoreError = [catalogue, orderData, settings, slides, inbox, audience].find((result) => result.error)?.error;
    if (firstCoreError) {
      status(firstCoreError.message, 'error');
      throw firstCoreError;
    }

    const featureErrors = [chartRows, collectionRows, membershipRows].filter((result) => result.error).map((result) => result.error);
    featureSchemaReady = featureErrors.length === 0;
    products = catalogue.data || [];
    orders = orderData.data || [];
    inquiries = inbox.data || [];
    newsletter = audience.data || [];
    sizeCharts = chartRows.error ? [] : (chartRows.data || []);
    collections = collectionRows.error ? [] : (collectionRows.data || []);
    collectionProducts = membershipRows.error ? [] : (membershipRows.data || []);
    siteData = { ...clone(window.VEYRATH_SITE_DATA || {}), ...(settings.data?.value || {}) };
    if (slides.data?.length) {
      siteData.banners = slides.data.map((slide) => ({
        id: slide.id,
        eyebrow: slide.eyebrow,
        heading: slide.heading,
        text: slide.body,
        image_url: slide.image_url,
        align: slide.align
      }));
    }
    renderAll();
    if (!featureSchemaReady) {
      status('Run veyrath-feature-upgrade-collections-sizecharts.sql once to enable collections and size charts.', 'error');
      return;
    }
    status(`Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`);
  }

  function profit(product) {
    const selling = Number(product.selling_price) > 0 ? Number(product.selling_price) : Number(product.price);
    return selling - Number(product.base_cost || 0) - Number(product.shipping_cost || 0);
  }

  function renderProducts() {
    $('#productsTable').innerHTML = products.map((product) => {
      const gallery = galleryOf(product);
      const collectionCount = collectionProducts.filter((item) => String(item.product_id) === String(product.id)).length;
      return `<tr><td><img src="${esc(gallery[0] || product.front_design_url || 'veyrath-tee.jpg')}" alt=""></td><td><strong>${esc(product.name)}</strong><br><small>${esc(product.category)} · ${product.is_published ? 'Published' : 'Draft'} · ${gallery.length} image${gallery.length === 1 ? '' : 's'}</small></td><td>${money(Number(product.selling_price) || product.price)}<br><small>Profit ${money(profit(product))}</small></td><td><span class="status-pill ${product.is_home_pinned ? 'status-ready' : 'status-planned'}">${product.is_home_pinned ? 'Home pinned' : 'Not pinned'}</span><br><small>${collectionCount} collection${collectionCount === 1 ? '' : 's'} · order ${Number(product.home_sort_order || 0)}</small></td><td><div class="table-buttons"><button type="button" data-edit-product="${product.id}" aria-label="Edit ${esc(product.name)}">Edit</button><button type="button" data-toggle-product="${product.id}">${product.is_published ? 'Draft' : 'Publish'}</button><button class="danger" type="button" data-delete-product="${product.id}">Delete</button></div></td></tr>`;
    }).join('') || '<tr><td colspan="5">No products yet.</td></tr>';
  }

  function editProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const form = $('#productForm');
    Object.entries(product).forEach(([key, value]) => {
      const field = form.elements[key];
      if (!field || field.type === 'file') return;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else if (key === 'printrove_variant_map') field.value = JSON.stringify(value || {}, null, 2);
      else field.value = Array.isArray(value) ? value.join(', ') : (value ?? '');
    });
    form.elements.profit_estimate.value = money(profit(product));
    const count = galleryOf(product).length;
    $('#productGalleryStatus').textContent = `${count} existing image${count === 1 ? '' : 's'}. Select new files only to replace this gallery.`;
    $('#productFormTitle').textContent = `Edit ${product.name}`;
    activate('products');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetProduct() {
    const form = $('#productForm');
    form.reset();
    form.elements.id.value = '';
    form.elements.rating.value = '4.5';
    form.elements.sort_order.value = '0';
    form.elements.home_sort_order.value = '0';
    form.elements.profit_estimate.value = '₹0';
    form.elements.is_published.checked = true;
    form.elements.is_featured.checked = false;
    form.elements.is_home_pinned.checked = false;
    $('#productGalleryStatus').textContent = 'No new files selected.';
    $('#productFormTitle').textContent = 'Add product';
    message(form, '');
  }

  function updateProfit() {
    const form = $('#productForm');
    const selling = Number(form.elements.selling_price.value) || Number(form.elements.price.value);
    form.elements.profit_estimate.value = money(selling - Number(form.elements.base_cost.value || 0) - Number(form.elements.shipping_cost.value || 0));
  }

  function compressedImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) return reject(new Error('Choose JPG, PNG or WebP images.'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error(`${file.name} is larger than 5 MB.`));
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`${file.name} could not be opened.`));
      };
      image.onload = () => {
        const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#101010';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`${file.name} could not be compressed.`)), 'image/webp', 0.88);
      };
      image.src = objectUrl;
    });
  }

  async function uploadGallery(files, productId, slug, form) {
    if (!files.length) return [];
    if (files.length > 30) throw new Error('Upload a maximum of 30 gallery images at once.');
    const bucket = client.storage.from('product-images');
    const stamp = Date.now();
    const uploaded = [];
    const newPaths = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        message(form, `Preparing and uploading image ${index + 1} of ${files.length}…`);
        const blob = await compressedImage(files[index]);
        const fileSlug = slugify(files[index].name.replace(/\.[^.]+$/, '')).slice(0, 55) || `image-${index + 1}`;
        const path = `${productId}/${stamp}-${String(index + 1).padStart(2, '0')}-${slug}-${fileSlug}.webp`;
        const { error } = await bucket.upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
        if (error) throw new Error(`${error.message}. Run product-gallery-migration.sql once in this Supabase project.`);
        const { data } = bucket.getPublicUrl(path);
        uploaded.push(data.publicUrl);
        newPaths.push(path);
      }
    } catch (error) {
      if (newPaths.length) await bucket.remove(newPaths);
      throw error;
    }
    const { data: oldFiles } = await bucket.list(productId, { limit: 100 });
    const stale = (oldFiles || []).map((item) => `${productId}/${item.name}`).filter((path) => !newPaths.includes(path));
    if (stale.length) await bucket.remove(stale);
    return uploaded;
  }

  async function uploadSingleImage(file, folder, ownerId, slug, form, label) {
    if (!file) return '';
    const bucket = client.storage.from('product-images');
    message(form, `Uploading ${label} image…`);
    const blob = await compressedImage(file);
    const fileSlug = slugify(file.name.replace(/\.[^.]+$/, '')).slice(0, 55) || label;
    const path = `${folder}/${ownerId}/${Date.now()}-${slug}-${fileSlug}.webp`;
    const { error } = await bucket.upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
    if (error) throw new Error(`${error.message}. Make sure product-gallery-migration.sql has been run.`);
    const { data } = bucket.getPublicUrl(path);
    return data.publicUrl;
  }

  function gallerySelection() {
    const files = [...($('#productForm').elements.image_files.files || [])];
    const total = files.reduce((sum, file) => sum + file.size, 0);
    $('#productGalleryStatus').textContent = files.length
      ? `${files.length} new image${files.length === 1 ? '' : 's'} selected (${(total / 1024 / 1024).toFixed(1)} MB before compression).`
      : 'No new files selected.';
  }

  async function submitProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const existing = products.find((product) => product.id === raw.id);
    message(form, 'Saving securely…');
    try {
      let variantMap = {};
      if (raw.printrove_variant_map.trim()) {
        variantMap = JSON.parse(raw.printrove_variant_map);
        if (!variantMap || Array.isArray(variantMap) || typeof variantMap !== 'object') throw new Error('Variant map must be a JSON object.');
      }
      const productId = raw.id || uuid();
      const productSlug = raw.slug.trim() || slugify(raw.name);
      const selectedFiles = [...form.elements.image_files.files];
      const uploaded = await uploadGallery(selectedFiles, productId, productSlug, form);
      const existingGallery = galleryOf(existing);
      let gallery = uploaded.length ? uploaded : existingGallery;
      const manualCover = raw.image_url.trim();
      if (manualCover && !uploaded.length) gallery = [manualCover, ...gallery.filter((url) => url !== manualCover)];
      const cover = gallery[0] || manualCover || existing?.image_url || '';
      const selling = Number(raw.selling_price || 0);
      const base = Number(raw.base_cost || 0);
      const shipping = Number(raw.shipping_cost || 0);
      const payload = {
        id: productId,
        name: raw.name.trim(),
        slug: productSlug,
        description: raw.description.trim(),
        price: Number(raw.price),
        selling_price: selling,
        compare_at_price: Number(raw.compare_at_price || 0),
        currency: 'INR',
        category: raw.category,
        gender: raw.gender,
        sizes: split(raw.sizes),
        colours: split(raw.colours),
        tags: split(raw.tags),
        style: split(raw.tags),
        rating: Number(raw.rating || 0),
        sort_order: Number(raw.sort_order || 0),
        home_sort_order: Number(raw.home_sort_order || 0),
        images: gallery,
        image_url: cover,
        front_design_url: raw.front_design_url.trim(),
        back_design_url: raw.back_design_url.trim(),
        printrove_sku: raw.printrove_sku.trim(),
        printrove_product_id: raw.printrove_product_id.trim(),
        printrove_variant_id: raw.printrove_variant_id.trim(),
        printrove_variant_map: variantMap,
        printrove_product_type: raw.printrove_product_type.trim(),
        print_type: raw.print_type.trim(),
        base_cost: base,
        shipping_cost: shipping,
        profit_margin: (selling || Number(raw.price)) - base - shipping,
        fulfilment_status: raw.fulfilment_status,
        external_url: raw.external_url.trim(),
        is_published: form.elements.is_published.checked,
        is_featured: form.elements.is_featured.checked,
        is_home_pinned: form.elements.is_home_pinned.checked
      };
      const { error } = await client.from('products').upsert(payload);
      if (error) throw error;
      resetProduct();
      await loadAll();
      message(form, 'Product saved to Supabase.');
    } catch (error) {
      message(form, error.message);
    }
  }

  function orderVisible(order, filter) {
    if (filter === 'paid') return order.payment_status === 'paid';
    if (filter === 'pending') return order.payment_status === 'pending';
    if (filter === 'printrove_failed') return order.fulfilment_status === 'printrove_failed';
    if (filter === 'admin_hold') return order.admin_hold;
    return true;
  }

  function renderOrders() {
    const filter = $('#orderFilter').value;
    const visible = orders.filter((order) => orderVisible(order, filter));
    $('#ordersTable').innerHTML = visible.map((order) => {
      const items = (order.order_items || []).map((item) => `${item.quantity}× ${esc(item.product_name)} <small>${esc(item.colour)} / ${esc(item.size)}</small>`).join('<br>');
      const canSend = order.payment_status === 'paid' && !order.admin_hold && ['not_sent', 'printrove_failed'].includes(order.fulfilment_status);
      return `<tr><td><strong>${esc(order.order_number)}</strong><br><small>${new Date(order.created_at).toLocaleString('en-IN')}</small></td><td><strong>${esc(order.customer_name)}</strong><br><small>${esc(order.customer_phone)} · ${esc(order.customer_email)}</small><br><small>${esc([order.address_line1, order.address_line2, order.city, order.state, order.pincode].filter(Boolean).join(', '))}</small></td><td>${items || 'No items'}</td><td><span class="status-pill status-${esc(order.payment_status)}">${esc(order.payment_status)}</span>${order.razorpay_payment_id ? `<br><small>${esc(order.razorpay_payment_id)}</small>` : ''}</td><td><span class="status-pill status-${esc(order.fulfilment_status)}">${esc(order.fulfilment_status)}</span>${order.printrove_order_id ? `<br><small>ID ${esc(order.printrove_order_id)} · ${esc(order.printrove_status || '')}</small>` : ''}${order.admin_hold ? '<br><span class="hold-note">Manual hold</span>' : ''}</td><td><strong>${money(order.total_amount)}</strong><br><small>Shipping ${money(order.shipping_amount)}</small></td><td><div class="order-actions">${canSend ? `<button class="primary" type="button" data-send-printrove="${order.id}">${order.fulfilment_status === 'printrove_failed' ? 'Retry Printrove' : 'Send to Printrove'}</button>` : ''}${order.printrove_order_id ? `<button type="button" data-sync-printrove="${order.id}">Sync status</button>` : ''}<button type="button" data-toggle-hold="${order.id}">${order.admin_hold ? 'Release hold' : 'Mark issue / hold'}</button></div></td></tr>`;
    }).join('') || '<tr><td colspan="7">No orders match this filter.</td></tr>';
  }

  async function functionMessage(error, fallback) {
    try {
      const body = await error?.context?.json();
      return body?.error || fallback;
    } catch (_) {
      return error?.message || fallback;
    }
  }

  async function invokeOrderFunction(name, orderId) {
    status(`${name === 'send-to-printrove' ? 'Sending to Printrove' : 'Syncing status'}…`);
    const { data, error } = await client.functions.invoke(name, { body: { order_id: orderId } });
    if (error || !data?.success) throw new Error(await functionMessage(error, data?.error || 'Function request failed.'));
    await loadAll();
    return data;
  }

  async function orderAction(event) {
    const send = event.target.closest('[data-send-printrove]');
    const sync = event.target.closest('[data-sync-printrove]');
    const hold = event.target.closest('[data-toggle-hold]');
    if (!send && !sync && !hold) return;
    try {
      if (send) {
        const order = orders.find((item) => item.id === send.dataset.sendPrintrove);
        if (!confirm(`Send paid order ${order?.order_number || ''} to Printrove now?`)) return;
        send.disabled = true;
        await invokeOrderFunction('send-to-printrove', send.dataset.sendPrintrove);
        status('Printrove order created.', 'success');
      }
      if (sync) {
        sync.disabled = true;
        await invokeOrderFunction('sync-printrove-status', sync.dataset.syncPrintrove);
        status('Printrove status updated.', 'success');
      }
      if (hold) {
        const order = orders.find((item) => item.id === hold.dataset.toggleHold);
        const { error } = await client.from('orders').update({
          admin_hold: !order.admin_hold,
          notes: !order.admin_hold ? `${order.notes || ''}\nManual hold set ${new Date().toISOString()}`.trim() : order.notes
        }).eq('id', order.id);
        if (error) throw error;
        await loadAll();
        status(order.admin_hold ? 'Manual hold released.' : 'Order placed on manual hold.', 'success');
      }
    } catch (error) {
      status(error.message, 'error');
      if (send) send.disabled = false;
      if (sync) sync.disabled = false;
    }
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function exportOrders() {
    const headers = ['Order number', 'Created', 'Customer', 'Phone', 'Email', 'Address', 'Items', 'Subtotal', 'Shipping', 'Total', 'Payment status', 'Razorpay payment ID', 'Fulfilment status', 'Printrove order ID', 'Printrove status', 'Admin hold'];
    const rows = orders.map((order) => [
      order.order_number,
      order.created_at,
      order.customer_name,
      order.customer_phone,
      order.customer_email,
      [order.address_line1, order.address_line2, order.city, order.state, order.pincode].filter(Boolean).join(', '),
      (order.order_items || []).map((item) => `${item.quantity}x ${item.product_name} ${item.colour}/${item.size}`).join('; '),
      order.subtotal,
      order.shipping_amount,
      order.total_amount,
      order.payment_status,
      order.razorpay_payment_id,
      order.fulfilment_status,
      order.printrove_order_id,
      order.printrove_status,
      order.admin_hold
    ].map(csvCell).join(','));
    download(`veyrath-orders-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${headers.map(csvCell).join(',')}\n${rows.join('\n')}`, 'text/csv;charset=utf-8');
  }

  function populateHomepage() {
    const form = $('#homepageForm');
    const hero = siteData.hero || {};
    const values = {
      hero_eyebrow: hero.eyebrow,
      hero_heading: hero.heading,
      hero_subheading: hero.subheading,
      primary_label: hero.primary_label,
      primary_link: hero.primary_link,
      secondary_label: hero.secondary_label,
      secondary_link: hero.secondary_link,
      hero_image: hero.image_url,
      about_text: siteData.about_text,
      marquee_text: siteData.marquee_text,
      category_intro: siteData.category_intro,
      size_facts: Array.isArray(siteData.size_facts) ? siteData.size_facts.join('\n') : ''
    };
    Object.entries(values).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value || '';
    });
  }

  async function submitHomepage(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    siteData.hero = {
      ...(siteData.hero || {}),
      eyebrow: values.hero_eyebrow.trim(),
      heading: values.hero_heading.trim(),
      subheading: values.hero_subheading.trim(),
      primary_label: values.primary_label.trim(),
      primary_link: values.primary_link.trim(),
      secondary_label: values.secondary_label.trim(),
      secondary_link: values.secondary_link.trim(),
      image_url: values.hero_image.trim()
    };
    siteData.about_text = values.about_text.trim();
    siteData.marquee_text = values.marquee_text.trim();
    siteData.category_intro = values.category_intro.trim();
    siteData.size_facts = lines(values.size_facts);
    const { error } = await client.from('site_settings').upsert({ key: 'site_data', value: siteData, is_public: true });
    message(form, error ? error.message : 'Homepage saved.');
  }

  function renderHomePins() {
    const host = $('#homePinList');
    if (!host) return;
    const sorted = [...products].sort((a, b) => Number(b.home_sort_order || 0) - Number(a.home_sort_order || 0) || Number(b.sort_order || 0) - Number(a.sort_order || 0));
    host.innerHTML = sorted.map((product) => {
      const image = galleryOf(product)[0] || product.image_url || 'veyrath-tee.jpg';
      return `<article class="home-pin-row"><img src="${esc(image)}" alt=""><div><strong>${esc(product.name)}</strong><small>${product.is_home_pinned ? 'Pinned to home' : 'Not pinned'} · ${esc(product.category || '')}</small></div><label>Order <input type="number" value="${Number(product.home_sort_order || 0)}" data-home-sort="${product.id}"></label><button type="button" data-save-home-sort="${product.id}">Save order</button><button type="button" data-toggle-home-pin="${product.id}">${product.is_home_pinned ? 'Unpin' : 'Pin'}</button></article>`;
    }).join('') || '<p>No products yet.</p>';
  }

  async function homePinAction(event) {
    const toggle = event.target.closest('[data-toggle-home-pin]');
    const save = event.target.closest('[data-save-home-sort]');
    if (!toggle && !save) return;
    const productId = (toggle || save).dataset.toggleHomePin || (toggle || save).dataset.saveHomeSort;
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) return;
    const orderInput = $$('[data-home-sort]').find((input) => String(input.dataset.homeSort) === String(productId));
    const payload = save
      ? { home_sort_order: Number(orderInput?.value || 0), is_home_pinned: true }
      : { is_home_pinned: !product.is_home_pinned, home_sort_order: Number(orderInput?.value || product.home_sort_order || 0) };
    const { error } = await client.from('products').update(payload).eq('id', productId);
    if (error) return alert(error.message);
    await loadAll();
  }

  function renderBanners() {
    const banners = siteData.banners || [];
    $('#bannerList').innerHTML = banners.map((banner) => `<div class="banner-row"><img src="${esc(banner.image_url || 'veyrath-hero.jpg')}" alt=""><div><strong>${esc(banner.heading)}</strong><small>${esc(banner.eyebrow || '')}</small></div><button class="danger" type="button" data-delete-banner="${banner.id}">Remove</button></div>`).join('') || '<p>No banners yet.</p>';
  }

  async function submitBanner(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const { error } = await client.from('hero_slides').insert({
      eyebrow: values.eyebrow.trim(),
      heading: values.heading.trim(),
      body: values.text.trim(),
      image_url: values.image_url.trim(),
      align: values.align || 'left',
      is_published: true,
      sort_order: (siteData.banners || []).length
    });
    if (error) return message(form, error.message);
    form.reset();
    await loadAll();
    message(form, 'Carousel banner added.');
  }

  function selectedProductIds(collectionId) {
    return collectionProducts
      .filter((item) => String(item.collection_id) === String(collectionId))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map((item) => String(item.product_id));
  }

  function renderProductPicker(selected = []) {
    const select = $('#collectionProductSelect');
    if (!select) return;
    const selectedSet = new Set(selected.map(String));
    select.innerHTML = products.map((product) => `<option value="${esc(product.id)}" ${selectedSet.has(String(product.id)) ? 'selected' : ''}>${esc(product.name)} — ${esc(product.category || 'Product')}</option>`).join('') || '<option disabled>No products available yet</option>';
  }

  function renderCollections() {
    renderProductPicker();
    $('#collectionsTable').innerHTML = collections.map((collection) => {
      const ids = selectedProductIds(collection.id);
      const firstProduct = products.find((product) => ids.includes(String(product.id)));
      const image = safeImage(collection.cover_image_url) || galleryOf(firstProduct)[0] || 'veyrath-tee.jpg';
      return `<tr><td><img src="${esc(image)}" alt=""></td><td><strong>${esc(collection.title)}</strong><br><small>${esc(collection.slug || '')} · ${collection.is_published ? 'Published' : 'Draft'}</small></td><td>${ids.length} product${ids.length === 1 ? '' : 's'}<br><small>${esc(collection.drop_label || 'Collection')}</small></td><td><div class="table-buttons"><button type="button" data-edit-collection="${collection.id}">Edit</button><button type="button" data-toggle-collection="${collection.id}">${collection.is_published ? 'Draft' : 'Publish'}</button><button class="danger" type="button" data-delete-collection="${collection.id}">Delete</button></div></td></tr>`;
    }).join('') || '<tr><td colspan="4">No collections yet.</td></tr>';
  }

  function resetCollection() {
    const form = $('#collectionForm');
    form.reset();
    form.elements.id.value = '';
    form.elements.sort_order.value = '0';
    form.elements.is_published.checked = true;
    form.elements.is_featured.checked = false;
    $('#collectionFormTitle').textContent = 'Create collection';
    renderProductPicker();
    message(form, '');
  }

  function editCollection(collectionId) {
    const collection = collections.find((item) => String(item.id) === String(collectionId));
    if (!collection) return;
    const form = $('#collectionForm');
    Object.entries(collection).forEach(([key, value]) => {
      const field = form.elements[key];
      if (!field || field.type === 'file') return;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else field.value = value ?? '';
    });
    renderProductPicker(selectedProductIds(collectionId));
    $('#collectionFormTitle').textContent = `Edit ${collection.title}`;
    activate('collections');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitCollection(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const collectionId = values.id || uuid();
    const slug = values.slug.trim() || slugify(values.title);
    const selectedIds = [...form.elements.product_ids.selectedOptions].map((option) => option.value);
    message(form, 'Saving collection…');
    try {
      const uploadedCover = await uploadSingleImage(form.elements.cover_file.files[0], 'collections', collectionId, slug, form, 'collection cover');
      const payload = {
        id: collectionId,
        title: values.title.trim(),
        slug,
        drop_label: values.drop_label.trim(),
        subtitle: values.subtitle.trim(),
        description: values.description.trim(),
        cover_image_url: uploadedCover || values.cover_image_url.trim(),
        sort_order: Number(values.sort_order || 0),
        is_published: form.elements.is_published.checked,
        is_featured: form.elements.is_featured.checked
      };
      const { error } = await client.from('collections').upsert(payload);
      if (error) throw error;
      const remove = await client.from('collection_products').delete().eq('collection_id', collectionId);
      if (remove.error) throw remove.error;
      if (selectedIds.length) {
        const rows = selectedIds.map((productId, index) => ({ collection_id: collectionId, product_id: productId, sort_order: index }));
        const add = await client.from('collection_products').insert(rows);
        if (add.error) throw add.error;
      }
      resetCollection();
      await loadAll();
      message(form, 'Collection saved.');
    } catch (error) {
      message(form, error.message);
    }
  }

  async function collectionAction(event) {
    const edit = event.target.closest('[data-edit-collection]');
    const toggle = event.target.closest('[data-toggle-collection]');
    const remove = event.target.closest('[data-delete-collection]');
    if (edit) return editCollection(edit.dataset.editCollection);
    if (toggle) {
      const collection = collections.find((item) => String(item.id) === String(toggle.dataset.toggleCollection));
      const { error } = await client.from('collections').update({ is_published: !collection.is_published }).eq('id', collection.id);
      if (error) alert(error.message);
      else await loadAll();
    }
    if (remove) {
      const collection = collections.find((item) => String(item.id) === String(remove.dataset.deleteCollection));
      if (collection && confirm(`Delete collection “${collection.title}”? Product rows stay safe.`)) {
        const { error } = await client.from('collections').delete().eq('id', collection.id);
        if (error) alert(error.message);
        else await loadAll();
      }
    }
  }

  function renderSizeCharts() {
    $('#sizeChartsTable').innerHTML = sizeCharts.map((chart) => `<tr><td><img src="${esc(safeImage(chart.image_url) || 'veyrath-tee.jpg')}" alt=""></td><td><strong>${esc(chart.title)}</strong><br><small>${esc(chart.category || '')} · ${esc(chart.slug || '')}</small></td><td><span class="status-pill ${chart.is_published ? 'status-ready' : 'status-planned'}">${chart.is_published ? 'Published' : 'Draft'}</span><br><small>Order ${Number(chart.sort_order || 0)}</small></td><td><div class="table-buttons"><button type="button" data-edit-chart="${chart.id}">Edit</button><button type="button" data-toggle-chart="${chart.id}">${chart.is_published ? 'Draft' : 'Publish'}</button><button class="danger" type="button" data-delete-chart="${chart.id}">Delete</button></div></td></tr>`).join('') || '<tr><td colspan="4">No size charts yet.</td></tr>';
  }

  function resetSizeChart() {
    const form = $('#sizeChartForm');
    form.reset();
    form.elements.id.value = '';
    form.elements.sort_order.value = '0';
    form.elements.is_published.checked = true;
    $('#sizeChartFormTitle').textContent = 'Add size chart';
    message(form, '');
  }

  function editSizeChart(chartId) {
    const chart = sizeCharts.find((item) => String(item.id) === String(chartId));
    if (!chart) return;
    const form = $('#sizeChartForm');
    Object.entries(chart).forEach(([key, value]) => {
      const field = form.elements[key];
      if (!field || field.type === 'file') return;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else if (key === 'facts') field.value = Array.isArray(value) ? value.join('\n') : (value ?? '');
      else field.value = value ?? '';
    });
    $('#sizeChartFormTitle').textContent = `Edit ${chart.title}`;
    activate('sizecharts');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitSizeChart(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const chartId = values.id || uuid();
    const slug = values.slug.trim() || slugify(values.title);
    message(form, 'Saving size chart…');
    try {
      const uploaded = await uploadSingleImage(form.elements.chart_file.files[0], 'size-charts', chartId, slug, form, 'size chart');
      const payload = {
        id: chartId,
        title: values.title.trim(),
        slug,
        category: values.category.trim(),
        product_type: values.category.trim(),
        description: values.description.trim(),
        image_url: uploaded || values.image_url.trim(),
        facts: lines(values.facts),
        sort_order: Number(values.sort_order || 0),
        is_published: form.elements.is_published.checked
      };
      const { error } = await client.from('size_charts').upsert(payload);
      if (error) throw error;
      resetSizeChart();
      await loadAll();
      message(form, 'Size chart saved.');
    } catch (error) {
      message(form, error.message);
    }
  }

  async function sizeChartAction(event) {
    const edit = event.target.closest('[data-edit-chart]');
    const toggle = event.target.closest('[data-toggle-chart]');
    const remove = event.target.closest('[data-delete-chart]');
    if (edit) return editSizeChart(edit.dataset.editChart);
    if (toggle) {
      const chart = sizeCharts.find((item) => String(item.id) === String(toggle.dataset.toggleChart));
      const { error } = await client.from('size_charts').update({ is_published: !chart.is_published }).eq('id', chart.id);
      if (error) alert(error.message);
      else await loadAll();
    }
    if (remove) {
      const chart = sizeCharts.find((item) => String(item.id) === String(remove.dataset.deleteChart));
      if (chart && confirm(`Delete size chart “${chart.title}”?`)) {
        const { error } = await client.from('size_charts').delete().eq('id', chart.id);
        if (error) alert(error.message);
        else await loadAll();
      }
    }
  }

  function renderRecords() {
    $('#inquiryList').innerHTML = inquiries.map((item) => `<article class="data-row"><small>${new Date(item.created_at).toLocaleString('en-IN')} · ${esc(item.subject || 'Inquiry')}</small><strong>${esc(item.name || 'Anonymous')} · ${esc(item.email || '')}</strong><span>${esc(item.product || '')}</span><p>${esc(item.message || '')}</p></article>`).join('') || '<p>No inquiries yet.</p>';
    $('#newsletterList').innerHTML = newsletter.map((item) => `<article class="data-row"><small>${new Date(item.created_at).toLocaleString('en-IN')}</small><strong>${esc(item.email)}</strong></article>`).join('') || '<p>No newsletter signups yet.</p>';
  }

  function renderAll() {
    $('#statProducts').textContent = products.length;
    $('#statPublished').textContent = products.filter((product) => product.is_published).length;
    $('#statHomePinned').textContent = products.filter((product) => product.is_home_pinned).length;
    $('#statCollections').textContent = collections.length;
    $('#statSizeCharts').textContent = sizeCharts.length;
    $('#statPaid').textContent = orders.filter((order) => order.payment_status === 'paid').length;
    $('#statPrintrove').textContent = orders.filter((order) => ['not_sent', 'printrove_failed'].includes(order.fulfilment_status) && order.payment_status === 'paid').length;
    $('#statHolds').textContent = orders.filter((order) => order.admin_hold).length;
    renderProducts();
    renderOrders();
    populateHomepage();
    renderHomePins();
    renderCollections();
    renderSizeCharts();
    renderBanners();
    renderRecords();
  }

  function download(name, text, type = 'text/javascript') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function importData(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const parsed = JSON.parse($('#importJson').value);
      const importedProducts = Array.isArray(parsed) ? parsed : parsed.products;
      if (Array.isArray(importedProducts) && importedProducts.length) {
        const normalized = importedProducts.map((product) => ({ ...product, id: /^[0-9a-f-]{36}$/i.test(product.id || '') ? product.id : uuid() }));
        const { error } = await client.from('products').upsert(normalized);
        if (error) throw error;
      }
      if (parsed.siteData) {
        const { error } = await client.from('site_settings').upsert({ key: 'site_data', value: parsed.siteData, is_public: true });
        if (error) throw error;
      }
      if (Array.isArray(parsed.sizeCharts) && parsed.sizeCharts.length) {
        const { error } = await client.from('size_charts').upsert(parsed.sizeCharts);
        if (error) throw error;
      }
      if (Array.isArray(parsed.collections) && parsed.collections.length) {
        const { error } = await client.from('collections').upsert(parsed.collections);
        if (error) throw error;
      }
      if (Array.isArray(parsed.collectionProducts) && parsed.collectionProducts.length) {
        const { error } = await client.from('collection_products').upsert(parsed.collectionProducts);
        if (error) throw error;
      }
      await loadAll();
      message(form, 'Data imported.');
    } catch (error) {
      message(form, `Import failed: ${error.message}`);
    }
  }

  function bind() {
    ensureLoginHelpers();
    $('#loginForm').addEventListener('submit', login);
    $('#adminMagicLink').addEventListener('click', magicLink);
    $('#adminClearSession').addEventListener('click', clearSession);
    $('#adminLogout').addEventListener('click', async () => { await client?.auth.signOut(); openLogin('Signed out.'); });
    $$('.admin-nav button').forEach((button) => button.addEventListener('click', () => activate(button.dataset.adminTab)));
    $$('[data-admin-tab-jump]').forEach((button) => button.addEventListener('click', () => activate(button.dataset.adminTabJump)));

    $('#productForm').addEventListener('submit', submitProduct);
    $('#productForm').elements.image_files.addEventListener('change', gallerySelection);
    $('#productReset').addEventListener('click', resetProduct);
    ['price', 'selling_price', 'base_cost', 'shipping_cost'].forEach((name) => $('#productForm').elements[name].addEventListener('input', updateProfit));
    $('#productsTable').addEventListener('click', async (event) => {
      const edit = event.target.closest('[data-edit-product]');
      const toggle = event.target.closest('[data-toggle-product]');
      const remove = event.target.closest('[data-delete-product]');
      if (edit) editProduct(edit.dataset.editProduct);
      if (toggle) {
        const product = products.find((item) => item.id === toggle.dataset.toggleProduct);
        const { error } = await client.from('products').update({ is_published: !product.is_published }).eq('id', product.id);
        if (!error) await loadAll();
        else alert(error.message);
      }
      if (remove) {
        const product = products.find((item) => item.id === remove.dataset.deleteProduct);
        if (product && confirm(`Delete “${product.name}”?`)) {
          const { error } = await client.from('products').delete().eq('id', product.id);
          if (error) alert(error.message);
          else await loadAll();
        }
      }
    });

    $('#ordersTable').addEventListener('click', orderAction);
    $('#orderFilter').addEventListener('change', renderOrders);
    $('#refreshOrders').addEventListener('click', loadAll);
    $('#exportOrdersCsv').addEventListener('click', exportOrders);

    $('#homepageForm').addEventListener('submit', submitHomepage);
    $('#homePinList').addEventListener('click', homePinAction);
    $('#bannerForm').addEventListener('submit', submitBanner);
    $('#bannerList').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-delete-banner]');
      if (button) {
        const { error } = await client.from('hero_slides').delete().eq('id', button.dataset.deleteBanner);
        if (!error) await loadAll();
        else alert(error.message);
      }
    });

    $('#collectionForm').addEventListener('submit', submitCollection);
    $('#collectionReset').addEventListener('click', resetCollection);
    $('#collectionsTable').addEventListener('click', collectionAction);

    $('#sizeChartForm').addEventListener('submit', submitSizeChart);
    $('#sizeChartReset').addEventListener('click', resetSizeChart);
    $('#sizeChartsTable').addEventListener('click', sizeChartAction);

    $('#importForm').addEventListener('submit', importData);
    $('#exportProducts').addEventListener('click', () => download('products.js', `(function(){window.VEYRATH_PRODUCTS=${JSON.stringify(products, null, 2)};})();\n`));
    $('#exportSite').addEventListener('click', () => download('site-data.js', `(function(){window.VEYRATH_SITE_DATA=${JSON.stringify(siteData, null, 2)};window.VEYRATH_SIZE_CHARTS=${JSON.stringify(sizeCharts, null, 2)};window.VEYRATH_COLLECTIONS=${JSON.stringify(collections, null, 2)};window.VEYRATH_COLLECTION_PRODUCTS=${JSON.stringify(collectionProducts, null, 2)};})();\n`));
    $('#exportJson').addEventListener('click', () => download('veyrath-data.json', JSON.stringify({ products, siteData, sizeCharts, collections, collectionProducts }, null, 2), 'application/json'));
    $('#clearLocalData').addEventListener('click', () => {
      ['veyrath_products_v3', 'veyrath_site_data_v3', 'veyrath_inquiries_v3', 'veyrath_newsletter_v3', 'veyrath_size_charts_v1', 'veyrath_collections_v1', 'veyrath_collection_products_v1'].forEach((key) => localStorage.removeItem(key));
      message($('#importForm'), 'Browser catalogue cache cleared.');
    });
  }

  async function init() {
    bind();
    try {
      if (!(await connectClient())) return openLogin('Configure supabase-config.js to enable secure admin login.');
      const { data } = await client.auth.getSession();
      if (data.session && await isAdmin()) return openApp();
      openLogin();
    } catch (error) {
      openLogin(`Could not connect to Supabase: ${error.message}`);
    }
  }

  init();
})();
