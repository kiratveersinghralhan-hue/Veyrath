(function () {
  'use strict';
  let clientPromise;
  function safeHttps(value) {
    try {
      const url = new URL(String(value));
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !host.includes('.') || /^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith('.local') || host.startsWith('[')) return '';
      return url.href;
    } catch (_) { return ''; }
  }
  function safeRelative(value, image) {
    const s = String(value || '').trim();
    if (/[\\\s"'<>]/.test(s) || s.startsWith('/') || s.split(/[/?#]/).includes('..')) return '';
    const pattern = image ? /^(?:[a-z0-9_.-]+\/)*[a-z0-9_.-]+\.(png|jpe?g|webp|gif|svg)(?:[?#][a-z0-9_=&%.-]*)?$/i : /^(?:(?:[a-z0-9_.-]+\/)*[a-z0-9_.-]+\.html(?:[?#][a-z0-9_=&%.-]*)?|#[a-z0-9_-]+)$/i;
    return pattern.test(s) ? s : '';
  }
  function configured() {
    const c = window.VEYRATH_SUPABASE || {};
    try { const u = new URL(c.url); return Boolean(c.anonKey && !c.anonKey.includes('YOUR_') && (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)))); } catch (_) { return false; }
  }
  async function client() {
    if (!configured()) throw new Error('The store is temporarily unavailable. Please try again later.');
    if (!clientPromise) clientPromise = (async () => {
      if (!window.supabase) await new Promise((resolve, reject) => {
        const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4';
        s.onload = resolve; s.onerror = () => reject(new Error('Secure connection unavailable.')); document.head.appendChild(s);
      });
      const c = window.VEYRATH_SUPABASE;
      return window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    })().catch((error) => { clientPromise = null; throw error; });
    return clientPromise;
  }
  async function invoke(name, body) {
    const db = await client(); const { data, error } = await db.functions.invoke(name, { body });
    if (error || data?.success === false || !data) throw new Error('Request could not be completed. Retry safely or contact support with your order number.');
    return data;
  }
  async function track(orderNumber, contact) {
    const data = await invoke('track-order', { order_number: orderNumber.trim(), contact: contact.trim() });
    if (!data.order) throw new Error('No matching order. Check your order number and checkout email or phone.');
    return { ...data.order, tracking_url: safeHttps(data.order.tracking_url) };
  }
  function csvCell(value) { const s = String(value ?? ''); return `"${(/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; }
  function localDate(value) { const d = new Date(value); if (!value || !Number.isFinite(d.getTime())) return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function safeImage(value) {
    const safe = safeHttps(value) || safeRelative(value, true); if (safe) return safe;
    try {
      const url = new URL(value), base = new URL(window.VEYRATH_SUPABASE?.url);
      if (url.origin === base.origin && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname) && !url.username && !url.password && url.pathname.startsWith('/storage/v1/object/public/product-images/public/')) return url.href;
    } catch (_) { /* Only explicitly configured local asset URLs may use HTTP. */ }
    return '';
  }
  const options = value => (Array.isArray(value) ? value : String(value || '').split(/[\n,]/)).map(v => String(v).trim()).filter(Boolean);
  // The array remains compatible with legacy URL strings. Structured entries
  // retain exact authoritative colours; array order is gallery order.
  function normalizeGallery(product = {}) {
    const colours = options(product.colours), entries = [], legacy = [], invalid = [];
    const addLegacy = value => { const url = typeof value === 'string' && safeImage(value); if (url && !legacy.some(e => e.url === url)) legacy.push({ url, alt: product.name || '', colour: null, view: '' }); };
    const images = Array.isArray(product.images) ? product.images : [];
    const structured = images.some(e => e && typeof e === 'object');
    if (!structured) addLegacy(product.image_url);
    for (const entry of images) {
      if (typeof entry === 'string') { addLegacy(entry); continue; }
      if (!entry || Array.isArray(entry) || typeof entry !== 'object' || !colours.includes(entry.colour) || typeof entry.url !== 'string' || !safeImage(entry.url) || (entry.view != null && !['front','back','detail'].includes(entry.view))) { invalid.push(entry); continue; }
      entries.push({ colour: entry.colour, view: entry.view || 'detail', url: safeImage(entry.url), alt: typeof entry.alt === 'string' ? entry.alt : `${product.name || ''} ${entry.colour} ${entry.view || 'detail'}`.trim() });
    }
    if (!structured) { addLegacy(product.front_image_url); addLegacy(product.back_image_url); }
    const byColour = Object.fromEntries(colours.map(colour => [colour, entries.filter(e => e.colour === colour)]));
    return { colours, entries, legacy, byColour, structured, invalid };
  }
  function galleryFor(product, colour) {
    const g = normalizeGallery(product), selected = g.colours.includes(colour) ? colour : g.colours[0];
    // A missing structured colour never borrows a different colour's cover.
    return g.byColour[selected]?.length ? g.byColour[selected] : g.legacy;
  }
  function galleryUrls(product) { const g = normalizeGallery(product); return [...new Set([...g.entries, ...g.legacy].map(e => e.url).concat(typeof product?.image_url === 'string' && safeImage(product.image_url) || []).filter(Boolean))]; }
  function parseVariantMap(text) {
    const value = JSON.parse(text || '{}');
    // JSON.parse silently overwrites repeated properties. Check raw top-level
    // keys first, including escaped spellings, before accepting the object.
    let depth = 0; const keys = new Set();
    const tokens = String(text || '{}').match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [];
    tokens.forEach((token, i) => {
      if (token === '{' || token === '[') depth++;
      else if (token === '}' || token === ']') depth--;
      else if (depth === 1 && token.startsWith('"') && tokens[i + 1] === ':') { const key = JSON.parse(token).trim(); if (keys.has(key)) throw new Error(`Duplicate mapping key: ${key}`); keys.add(key); }
    });
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Variant map must be a JSON object.');
    return value;
  }
  function validateVariants(coloursValue, sizesValue, map) {
    const colours = options(coloursValue), sizes = options(sizesValue), errors = [], ids = new Set(), missing = [], extra = [];
    if ([colours, sizes].some(values => new Set(values).size !== values.length || values.some(v => v.includes('|')))) errors.push('Options must be unique and cannot contain |.');
    const expected = colours.flatMap(c => sizes.map(s => `${c}|${s}`));
    if (!map || Array.isArray(map) || typeof map !== 'object') { errors.push('Variant map must be an object.'); map = {}; }
    for (const key of Object.keys(map)) {
      if (!expected.includes(key)) extra.push(key);
      const entry = map[key], id = entry?.variant_id;
      const numeric = (typeof id === 'number' || typeof id === 'string' && /^[1-9][0-9]*$/.test(id)) ? Number(id) : NaN;
      if (!entry || Array.isArray(entry) || typeof entry !== 'object' || !Number.isSafeInteger(numeric) || numeric <= 0) errors.push(`Invalid variant ID: ${key}`);
      else if (ids.has(numeric)) errors.push(`Duplicate variant ID: ${numeric}`); else ids.add(numeric);
    }
    expected.forEach(key => { if (!Object.hasOwn(map, key)) missing.push(key); });
    if (extra.length) errors.push(`Extra combinations: ${extra.join(', ')}`);
    return { expected: expected.length, mapped: expected.filter(k => Object.hasOwn(map, k)).length, missing, extra, errors, complete: expected.length > 0 && !missing.length && !errors.length };
  }
  function validateMedia(product) {
    const g = normalizeGallery(product);
    const missing = g.colours.filter(c => !g.byColour[c]?.length && !(g.colours.length === 1 && !g.structured && g.legacy.length));
    return { missing, errors: g.invalid.length ? ['Invalid colour image entry.'] : [], complete: g.colours.length > 0 && !missing.length && !g.invalid.length };
  }
  function validatePublication(product) {
    const variants = validateVariants(product.colours, product.sizes, product.printrove_variant_map), media = validateMedia(product), errors = [...variants.errors, ...media.errors];
    if (!product.name?.trim() || product.name.trim().length < 2 || product.name.trim().length > 160) errors.push('A valid name is required.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(product.slug || '')) errors.push('A valid slug is required.');
    if (!Number.isFinite(Number(product.price)) || !(Number(product.price) > 0) || product.currency !== 'INR') errors.push('A positive INR price is required.');
    if (!variants.complete) errors.push(`Complete mappings required: ${variants.mapped}/${variants.expected}. Missing: ${variants.missing.join(', ')}`);
    if (!media.complete) errors.push(`Images required for: ${media.missing.join(', ')}`);
    if (!/^[1-9][0-9]*$/.test(String(product.printrove_product_id || ''))) errors.push('A positive Printrove product ID is required.');
    if (product.fulfilment_status !== 'ready' || !product.mapping_verified_at || !Number.isFinite(Date.parse(product.mapping_verified_at))) errors.push('Server-verified ready fulfilment is required.');
    if (product.archived_at) errors.push('Archived products cannot be published.');
    return { valid: !errors.length, errors, variants, media };
  }
  function colourImagePath(productId, batchId, colourIndex, colour, imageIndex, view, extension) {
    if (![productId, batchId].every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || !Number.isInteger(colourIndex) || colourIndex < 0 || !Number.isInteger(imageIndex) || imageIndex < 0 || !['front','back','detail'].includes(view) || !['jpg','png','webp'].includes(extension)) throw new Error('Invalid image storage path input.');
    const segment = String(colour).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'colour';
    return `public/${productId}/galleries/${batchId}/${String(colourIndex + 1).padStart(3,'0')}-${segment}/${String(imageIndex + 1).padStart(3,'0')}-${view}.${extension}`;
  }
  const selections = new Map();
  function selectProduct(product, selection = {}) {
    const previous = selections.get(String(product.id)) || {}, colours = options(product.colours), sizes = options(product.sizes);
    const choose = (list, candidate, old) => list.includes(candidate) ? candidate : list.includes(old) ? old : list[0] || '';
    const selected = { colour: choose(colours, selection.colour, previous.colour), size: choose(sizes, selection.size, previous.size) };
    selections.set(String(product.id), selected); return selected;
  }
  window.VeyrathAPI = { configured, client, invoke, track, safeHttps, safeImage, safeLink: (v) => safeHttps(v) || safeRelative(v, false), csvCell, localDate, options, normalizeGallery, galleryFor, galleryUrls, parseVariantMap, validateVariants, validateMedia, validatePublication, colourImagePath, selectProduct };
})();
