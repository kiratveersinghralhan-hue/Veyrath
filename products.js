(function () {
  'use strict';

  const mockup = (base, ink, symbol, label) => {
    const safe = String(label).replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="#0f0e0f"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="28" stdDeviation="24" flood-opacity=".3"/></filter></defs><rect width="900" height="1100" fill="${base}"/><circle cx="450" cy="510" r="330" fill="none" stroke="${ink}" stroke-opacity=".15"/><g filter="url(#s)"><path d="M295 225 175 300 88 520l150 58 63-130v430h298V448l63 130 150-58-87-220-120-75-85 45H380Z" fill="url(#g)" stroke="${ink}" stroke-opacity=".24" stroke-width="4"/><path d="M380 226c12 75 128 75 140 0" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width="10"/></g><text x="450" y="525" text-anchor="middle" fill="${ink}" font-size="118" font-family="Georgia">${symbol}</text><text x="450" y="975" text-anchor="middle" fill="${ink}" font-size="20" letter-spacing="10" font-family="Arial">${safe}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  const defaultProducts = [
    {
      id: 'nocturne-oversized-tee', name: 'Nocturne Oversized Tee', slug: 'nocturne-oversized-tee',
      price: 1299, sale_price: 1099, category: 'T-Shirts', gender: 'Unisex', rating: 4.8,
      colours: ['Ink Black', 'Oxblood'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], style: 'Celestial Minimal',
      image_url: mockup('#262324', '#eadfce', '☾', 'NOCTURNE'),
      front_image_url: mockup('#262324', '#eadfce', '☾', 'FRONT / NOCTURNE'),
      back_image_url: mockup('#191719', '#c8a26a', 'XVII', 'BACK / AFTER DARK'),
      blinkstore_url: '', description: 'Heavy-feel visual language on a relaxed, oversized silhouette.',
      is_featured: true, is_published: true, sort_order: 1
    },
    {
      id: 'orbit-oversized-tee', name: 'Orbit Oversized Tee', slug: 'orbit-oversized-tee',
      price: 1199, sale_price: null, category: 'T-Shirts', gender: 'Unisex', rating: 4.6,
      colours: ['Bone', 'Graphite'], sizes: ['S', 'M', 'L', 'XL'], style: 'Astrology Coded',
      image_url: mockup('#d8d0c3', '#241f1f', '◎', 'ORBIT 08'),
      front_image_url: mockup('#d8d0c3', '#241f1f', '◎', 'FRONT / ORBIT'),
      back_image_url: mockup('#cec4b5', '#74232b', '♄', 'BACK / IN MOTION'),
      blinkstore_url: '', description: 'An orbital mark, reduced to its quietest possible form.',
      is_featured: true, is_published: true, sort_order: 2
    },
    {
      id: 'eclipse-signal-tee', name: 'Eclipse Signal Tee', slug: 'eclipse-signal-tee',
      price: 1399, sale_price: 1199, category: 'T-Shirts', gender: 'Unisex', rating: 4.9,
      colours: ['Oxblood', 'Ink Black'], sizes: ['M', 'L', 'XL', 'XXL'], style: 'Dark Graphic',
      image_url: mockup('#521b22', '#e9dcc8', '◐', 'ECLIPSE SIGNAL'),
      front_image_url: mockup('#521b22', '#e9dcc8', '◐', 'FRONT / ECLIPSE'),
      back_image_url: mockup('#42151a', '#c9a267', '03:17', 'BACK / NIGHT FREQUENCY'),
      blinkstore_url: '', description: 'A deep oxblood statement tuned to the hours after midnight.',
      is_featured: true, is_published: true, sort_order: 3
    },
    {
      id: 'ascendant-hoodie', name: 'Ascendant Hoodie', slug: 'ascendant-hoodie',
      price: 2499, sale_price: null, category: 'Hoodies', gender: 'Unisex', rating: 4.7,
      colours: ['Graphite'], sizes: ['S', 'M', 'L', 'XL'], style: 'Minimal Luxury',
      image_url: mockup('#363234', '#d3b67d', '↑', 'ASCENDANT'), front_image_url: '', back_image_url: '',
      blinkstore_url: '', description: 'A future layer for cold nights and sharper silhouettes.',
      is_featured: false, is_published: true, sort_order: 4
    },
    {
      id: 'lunar-lowers', name: 'Lunar Relaxed Lowers', slug: 'lunar-relaxed-lowers',
      price: 1799, sale_price: null, category: 'Lowers', gender: 'Unisex', rating: 4.5,
      colours: ['Ink Black'], sizes: ['S', 'M', 'L', 'XL'], style: 'Off-Duty',
      image_url: mockup('#1d1c1d', '#efe8dd', '☽', 'LUNAR LOWERS'), front_image_url: '', back_image_url: '',
      blinkstore_url: '', description: 'Relaxed essentials intended for the next VEYRATH release.',
      is_featured: false, is_published: true, sort_order: 5
    },
    {
      id: 'after-dark-tote', name: 'After Dark Tote', slug: 'after-dark-tote',
      price: 699, sale_price: null, category: 'Accessories', gender: 'Unisex', rating: 4.4,
      colours: ['Natural'], sizes: ['One Size'], style: 'Utility',
      image_url: mockup('#bcae9b', '#251f1f', 'V', 'AFTER DARK'), front_image_url: '', back_image_url: '',
      blinkstore_url: '', description: 'A simple carry-all with the VEYRATH night mark.',
      is_featured: false, is_published: true, sort_order: 6
    }
  ];

  const defaultSlides = [
    { id: 'signal', eyebrow: 'VEYRATH / INDIA', title: 'Streetwear for the hours that shape you.', text: 'Oversized silhouettes. Celestial restraint. Made after you order.', cta_label: 'Enter catalogue', cta_link: 'shop.html', is_published: true, sort_order: 1 },
    { id: 'after-dark', eyebrow: 'BORN AFTER DARK', title: 'Quiet design. Loud presence.', text: 'Astrology-coded graphics built for real rotation, not one-night hype.', cta_label: 'Read our story', cta_link: 'about.html', is_published: true, sort_order: 2 },
    { id: 'made-on-demand', eyebrow: 'NO DEAD STOCK', title: 'Your piece begins after your order.', text: 'Print-on-demand helps us start lean, learn fast, and make with intent.', cta_label: 'How it works', cta_link: 'about.html#process', is_published: true, sort_order: 3 }
  ];

  const defaultSettings = {
    collection_title: '',
    announcement: 'Born After Dark · Made after order · Built in India',
    hero_media_url: '',
    showcase: {
      product_id: 'nocturne-oversized-tee',
      product_name: 'Nocturne Oversized Tee',
      front_image_url: defaultProducts[0].front_image_url,
      back_image_url: defaultProducts[0].back_image_url,
      background_media_url: '',
      highlight_text: 'Two faces. One night signal.',
      cta_link: 'shop.html'
    }
  };

  window.VEYRATH_SEED = Object.freeze({ defaultProducts, defaultSlides, defaultSettings });
})();
