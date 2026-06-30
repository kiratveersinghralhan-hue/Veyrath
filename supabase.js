(function () {
  'use strict';

  const cfg = window.VEYRATH_SUPABASE || { enabled: false };
  const settings = window.VEYRATH_SETTINGS || {};
  let client = null;

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; }
    catch (_) { return fallback; }
  }

  const local = {
    get(key, fallback) { return safeParse(localStorage.getItem(key), fallback); },
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  };

  function makeId() {
    try {
      if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    } catch (_) {}
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function slugify(str) {
    return String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
  }

  function hasSupabase() {
    return !!(
      cfg.enabled === true &&
      cfg.url &&
      cfg.anonKey &&
      /^https:\/\/.+\.supabase\.co\/?$/.test(String(cfg.url).trim()) &&
      window.supabase &&
      typeof window.supabase.createClient === 'function'
    );
  }

  function getClient() {
    if (!hasSupabase()) return null;
    if (!client) {
      client = window.supabase.createClient(String(cfg.url).trim(), String(cfg.anonKey).trim(), {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return client;
  }

  function normalizeProduct(p = {}) {
    const id = p.id || makeId();
    const title = p.title || 'Untitled Product';
    return {
      id,
      title,
      slug: p.slug || slugify(title),
      category: p.category || 'tshirts',
      gender: p.gender || 'unisex',
      style: p.style || 'premium',
      budget: p.budget || 'mid',
      price: Number(p.price || 0),
      mrp: Number(p.mrp || 0),
      rating: Number(p.rating || 0),
      reviews_count: Number(p.reviews_count || p.review_count || 0),
      description: p.description || '',
      image_url: p.image_url || p.image || '',
      gallery: Array.isArray(p.gallery) ? p.gallery : [],
      blink_url: p.blink_url || p.blinkUrl || '',
      is_featured: !!p.is_featured,
      is_published: p.is_published !== false,
      created_at: p.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  async function loadProducts({ includeDrafts = false } = {}) {
    const sb = getClient();
    if (sb) {
      try {
        let query = sb.from('products').select('*').order('created_at', { ascending: false });
        if (!includeDrafts) query = query.eq('is_published', true);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(normalizeProduct);
      } catch (err) {
        console.warn('Veyrath: Supabase products fallback:', err.message || err);
      }
    }

    const localProducts = local.get('veyrath_products', null);
    const fallback = window.VEYRATH_PRODUCTS || [];
    const products = localProducts || fallback;
    return (includeDrafts ? products : products.filter(p => p.is_published !== false)).map(normalizeProduct);
  }

  async function saveProduct(product) {
    const normalized = normalizeProduct(product);
    const sb = getClient();
    if (sb && sessionStorage.getItem('veyrath_admin_supabase') === 'yes') {
      const { data, error } = await sb.from('products').upsert(normalized, { onConflict: 'id' }).select().single();
      if (error) throw error;
      return normalizeProduct(data);
    }

    const products = local.get('veyrath_products', []);
    const index = products.findIndex(p => p.id === normalized.id);
    if (index >= 0) products[index] = normalized;
    else products.unshift(normalized);
    local.set('veyrath_products', products);
    return normalized;
  }

  async function deleteProduct(id) {
    const sb = getClient();
    if (sb && sessionStorage.getItem('veyrath_admin_supabase') === 'yes') {
      const { error } = await sb.from('products').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const products = local.get('veyrath_products', []).filter(p => p.id !== id);
    local.set('veyrath_products', products);
    return true;
  }

  async function saveLead(type, payload) {
    const record = { ...payload, source: type, created_at: new Date().toISOString() };
    const table = type === 'newsletter' ? 'newsletter' : 'inquiries';
    const sb = getClient();
    if (sb) {
      try {
        const { error } = await sb.from(table).insert(record);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('Veyrath: lead saved locally because Supabase insert failed:', err.message || err);
      }
    }
    const key = type === 'newsletter' ? 'veyrath_newsletter' : 'veyrath_inquiries';
    const items = local.get(key, []);
    items.unshift(record);
    local.set(key, items);
    return true;
  }

  async function trackEvent(event_name, metadata = {}) {
    const event = { event_name, page_path: location.pathname, metadata, created_at: new Date().toISOString() };
    const localEvents = local.get('veyrath_events', []);
    localEvents.unshift(event);
    local.set('veyrath_events', localEvents.slice(0, 1000));

    const sb = getClient();
    if (sb) {
      try { await sb.from('event_logs').insert(event); }
      catch (err) { console.warn('Veyrath: event log skipped:', err.message || err); }
    }
  }

  async function getAdminData() {
    const products = await loadProducts({ includeDrafts: true });
    const sb = getClient();
    if (sb && sessionStorage.getItem('veyrath_admin_supabase') === 'yes') {
      try {
        const [newsletterRes, inquiriesRes, eventsRes] = await Promise.all([
          sb.from('newsletter').select('*').order('created_at', { ascending: false }).limit(200),
          sb.from('inquiries').select('*').order('created_at', { ascending: false }).limit(200),
          sb.from('event_logs').select('*').order('created_at', { ascending: false }).limit(500)
        ]);
        return {
          products,
          newsletter: newsletterRes.data || [],
          inquiries: inquiriesRes.data || [],
          events: eventsRes.data || []
        };
      } catch (err) {
        console.warn('Veyrath: admin Supabase data fallback:', err.message || err);
      }
    }
    return {
      products,
      newsletter: local.get('veyrath_newsletter', []),
      inquiries: local.get('veyrath_inquiries', []),
      events: local.get('veyrath_events', [])
    };
  }

  async function signIn(email, passwordOrPin) {
    const pin = settings.fallbackAdminPin || 'veyrath-admin';

    // Local PIN must always work as an emergency fallback, even if Supabase is enabled.
    if (settings.allowLocalFallback !== false && passwordOrPin === pin) {
      const fakeUser = { id: 'local-admin', email: email || 'local-admin@veyrath.in', mode: 'local' };
      sessionStorage.setItem('veyrath_admin', JSON.stringify(fakeUser));
      sessionStorage.removeItem('veyrath_admin_supabase');
      return fakeUser;
    }

    const sb = getClient();
    if (sb && email && email.includes('@')) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: passwordOrPin });
      if (error) throw error;
      sessionStorage.setItem('veyrath_admin', JSON.stringify(data.user));
      sessionStorage.setItem('veyrath_admin_supabase', 'yes');
      return data.user;
    }

    throw new Error('Invalid login. Use your Supabase Auth email/password or the local fallback PIN.');
  }

  async function signOut() {
    const sb = getClient();
    if (sb) {
      try { await sb.auth.signOut(); } catch (_) {}
    }
    sessionStorage.removeItem('veyrath_admin');
    sessionStorage.removeItem('veyrath_admin_supabase');
  }

  async function getUser() {
    const localAdmin = safeParse(sessionStorage.getItem('veyrath_admin'), null);
    if (localAdmin) return localAdmin;
    const sb = getClient();
    if (sb) {
      try {
        const { data } = await sb.auth.getUser();
        if (data && data.user) return data.user;
      } catch (_) {}
    }
    return local.get('veyrath_customer_user', null);
  }

  async function customerLogin(email) {
    const user = { id: `guest-${Date.now()}`, email, created_at: new Date().toISOString() };
    local.set('veyrath_customer_user', user);
    await saveLead('newsletter', { email, name: '', consent: true, note: 'Customer login / discount access' });
    return user;
  }

  window.VeyrathDB = {
    hasSupabase,
    getClient,
    loadProducts,
    saveProduct,
    deleteProduct,
    saveLead,
    trackEvent,
    getAdminData,
    signIn,
    signOut,
    getUser,
    customerLogin,
    normalizeProduct,
    slugify
  };
})();
