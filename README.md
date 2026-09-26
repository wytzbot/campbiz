# CampBiz

A low-cost, mobile-first campus business discovery platform.

## Agreed v1 model

- Students browse anonymously after choosing a school.
- Students see businesses only for their selected school.
- Business owners use Google sign-in for account/sync/billing.
- Business owners connect their own Google Drive for business media.
- Your platform stores business metadata, SEO, reviews, subscriptions, analytics and system records.
- Businesses pay ₦1,200/month after a 60-day free period.
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
- Flutterwave can be connected server-side for the ₦1,200 subscription.
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
- FCM client code checks browser permission/support and verifies the token endpoint response.
- `robots.txt` contains no fake domain placeholder.


## Configuration policy
Public Firebase Web SDK configuration is stored in `firebase-config.js` and is not a Vercel secret. Firebase Admin credentials, Google OAuth secrets, and Flutterwave secrets remain server-side.
