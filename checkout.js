(function () {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const split = (value) => Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const cfg = window.VEYRATH_SUPABASE || {};
  let client = null; let activeProduct = null; let freeShippingThreshold = 1999;

  function configured() { return /^https:\/\//.test(cfg.url || '') && cfg.anonKey && !cfg.anonKey.includes('YOUR_'); }
  function message(text, tone = '') { const node = $('#checkoutMessage'); if (!node) return; node.textContent = text; node.dataset.tone = tone; }
  function setBusy(busy, label = 'Pay securely') { const button = $('#checkoutSubmit'); if (!button) return; button.disabled = busy; button.textContent = busy ? label : 'Pay securely'; }
  function productPrice(product) { return Number(product.sale_price || product.selling_price || product.price || 0); }
  function selectedQuantity() { return Math.max(1, Math.min(10, Number($('#checkoutQuantity')?.value || 1))); }
  function calculate() {
    if (!activeProduct) return;
    const subtotal = productPrice(activeProduct) * selectedQuantity();
    const shipping = subtotal >= freeShippingThreshold ? 0 : Number(activeProduct.shipping_cost || 0);
    $('#checkoutSubtotal').textContent = money(subtotal);
    $('#checkoutShipping').textContent = shipping ? money(shipping) : 'Free';
    $('#checkoutTotal').textContent = money(subtotal + shipping);
  }

  function markup() {
    return `<dialog class="checkout-dialog" id="checkoutDialog" aria-labelledby="checkoutTitle"><button class="checkout-close" type="button" aria-label="Close checkout">×</button><form class="checkout-shell" id="checkoutForm"><header class="checkout-head"><p class="eyebrow">VEYRATH / SECURE CHECKOUT</p><h2 id="checkoutTitle">Complete your signal.</h2><p>Born After Dark. Paid securely through Razorpay.</p></header><div class="checkout-layout"><section class="checkout-fields"><div class="checkout-product"><img id="checkoutProductImage" src="veyrath-tee.jpg" alt=""><div><small id="checkoutProductCategory">VEYRATH</small><strong id="checkoutProductName">Selected piece</strong><span id="checkoutProductPrice">₹0</span></div></div><div class="checkout-options"><label>Size<select id="checkoutSize" name="size" required></select></label><label>Colour<select id="checkoutColour" name="colour" required></select></label><label>Quantity<input id="checkoutQuantity" name="quantity" type="number" min="1" max="10" value="1" required></label></div><h3>Delivery details</h3><div class="checkout-form-grid"><label>Full name<input name="name" autocomplete="name" minlength="2" maxlength="120" required></label><label>Phone<input name="phone" type="tel" inputmode="numeric" autocomplete="tel" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit number" required></label><label class="wide">Email<input name="email" type="email" autocomplete="email" maxlength="320" required></label><label class="wide">Address line 1<input name="address_line1" autocomplete="address-line1" minlength="3" maxlength="240" required></label><label class="wide">Address line 2 <em>optional</em><input name="address_line2" autocomplete="address-line2" maxlength="240"></label><label>City<input name="city" autocomplete="address-level2" minlength="2" maxlength="120" required></label><label>State<input name="state" autocomplete="address-level1" minlength="2" maxlength="120" required></label><label>Pincode<input name="pincode" inputmode="numeric" autocomplete="postal-code" pattern="[1-9][0-9]{5}" maxlength="6" required></label></div></section><aside class="checkout-summary"><p class="eyebrow">Order summary</p><dl><div><dt>Subtotal</dt><dd id="checkoutSubtotal">₹0</dd></div><div><dt>Shipping</dt><dd id="checkoutShipping">—</dd></div><div class="checkout-total"><dt>Total</dt><dd id="checkoutTotal">₹0</dd></div></dl><button class="btn btn-gold" id="checkoutSubmit" type="submit">Pay securely</button><small><span aria-hidden="true">◈</span> Price and availability are rechecked securely before payment.</small><p class="checkout-message" id="checkoutMessage" role="status" aria-live="polite"></p></aside></div></form></dialog>`;
  }

  async function ensureClient() {
    if (client) return client;
    if (!configured()) throw new Error('Secure checkout is not configured yet.');
    if (!window.supabase) {
      await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; script.onload = resolve; script.onerror = () => reject(new Error('Could not load secure checkout.')); document.head.appendChild(script); });
    }
    client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await client.from('site_settings').select('value').eq('key', 'commerce').maybeSingle();
    freeShippingThreshold = Number(data?.value?.free_shipping_threshold || 1999);
    return client;
  }

  async function findProduct(productId) {
    const local = window.VeyrathStore?.products?.().find((item) => String(item.id) === String(productId));
    if (local) return local;
    const supabase = await ensureClient();
    const { data, error } = await supabase.from('storefront_products').select('*').eq('id', productId).maybeSingle();
    if (error || !data) throw new Error('This product is not available right now.');
    return data;
  }

  function fillProduct(product) {
    activeProduct = product;
    const sizes = split(product.sizes); const colours = split(product.colours);
    $('#checkoutTitle').textContent = 'Complete your signal.'; $('#checkoutSubmit').hidden = false;
    $('#checkoutProductImage').src = product.image_url || product.front_design_url || 'veyrath-tee.jpg';
    $('#checkoutProductImage').alt = product.name;
    $('#checkoutProductCategory').textContent = product.category || 'VEYRATH';
    $('#checkoutProductName').textContent = product.name;
    $('#checkoutProductPrice').textContent = money(productPrice(product));
    $('#checkoutSize').innerHTML = (sizes.length ? sizes : ['One size']).map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    $('#checkoutColour').innerHTML = (colours.length ? colours : ['As shown']).map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    $('#checkoutQuantity').value = '1';
    $('#checkoutForm').reset();
    $('#checkoutQuantity').value = '1';
    message(''); calculate();
  }

  async function open(productId) {
    try {
      const product = await findProduct(productId);
      fillProduct(product);
      $('#productModal')?.close();
      $('#checkoutDialog').showModal();
      document.body.classList.add('checkout-open');
    } catch (error) {
      window.alert(error.message || 'Checkout is unavailable right now.');
    }
  }

  function close() { $('#checkoutDialog')?.close(); document.body.classList.remove('checkout-open'); }
  async function loadRazorpay() {
    if (window.Razorpay) return;
    await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true; script.onload = resolve; script.onerror = () => reject(new Error('Razorpay Checkout could not load.')); document.head.appendChild(script); });
  }

  async function functionError(error, fallback) {
    try { const payload = await error?.context?.json(); return payload?.error || fallback; } catch (_) { return error?.message || fallback; }
  }

  async function submit(event) {
    event.preventDefault();
    if (!activeProduct || !event.currentTarget.reportValidity()) return;
    setBusy(true, 'Creating secure order…'); message('Confirming price and availability…');
    try {
      const supabase = await ensureClient();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      values.phone = String(values.phone || '').replace(/\D/g, '');
      values.pincode = String(values.pincode || '').replace(/\D/g, '');
      const { data: pending, error: pendingError } = await supabase.rpc('create_pending_order', {
        p_customer: { name: values.name, phone: values.phone, email: values.email, address_line1: values.address_line1, address_line2: values.address_line2 || '', city: values.city, state: values.state, pincode: values.pincode },
        p_items: [{ product_id: activeProduct.id, size: values.size, colour: values.colour, quantity: Number(values.quantity) }],
      });
      if (pendingError) throw new Error(pendingError.message || 'Could not save the order.');
      sessionStorage.setItem('veyrath_pending_order', JSON.stringify({ id: pending.order_id, number: pending.order_number }));

      const { data: paymentOrder, error: createError } = await supabase.functions.invoke('create-razorpay-order', { body: { order_id: pending.order_id } });
      if (createError || !paymentOrder?.success) throw new Error(await functionError(createError, paymentOrder?.error || 'Could not start Razorpay.'));
      await loadRazorpay();
      setBusy(false); message('Opening Razorpay secure payment…');
      const razorpay = new window.Razorpay({
        key: paymentOrder.key_id,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: 'VEYRATH',
        description: activeProduct.name,
        image: new URL('logo.svg', location.href).href,
        order_id: paymentOrder.razorpay_order_id,
        prefill: { name: values.name, email: values.email, contact: values.phone },
        notes: { veyrath_order: pending.order_number },
        theme: { color: '#0b0b0b', backdrop_color: 'rgba(0,0,0,.88)' },
        modal: { ondismiss: () => message(`Payment was not completed. Order ${pending.order_number} remains pending.`, 'notice') },
        handler: async (response) => {
          setBusy(true, 'Verifying payment…'); message('Payment received. Verifying it securely…');
          const { data: verified, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', { body: { order_id: pending.order_id, ...response } });
          if (verifyError || !verified?.success) {
            message(await functionError(verifyError, verified?.error || 'Payment verification is pending. Please keep your payment ID.'), 'error'); setBusy(false); return;
          }
          sessionStorage.removeItem('veyrath_pending_order');
          event.currentTarget.reset();
          $('#checkoutTitle').textContent = 'Payment confirmed.';
          message(`Order ${verified.order_number} is paid. We will prepare it after dark.`, 'success');
          $('#checkoutSubmit').hidden = true;
        },
      });
      razorpay.on('payment.failed', (response) => { message(response?.error?.description || 'Payment failed. No fulfilment order was created.', 'error'); setBusy(false); });
      razorpay.open();
    } catch (error) {
      message(error.message || 'Checkout could not be completed. Please try again.', 'error'); setBusy(false);
    }
  }

  function init() {
    document.body.insertAdjacentHTML('beforeend', markup());
    document.addEventListener('click', (event) => { const button = event.target.closest('[data-buy-now]'); if (button) { event.preventDefault(); open(button.dataset.buyNow); } });
    $('.checkout-close').addEventListener('click', close);
    $('#checkoutDialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) close(); });
    $('#checkoutDialog').addEventListener('close', () => document.body.classList.remove('checkout-open'));
    $('#checkoutQuantity').addEventListener('input', calculate);
    $('#checkoutForm').addEventListener('submit', submit);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
