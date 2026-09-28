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
  window.VeyrathAPI = { configured, client, invoke, track, safeHttps, safeImage, safeLink: (v) => safeHttps(v) || safeRelative(v, false), csvCell, localDate };
})();
