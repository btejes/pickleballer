# BePickleballer

Paddle finder quiz, admin, and backend.

## Folders

- `bp-quiz/` public quiz, served via GitHub Pages, embedded on `bepickleballer.com/quiz/`
- `bp-admin/` admin UI for paddles, categories, quiz mappings, subscribers (hosted on Bluehost at `bepickleballer.com/admin/`)
- `paddle-quiz-appsscript.gs` Apps Script: paddle admin + auth
- `paddle-quiz-m2-appsscript.gs` Apps Script: quiz engine, results, email, click tracking

## Apps Script properties

- RESEND_API_KEY
- FROM_EMAIL = ben@bepickleballer.com
- FROM_NAME = BePickleballer
- BP_QUIZ_PUBLIC_URL = https://bepickleballer.com/quiz
- DISCOUNT_DB_URL (Ben's discount codes page)
- ADMIN_USERNAME, ADMIN_PASSWORD
