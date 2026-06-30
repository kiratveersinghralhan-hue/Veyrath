(function(){
  const $ = (q, root=document)=>root.querySelector(q);
  const $$ = (q, root=document)=>[...root.querySelectorAll(q)];
  const { STORE, get, set, products, money } = window.VeyrathStore || {};
  const ADMIN_PASSWORD = 'veyrath-admin'; // Change this before sharing. Static password is not secure.
  let activeProductId = null;

  function csv(rows){
    if(!rows.length) return '';
    const keys = Object.keys(rows[0]);
    return [keys.join(','), ...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
  }
  function download(name, text, type='text/plain'){
    const blob = new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
  }
  function productTemplate(){
    return { id:'prod-'+Date.now(), name:'New Product', category:'T-Shirts', type:'Oversized Tee', gender:'Unisex', vibe:'Dark Luxury', price:999, compareAt:1299, rating:4.8, reviews:0, color:'Black', badge:'Drop 001', status:'Available Soon', description:'Write product description here.', frontText:'VEYRATH', backText:'BORN AFTER DARK', details:['Detail 1','Detail 2','Detail 3'], blinkUrl:'#update-blinkstore-link' };
  }
  function renderMetrics(){
    const analytics = get(STORE.analytics, []), inquiries=get(STORE.inquiries, []), subs=get(STORE.subscribers, []), list=products();
    $('#metrics').innerHTML = `
      <div class="metric"><strong>${analytics.filter(x=>x.type==='page_view').length}</strong><span>Page views on this browser</span></div>
      <div class="metric"><strong>${analytics.filter(x=>x.type==='buy_click').length}</strong><span>Buy clicks</span></div>
      <div class="metric"><strong>${subs.length}</strong><span>Newsletter records</span></div>
      <div class="metric"><strong>${inquiries.length}</strong><span>Inquiries</span></div>
      <div class="metric"><strong>${list.length}</strong><span>Products</span></div>
      <div class="metric"><strong>${new Set(analytics.map(x=>x.page)).size}</strong><span>Visited pages</span></div>`;
  }
  function renderProducts(){
    const list = products();
    $('#adminProductsTable').innerHTML = `<table><thead><tr><th>Name</th><th>Category</th><th>Vibe</th><th>Price</th><th>Status</th><th>Action</th></tr></thead><tbody>${list.map(p=>`<tr><td>${p.name}</td><td>${p.category}</td><td>${p.vibe}</td><td>${money(p.price)}</td><td>${p.status}</td><td><button class="btn small" data-edit="${p.id}">Edit</button> <button class="btn small" data-delete="${p.id}">Delete</button></td></tr>`).join('')}</tbody></table>`;
    $$('[data-edit]').forEach(b=>b.onclick=()=>loadProduct(b.dataset.edit));
    $$('[data-delete]').forEach(b=>b.onclick=()=>{ if(confirm('Delete this product locally?')){ set(STORE.products, list.filter(p=>p.id!==b.dataset.delete)); renderProducts(); renderMetrics(); } });
  }
  function loadProduct(id){
    const p = products().find(x=>x.id===id) || productTemplate(); activeProductId = p.id;
    const form = $('#productForm');
    for(const [k,v] of Object.entries(p)){
      const input = form.elements[k]; if(!input) continue;
      input.value = Array.isArray(v) ? v.join('\n') : v;
    }
    $('#productEditorTitle').textContent = 'Editing: ' + p.name;
    window.scrollTo({top:form.getBoundingClientRect().top + scrollY - 100, behavior:'smooth'});
  }
  function saveProduct(e){
    e.preventDefault(); const fd = new FormData(e.target); const p = {};
    for(const [k,v] of fd.entries()) p[k]=v;
    p.price=Number(p.price||0); p.compareAt=Number(p.compareAt||0); p.rating=Number(p.rating||0); p.reviews=Number(p.reviews||0); p.details=String(p.details||'').split('\n').filter(Boolean);
    const list = products(); const idx = list.findIndex(x=>x.id===p.id);
    if(idx>=0) list[idx]=p; else list.push(p);
    set(STORE.products, list); renderProducts(); renderMetrics(); alert('Saved locally. Export products.js and upload it to GitHub to update live product data.');
  }
  function renderInquiries(){
    const list = get(STORE.inquiries, []);
    $('#inquiriesTable').innerHTML = list.length ? `<table><thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Topic</th><th>Message</th></tr></thead><tbody>${list.map(i=>`<tr><td>${new Date(i.ts).toLocaleString()}</td><td>${i.name||''}</td><td>${i.email||''}</td><td>${i.topic||''}</td><td>${i.message||''}</td></tr>`).join('')}</tbody></table>` : '<div class="card"><p class="muted">No inquiries yet on this browser.</p></div>';
  }
  function renderSubscribers(){
    const list = get(STORE.subscribers, []);
    $('#subscribersTable').innerHTML = list.length ? `<table><thead><tr><th>Date</th><th>Email</th><th>Source</th></tr></thead><tbody>${list.map(s=>`<tr><td>${new Date(s.ts).toLocaleString()}</td><td>${s.email}</td><td>${s.source||''}</td></tr>`).join('')}</tbody></table>` : '<div class="card"><p class="muted">No newsletter records yet on this browser.</p></div>';
  }
  function renderAnalytics(){
    const list = get(STORE.analytics, []).slice(-150).reverse();
    $('#analyticsTable').innerHTML = list.length ? `<table><thead><tr><th>Date</th><th>Type</th><th>Page</th><th>Data</th></tr></thead><tbody>${list.map(a=>`<tr><td>${new Date(a.ts).toLocaleString()}</td><td>${a.type}</td><td>${a.page}</td><td>${JSON.stringify(a.payload||{})}</td></tr>`).join('')}</tbody></table>` : '<div class="card"><p class="muted">No analytics yet.</p></div>';
  }
  function exportProducts(){
    const data = 'window.VEYRATH_PRODUCTS = ' + JSON.stringify(products(), null, 2) + ';\n';
    download('products.js', data, 'application/javascript');
  }
  function showAdmin(){
    $('#adminLogin').style.display='none'; $('#adminArea').style.display='grid';
    renderMetrics(); renderProducts(); renderInquiries(); renderSubscribers(); renderAnalytics();
  }
  function init(){
    if(!$('#adminLogin')) return;
    if(sessionStorage.getItem('veyrath_admin')==='true') showAdmin();
    $('#loginForm').onsubmit=e=>{ e.preventDefault(); const pass=$('#adminPass').value; if(pass===ADMIN_PASSWORD){ sessionStorage.setItem('veyrath_admin','true'); showAdmin(); } else alert('Wrong password. Default is mentioned in README/admin.js. Change it before sharing.'); };
    $$('.admin-sidebar [data-panel]').forEach(btn=>btn.onclick=()=>{ $$('.admin-panel').forEach(p=>p.classList.remove('active')); $('#panel-'+btn.dataset.panel).classList.add('active'); });
    $('#newProductBtn').onclick=()=>{ const p=productTemplate(); const list=products(); list.push(p); set(STORE.products,list); renderProducts(); loadProduct(p.id); renderMetrics(); };
    $('#productForm').onsubmit=saveProduct;
    $('#exportProductsBtn').onclick=exportProducts;
    $('#resetProductsBtn').onclick=()=>{ if(confirm('Reset to original demo products?')){ localStorage.removeItem(STORE.products); renderProducts(); renderMetrics(); } };
    $('#exportInquiriesBtn').onclick=()=>download('veyrath-inquiries.csv', csv(get(STORE.inquiries, [])), 'text/csv');
    $('#exportSubscribersBtn').onclick=()=>download('veyrath-subscribers.csv', csv(get(STORE.subscribers, [])), 'text/csv');
    $('#clearAnalyticsBtn').onclick=()=>{ if(confirm('Clear local analytics?')){ set(STORE.analytics, []); renderAnalytics(); renderMetrics(); } };
  }
  document.addEventListener('DOMContentLoaded', init);
})();
