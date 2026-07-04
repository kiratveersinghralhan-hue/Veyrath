(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const cfg = window.VEYRATH_SUPABASE || {};
  let client;

  async function connect() {
    if (client) return client;
    if (!/^https:\/\//.test(cfg.url || '') || !cfg.anonKey) throw new Error('Secure order tracking is not configured.');
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Could not load secure tracking.'));
        document.head.appendChild(script);
      });
    }
    client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return client;
  }

  function statusText(order) {
    const raw = String(order.printrove_status || order.fulfilment_status || order.order_status || 'processing');
    return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function render(order) {
    const status = String(order.printrove_status || '').toLowerCase();
    const shipped = /ship|dispatch|transit|pickup|out for delivery|delivered/.test(status) || Boolean(order.tracking_number);
    const delivered = /delivered|fulfilled|completed/.test(status) || order.order_status === 'fulfilled';
    $('#trackResultNumber').textContent = order.order_number;
    $('#trackResultBadge').textContent = statusText(order);
    $('#trackPrintStatus').textContent = statusText(order);
    $('#trackCourier').textContent = order.courier_name || 'Assigned at dispatch';
    $('#trackNumber').textContent = order.tracking_number || 'Not generated yet';
    $('#trackStepPaid').classList.toggle('is-complete', order.payment_status === 'paid');
    $('#trackStepProduction').classList.toggle('is-complete', ['processing', 'fulfilled'].includes(order.order_status));
    $('#trackStepShipped').classList.toggle('is-complete', shipped);
    $('#trackStepDelivered').classList.toggle('is-complete', delivered);
    const link = $('#trackCourierLink');
    link.hidden = !order.tracking_url;
    if (order.tracking_url) link.href = order.tracking_url;
    $('#trackResult').hidden = false;
  }

  async function lookup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const message = $('#trackMessage');
    button.disabled = true;
    button.textContent = 'Finding order…';
    message.textContent = '';
    $('#trackResult').hidden = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      const supabase = await connect();
      const { data, error } = await supabase.functions.invoke('track-order', { body: {
        order_number: String(values.order_number || '').trim(),
        contact: String(values.contact || '').trim(),
      } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Tracking is temporarily unavailable.');
      const order = data.order;
      if (!order) throw new Error('No matching order found. Check the order number and checkout email or phone.');
      render(order);
    } catch (error) {
      message.textContent = error.message || 'Tracking is temporarily unavailable.';
    } finally {
      button.disabled = false;
      button.textContent = 'Track order';
    }
  }

  function init() {
    const orderNumber = new URLSearchParams(location.search).get('order');
    if (orderNumber) $('#trackOrderNumber').value = orderNumber;
    $('#trackForm').addEventListener('submit', lookup);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
