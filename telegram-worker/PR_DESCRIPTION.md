# Pull request: fix: accept India form values in telegram worker

This change updates the telegram worker validation to accept the option strings used by the website lead form and adds a small debug log for invalid India values.

Files changed
- telegram-worker/worker.js

What was wrong
- The worker rejected India leads because ALLOWED_INDIA_PATHS and ALLOWED_NEET_SCORES didn't match the frontend option strings.
- Bangladesh was missing from ALLOWED_COUNTRIES while the form lists it as an option.

What I changed
- Updated ALLOWED_INDIA_PATHS to match the form: Govt College, Private College, Deemed University, NRI Quota, Not Sure
- Updated ALLOWED_NEET_SCORES to match the form: Below 400, 400 – 500, 500 – 600, 600 – 650, 650+
- Added Bangladesh to ALLOWED_COUNTRIES
- Added console.error logging on India validation failures to help diagnose future issues

Testing steps
1. Deploy the updated worker (in telegram-worker): npx wrangler deploy
2. Submit the lead form choosing India options and confirm Telegram messages are delivered
3. If the worker still returns 400, check worker logs for the new console.error entry which includes the invalid values

Notes
- Ensure the worker that's actually used by the site (the API_ENDPOINT in assets/js/site.js) is the deployed worker being updated.
