# CampBiz

A low-cost, mobile-first campus business discovery platform.

## Agreed v1 model

- Students browse anonymously after choosing a school.
- Students see businesses only for their selected school.
- Business owners use Google sign-in for account/sync/billing.
- Business owners connect their own Google Drive for business media.
- Your platform stores business metadata, SEO, reviews, subscriptions, analytics and system records.
- Business owners are offered a recurring the configured Paystack annual plan subscription. Configure a Paystack annual payment plan before enabling live billing.
- The platform does not process student-to-business sales or hold customer money.
- Students contact owners directly through WhatsApp/DM links.
- Store links are available to active businesses.
- Student verification by matric number is intentionally NOT included in v1.
- Free browser-based student tools are included.

## Low-cost production architecture

Frontend:
- Static HTML/CSS/JS PWA.
- Host on GitHub Pages, Vercel or another free static host.
- Connect a cheap `.name.ng` domain.

Database/auth:
- Firebase/Firestore + Google Authentication are suitable for the first production deployment.
- Keep database records small and avoid storing media binaries.

Media:
- Business owner connects Google Drive.
- Store Drive file IDs/references in your database.
- Request the narrowest Google Drive OAuth scope that supports the product.
- Do not request unrestricted access to a user's entire Drive.
- Compress images before upload and impose reasonable per-business limits.

Payments:
- Paystack checkout is created server-side using the configured monthly or annual Paystack plan code. Configure PAYSTACK_SECRET_KEY, PAYSTACK_MONTHLY_PLAN_CODE, PAYSTACK_ANNUAL_PLAN_CODE, APP_URL, and Firebase Admin credentials as server-side environment variables. Confirm subscription activation only from server-side transaction verification or a verified Paystack webhook.
- Never put payment secrets in frontend JavaScript.
- Store only necessary payment/customer references and subscription state.

Backend endpoints to implement:
POST /api/auth/google
POST /api/drive/connect
POST /api/drive/callback
POST /api/drive/upload-reference
POST /api/business
PATCH /api/business/:id
GET /api/businesses?schoolId=
GET /api/search
POST /api/reviews
POST /api/events
POST /api/paystack-webhook
GET /api/subscription
POST /api/admin/business/:id/approve

## Data model

schools/{schoolId}
  fullName, abbreviation, type, state, city, aliases, active

users/{uid}
  role, schoolId, createdAt

businesses/{businessId}
  ownerId, schoolId, name, category, about, contact, location,
  deliveryTime, priceRange, storeSlug, driveConnectionId,
  status, subscriptionStatus, trialEndsAt, subscriptionEndsAt

products/{productId}
  businessId, name, description, price, driveFileId, imageUrl, active

reviews/{reviewId}
  businessId, userIdOrAnonymousSession, rating, text, createdAt, status

events/{eventId}
  schoolId, businessId, type, createdAt

## Security rules

1. Every business query must be scoped by schoolId.
2. Never trust schoolId supplied by the browser for authorization; derive it from the authenticated/session record where possible.
3. Business owners can edit only their own businesses.
4. Admin approval is required before a business becomes public.
5. Payment webhooks must be verified server-side.
6. Drive OAuth tokens/secrets stay server-side.
7. Students do not need Google accounts in v1.
8. Do not store raw matric numbers because student verification is deferred.
9. Rate-limit reviews and contact/event endpoints.
10. Do not expose private Drive files or OAuth tokens in HTML.

## Student tools included in this starter

- GPA calculator
- CGPA calculator
- Percentage calculator
- Target-score calculator
- Study timer
- Word counter
- Unit converter
- Deadline countdown
- Private local notes

These tools run locally and do not create a third-party API bill.

## School database

The included school list is only a starter seed and must not be presented as the complete Nigerian institution list. Before launch, import a maintained authoritative list covering universities, polytechnics and colleges, with full names, abbreviations, aliases, states and institution types.

## Production checklist

- Replace YOUR-DOMAIN.name.ng in robots.txt.
- Add sitemap.xml generated from public store routes.
- Configure Firebase project and secure Firestore rules.
- Configure Google OAuth.
- Create a server-side Google Drive OAuth flow.
- Configure Paystack on the server.
- Add webhook signature verification.
- Add admin authentication and approval screens.
- Add a real school seed dataset.
- Add image compression and file-size limits.
- Add privacy, terms, disclaimer, contact and business-owner policies.
- Test mobile PWA installation and all payment/Drive failure states.


## GPA/CGPA update
Students enter an unlimited number of courses in three columns: Course, Credit Units, Score. The calculator uses a 5-point scale by default: 70+=5, 60-69=4, 50-59=3, 45-49=2, 40-44=1, below 40=0. Make this scale configurable per school before production if needed.

## FCM notifications for study tools
The timer and deadline tools expose completion events. Production notifications should use Firebase Cloud Messaging through a secure backend/service worker. Students must explicitly grant browser notification permission; a website cannot silently bypass that permission. Store the FCM token with anonymous session/school ID and preferences, and schedule deadline reminders server-side if they must fire while the page is closed. Never put Firebase Admin credentials in the browser.


## Owner account
Privileged owner/admin test email:
`ilemobayotolulope11092003@gmail.com`

Verify the Google identity server-side before granting privileges.

## Production fixes included in v2
- PWA icon and manifest icon entry
- FCM background-service-worker template
- Secure FCM backend flow documentation
- Owner email configuration
- API wiring documentation


