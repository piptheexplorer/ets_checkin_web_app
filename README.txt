Event Ticket Seller Check-in Web App
====================================

This is a standalone Progressive Web App for venue staff. It checks tickets in by talking to the Event Ticket Seller WordPress plugin API.

Setup
-----
1. Install the matching Event Ticket Seller plugin upgrade.
2. In WordPress, open Ticket Seller > Check-in App API.
3. Add the web app domain to Allowed web app origins.
4. Generate a token and copy it once.
5. Upload this web app folder to a static host, subdomain or server directory.
6. Open the app, enter the WordPress site URL or API base URL, paste the token and save.

API base examples
-----------------
https://example.com
https://example.com/wp-json/ets-app/v1

The app works best over HTTPS because browser camera access normally requires a secure context.

What it can do
--------------
- Staff token connection.
- Event and date selection.
- QR camera scanning.
- Manual ticket lookup.
- Valid / duplicate / refunded / wrong-event / wrong-date feedback.
- Check-in and undo.
- Gate or entrance tracking.
- Live attendance totals.
- Recent activity feed.
- Door list search and filters.
- Add to home screen as a PWA.

Offline note
------------
This first version caches the app shell, but ticket validation and check-in are online-only. WordPress remains the source of truth for duplicate prevention, refunds and multi-device sync.
