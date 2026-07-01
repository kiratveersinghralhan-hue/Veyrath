VEYRATH PREMIUM STATIC WEBSITE — BORN AFTER DARK
=================================================

OPEN / DEPLOY
1. Keep every supplied file together in one root folder.
2. Open index.html for a quick preview, or upload all root files to GitHub Pages / Netlify.
3. Replace https://your-domain.example placeholders in HTML, robots.txt and sitemap.xml.

SUPABASE SETUP
1. In Supabase Authentication > Users, create the owner account:
   kiratveersinghralhan@gmail.com
   Enter the private password directly in Supabase. Never add it to website files.
2. Open SQL Editor and run the complete supabase-schema.sql file.
   WARNING: this reset file deletes the old VEYRATH site tables and their data.
   It does not delete Authentication users.
3. The supplied public project URL and anon key are already set in supabase-config.js.
4. Open admin.html and sign in with the Supabase Auth account.

SECURITY
- The admin password is never included in HTML, JavaScript, SQL or this ZIP.
- Do not add a service-role key, Printrove secret, payment secret or private API key.
- Products, site content and carousel banners use Row Level Security.
- Public visitors can read published content and submit enquiries/newsletter emails.
- Only the active admin account can manage content.

ADMIN
- Products: add/edit/delete, publish, feature, upload images and add Printrove mapping.
- Homepage: edit hero, story, offer text and category introduction.
- Hero Images: add/remove live autoplay carousel slides.
- Inquiries / Newsletter: view Supabase submissions.
- Export / Import: move products and site content using JS or JSON.

MOTION / INTERACTIONS
- Premium VEYRATH intro plays on every fresh homepage load.
- Scroll reveals animate smoothly in both scroll directions.
- Header hides on downward scroll and returns on upward scroll.
- Offer rail moves continuously left-to-right and pauses on hover.
- Campaign carousel autoplays, pauses on hover/focus, supports buttons, dots and swipe.
- Reduced-motion visitors automatically receive a still experience.

IMAGES INCLUDED
- veyrath-hero.jpg
- veyrath-tee.jpg
- veyrath-hoodies.jpg
- veyrath-accessories.jpg
- veyrath-carousel-01.jpg
- veyrath-carousel-02.jpg
- veyrath-carousel-03.jpg
Every generated campaign image visibly carries the VEYRATH mark.

PRODUCTS
The catalogue intentionally starts empty. Add real products through admin.html.
Without an external checkout URL, the site displays an enquiry action.

LEGAL
The legal pages are practical drafts. Add final contact details, exact timelines,
jurisdiction and professional review before accepting live orders.
