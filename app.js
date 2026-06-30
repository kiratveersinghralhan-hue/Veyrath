(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const settings = window.VEYRATH_SETTINGS || {};
  let allProducts = [];

  function toast(message){
    const el = $('#toast');
    if(!el) return alert(message);
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window.__veyrathToast);
    window.__veyrathToast = setTimeout(()=>el.classList.remove('show'), 3200);
  }

  function money(num){ return `${settings.currency || '₹'}${Number(num || 0).toLocaleString('en-IN')}`; }
  function escapeHtml(str=''){
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function loader(){
    const intro = $('#introLoader');
    if(!intro) return;
    setTimeout(()=>{
      intro.classList.add('hide');
      document.body.classList.remove('locked');
    }, 1850);
  }

  function nav(){
    const toggle = $('#menuToggle');
    const menu = $('#megaMenu');
    if(!toggle || !menu) return;
    toggle.addEventListener('click', ()=>{
      toggle.classList.toggle('open');
      menu.classList.toggle('open');
      document.body.classList.toggle('locked', menu.classList.contains('open'));
      window.VeyrathDB?.trackEvent('menu_toggle', { open: menu.classList.contains('open') });
    });
    $$('.mega-links a').forEach(a => a.addEventListener('click', ()=>{
      toggle.classList.remove('open'); menu.classList.remove('open'); document.body.classList.remove('locked');
    }));
  }

  function activeNav(){
    const path = location.pathname.split('/').pop() || 'index.html';
    $$('.navlinks a, .mega-links a').forEach(a=>{
      const href = a.getAttribute('href');
      if(href === path || (path === '' && href === 'index.html')) a.classList.add('active');
    });
  }

  function reveal(){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { threshold:.12 });
    $$('.reveal').forEach(el=>io.observe(el));
  }

  function glowCards(){
    $$('.glass-card,.category-card').forEach(card=>{
      card.addEventListener('pointermove', e=>{
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX-r.left}px`);
        card.style.setProperty('--my', `${e.clientY-r.top}px`);
      });
    });
  }

  function heroParallax(){
    const visual = $('.product-monolith');
    if(!visual) return;
    window.addEventListener('pointermove', e=>{
      const x = (e.clientX / innerWidth - .5) * 10;
      const y = (e.clientY / innerHeight - .5) * -8;
      visual.style.transform = `rotateY(${-15 + x}deg) rotateX(${8 + y}deg)`;
    }, { passive:true });
  }

  function starCanvas(){
    const canvas = $('#voidCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let w,h,dpr,stars;
    function resize(){
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.width = Math.floor(innerWidth * dpr);
      h = canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px';
      stars = Array.from({length: Math.min(220, Math.floor(innerWidth/6))}, () => ({
        x: Math.random()*w, y: Math.random()*h, z: Math.random()*1, r: Math.random()*1.7+.2, v: Math.random()*.42+.08
      }));
    }
    function draw(){
      ctx.clearRect(0,0,w,h);
      const g = ctx.createRadialGradient(w*.55,h*.45,0,w*.55,h*.45,Math.max(w,h)*.72);
      g.addColorStop(0,'rgba(141,16,29,.17)');
      g.addColorStop(.48,'rgba(185,199,255,.05)');
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      stars.forEach(s=>{
        s.y += s.v*dpr;
        s.x += Math.sin((Date.now()/1600)+s.y*.002)*.12*dpr;
        if(s.y>h){s.y=-10;s.x=Math.random()*w}
        ctx.beginPath();
        ctx.arc(s.x,s.y,s.r*dpr,0,Math.PI*2);
        ctx.fillStyle = `rgba(245,240,232,${.18+s.z*.55})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    resize(); draw(); addEventListener('resize', resize, {passive:true});
  }

  function productImage(p){
    if(p.image_url) return `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}" loading="lazy">`;
    return `<div class="product-placeholder">V</div>`;
  }

  function productCard(p){
    const buy = p.blink_url
      ? `<a class="mini-btn" href="${escapeHtml(p.blink_url)}" target="_blank" rel="noopener" data-event="buy_click" data-product="${escapeHtml(p.title)}">Buy</a>`
      : `<button class="mini-btn notify-btn" data-product="${escapeHtml(p.title)}">Notify</button>`;
    return `<article class="product-card reveal" data-category="${escapeHtml(p.category)}" data-style="${escapeHtml(p.style)}">
      <div class="product-media">
        ${productImage(p)}
        <span class="product-badge">${escapeHtml(p.category || 'product')}</span>
      </div>
      <div class="product-info">
        <div class="product-meta"><span>${escapeHtml(p.gender || 'unisex')}</span><span>★ ${Number(p.rating||0).toFixed(1)}</span></div>
        <h3>${escapeHtml(p.title)}</h3>
        <p class="product-desc">${escapeHtml(p.description || 'Premium Veyrath piece. Details will be updated soon.')}</p>
        <div class="price-row"><div><span class="price">${money(p.price)}</span>${p.mrp ? `<span class="mrp">${money(p.mrp)}</span>` : ''}</div>${buy}</div>
      </div>
    </article>`;
  }

  function emptyProducts(){
    return `<div class="empty-state reveal in">
      <p class="eyebrow">Catalogue locked</p>
      <h3>No products published yet.</h3>
      <p>Add products from the admin panel. Until then, the website stays clean and does not show fake drops or random product names.</p>
      <a href="admin.html" class="ghost-btn">Open Admin</a>
    </div>`;
  }

  async function renderHomeProducts(){
    const wrap = $('#featuredProducts');
    if(!wrap) return;
    allProducts = await window.VeyrathDB.loadProducts();
    const featured = allProducts.filter(p=>p.is_featured).slice(0,3);
    const list = featured.length ? featured : allProducts.slice(0,3);
    wrap.innerHTML = list.length ? list.map(productCard).join('') : emptyProducts();
    reveal(); bindProductActions();
  }

  function getFilters(){
    return {
      q: ($('#searchInput')?.value || '').toLowerCase().trim(),
      category: $('#categoryFilter')?.value || 'all',
      gender: $('#genderFilter')?.value || 'all',
      budget: $('#budgetFilter')?.value || 'all',
      style: $('.filter-chip.active')?.dataset.style || 'all',
      rating: Number($('#ratingFilter')?.value || 0),
      sort: $('#sortFilter')?.value || 'new'
    };
  }

  function applyFilters(products){
    const f = getFilters();
    let result = products.filter(p=>{
      const text = `${p.title} ${p.description} ${p.category} ${p.style} ${p.gender}`.toLowerCase();
      return (!f.q || text.includes(f.q)) &&
        (f.category==='all' || p.category===f.category) &&
        (f.gender==='all' || p.gender===f.gender) &&
        (f.budget==='all' || p.budget===f.budget) &&
        (f.style==='all' || p.style===f.style) &&
        (Number(p.rating||0) >= f.rating);
    });
    if(f.sort==='price-low') result.sort((a,b)=>a.price-b.price);
    if(f.sort==='price-high') result.sort((a,b)=>b.price-a.price);
    if(f.sort==='rating') result.sort((a,b)=>b.rating-a.rating);
    if(f.sort==='new') result.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    return result;
  }

  async function renderShop(){
    const grid = $('#shopGrid');
    const count = $('#productCount');
    if(!grid) return;
    allProducts = await window.VeyrathDB.loadProducts();
    const filtered = applyFilters(allProducts);
    if(count) count.textContent = `${filtered.length} product${filtered.length===1?'':'s'}`;
    grid.innerHTML = filtered.length ? filtered.map(productCard).join('') : emptyProducts();
    reveal(); bindProductActions();
  }

  function bindFilters(){
    const ids = ['searchInput','categoryFilter','genderFilter','budgetFilter','ratingFilter','sortFilter'];
    ids.forEach(id=> $('#'+id)?.addEventListener('input', renderShop));
    $$('.filter-chip').forEach(chip=> chip.addEventListener('click', ()=>{
      $$('.filter-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active'); renderShop();
    }));
    $('#resetFilters')?.addEventListener('click', ()=>{
      ids.forEach(id=>{ const el=$('#'+id); if(el) el.value = id==='sortFilter'?'new': id==='ratingFilter'?'0':'all'; });
      if($('#searchInput')) $('#searchInput').value='';
      $$('.filter-chip').forEach(c=>c.classList.toggle('active', c.dataset.style==='all'));
      renderShop();
    });
  }

  function bindProductActions(){
    $$('[data-event="buy_click"]').forEach(btn=>btn.addEventListener('click', ()=>{
      window.VeyrathDB?.trackEvent('buy_click', { product: btn.dataset.product });
    }));
    $$('.notify-btn').forEach(btn=>btn.addEventListener('click', ()=>{
      openAuth(`Get launch alert for ${btn.dataset.product}`);
      window.VeyrathDB?.trackEvent('notify_click', { product: btn.dataset.product });
    }));
  }

  function authModal(){
    const modal = $('#authModal');
    const openers = $$('[data-open-auth]');
    const close = $('#authClose');
    openers.forEach(o=>o.addEventListener('click', ()=>openAuth()));
    close?.addEventListener('click', ()=>modal?.classList.remove('open'));
    modal?.addEventListener('click', e=>{ if(e.target===modal) modal.classList.remove('open'); });
    $('#authForm')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const email = $('#authEmail').value.trim();
      const name = $('#authName').value.trim();
      if(!email) return toast('Enter your email.');
      try{
        await window.VeyrathDB.customerLogin(email);
        if(name) await window.VeyrathDB.saveLead('newsletter',{ email, name, consent:true, note:'Discount/login modal' });
        modal.classList.remove('open');
        toast('You are in. Veyrath updates will reach you first.');
      }catch(err){ toast(err.message || 'Could not save.'); }
    });
  }

  function openAuth(title='Login for drops, discounts and updates'){
    const modal = $('#authModal');
    $('#authTitle') && ($('#authTitle').textContent = title);
    modal?.classList.add('open');
  }
  window.openVeyrathAuth = openAuth;

  function forms(){
    $('#newsletterForm')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const email = $('#newsletterEmail').value.trim();
      if(!email) return toast('Enter email first.');
      try{ await window.VeyrathDB.saveLead('newsletter', { email, consent:true, note:'Footer/home newsletter' }); toast('Newsletter saved.'); e.target.reset(); }
      catch(err){ toast(err.message || 'Could not save.'); }
    });
    $('#contactForm')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      try{ await window.VeyrathDB.saveLead('inquiry', payload); toast('Inquiry saved. We will contact you soon.'); e.target.reset(); }
      catch(err){ toast(err.message || 'Could not save inquiry.'); }
    });
  }

  function cookie(){
    const banner = $('#cookieBanner');
    if(!banner || localStorage.getItem('veyrath_cookie_ok')) return;
    setTimeout(()=>banner.classList.add('show'), 2400);
    $('#cookieAccept')?.addEventListener('click', ()=>{
      localStorage.setItem('veyrath_cookie_ok','yes');
      banner.classList.remove('show');
      window.VeyrathDB?.trackEvent('cookie_accept');
    });
    $('#cookieDecline')?.addEventListener('click', ()=>{
      localStorage.setItem('veyrath_cookie_ok','no');
      banner.classList.remove('show');
    });
  }

  function faq(){
    $$('.faq-q').forEach(q=>q.addEventListener('click',()=>q.closest('.faq-item').classList.toggle('open')));
  }

  function track(){
    window.VeyrathDB?.trackEvent('page_view', { title: document.title });
  }

  function init(){
    document.body.classList.add('noise');
    loader(); nav(); activeNav(); reveal(); glowCards(); heroParallax(); starCanvas(); authModal(); forms(); cookie(); faq(); bindFilters();
    renderHomeProducts(); renderShop(); track();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
