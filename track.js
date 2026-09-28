(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const api = window.VeyrathAPI;
  function render(order) {
    const support = $('#trackOrderResult');
    if (support) {
      support.replaceChildren();
      const title = document.createElement('strong'); title.textContent = `${order.order_number} · ${order.stage}`; support.append(title);
      const detail = document.createElement('span'); detail.textContent = order.tracking_number ? `${order.courier_name} · ${order.tracking_number}` : 'Tracking appears after dispatch.'; support.append(detail);
      if (order.tracking_url) { const a = document.createElement('a'); a.href = order.tracking_url; a.textContent = 'Track shipment ↗'; a.target = '_blank'; a.rel = 'noopener noreferrer'; support.append(a); }
      support.dataset.tone = 'success'; return;
    }
    $('#trackResultNumber').textContent = order.order_number;
    $('#trackResultBadge').textContent = order.stage;
    $('#trackPrintStatus').textContent = order.stage;
    $('#trackCourier').textContent = order.courier_name || 'Assigned at dispatch';
    $('#trackNumber').textContent = order.tracking_number || 'Not generated yet';
    $('#trackStepPaid').classList.toggle('is-complete', Boolean(order.paid_at));
    $('#trackStepProduction').classList.toggle('is-complete', ['In production', 'Dispatched', 'Delivered'].includes(order.stage));
    $('#trackStepShipped').classList.toggle('is-complete', Boolean(order.dispatched_at));
    $('#trackStepDelivered').classList.toggle('is-complete', Boolean(order.delivered_at));
    const link = $('#trackCourierLink'); link.hidden = !order.tracking_url; link.removeAttribute('href');
    if (order.tracking_url) link.href = order.tracking_url;
    $('#trackResult').hidden = false;
  }
  async function lookup(event) {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]');
    const message = $('#trackMessage') || $('#trackOrderResult'); const label = button.textContent;
    button.disabled = true; button.textContent = 'Finding order…'; message.textContent = '';
    if ($('#trackResult')) $('#trackResult').hidden = true;
    try { const v = Object.fromEntries(new FormData(form)); render(await api.track(String(v.order_number || ''), String(v.contact || v.email || ''))); }
    catch (error) { message.textContent = error.message; message.dataset.tone = 'error'; }
    finally { button.disabled = false; button.textContent = label; }
  }
  function init() {
    const form = $('#trackForm') || $('#trackOrderForm'); if (!form) return;
    const number = new URLSearchParams(location.search).get('order'); if (number) form.elements.order_number.value = number;
    form.addEventListener('submit', lookup);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
