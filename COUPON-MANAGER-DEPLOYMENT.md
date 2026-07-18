# VEYRATH Coupon Studio — deployment

This update is non-destructive. It keeps the current products, collections, customers and orders.

## 1. Upload the website files

Upload the contents of the supplied website ZIP to the root of the `Veyrath` GitHub repository. Do not put the files inside another folder.

## 2. Run the SQL once

In the **VEYRATH** Supabase project, open **SQL Editor** and run, in this order:

1. `veyrath-launch-upgrade.sql` — only if it has not already been run in this project.
2. `veyrath-coupon-manager-upgrade.sql` — required for this release.

The second script creates the safe public-offer view, validates product/private-code eligibility on the server, adds the Admin coupon manager fields, and creates/updates this launch offer:

```
LAUNCH20 — 20% off — public — automatically applied
```

It also pauses the old untouched `AFTERDARK10` fallback code, so customers see one clear launch offer. A manually edited version is left alone.

If you see the final row `VEYRATH coupon manager installed.`, it is ready.

## 3. Check it before promotion

1. Open a product page on the deployed website.
2. Confirm a gold `20% OFF · LAUNCH20` label is visible.
3. Select Buy now. The code should apply automatically and the total should reduce before Razorpay opens.
4. Open `admin.html`, sign in, then open **Offers & coupons**.

## Admin controls

- **Public website**: shows the offer on eligible products and in the offer strip.
- **Private customer email**: makes the code private and valid only for that exact checkout email.
- **Applies to → One product only**: restricts the discount to one product. The storefront only displays it on that product.
- **Apply automatically**: pre-applies an eligible public offer at checkout.
- **Pause**: turns off a code without deleting it. **Delete** removes the code for future orders.

For a personal customer code, enter their email, leave `Show on website` unchecked, and keep automatic apply off.

## Important

The price is recalculated in Supabase immediately before Razorpay is opened. A visitor cannot lower the payment amount by editing browser code. Coupon usage is marked after a paid order, not merely after an abandoned checkout.
