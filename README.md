NEXORA v2.3.0

NEXORA is a Firebase-powered business workspace starter.

Files

index.html — app layout and authentication screen

style.css — responsive UI and dark/light theme

app.js — authentication, records, dashboard, reports and team/task interface

firebase.js — Firebase project initialization

firestore.rules — database access rules

firestore.indexes.json — Firestore index configuration

Setup

Create or open the Firebase project nexora-ac0e4.

Enable Email/Password and Google sign-in in Firebase Authentication.

Create the Firestore database.

Test and deploy the Firestore rules only after reviewing them in the Firebase Emulator.

Push the files to the NEXORA GitHub repository.

Deploy the repository on Vercel.

Important limitations

Creating an invitation document does not send an email.

Email invitations require a trusted email service or backend.

The invitation-acceptance implementation must be completed and tested with a secure invite identifier before production use.

A category selector does not automatically create a fully specialized workflow for every profession. Profession-specific workflows still need implementation.

Test account creation, login, data isolation, membership, task access, status updates and exports before inviting real users.

Do not store sensitive healthcare, financial or other regulated personal data until the application has undergone the appropriate security and privacy review.
