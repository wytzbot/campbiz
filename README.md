# CampBiz

A low-cost, mobile-first campus business discovery platform.

## Agreed v1 model

- Students browse anonymously after choosing a school.
- Students see businesses only for their selected school.
- Business owners use Google sign-in for account/sync/billing.
- Business owners connect their own Google Drive for business media.
- Your platform stores business metadata, SEO, reviews, subscriptions, analytics and system records.
- Business owners are offered a recurring ₦11,500/year subscription. Configure a Flutterwave annual payment plan before enabling live billing.
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
- Flutterwave checkout is created server-side for the ₦11,500 annual plan. Use Flutterwave v4 customer/payment-method setup and v4 recurring charges; no v3 endpoints or payment-plan IDs are used. Configure FLW_SECRET_KEY, APP_URL, and Firebase Admin credentials as server-side environment variables. Confirm subscription activation only from a verified Flutterwave webhook; checkout return alone is not proof of payment.
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
POST /api/flutterwave/webhook
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
- Configure Flutterwave on the server.
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
Public Firebase Web SDK configuration is stored in `firebase-config.js` and is not a Vercel secret. Firebase Admin credentials, Google OAuth secrets, and Flutterwave secrets remain server-side.


## FCM backend configuration
The included `/api/fcm/token` endpoint securely registers browser FCM tokens in Firestore. It never exposes Firebase Admin credentials to the browser.

Configure either `FIREBASE_SERVICE_ACCOUNT_JSON` (the complete service-account JSON) **or** these three Vercel server-side variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Keep all of them secret. The public Firebase Web SDK config and VAPID public key remain in the client files.


## School catalogue
CampBiz now includes an expanded Nigerian tertiary-institution catalogue covering universities, polytechnics and colleges of education. The catalogue is also exported to `data/schools.json` so it can later be moved to Firestore, Google Sheets/Drive, or another managed data source without changing the UI.

The institution lists were cross-checked against current NUC university-system information and NCCE/NBTE institution directories where applicable.


## Annual subscription setup (required before launch)
- Create a Flutterwave plan with amount NGN 11,500 and billing interval yearly/annually in the Flutterwave dashboard.
- Set `FLW_ANNUAL_PLAN_ID` to that exact plan ID, plus `FLW_SECRET_KEY` and `APP_URL` in the deployment's server-side environment.
- Configure Firebase Admin service account variables as described above.
- Configure the Flutterwave webhook endpoint and verify its signature and each transaction server-side before granting access. Never activate a plan based only on the browser redirect or client-provided status.
- Test successful, declined, abandoned, duplicate webhook, renewal, cancellation and failed-renewal scenarios in Flutterwave test mode before going live.
- Recurring billing behavior, renewal retries and cancellation are controlled by the Flutterwave plan/account configuration; confirm those settings in the dashboard before publishing the offer.

## Audit findings / launch blockers
- The UI's annual billing button now reports the provider's charge state and never claims a subscription is active from initiation.
- Charge attempts are recorded in Firestore `subscriptionPayments` with server timestamps and provider charge IDs.
- Critical blocker: implement v4 charge verification endpoint and webhook processor to validate successful status, exact amount NGN 11,500, currency, unique reference, and customer/owner mapping; process events idempotently and update entitlement.
- Critical blocker: implement trusted annual renewal scheduler or a Flutterwave-supported subscription schedule for this merchant account. A one-time `/charges` call with `recurring:true` is a recurring-card charge capability, not a schedule that automatically charges every year.
- Critical blocker: secure v4 payment-method/customer enrollment is not included. The app expects `billingCustomers/{uid}` to be populated only by a server-verified enrollment flow.
- Existing marketplace listings are demo/static client data, ratings/favorites are device-local, and the business owner screen is not a complete listing submission CRUD workflow. Do not launch or represent demo businesses as verified live listings.
- Run end-to-end sandbox tests for auth required/guest, missing payment method, charge success/failure/pending, duplicate webhook, invalid webhook signature, refund/chargeback, renewal, cancellation, expired card, and access revocation.

### Flutterwave v4 authorization endpoint
The backend now includes `POST /api/subscription/authorize` for charge challenges. It supports the v4 `requires_pin` and `requires_otp` action types, verifies the Firebase owner and stored charge challenge, then sends the documented `PUT /charges/{id}` authorization payload. PIN values must arrive encrypted with a nonce; raw PINs are rejected. The initial checkout records the provider's `next_action` and no longer marks the first charge as recurring, so an issuer-required authorization can be handled. This does not complete the missing card-enrollment UI/encryption integration or verified webhook entitlement handler; do not deploy as a complete live subscription flow until those are implemented and tested.
