# Backend contract

The frontend is intentionally static-first. Production backend endpoints should implement these contracts.

## Business
`POST /api/business`
- authenticated Google owner
- validates schoolId against allowed school records
- creates pending business
- sets 60-day trial after approval

`PATCH /api/business/:id`
- owner/admin only

## Google Drive
`POST /api/drive/connect`
- creates OAuth authorization URL

`GET /api/drive/callback`
- exchanges authorization code server-side
- stores encrypted token reference
- creates/locates app-owned folder

`POST /api/drive/upload-reference`
- uploads or references approved media
- returns Drive file ID + safe image URL

## Search
`GET /api/search?schoolId=&q=&category=&price=`
- always restricts results to schoolId
- ranks relevance, engagement, freshness, profile completeness, rating quality, availability and location match

## Reviews
`POST /api/reviews`
- rate limited
- moderation status
- prevent obvious duplicate abuse

## Payments
`POST /api/paystack-webhook`
- verify the HMAC-SHA512 signature against the raw request body
- process each payload idempotently
- map verified metadata/customer/payment references to the owner
- use Paystack subscription `next_payment_date` instead of calculating renewal dates locally
- handle `subscription.create`, `charge.success`, `invoice.payment_failed`, `subscription.not_renew`, and `subscription.disable`
- never trust a client-side "paid=true"

## Store
`GET /store/:schoolSlug/:businessSlug`
- public SEO page
- canonical URL
- JSON-LD business data
- robots/indexing controls based on business status

## Paystack
`POST /api/subscription/checkout`
- Requires Firebase owner bearer token.
- Body: `{ "plan": "monthly" | "annual" }`.
- Uses the configured Paystack plan code; the server never trusts a client amount.

`POST /api/subscription/verify`
- Verifies the Paystack transaction server-side before granting Pro access.

`GET /api/subscription/status`
- Returns current verified owner subscription state.

`POST /api/paystack-webhook`
- Verifies the Paystack signature and processes charge/subscription/failed-payment events.

## Google Drive storage
`POST /api/storage/upload`
- Requires Firebase owner bearer token.
- Body: `{ "fileName": "...", "mimeType": "image/jpeg", "data": "<base64>" }`.
- Stores the file in the configured `DRIVE_FOLDER_ID` and returns the Drive file ID and a web-view URL.
- The Drive folder must be shared with the configured service account.

## Trial billing
`POST /api/subscription/trial-enroll`
- Requires Firebase owner bearer token.
- Initializes a refundable NGN 50 card verification transaction.
- Stores only the resulting reusable authorization code server-side.

`POST /api/subscription/trial-verify`
- Verifies the tokenization transaction directly with Paystack.
- Requires a reusable authorization.
- Queues a full refund for the NGN 50 verification.

`POST /api/subscription/activate-trial`
- Requires Firebase owner bearer token.
- After the 60-day trial, creates the selected Paystack subscription using the stored authorization.

`GET /api/cron/subscription-trials`
- Server-only scheduled job.
- Finds expired trials with enrolled reusable authorizations and starts their selected Paystack plans.
- Protected by `CRON_SECRET` when configured.
