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
`POST /api/flutterwave/webhook`
- verify webhook authenticity
- verify transaction server-side
- verify transaction amount/currency, reference and status directly with Flutterwave\n- map verified customer/metadata to authenticated owner and persist plan renewal dates\n- handle duplicate events idempotently\n- update subscription status
- never trust a client-side "paid=true"

## Store
`GET /store/:schoolSlug/:businessSlug`
- public SEO page
- canonical URL
- JSON-LD business data
- robots/indexing controls based on business status
