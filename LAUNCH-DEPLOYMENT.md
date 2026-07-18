# VEYRATH launch release

This folder is an upload-ready GitHub Pages release. It keeps your current products and includes the launch improvements: catalogue loading skeletons, a server-validated coupon field, private customer order tracking, customer confirmation/tracking email support, cleaner public wording, gallery limits for faster product modals, and optional GA4/Meta event hooks.

## 1. Upload the website

Upload the contents of this package to the root of your existing `Veyrath` GitHub repository. Do not upload this ZIP as a nested folder. Keep `supabase-config.js` set to your VEYRATH project URL and anon key only.

## 2. Install the non-destructive database upgrade

In the **VEYRATH** Supabase project, open **SQL Editor**, open `veyrath-launch-upgrade.sql`, paste all of it, then run it once.

It does not delete products, orders, collections, size charts, customers, or settings. It creates the `AFTERDARK10` coupon. It deliberately replaces only the existing two-argument `create_pending_order(jsonb,jsonb)` function, so the old ambiguous-RPC issue cannot return.

## 3. Deploy Edge Functions

Open PowerShell inside the folder you uploaded, confirm the structure, then deploy:

```powershell
cd "C:\path\to\Veyrath"
dir supabase\functions\verify-razorpay-payment\index.ts
npx supabase link --project-ref YOUR_VEYRATH_PROJECT_REF
npx supabase functions deploy verify-razorpay-payment
npx supabase functions deploy sync-printrove-status
npx supabase functions deploy notify-order-tracking
npx supabase functions deploy send-to-printrove
```

`create-razorpay-order` and `razorpay-webhook` do not need redeployment unless you change those files.

## 4. Enable professional customer emails (recommended)

Email is intentionally optional. The payment flow never fails merely because email is not configured. Create a Resend account, verify a domain you own, then set these server-side secrets (never place them in frontend files):

```powershell
npx supabase secrets set RESEND_API_KEY="re_your_resend_key"
npx supabase secrets set ORDER_EMAIL_FROM="VEYRATH <orders@yourdomain.com>"
npx supabase secrets set ORDER_EMAIL_REPLY_TO="support@yourdomain.com"
```

Then redeploy the three functions in step 3 that use mail.

The system sends one payment-confirmed email and one tracking email per order. If the email configuration is absent, it records a skipped notification while the order/payment flow continues safely.

## 5. Printrove automation—turn on only after a controlled order

The secure code can send paid orders to Printrove automatically, but it stays **off** by default because a real Printrove order uses your wallet balance. First check every product’s Printrove variant mapping with one controlled order.

When that is correct, run this in the VEYRATH SQL Editor:

```sql
update public.site_settings
set value = jsonb_set(coalesce(value, '{}'::jsonb), '{auto_send_to_printrove}', 'true'::jsonb, true),
    updated_at = now()
where key = 'commerce';
```

After that, a captured Razorpay payment will: verify server-side, record payment, apply any coupon usage once, send the confirmation email (if configured), and create the Printrove order. Never enable this until Printrove product/variant maps are correct.

To pause automatic Printrove charges again:

```sql
update public.site_settings
set value = jsonb_set(coalesce(value, '{}'::jsonb), '{auto_send_to_printrove}', 'false'::jsonb, true),
    updated_at = now()
where key = 'commerce';
```

## 6. Tracking operations

From **Admin → Orders**, use **Sync status** for a Printrove-created order. If Printrove returns a courier/tracking value, it is stored and the customer can find it on **Support → Track order**. You can also use **Update tracking** to enter an AWB/link manually; it attempts to email the customer through `notify-order-tracking`.

The public tracking form requires both the order number and the original checkout email. It does not expose addresses, payment IDs, or other customer orders.

## 7. Optional analytics

In `analytics-config.js`, fill only your own public IDs:

```js
window.VEYRATH_ANALYTICS = {
  gaMeasurementId: 'G-XXXXXXXXXX',
  metaPixelId: '123456789012345'
};
```

Leave them blank if you are not ready. The site then loads no GA4 or Meta script. The release tracks page view, item view, checkout start, coupon use, order tracking lookup, newsletter signup, and verified purchase when IDs are present.

## Final launch check

1. Confirm `AFTERDARK10` works and the discount changes the Razorpay amount.
2. Use a low-value controlled payment; confirm the admin order is paid before enabling auto Printrove.
3. Confirm the Razorpay webhook URL is the Supabase `razorpay-webhook` Edge Function URL—not your GitHub Pages URL.
4. Verify the payment confirmation email from a real customer email after configuring Resend.
5. On a real phone, test Shop, product modal, checkout, Support tracking, Collection dropdown, and Size charts.
6. Before a custom domain goes live, update canonical and Open Graph URLs in the root HTML files from the GitHub Pages address to the final domain.

Never paste Razorpay secrets, Printrove credentials, Supabase service keys, Resend keys, or email-provider passwords into GitHub or a frontend JavaScript file.
