VEYRATH PHASE 2 - RAZORPAY + SUPABASE + PRINTROVE
==================================================

WHAT IS INCLUDED
----------------
- Mobile-friendly Buy Now checkout on the homepage and shop quick view.
- Server-calculated pending orders in Supabase.
- Razorpay order creation, payment signature verification and webhook handling.
- Admin order list, payment/Printrove status, manual hold, retry, sync and CSV export.
- Manual Printrove fulfilment by default.
- All private credentials stay in Supabase Edge Function secrets.

SECURITY RULES
--------------
1. Never paste Razorpay Key Secret, webhook secret, Printrove credentials or the
   Supabase service-role key into any root website file.
2. supabase-config.js contains only the public Project URL and anon/publishable key.
3. Never commit a .env file containing real credentials.
4. The browser cannot choose the payable price. create_pending_order calculates it
   from the published products table, and create-razorpay-order rechecks it.
5. A Printrove order can be created only for a paid, non-held order.

FOLDER LAYOUT
-------------
Upload the root HTML/CSS/JS/image files to GitHub Pages.
Do not upload the supabase folder as website code; deploy it with Supabase CLI.

supabase/functions/create-razorpay-order/index.ts
supabase/functions/verify-razorpay-payment/index.ts
supabase/functions/razorpay-webhook/index.ts
supabase/functions/send-to-printrove/index.ts
supabase/functions/sync-printrove-status/index.ts

1. CONFIGURE THE VEYRATH SUPABASE PROJECT
-----------------------------------------
Open the VEYRATH project (not harvesterparts.in).

A. Project Settings > API:
   - Copy Project URL.
   - Copy anon/public/publishable key. Never copy service_role into the website.
   - Replace url and anonKey inside root supabase-config.js.

B. SQL Editor:
   - Back up anything needed first.
   - Run the complete supabase-schema.sql once.
   - This is a reset schema and deletes the listed VEYRATH public tables/data.
   - It does not delete Authentication users.
   - If the admin Auth user already exists, the schema activates it automatically.
   - Otherwise create the Auth user and then run admin-access.sql.

C. Authentication > URL Configuration:
   Site URL:
   https://kiratveersinghralhan-hue.github.io/Veyrath/

   Redirect URL:
   https://kiratveersinghralhan-hue.github.io/Veyrath/admin.html

2. INSTALL AND LINK SUPABASE CLI
--------------------------------
From the website project folder:

supabase login
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF

3. SET SERVER SECRETS
---------------------
Use Razorpay TEST keys first:

supabase secrets set RAZORPAY_KEY_ID="rzp_test_..."
supabase secrets set RAZORPAY_KEY_SECRET="..."
supabase secrets set RAZORPAY_WEBHOOK_SECRET="..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set SITE_URL="https://kiratveersinghralhan-hue.github.io"

Printrove's official API creates a bearer token using the Printrove account email
and password. Set these two secrets:

supabase secrets set PRINTROVE_EMAIL="your-printrove-login-email"
supabase secrets set PRINTROVE_PASSWORD="your-printrove-password"

If Printrove has issued a long-lived bearer token/API key for your account, use one
of these instead of email/password:

supabase secrets set PRINTROVE_API_TOKEN="..."
supabase secrets set PRINTROVE_API_KEY="..."

Supabase normally injects SUPABASE_URL, SUPABASE_ANON_KEY and
SUPABASE_SERVICE_ROLE_KEY automatically. The explicit service-role command above is
included for projects where it is not already present. Never use that key in GitHub.

4. DEPLOY EDGE FUNCTIONS
------------------------
Run from the folder containing supabase/functions:

supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase functions deploy send-to-printrove
supabase functions deploy sync-printrove-status

The --no-verify-jwt flag is required only for the Razorpay webhook because Razorpay
is an external server and cannot send a Supabase user JWT. The function still
authenticates every webhook with the Razorpay HMAC signature.

5. CONFIGURE RAZORPAY TEST MODE
-------------------------------
1. Enable Test Mode in Razorpay Dashboard.
2. Generate a Test Key ID and Test Key Secret.
3. Enable automatic payment capture. VEYRATH marks an order paid only after the
   payment is confirmed as captured.
4. Add this webhook URL:

   https://YOUR_SUPABASE_PROJECT_REF.functions.supabase.co/razorpay-webhook

5. Select events:
   - payment.captured
   - order.paid
   - payment.failed
6. Create a strong webhook secret and save the same value using:
   supabase secrets set RAZORPAY_WEBHOOK_SECRET="..."
7. Request a new webhook test after changing its secret; old retries may use the
   previous secret.

6. MAP ONE PRINTROVE PRODUCT FIRST
---------------------------------
1. Sign in to admin.html.
2. Edit one product.
3. Add Printrove SKU, Product ID and Variant ID from Printrove Product Library.
4. If different sizes/colours have different variant IDs, add Variant map JSON:

   {"Ink Black|S":"460021","Ink Black|M":"460022","Ink Black|L":"460023"}

   The key is exactly Colour|Size and must match the product colour/size spelling.
5. Add the front/back design URLs for internal records. For an existing Printrove
   Product Library variant, Printrove already owns the print design; its Create
   Order API uses the variant ID and does not require a public design URL.
6. Add base cost, selling price and shipping cost. Profit is calculated as:
   selling price - base cost - shipping cost.

7. SAFE TEST PROCEDURE
----------------------
1. Keep site_settings > commerce > auto_send_to_printrove set to false (default).
2. Publish one correctly mapped product.
3. Open the GitHub Pages website on mobile and desktop.
4. Select Buy Now, size, colour and quantity; enter a real serviceable test address.
5. Complete a Razorpay Test Mode payment.
6. Confirm the order appears as paid in admin.html.
7. Compare amount, address and Printrove variant mapping.
8. Click Send to Printrove only when the mapping is correct.
9. Confirm the returned Printrove Order ID and sync its status.
10. Keep fulfilment manual for the first 3-5 successful paid test orders.

Only after those tests should auto_send_to_printrove be changed to true. The
verify-razorpay-payment function supports auto-send, while the Razorpay webhook
remains the payment recovery path.

8. GO LIVE
----------
1. Finish Razorpay account activation/KYC and legal pages.
2. Replace TEST Razorpay secrets with LIVE secrets using supabase secrets set.
3. Create a separate Live Mode webhook and Live webhook secret.
4. Deploy functions again if code changed; secret changes apply without exposing
   any value to GitHub.
5. Run one low-value live order end to end before advertising the store.

TROUBLESHOOTING
---------------
- Products missing after schema reset: the reset intentionally starts with an empty
  catalogue. Add/import products in admin and publish them.
- Payment modal does not open: confirm all five functions are deployed, Razorpay
  test secrets are set, and browser content blockers are disabled.
- Payment stays pending: enable automatic capture and inspect Edge Function logs and
  Razorpay webhook delivery logs.
- Send to Printrove is unavailable: order must be paid, not on hold, and either
  not_sent or printrove_failed.
- Printrove variant mapping error: set a numeric default Variant ID or a matching
  Colour|Size entry in Variant map JSON.
- Webhook returns 401: webhook secret differs from RAZORPAY_WEBHOOK_SECRET.
- Admin cannot read orders: ensure the Auth user exists in the same VEYRATH project
  and admin-access.sql has been run.

No private credential is included in this package.
