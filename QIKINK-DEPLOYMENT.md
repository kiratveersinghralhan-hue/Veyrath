# VEYRATH secure Qikink deployment

## 1. Apply the database migration

Open the Supabase SQL Editor, paste the complete `supabase-schema.sql` file, and run it. The file is idempotent.

The public checkout calls `create_pending_order()`. This function validates the address and product options, ignores browser-submitted prices, recalculates prices from published products, and always creates the order with:

- `payment_status = pending`
- `status = pending_payment`
- `qikink_status = not_sent`
- `amount_paid = 0`

## 2. Configure the CLI

```bash
supabase login
supabase link --project-ref rpsiddurmwtwvpnwzclo
```

## 3. Set Qikink credentials

Run these commands locally. Never add the real values to Git or frontend JavaScript.

```bash
supabase secrets set QIKINK_CLIENT_ID="YOUR_QIKINK_CLIENT_ID"
supabase secrets set QIKINK_CLIENT_SECRET="YOUR_QIKINK_CLIENT_SECRET"
```

The function defaults to `https://api.qikink.com/api/v1/auth/token` and `https://api.qikink.com/api/v1/orders`. Qikink's merchant API contract is account/version dependent and its exact endpoint schema is not publicly indexed. Compare these paths with the API pack in your Qikink account. If different, configure them without changing frontend code:

```bash
supabase secrets set QIKINK_TOKEN_URL="THE_TOKEN_ENDPOINT_FROM_QIKINK"
supabase secrets set QIKINK_ORDER_URL="THE_ORDER_ENDPOINT_FROM_QIKINK"
```

If Qikink specifies direct client headers instead of an access token:

```bash
supabase secrets set QIKINK_AUTH_MODE="direct"
```

Optionally restrict browser origins to the final GitHub Pages address and localhost:

```bash
supabase secrets set ALLOWED_ORIGINS="https://YOUR-USER.github.io,http://127.0.0.1:4173"
```

## 4. Deploy the function

The function source is at `supabase/functions/create-qikink-order/index.ts`.

```bash
supabase functions deploy create-qikink-order
```

JWT verification is enabled in `supabase/config.toml`. The function additionally verifies that the signed-in user exists as an active row in `admin_users`.

## 5. Map products

In `admin.html`, edit each product and provide:

- Qikink SKU, product ID, and variant ID
- print type and front/back print areas
- at least one public high-resolution design URL
- base cost, selling price, and estimated shipping charge

Qikink mapping is copied into `order_items` when checkout occurs, so later product edits do not silently change an existing paid order.

## 6. Payment integration

The project is Razorpay-ready but does not fake verification. A future Razorpay order/webhook Edge Function must:

1. verify Razorpay's signature using a server-side secret;
2. insert an immutable `payment_logs` row;
3. update `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, `amount_paid`, and `payment_status = paid` using the service role;
4. never allow the browser to mark an order paid.

After verified payment, an authenticated admin can use **Send to Qikink**. Failed attempts can be retried; created or in-progress orders are idempotently blocked.

## Lifecycle

```text
pending_payment -> paid (future verified payment webhook)
paid -> qikink_pending -> qikink_created
                       -> qikink_failed -> retry
```
