SCHOOLTRACK EAPIHS — FIREBASE STARTER

FILES
- index.html: app screens and navigation
- style.css: maroon/green design
- app.js: app behavior, inventory, reports, feedback, history, sounds, theme
- firebase.js: Firebase project configuration and offline Firestore persistence
- admin.js: separate Admin authentication/authorization module
- firestore.rules: database security rules
- manifest.json + service-worker.js: installable PWA shell
- assets/schooltrack-icon.png: supplied SchoolTrack icon

IMPORTANT SETUP
1. Create/open your Firebase project.
2. Register a Web App in Firebase Project settings.
3. Copy the Web App configuration into firebase.js. Replace every placeholder.
4. In Firebase Authentication, enable Email/Password and Anonymous sign-in.
5. Create a Firestore database.
6. Publish firestore.rules in Firestore Rules.
7. Create an Admin account in Authentication > Users using the authorized administrator's email/password.
8. Copy that user's UID.
9. In Firestore Data, create collection: admins
   Document ID: exactly the Admin user's UID
   Field: active (boolean) = true
   Do not let ordinary users create or edit admin documents.
10. Upload the project files to your static host using HTTPS (GitHub Pages can host the front end).
11. Open the website, choose Account, and sign in as Admin. Guests can continue anonymously.

ADMIN SECURITY
The Admin check is in admin.js, separate from app.js.
Do NOT store an Admin password or shared secret code in browser JavaScript.
Admin permissions are granted by the protected admins/{uid} Firestore document.
Only a trusted project owner should create that document through Firebase Console.

OFFLINE NOTES
The app shell and Firestore cache can work offline after the first successful online load.
New writes made offline are queued by Firestore and sync when the device reconnects.
Authentication and first-time sign-in require internet.
Do not describe this as fully offline before testing on the target phone/browser.

CURRENT STARTER LIMITATIONS
- Inventory create, list, basic borrow/return, send-to-repair, edit and delete are included.
- Reports can be submitted; Admin can update Pending / Under Review / Resolved.
- Feedback, history, CSV report, JSON backup and basic inventory restore are included.
- Detailed missing/found and repair completion workflows, multi-user conflict testing, stronger audit history, and full device installation testing still need to be added/tested.
- The Firebase config values are placeholders and must be filled locally by the project owner.
