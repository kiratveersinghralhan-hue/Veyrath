(function () {
  'use strict';

  const KEYS = {
    products: 'veyrath_products', settings: 'veyrath_settings', slides: 'veyrath_slides',
    inquiries: 'veyrath_inquiries', newsletter: 'veyrath_newsletter', events: 'veyrath_events'
  };
  const seed = () => window.VEYRATH_SEED || { defaultProducts: [], defaultSlides: [], defaultSettings: {} };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? clone(fallback); }
    catch (_) { return clone(fallback); }
  };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); return value; };
  const addLocal = (key, payload) => {
    const items = read(key, []);
    const item = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, created_at: new Date().toISOString(), ...payload };
    items.unshift(item); write(key, items); return item;
  };

  const state = { client: null, available: false, isAdmin: false, session: null, lastError: null };
  const localProducts = () => read(KEYS.products, seed().defaultProducts);
  const localSettings = () => ({ ...clone(seed().defaultSettings), ...read(KEYS.settings, {}) });
  const localSlides = () => read(KEYS.slides, seed().defaultSlides);

  const api = {
    state,
    get mode() { return state.available && state.isAdmin ? 'supabase' : 'local'; },
    get status() { return { available: state.available, isAdmin: state.isAdmin, mode: api.mode, email: state.session?.user?.email || '' }; },

    async init() {
      if (state.client || state.lastError) return api.status;
      const config = window.VEYRATH_SUPABASE || {};
      try {
        if (!window.supabase?.createClient || !config.url || !config.anonKey) throw new Error('Supabase library or configuration unavailable');
        state.client = window.supabase.createClient(config.url, config.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        state.available = true;
        const { data } = await state.client.auth.getSession();
        state.session = data?.session || null;
        if (state.session) await api.refreshAdminStatus();
        state.client.auth.onAuthStateChange((_event, session) => {
          state.session = session;
          if (!session) state.isAdmin = false;
        });
      } catch (error) {
        state.lastError = error;
        state.available = false;
        console.info('VEYRATH is using local fallback data.');
      }
      return api.status;
    },

    async refreshAdminStatus() {
      if (!state.client || !state.session?.user) { state.isAdmin = false; return false; }
      try {
        const { data, error } = await state.client.from('admin_users').select('user_id').eq('user_id', state.session.user.id).eq('is_active', true).maybeSingle();
        if (error) throw error;
        state.isAdmin = Boolean(data);
      } catch (_) { state.isAdmin = false; }
      return state.isAdmin;
    },

    async signIn(email, password) {
      await api.init();
      if (!state.client) throw new Error('Supabase is unavailable. Use the local demo PIN.');
      const { data, error } = await state.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.session = data.session;
      const allowed = await api.refreshAdminStatus();
      if (!allowed) { await api.signOut(); throw new Error('This account is not listed as a VEYRATH admin.'); }
      return api.status;
    },

    async signOut() {
      if (state.client) await state.client.auth.signOut();
      state.session = null; state.isAdmin = false;
    },

    async getProducts(options = {}) {
      await api.init();
      const includeUnpublished = Boolean(options.includeUnpublished && state.isAdmin);
      if (state.client) {
        try {
          let query = state.client.from('products').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
          if (!includeUnpublished) query = query.eq('is_published', true);
          const { data, error } = await query;
          if (error) throw error;
          if (data?.length) return data;
        } catch (error) { state.lastError = error; }
      }
      const items = localProducts();
      return includeUnpublished ? items : items.filter((item) => item.is_published !== false);
    },

    async getSettings() {
      await api.init();
      if (state.client) {
        try {
          const { data, error } = await state.client.from('site_settings').select('key,value').eq('is_public', true);
          if (error) throw error;
          if (data?.length) return data.reduce((all, row) => ({ ...all, [row.key]: row.value }), clone(seed().defaultSettings));
        } catch (error) { state.lastError = error; }
      }
      return localSettings();
    },

    async getHeroSlides(options = {}) {
      await api.init();
      if (state.client) {
        try {
          let query = state.client.from('hero_slides').select('*').order('sort_order', { ascending: true });
          if (!(options.includeUnpublished && state.isAdmin)) query = query.eq('is_published', true);
          const { data, error } = await query;
          if (error) throw error;
          if (data?.length) return data;
        } catch (error) { state.lastError = error; }
      }
      const slides = localSlides();
      return options.includeUnpublished ? slides : slides.filter((slide) => slide.is_published !== false);
    },

    async saveProduct(product) {
      const clean = { ...product, updated_at: new Date().toISOString() };
      if (!clean.id) clean.id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      if (state.client && state.isAdmin) {
        const { data, error } = await state.client.from('products').upsert(clean).select().single();
        if (error) throw error;
        return data;
      }
      const items = localProducts();
      const index = items.findIndex((item) => item.id === clean.id);
      if (index >= 0) items[index] = clean; else items.unshift(clean);
      write(KEYS.products, items); return clean;
    },

    async deleteProduct(id) {
      if (state.client && state.isAdmin) {
        const { error } = await state.client.from('products').delete().eq('id', id);
        if (error) throw error;
      } else write(KEYS.products, localProducts().filter((item) => item.id !== id));
      return true;
    },

    async saveSettings(settings) {
      if (state.client && state.isAdmin) {
        const rows = Object.entries(settings).map(([key, value]) => ({ key, value, is_public: true, updated_at: new Date().toISOString() }));
        const { error } = await state.client.from('site_settings').upsert(rows, { onConflict: 'key' });
        if (error) throw error;
      } else write(KEYS.settings, settings);
      return settings;
    },

    async saveHeroSlides(slides) {
      if (state.client && state.isAdmin) {
        const rows = slides.map((slide, index) => ({ ...slide, sort_order: index + 1, updated_at: new Date().toISOString() }));
        const { error } = await state.client.from('hero_slides').upsert(rows);
        if (error) throw error;
      } else write(KEYS.slides, slides);
      return slides;
    },

    async deleteHeroSlide(id) {
      if (state.client && state.isAdmin) {
        const { error } = await state.client.from('hero_slides').delete().eq('id', id);
        if (error) throw error;
      } else write(KEYS.slides, localSlides().filter((slide) => String(slide.id) !== String(id)));
      return true;
    },

    async submitInquiry(payload) {
      await api.init();
      if (state.client) {
        const { data, error } = await state.client.from('inquiries').insert(payload).select().single();
        if (!error) return data;
      }
      return addLocal(KEYS.inquiries, payload);
    },

    async subscribe(email, source = 'website') {
      await api.init();
      const payload = { email, source };
      if (state.client) {
        const { data, error } = await state.client.from('newsletter_signups').upsert(payload, { onConflict: 'email', ignoreDuplicates: true }).select();
        if (!error) return data?.[0] || payload;
      }
      return addLocal(KEYS.newsletter, payload);
    },

    async logEvent(event_name, metadata = {}) {
      await api.init();
      const payload = { event_name, metadata, page_path: location.pathname || '/' };
      if (state.client) {
        const { error } = await state.client.from('event_logs').insert(payload);
        if (!error) return true;
      }
      addLocal(KEYS.events, payload); return true;
    },

    async getAdminRecords(table) {
      const localMap = { inquiries: KEYS.inquiries, newsletter_signups: KEYS.newsletter, event_logs: KEYS.events };
      if (state.client && state.isAdmin) {
        const { data, error } = await state.client.from(table).select('*').order('created_at', { ascending: false }).limit(250);
        if (error) throw error;
        return data || [];
      }
      return read(localMap[table], []);
    },

    importProducts(items) {
      if (!Array.isArray(items)) throw new Error('Imported JSON must be an array of products.');
      return write(KEYS.products, items);
    },
    resetLocalData() { Object.values(KEYS).forEach((key) => localStorage.removeItem(key)); }
  };

  /* Defined synchronously, before any network call, so admin.js can never see undefined. */
  window.VeyrathDB = api;
  api.init();
})();
