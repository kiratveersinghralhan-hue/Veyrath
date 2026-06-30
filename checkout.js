(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const currency = (value) => window.VeyrathUI?.currency(value) || `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const esc = (value = '') => window.VeyrathUI?.esc(value) || String(value);
  let checkoutItems = [];

  function readItems() {
    try { return JSON.parse(localStorage.getItem('veyrath_checkout_items') || '[]'); }
    catch (_) { return []; }
  }

  function renderItems() {
    const holder = $('#checkoutItems');
    if (!checkoutItems.length) {
      holder.innerHTML = '<div class="checkout-empty"><h2>Your selection is empty.</h2><p>Choose a product, size, and colour before checkout.</p><a class="btn" href="shop.html">Return to catalogue</a></div>';
      $('#checkoutForm').hidden = true; return;
    }
    holder.innerHTML = checkoutItems.map((item) => `<article class="summary-item"><img src="${esc(item.image_url)}" alt="${esc(item.name)}"><div><strong>${esc(item.name)}</strong><span>${esc(item.colour)} · ${esc(item.size)} · Qty ${Number(item.quantity)}</span><b>${currency(Number(item.unit_price) * Number(item.quantity))}</b></div></article>`).join('');
    const subtotal = checkoutItems.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
    $('#checkoutSubtotal').textContent = currency(subtotal); $('#checkoutTotal').textContent = currency(subtotal);
  }

  async function submit(event) {
    event.preventDefault(); const form = event.currentTarget; const status = $('.form-status', form); const button = $('.checkout-submit', form);
    if (!form.reportValidity() || !checkoutItems.length) return;
    const values = Object.fromEntries(new FormData(form));
    const customer = { name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim().toLowerCase(), address_line1: values.address_line1.trim(), address_line2: values.address_line2?.trim() || '', city: values.city.trim(), state: values.state.trim(), postal_code: values.postal_code.trim(), country_code: 'IN' };
    button.disabled = true; status.textContent = 'Creating your secure pending order…';
    try {
      const result = await window.VeyrathDB.createPendingOrder(customer, checkoutItems, values.payment_provider || 'razorpay');
      window.VeyrathCheckout?.clear(); form.hidden = true; $('.order-summary').hidden = true;
      const success = $('#checkoutSuccess'); success.hidden = false; success.innerHTML = `<div class="success-mark">✓</div><p class="eyebrow">Pending order created</p><h2>${esc(result.order_number || 'Order received')}</h2><p>Your details are stored securely. Payment status is <strong>pending</strong>; this order will not be sent to Qikink until a verified payment event marks it paid.</p><div class="success-meta"><span>Estimated total</span><strong>${currency(result.total_amount || result.total || 0)}</strong></div><a class="btn btn--accent" href="shop.html">Continue shopping</a>`;
      window.VeyrathDB.logEvent('pending_order_created', { order_number: result.order_number });
    } catch (error) {
      status.textContent = error.message || 'The pending order could not be created. Please try again.'; button.disabled = false;
    }
  }

  function init() { checkoutItems = readItems(); renderItems(); $('#checkoutForm')?.addEventListener('submit', submit); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
