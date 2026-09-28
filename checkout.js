(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const api = window.VeyrathAPI;
  const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(v) || 0);
  const storageKey = `veyrath-checkout-v1:${window.VEYRATH_SUPABASE?.url || 'unconfigured'}`;
  let activeProduct, quote, pending, busy = false, quoteVersion = 0, timer;
  try { pending = JSON.parse(sessionStorage.getItem(storageKey)); } catch (_) { pending = null; }
  function save() { sessionStorage.setItem(storageKey, JSON.stringify(pending)); }
  function message(text, tone = '') { $('#checkoutMessage').textContent = text; $('#checkoutMessage').dataset.tone = tone; }
  function setBusy(value, text = 'Pay securely') { busy = value; $('#checkoutSubmit').disabled = value; $('#checkoutSubmit').textContent = text; }
  function show() { if (!$('#checkoutDialog').open) $('#checkoutDialog').showModal(); document.body.classList.add('checkout-open'); }
  function close() { $('#checkoutDialog').close(); document.body.classList.remove('checkout-open'); }
  function markup() {
    return `<dialog class="checkout-dialog" id="checkoutDialog" aria-labelledby="checkoutTitle">
      <button class="checkout-close" type="button" aria-label="Close checkout">×</button>
      <form class="checkout-shell" id="checkoutForm">
        <header class="checkout-head"><p class="eyebrow">VEYRATH / SECURE CHECKOUT</p><h2 id="checkoutTitle">Complete your signal.</h2><p>Born After Dark. Paid securely through Razorpay.</p></header>
        <div class="checkout-layout">
          <section class="checkout-fields">
            <div class="checkout-product"><img id="checkoutProductImage" src="veyrath-tee.jpg" alt=""><div><small id="checkoutProductCategory">VEYRATH</small><strong id="checkoutProductName">Selected piece</strong><span id="checkoutProductPrice">₹0</span></div></div>
            <div class="checkout-options"><label>Size<select id="checkoutSize" name="size" required></select></label><label>Colour<select id="checkoutColour" name="colour" required></select></label><label>Quantity<input id="checkoutQuantity" name="quantity" type="number" min="1" max="10" value="1" required></label></div>
            <h3>Delivery details</h3>
            <div class="checkout-form-grid"><label>Full name<input name="name" autocomplete="name" minlength="2" maxlength="120" required></label><label>Phone<input name="phone" type="tel" inputmode="numeric" autocomplete="tel" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit number" required></label><label class="wide">Email<input name="email" type="email" autocomplete="email" maxlength="320" required></label><label class="wide">Address line 1<input name="address_line1" autocomplete="address-line1" minlength="3" maxlength="240" required></label><label class="wide">Address line 2 <em>optional</em><input name="address_line2" autocomplete="address-line2" maxlength="240"></label><label>City<input name="city" autocomplete="address-level2" minlength="2" maxlength="120" required></label><label>State<input name="state" autocomplete="address-level1" minlength="2" maxlength="120" required></label><label>Pincode<input name="pincode" inputmode="numeric" autocomplete="postal-code" pattern="[1-9][0-9]{5}" maxlength="6" required></label></div>
          </section>
          <aside class="checkout-summary">
            <p class="eyebrow">Order summary</p>
            <div class="checkout-coupon"><label for="checkoutCoupon">Offer code <em>optional</em></label><div><input id="checkoutCoupon" inputmode="text" maxlength="40" autocomplete="off" placeholder="Offer code"><button id="applyCoupon" type="button">Apply</button></div><small id="checkoutCouponMessage" aria-live="polite">Have an offer code? Apply it before you pay.</small></div>
            <dl><div><dt>Subtotal</dt><dd id="checkoutSubtotal">₹0</dd></div><div class="checkout-discount" id="checkoutDiscountRow" hidden><dt>Offer</dt><dd id="checkoutDiscount">−₹0</dd></div><div><dt>Shipping</dt><dd id="checkoutShipping">—</dd></div><div class="checkout-total"><dt>Total</dt><dd id="checkoutTotal">₹0</dd></div></dl>
            <button type="button" id="checkoutRecovery" hidden>Check saved payment</button><button class="btn btn-gold" id="checkoutSubmit" type="submit">Pay securely</button><small><span aria-hidden="true">◇</span> Price and availability are rechecked securely before payment.</small><p class="checkout-message" id="checkoutMessage" role="status" aria-live="polite"></p>
          </aside>
        </div>
      </form>
    </dialog>`;
  }


  function items() { return [{ product_id: activeProduct.id, size: $('#checkoutSize').value, colour: $('#checkoutColour').value, quantity: Number($('#checkoutQuantity').value) }]; }
  function renderQuote(q) {
    $('#checkoutSubtotal').textContent = money(q.subtotal_amount);
    $('#checkoutShipping').textContent = money(q.shipping_amount);
    $('#checkoutDiscount').textContent = `−${money(q.discount_amount)}`;
    $('#checkoutDiscountRow').hidden = !Number(q.discount_amount);
    $('#checkoutTotal').textContent = money(q.total_amount);
  }
  async function refreshQuote() {
    if (!activeProduct || busy) return;
    const version = ++quoteVersion; quote = null; $('#checkoutSubmit').disabled = true;
    const code = $('#checkoutCoupon').value.trim().toUpperCase();
    try {
      const q = await api.invoke('create-checkout', { action: 'quote', items: items(), email: $('#checkoutForm').elements.email.value.trim().toLowerCase(), coupon_code: code });
      if (version !== quoteVersion) return;
      quote = q; renderQuote(q);
      $('#checkoutCouponMessage').textContent = q.coupon_code ? `${q.coupon_code} applied — save ${money(q.discount_amount)}.` : 'Have an offer code? Apply it before you pay.';
      $('#checkoutSubmit').disabled = false;
    } catch (error) {
      if (version !== quoteVersion) return;
      $('#checkoutTotal').textContent = 'Unavailable'; $('#checkoutCouponMessage').textContent = code ? 'Offer or checkout unavailable. Check the code and checkout email.' : error.message;
    }
  }
  function scheduleQuote() { quote = null; quoteVersion++; $('#checkoutSubmit').disabled = true; clearTimeout(timer); timer = setTimeout(refreshQuote, 500); }
  async function open(id) {
    if (busy) return;
    try {
      const db = await api.client(); const { data: product, error } = await db.from('storefront_products').select('*').eq('id', id).maybeSingle();
      if (error || !product?.checkout_ready) throw new Error('This product is temporarily unavailable.');
      activeProduct = product; $('#checkoutForm').reset();
      $('#checkoutProductImage').src = api.safeImage(product.image_url) || 'veyrath-tee.jpg'; $('#checkoutProductImage').alt = product.name;
      $('#checkoutProductName').textContent = product.name; $('#checkoutProductCategory').textContent = product.category;
      $('#checkoutProductPrice').textContent = money(product.selling_price || product.price);
      for (const [selector, values] of [['#checkoutSize', product.sizes], ['#checkoutColour', product.colours]]) $(selector).innerHTML = values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
      $('#checkoutTitle').textContent = 'Complete your signal.'; $('#checkoutSubmit').hidden = false;
      $('#checkoutRecovery').hidden = !pending?.order_id;
      message(pending?.order_number ? `Saved order ${pending.order_number}. Check its payment before retrying; retries reuse the frozen order.` : '');
      $('#productModal')?.close(); show(); await refreshQuote();
    } catch (error) { window.alert(error.message); }
  }
  async function loadRazorpay() {
    if (window.Razorpay) return;
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load payment. Your order is saved.'));document.head.appendChild(s);});
  }
  function confirmed(result) {
    message(`Payment confirmed for ${result.order_number}. Tracking will be available after dispatch.`, 'success');
    $('#checkoutTitle').textContent = 'Payment confirmed.'; $('#checkoutSubmit').hidden = true; $('#checkoutRecovery').hidden = true;
    window.VeyrathAnalytics?.track?.('purchase', { transaction_id: result.order_number, value: Number(result.total_amount), currency: result.currency || 'INR' });
    pending = null; sessionStorage.removeItem(storageKey);
  }
  async function recover() {
    if (!pending?.order_id || busy) return;
    setBusy(true, 'Checking payment…');
    try {
      let result;
      if (pending.response) result = await api.invoke('verify-razorpay-payment', { order_id: pending.order_id, checkout_token: pending.checkout_token, ...pending.response });
      else result = await api.invoke('create-checkout', { action: 'status', order_id: pending.order_id, checkout_token: pending.checkout_token });
      if (result.success || result.payment_status === 'paid') confirmed(result);
      else message(`Order ${pending.order_number} is awaiting payment confirmation. If charged, do not start another payment; check again or contact support.`, 'notice');
    } catch (_) { message(`Confirmation is still pending for ${pending.order_number}. Keep your payment receipt. Check again; do not pay again if charged.`, 'notice'); }
    finally { setBusy(false); }
  }
  async function fingerprint(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  async function submit(event) {
    event.preventDefault(); if (busy || !activeProduct || !event.currentTarget.reportValidity()) return;
    if (pending?.response) return recover();
    if (!quote) return refreshQuote();
    setBusy(true, 'Preparing payment…'); clearTimeout(timer); quoteVersion++;
    try {
      const values = Object.fromEntries(new FormData($('#checkoutForm')));
      const customer = Object.fromEntries(['name','email','phone','address_line1','address_line2','city','state','pincode'].map(k=>[k,String(values[k] || '').trim()]));
      customer.email = customer.email.toLowerCase(); customer.coupon_code = $('#checkoutCoupon').value.trim().toUpperCase();
      const input = { customer, items: items() }; const fp = await fingerprint(input);
      if (pending && pending.fingerprint !== fp) throw new Error(`Saved checkout ${pending.order_number || ''} has different details. Check its payment first. To start a separate order, use a new tab after confirming no payment was taken.`);
      if (!pending) {
        pending = { fingerprint: fp, request_key: crypto.randomUUID() };
        save(); // Persist before sending: a lost create response must reuse this key.
      }
      const order = await api.invoke('create-checkout', { action:'create', ...input, request_key:pending.request_key });
      if (typeof order.checkout_token !== 'string' || !/^[0-9a-f]{64}$/.test(order.checkout_token)) throw new Error('Checkout response incomplete. Retry safely with the saved request.');
      Object.assign(pending, order); save(); renderQuote(order); $('#checkoutRecovery').hidden = false;
      const status = await api.invoke('create-checkout', { action:'status', order_id:pending.order_id, checkout_token:pending.checkout_token });
      if (status.payment_status === 'paid') { confirmed(status); setBusy(false); return; }
      const payment = await api.invoke('create-razorpay-order', { order_id:pending.order_id, checkout_token:pending.checkout_token });
      if (payment.amount !== Math.round(Number(order.total_amount)*100)) throw new Error('Payment amount mismatch. Contact support.');
      $('#checkoutTotal').textContent = money(payment.amount/100);
      await loadRazorpay();
      const r = new window.Razorpay({ key:payment.key_id, amount:payment.amount, currency:payment.currency, order_id:payment.razorpay_order_id,
        name:'VEYRATH', description:activeProduct.name, prefill:{name:customer.name,email:customer.email,contact:customer.phone}, theme:{color:'#0b0b0b'},
        modal:{ondismiss:()=>{show();setBusy(false);message(`Order ${order.order_number} is saved. If charged, check payment before retrying.`, 'notice');}},
        handler:async response=>{ pending.response=response; save(); show(); setBusy(false); await recover(); }
      });
      r.on('payment.failed',()=>{show();setBusy(false);message(`Payment was not confirmed for ${order.order_number}. Check payment status before retrying.`, 'notice');});
      close(); r.open();
    } catch(error) { show(); message(error.message, 'error'); setBusy(false); }
  }
  function init() {
    document.body.insertAdjacentHTML('beforeend',markup());
    document.addEventListener('click',event=>{const b=event.target.closest('[data-buy-now]');if(b&&!b.disabled){event.preventDefault();open(b.dataset.buyNow);}});
    $('.checkout-close').addEventListener('click',close);
    $('#checkoutDialog').addEventListener('close',()=>document.body.classList.remove('checkout-open'));
    $('#checkoutForm').addEventListener('submit',submit);
    $('#applyCoupon').addEventListener('click',()=>refreshQuote());
    $('#checkoutCoupon').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();refreshQuote();}});
    for (const s of ['#checkoutSize','#checkoutColour','#checkoutQuantity','#checkoutCoupon','#checkoutForm [name="email"]']) $(s).addEventListener('input',scheduleQuote);
    $('#checkoutRecovery').addEventListener('click',recover);
    if (pending?.order_id) { $('#checkoutRecovery').hidden=false; $('#checkoutSubmit').hidden=true; message(`Saved order ${pending.order_number}. Check payment confirmation before placing another order.`); show(); }
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
