(function(){
  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const STORE = {
    products: 'veyrath_products_v1',
    analytics: 'veyrath_analytics_v1',
    inquiries: 'veyrath_inquiries_v1',
    subscribers: 'veyrath_subscribers_v1',
    wishlist: 'veyrath_wishlist_v1'
  };
  const get = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch(e){ return fallback; }
  };
  const set = (key, val) => localStorage.setItem(key, JSON.stringify(val));
  const products = () => get(STORE.products, window.VEYRATH_PRODUCTS || []);
  const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0));
  window.VeyrathStore = { STORE, get, set, products, money };

  function track(type, payload={}){
    const data = get(STORE.analytics, []);
    data.push({ type, payload, page: location.pathname.split('/').pop() || 'index.html', ts: new Date().toISOString() });
    set(STORE.analytics, data.slice(-2000));
  }
  window.VeyrathTrack = track;

  function injectCosmic(){
    if(!$('.cosmic-bg')){
      const bg = document.createElement('div'); bg.className='cosmic-bg'; document.body.prepend(bg);
    }
  }
  function injectNav(){
    const navHost = $('#site-nav');
    if(!navHost) return;
    const current = location.pathname.split('/').pop() || 'index.html';
    const navs = [
      ['index.html','Home'],['shop.html','Shop'],['about.html','About'],['contact.html','Contact'],['support.html','Support'],['admin.html','Admin']
    ];
    navHost.innerHTML = `
      <nav class="nav">
        <div class="nav-inner">
          <a class="logo-wrap" href="index.html" aria-label="Veyrath home">
            <div class="logo-mark"><span>V</span></div><div><div class="brand-text">VEYЯATH</div></div>
          </a>
          <button class="mobile-toggle" id="mobileToggle" aria-label="Open menu">Menu</button>
          <div class="nav-links" id="navLinks">
            ${navs.map(([href,label])=>`<a class="${current===href?'active':''}" href="${href}">${label}</a>`).join('')}
            <a class="nav-action" href="shop.html">Shop Drop 001</a>
          </div>
        </div>
      </nav>`;
    $('#mobileToggle')?.addEventListener('click',()=>$('#navLinks')?.classList.toggle('open'));
  }
  function injectFooter(){
    const host = $('#site-footer'); if(!host) return;
    host.innerHTML = `
      <footer class="footer">
        <div class="footer-inner">
          <div>
            <div class="logo-wrap"><div class="logo-mark"><span>V</span></div><div><div class="brand-text">VEYRATH</div><div class="muted">Born After Dark</div></div></div>
            <p class="muted">Dark luxury streetwear with subtle astrology details. Built for night-drive energy, silence, and self-made ambition.</p>
          </div>
          <div>
            <h3>Shop</h3>
            <a href="shop.html">Drop 001</a><a href="shop.html?cat=T-Shirts">T-Shirts</a><a href="shop.html?cat=Hoodies">Hoodies</a><a href="shop.html?cat=Lowers">Lowers</a>
          </div>
          <div>
            <h3>Legal</h3>
            <a href="terms.html">Terms & Conditions</a><a href="privacy.html">Privacy Policy</a><a href="shipping.html">Shipping Policy</a><a href="returns.html">Return & Refund Policy</a><a href="cancellation.html">Cancellation Policy</a>
          </div>
        </div>
        <div class="subfooter">© ${new Date().getFullYear()} VEYRATH. Replace placeholder contact details before applying for Razorpay or going live.</div>
      </footer>`;
  }

  function reveal(){
    const obs = new IntersectionObserver((entries)=>entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('visible'); }),{threshold:.12});
    $$('.reveal').forEach(el=>obs.observe(el));
  }

  function renderProductArt(p){
    const off = /off|white|cream/i.test(p.color || '');
    return `<div class="product-art" aria-hidden="true"><div class="mock-tee ${off?'off':''}"><div class="front">${escapeHtml(p.frontText||'VEYЯATH')}</div><div class="back">${escapeHtml(p.backText||p.name)}</div></div></div>`;
  }
  function productCard(p){
    return `<article class="product-card reveal" data-product-id="${p.id}" data-category="${p.category}">
      ${renderProductArt(p)}
      <div class="product-info">
        <div class="product-top"><div><span class="badge">${escapeHtml(p.badge||p.status||'Drop')}</span><h3>${escapeHtml(p.name)}</h3><div class="muted">${escapeHtml(p.type)} • ${escapeHtml(p.gender)} • ${escapeHtml(p.vibe)}</div></div><div class="rating">★ ${Number(p.rating||0).toFixed(1)} <span class="muted">(${p.reviews||0})</span></div></div>
        <p class="muted">${escapeHtml(p.description)}</p>
        <div><span class="price">${money(p.price)}</span>${p.compareAt ? `<span class="compare">${money(p.compareAt)}</span>`:''}</div>
        <div class="product-actions">
          <button class="btn small" data-quick="${p.id}">Quick View</button>
          <a class="btn small primary" data-buy="${p.id}" href="${p.blinkUrl || '#'}" target="_blank" rel="noopener">Buy / View</a>
        </div>
      </div>
    </article>`;
  }
  function renderFeatured(){
    const host = $('#featuredProducts'); if(!host) return;
    host.innerHTML = products().slice(0,3).map(productCard).join('');
    bindProductActions(); reveal();
  }
  function renderShop(){
    const host = $('#productsGrid'); if(!host) return;
    const params = new URLSearchParams(location.search);
    let activeCat = params.get('cat') || 'All';
    let state = { search:'', cat:activeCat, vibe:'All', gender:'All', budget:'All', rating:'All', sort:'featured' };
    const categoryHost = $('#categoryTabs');
    const cats = ['All',...new Set(products().map(p=>p.category))];
    categoryHost.innerHTML = cats.map(c=>`<button class="tab ${c===activeCat?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
    categoryHost.addEventListener('click',e=>{ const b=e.target.closest('[data-cat]'); if(!b)return; state.cat=b.dataset.cat; $$('.tab',categoryHost).forEach(t=>t.classList.toggle('active', t===b)); draw(); track('filter_category',{cat:state.cat}); });
    const fields = {
      search: $('#searchBox'), vibe: $('#vibeFilter'), gender: $('#genderFilter'), budget: $('#budgetFilter'), rating: $('#ratingFilter'), sort: $('#sortFilter')
    };
    Object.entries(fields).forEach(([key,el])=> el?.addEventListener('input',()=>{ state[key]=el.value; draw(); if(key==='search') track('search',{q:el.value}); }));
    function draw(){
      let list = products().filter(p=>{
        const q = state.search.trim().toLowerCase();
        const matchQ = !q || [p.name,p.category,p.type,p.gender,p.vibe,p.description,p.color].join(' ').toLowerCase().includes(q);
        const matchCat = state.cat==='All'||p.category===state.cat;
        const matchVibe = state.vibe==='All'||p.vibe===state.vibe;
        const matchGender = state.gender==='All'||p.gender===state.gender;
        const price = Number(p.price||0);
        const matchBudget = state.budget==='All'||(state.budget==='under800'&&price<800)||(state.budget==='800to1200'&&price>=800&&price<=1200)||(state.budget==='1200plus'&&price>1200);
        const matchRating = state.rating==='All'||Number(p.rating||0)>=Number(state.rating);
        return matchQ&&matchCat&&matchVibe&&matchGender&&matchBudget&&matchRating;
      });
      if(state.sort==='priceLow') list.sort((a,b)=>a.price-b.price);
      if(state.sort==='priceHigh') list.sort((a,b)=>b.price-a.price);
      if(state.sort==='rating') list.sort((a,b)=>b.rating-a.rating);
      host.innerHTML = list.length ? list.map(productCard).join('') : `<div class="card"><h3>No products found</h3><p class="muted">Try changing filters or search terms.</p></div>`;
      $('#resultCount') && ($('#resultCount').textContent = `${list.length} products`);
      bindProductActions(); reveal();
    }
    draw();
  }
  function bindProductActions(){
    $$('[data-quick]').forEach(btn=>btn.addEventListener('click',()=>openQuick(btn.dataset.quick)));
    $$('[data-buy]').forEach(a=>a.addEventListener('click',e=>{
      track('buy_click',{id:a.dataset.buy});
      if((a.getAttribute('href')||'').includes('update-blinkstore-link')){
        e.preventDefault(); alert('Blinkstore product link is not added yet. Add the live Blinkstore link from admin.html or products.js.');
      }
    }));
  }
  function openQuick(id){
    const p = products().find(x=>x.id===id); if(!p) return;
    track('quick_view',{id});
    const modal = $('#productModal') || document.body.appendChild(Object.assign(document.createElement('div'),{id:'productModal',className:'modal'}));
    modal.innerHTML = `<div class="modal-card"><div class="modal-head"><h3>${escapeHtml(p.name)}</h3><button class="close" aria-label="Close">×</button></div><div class="grid two">${renderProductArt(p)}<div><span class="badge">${escapeHtml(p.badge||'Drop')}</span><p class="muted">${escapeHtml(p.description)}</p><div><span class="price">${money(p.price)}</span>${p.compareAt?`<span class="compare">${money(p.compareAt)}</span>`:''}</div><p class="rating">★ ${Number(p.rating||0).toFixed(1)} (${p.reviews||0} reviews)</p><ul>${(p.details||[]).map(d=>`<li class="muted">${escapeHtml(d)}</li>`).join('')}</ul><a class="btn primary" data-buy="${p.id}" href="${p.blinkUrl || '#'}" target="_blank" rel="noopener">Buy on Blinkstore</a></div></div></div>`;
    modal.classList.add('show');
    modal.querySelector('.close').onclick=()=>modal.classList.remove('show');
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.remove('show'); });
    bindProductActions();
  }

  function bindForms(){
    $$('[data-newsletter]').forEach(form=>form.addEventListener('submit',e=>{
      e.preventDefault(); const email = form.querySelector('input[type="email"]')?.value.trim(); if(!email) return;
      const list = get(STORE.subscribers, []); list.push({email, ts:new Date().toISOString(), source:location.pathname}); set(STORE.subscribers,list); form.reset(); form.querySelector('.success')?.classList.add('show'); track('newsletter',{email});
    }));
    $$('[data-inquiry]').forEach(form=>form.addEventListener('submit',e=>{
      e.preventDefault(); const data = Object.fromEntries(new FormData(form).entries()); const list = get(STORE.inquiries, []); list.push({...data, ts:new Date().toISOString(), page:location.pathname}); set(STORE.inquiries,list); form.reset(); form.querySelector('.success')?.classList.add('show'); track('inquiry',{topic:data.topic||'general'});
    }));
  }
  function carousel(){
    const wrap = $('#homeCarousel'); if(!wrap) return;
    const slides = $$('.slide',wrap), dots=$$('.dot',wrap); let i=0;
    function show(n){ slides.forEach((s,idx)=>s.classList.toggle('active',idx===n)); dots.forEach((d,idx)=>d.classList.toggle('active',idx===n)); i=n; }
    dots.forEach((d,idx)=>d.addEventListener('click',()=>show(idx)));
    setInterval(()=>show((i+1)%slides.length),5200);
  }
  function escapeHtml(str){ return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  document.addEventListener('DOMContentLoaded',()=>{
    injectCosmic(); injectNav(); injectFooter(); reveal(); carousel(); renderFeatured(); renderShop(); bindForms(); track('page_view');
  });
})();
