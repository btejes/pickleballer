# BePickleballer

Paddle finder quiz, admin, and backend.

## Folders

- `bp-quiz/` public quiz, served via GitHub Pages, embedded on `bepickleballer.com/quiz/`
- `bp-admin/` admin UI for paddles, categories, quiz mappings, subscribers (hosted on Bluehost at `bepickleballer.com/admin/`)
- `paddle-quiz-appsscript.gs` Apps Script: paddle admin + auth
- `paddle-quiz-m2-appsscript.gs` Apps Script: quiz engine, results, email, click tracking

## Build

CSS is compiled with Tailwind CLI. Both apps have their own `tailwind.config.js` and produce their own `tailwind.css`.

```
npm install
npm run build           # builds both apps
npm run watch:quiz      # rebuild quiz on change
npm run watch:admin     # rebuild admin on change
```

The built `tailwind.css` files are committed so deploying the static folders to GitHub Pages or Bluehost requires no build step on the host.

## Apps Script properties

- RESEND_API_KEY
- FROM_EMAIL = ben@bepickleballer.com
- FROM_NAME = Ben T
- BP_QUIZ_PUBLIC_URL = https://bepickleballer.com/quiz
- DISCOUNT_DB_URL (Ben's discount codes page)
- ADMIN_USERNAME, ADMIN_PASSWORD