## Error-audit notes
- Dynamic search/FYP/favorites cards rebind their Save handlers after every render.
- Invalid/corrupt localStorage favorites no longer crash startup.
- Deadline tool rejects empty, invalid and past dates.
- Study timer rejects zero/negative/invalid durations.
- Business text is escaped before being inserted into generated cards.
- PWA uses 192px/512px PNG icons for broader install compatibility.
- Service worker uses a versioned cache and does not cache failed responses.
- FCM client code imports the embedded public Firebase config/VAPID key, checks browser permission/support, reuses an existing Firebase app when available, and verifies the token endpoint response.
- `robots.txt` contains no fake domain placeholder.


## Configuration policy
Public Firebase Web SDK configuration is stored in `firebase-config.js` and is not a Vercel secret. Firebase Admin credentials, Google OAuth secrets, and Paystack secrets remain server-side.


## FCM backend configuration
The included `/api/fcm/token` endpoint securely registers browser FCM tokens in Firestore. It never exposes Firebase Admin credentials to the browser.

Configure either `FIREBASE_SERVICE_ACCOUNT_JSON` (the complete service-account JSON) **or** these three Vercel server-side variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Keep all of them secret. The public Firebase Web SDK config and VAPID public key remain in the client files.


## School catalogue
CampBiz now includes an expanded Nigerian tertiary-institution catalogue covering universities, polytechnics and colleges of education. The catalogue is also exported to `data/schools.json` so it can later be moved to Firestore, Google Sheets/Drive, or another managed data source without changing the UI.

The institution lists were cross-checked against current NUC university-system information and NCCE/NBTE institution directories where applicable.


## Paystack subscription setup
- Set `PAYSTACK_SECRET_KEY` as a server-side Vercel environment variable.
- Set `PAYSTACK_MONTHLY_PLAN_CODE=PLN_l3x2lebuzk6dzqw`.
- Set `PAYSTACK_ANNUAL_PLAN_CODE=PLN_9b33lqkxewk4hh8`.
- Set `APP_URL=https://campbiz.vercel.app` (or the final production origin).
- Configure the Paystack webhook URL as `https://campbiz.vercel.app/api/paystack-webhook`.
- Set `CRON_SECRET` to a long random secret for the trial activation cron.
- Configure the Vercel cron path `/api/cron/subscription-trials`.
- On Vercel Hobby, this daily job can run once per day and may be invoked within the scheduled hour rather than at an exact minute. This is sufficient because the job only processes trials that have already expired.
- Pro access is free for 60 days. Because Paystack does not provide a native zero-payment subscription trial, the app uses Paystack's documented tokenization workaround: a refundable NGN 50 card verification captures a reusable authorization, the verification transaction is refunded, and the selected plan is created after the 60-day trial.
- The monthly plan code is `PLN_l3x2lebuzk6dzqw`; the annual plan code is `PLN_9b33lqkxewk4hh8`. The actual annual amount/interval remains controlled by the Paystack plan configuration.
- Never expose `PAYSTACK_SECRET_KEY`, Firebase Admin credentials, or Google Drive service-account credentials to the browser.

## Audit findings / launch blockers
- The UI's annual billing button now reports the provider's charge state and never claims a subscription is active from initiation.
- Charge attempts are recorded in Firestore `subscriptionPayments` with server timestamps and provider charge IDs.
- Existing marketplace listings are demo/static client data, ratings/favorites are device-local, and the business owner screen is not a complete listing submission CRUD workflow. Do not launch or represent demo businesses as verified live listings.
- Run end-to-end sandbox tests for auth required/guest, missing payment method, charge success/failure/pending, duplicate webhook, invalid webhook signature, refund/chargeback, renewal, cancellation, expired card, and access revocation.

The backend now includes `POST /api/subscription/authorize` for charge challenges. It supports the v4 `requires_pin` and `requires_otp` action types, verifies the Firebase owner and stored charge challenge, then sends the documented `PUT /charges/{id}` authorization payload. PIN values must arrive encrypted with a nonce; raw PINs are rejected. The initial checkout records the provider's `next_action` and no longer marks the first charge as recurring, so an issuer-required authorization can be handled. This does not complete the missing card-enrollment UI/encryption integration or verified webhook entitlement handler; do not deploy as a complete live subscription flow until those are implemented and tested.

## Published listing storage
Published business listings are stored as metadata/reference documents in the Firestore `publishedListings` collection. Images are not stored in Firestore. The browser resizes/crops featured images to 1280x720 and product images to 1200x900, then iteratively JPEG-compresses each image to 450 KB or less before upload. The Drive upload endpoint rejects image payloads over 550 KB as a second safety check. Firestore stores only the Drive image IDs/URLs and listing metadata.

The existing `/api/storage/upload` serverless function handles Drive status/connect/upload plus published-listing writes and public listing reads, so the project remains at 10 API functions.


## Final interaction fixes
- Owner Google sign-in uses a direct shared authentication handler; mobile uses redirect and desktop uses popup with fallback.
- School picker supports search, type filters, and up to 80 visible matches per query.
- Menu renders the complete category list rather than truncating it to 12.
- Dashboard uses a 4-step owner workflow and clearer Drive/listing status.
- API count remains 10.


## Merchant reputation and moderation rules

CampBiz merchant reputation is account-level:
- A merchant has one rating average/count shared by every published listing.
- Likes are also account-level and one client account can like a merchant once.
- Listing reviews/comments remain listing-specific and only their count is shown on each listing.
- Reports are unique per reporting client account and merchant account. The default automatic restriction threshold is 50.
- Suggested and Trusted merchant flags are calculated from configurable rating, rating-count and like thresholds stored in `campbizSettings/regulations`.
- CampBiz Admin Studio can enable/disable enforcement and change those thresholds.
