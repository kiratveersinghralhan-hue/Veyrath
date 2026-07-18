(() => {
  'use strict';

  const config = window.VEYRATH_ANALYTICS || {};
  const gaId = String(config.gaMeasurementId || '').trim();
  const metaId = String(config.metaPixelId || '').trim();
  const usableGa = /^G-[A-Z0-9]+$/i.test(gaId);
  const usableMeta = /^\d{8,}$/.test(metaId);
  const load = (src) => new Promise((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });

  if (usableGa) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', gaId, { anonymize_ip: true });
    load(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`);
  }

  if (usableMeta) {
    window.fbq = window.fbq || function fbq() { window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments); };
    window.fbq.queue = window.fbq.queue || [];
    window.fbq.loaded = true;
    window.fbq.version = '2.0';
    window.fbq('init', metaId);
    window.fbq('track', 'PageView');
    load('https://connect.facebook.net/en_US/fbevents.js');
  }

  const metaNames = {
    view_item: 'ViewContent',
    begin_checkout: 'InitiateCheckout',
    purchase: 'Purchase',
    generate_lead: 'Lead',
    track_order: 'Search',
    select_promotion: 'CustomizeProduct'
  };

  function track(name, parameters = {}) {
    const params = { ...parameters, page_location: location.href };
    if (usableGa && window.gtag) window.gtag('event', name, params);
    const metaName = metaNames[name];
    if (usableMeta && metaName && window.fbq) window.fbq('track', metaName, parameters);
  }

  window.VeyrathAnalytics = { track };
  track('page_view', { page_title: document.title });
})();
