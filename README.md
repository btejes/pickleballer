# BePickleballer

Source code for the BePickleballer paddle finder quiz, admin, and Apps Script backend.

## Folders

| Path | What it is | Where it runs |
|---|---|---|
| `bp-quiz/` | Public paddle finder quiz visitors take | GitHub Pages (`https://btejes.github.io/pickleballer/bp-quiz/`) embedded via iframe on `bepickleballer.com/quiz/` |
| `bp-admin/` | Internal admin (paddles, categories, quiz mappings, subscribers, completions, click logs) | Bluehost-hosted WordPress at `bepickleballer.com/admin/` (this folder is the canonical source) |
| `paddle-quiz-appsscript.gs` | Apps Script M1 backend (paddle admin CRUD + auth) | Google Apps Script web app — `BePickleballer Email Capture` project |
| `paddle-quiz-m2-appsscript.gs` | Apps Script M2-M4 backend (quiz engine, scoring, results, email send, click tracking) | Same Apps Script web app, paste as a second `.gs` file |

## How the pieces fit together

1. Visitor lands on `bepickleballer.com/quiz/` (WordPress page)
2. That page embeds `bp-quiz/` via iframe via `bp-quiz/wordpress-embed.html`
3. Quiz submits to the Apps Script web app
4. Apps Script reads/writes the Google Sheet (Paddles, Categories, QuizMappings, Completions, Subscribers, PaddleClicks)
5. Quiz shows top 3 paddles with discount codes; visitor can email results (via Resend)
6. Click on a paddle records to `PaddleClicks` tab

## Apps Script Script Properties needed

- `RESEND_API_KEY` — Resend API key (Pro account)
- `FROM_EMAIL` — `ben@bepickleballer.com`
- `FROM_NAME` — `BePickleballer`
- `BP_QUIZ_PUBLIC_URL` — `https://bepickleballer.com/quiz` (the WordPress URL, not GitHub Pages)
- `DISCOUNT_DB_URL` — Ben's discount codes database URL (used in results email)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` — for the admin login
