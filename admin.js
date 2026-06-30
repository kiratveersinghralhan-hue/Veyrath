(function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  let products = [];
  let editingId = null;

  function toast(msg){
    const el = $('#toast');
    if(!el) return alert(msg);
    el.textContent = msg; el.classList.add('show');
    clearTimeout(window.__adminToast); window.__adminToast = setTimeout(()=>el.classList.remove('show'), 3000);
  }
  function money(n){ return `${window.VEYRATH_SETTINGS?.currency || '₹'}${Number(n||0).toLocaleString('en-IN')}`; }
  function esc(str=''){return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  async function checkLogin(){
    const user = await window.VeyrathDB.getUser();
    if(user && (sessionStorage.getItem('veyrath_admin') || window.VeyrathDB.hasSupabase())) showAdmin(user);
  }

  async function showAdmin(user){
    $('#loginPanel')?.classList.add('hidden');
    $('#adminApp')?.classList.remove('hidden');
    $('#adminEmailLabel') && ($('#adminEmailLabel').textContent = user.email || 'Admin');
    $('#supabaseStatus') && ($('#supabaseStatus').textContent = window.VeyrathDB.hasSupabase() ? 'Supabase connected' : 'Local demo mode');
    $('#supabaseStatus')?.classList.toggle('good', window.VeyrathDB.hasSupabase());
    await refresh();
  }

  async function refresh(){
    const data = await window.VeyrathDB.getAdminData();
    products = data.products || [];
    renderStats(data);
    renderProducts();
    renderLeads(data);
    renderEvents(data.events || []);
  }

  function renderStats(data){
    const published = products.filter(p=>p.is_published).length;
    const featured = products.filter(p=>p.is_featured).length;
    $('#statProducts') && ($('#statProducts').textContent = products.length);
    $('#statPublished') && ($('#statPublished').textContent = published);
    $('#statFeatured') && ($('#statFeatured').textContent = featured);
    $('#statLeads') && ($('#statLeads').textContent = (data.newsletter?.length||0) + (data.inquiries?.length||0));
  }

  function renderProducts(){
    const body = $('#productsTableBody');
    if(!body) return;
    body.innerHTML = products.length ? products.map(p=>`<tr>
      <td><strong>${esc(p.title)}</strong><br><span class="text-muted">${esc(p.slug)}</span></td>
      <td>${esc(p.category)}</td>
      <td>${esc(p.gender)}</td>
      <td>${esc(p.style)}</td>
      <td>${money(p.price)}</td>
      <td>${p.is_published ? 'Published' : 'Draft'}${p.is_featured ? ' · Featured' : ''}</td>
      <td>
        <button class="mini-btn edit-product" data-id="${esc(p.id)}">Edit</button>
        <button class="mini-btn delete-product" data-id="${esc(p.id)}">Delete</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="7">No products yet. Add your first item from Product Editor.</td></tr>`;
    $$('.edit-product').forEach(btn=>btn.addEventListener('click',()=>loadEditor(btn.dataset.id)));
    $$('.delete-product').forEach(btn=>btn.addEventListener('click',async()=>{
      if(!confirm('Delete this product?')) return;
      try{ await window.VeyrathDB.deleteProduct(btn.dataset.id); toast('Product deleted.'); await refresh(); }
      catch(err){ toast(err.message || 'Delete failed.'); }
    }));
  }

  function renderLeads(data){
    const news = $('#newsletterList');
    const inquiries = $('#inquiryList');
    if(news) news.innerHTML = (data.newsletter||[]).slice(0,20).map(x=>`<tr><td>${esc(x.email)}</td><td>${esc(x.name||'')}</td><td>${esc(x.created_at||'')}</td></tr>`).join('') || '<tr><td colspan="3">No newsletter leads yet.</td></tr>';
    if(inquiries) inquiries.innerHTML = (data.inquiries||[]).slice(0,20).map(x=>`<tr><td>${esc(x.name||'')}</td><td>${esc(x.email||'')}</td><td>${esc(x.subject||x.source||'')}</td><td>${esc(x.created_at||'')}</td></tr>`).join('') || '<tr><td colspan="4">No inquiries yet.</td></tr>';
  }

  function renderEvents(events){
    const body = $('#eventsTableBody');
    if(!body) return;
    body.innerHTML = events.slice(0,50).map(e=>`<tr><td>${esc(e.event_name)}</td><td>${esc(e.page_path)}</td><td>${esc(e.created_at)}</td><td>${esc(JSON.stringify(e.metadata||{}))}</td></tr>`).join('') || '<tr><td colspan="4">No events yet.</td></tr>';
  }

  function readForm(){
    return window.VeyrathDB.normalizeProduct({
      id: editingId || $('#pId').value || undefined,
      title: $('#pTitle').value.trim(),
      slug: $('#pSlug').value.trim() || undefined,
      category: $('#pCategory').value,
      gender: $('#pGender').value,
      style: $('#pStyle').value,
      budget: $('#pBudget').value,
      price: Number($('#pPrice').value || 0),
      mrp: Number($('#pMrp').value || 0),
      rating: Number($('#pRating').value || 0),
      reviews_count: Number($('#pReviews').value || 0),
      description: $('#pDescription').value.trim(),
      image_url: $('#pImage').value.trim(),
      blink_url: $('#pBlink').value.trim(),
      is_featured: $('#pFeatured').checked,
      is_published: $('#pPublished').checked
    });
  }

  function clearEditor(){
    editingId = null;
    $('#productForm')?.reset();
    $('#pPublished').checked = true;
    $('#pFeatured').checked = false;
    $('#editorTitle') && ($('#editorTitle').textContent = 'Add Product');
  }

  function loadEditor(id){
    const p = products.find(x=>x.id===id);
    if(!p) return;
    editingId = p.id;
    $('#editorTitle') && ($('#editorTitle').textContent = 'Edit Product');
    $('#pId').value = p.id || '';
    $('#pTitle').value = p.title || '';
    $('#pSlug').value = p.slug || '';
    $('#pCategory').value = p.category || 'tshirts';
    $('#pGender').value = p.gender || 'unisex';
    $('#pStyle').value = p.style || 'premium';
    $('#pBudget').value = p.budget || 'mid';
    $('#pPrice').value = p.price || '';
    $('#pMrp').value = p.mrp || '';
    $('#pRating').value = p.rating || 0;
    $('#pReviews').value = p.reviews_count || 0;
    $('#pDescription').value = p.description || '';
    $('#pImage').value = p.image_url || '';
    $('#pBlink').value = p.blink_url || '';
    $('#pFeatured').checked = !!p.is_featured;
    $('#pPublished').checked = p.is_published !== false;
    document.getElementById('productEditorCard')?.scrollIntoView({behavior:'smooth'});
  }

  function exportProductsJs(){
    const text = `/* Generated from Veyrath Admin */\nwindow.VEYRATH_PRODUCTS = ${JSON.stringify(products, null, 2)};\n\nwindow.VEYRATH_CATEGORIES = ${JSON.stringify(window.VEYRATH_CATEGORIES || [], null, 2)};\nwindow.VEYRATH_STYLES = ${JSON.stringify(window.VEYRATH_STYLES || [], null, 2)};\nwindow.VEYRATH_GENDERS = ${JSON.stringify(window.VEYRATH_GENDERS || [], null, 2)};\n`;
    const blob = new Blob([text], {type:'application/javascript'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'products.js'; a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCsv(key){
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    if(!data.length) return toast('Nothing to export yet.');
    const headers = Array.from(data.reduce((set,row)=>{Object.keys(row).forEach(k=>set.add(k));return set;},new Set()));
    const rows = [headers.join(','), ...data.map(row=>headers.map(h=>`"${String(row[h] ?? '').replace(/"/g,'""')}"`).join(','))];
    const blob = new Blob([rows.join('\n')], {type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = key + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  function bind(){
    $('#adminLoginForm')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const email = $('#adminEmail').value.trim();
      const pass = $('#adminPassword').value.trim();
      try{ const user = await window.VeyrathDB.signIn(email, pass); toast('Admin unlocked.'); await showAdmin(user); }
      catch(err){ toast(err.message || 'Login failed.'); }
    });
    $('#logoutBtn')?.addEventListener('click', async()=>{ await window.VeyrathDB.signOut(); location.reload(); });
    $$('.admin-tab').forEach(tab=>tab.addEventListener('click',()=>{
      $$('.admin-tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active');
      $$('.admin-panel').forEach(p=>p.classList.remove('active'));
      $('#' + tab.dataset.panel)?.classList.add('active');
    }));
    $('#productForm')?.addEventListener('submit', async e=>{
      e.preventDefault();
      const product = readForm();
      if(!product.title || !product.price) return toast('Product title and price are required.');
      try{ await window.VeyrathDB.saveProduct(product); toast('Product saved.'); clearEditor(); await refresh(); }
      catch(err){ toast(err.message || 'Save failed.'); }
    });
    $('#clearProductForm')?.addEventListener('click', clearEditor);
    $('#exportProducts')?.addEventListener('click', exportProductsJs);
    $('#refreshAdmin')?.addEventListener('click', refresh);
    $('#exportNewsletter')?.addEventListener('click',()=>exportCsv('veyrath_newsletter'));
    $('#exportInquiries')?.addEventListener('click',()=>exportCsv('veyrath_inquiries'));
    $('#pTitle')?.addEventListener('input',()=>{ if(!editingId) $('#pSlug').value = window.VeyrathDB.slugify($('#pTitle').value); });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ bind(); checkLogin(); });
})();
