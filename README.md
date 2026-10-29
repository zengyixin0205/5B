# 5B English — Question board

A responsive English class board for Class 5B. Teachers can post questions with an optional topic. Students can answer with an optional name or initials. Answers can be downloaded as CSV.

## Website and API

- Website: https://zengyixin0205.github.io/5B/
- Cloudflare Worker API: https://5b-english-api.zeng-yixin.workers.dev
- Cloudflare D1 database: 5b-english-board

The website is hosted on GitHub Pages. The API runs on a Cloudflare Worker and stores shared questions and answers in Cloudflare D1.

## Teacher posting

Enter the teacher access code in the question form each time a prompt is posted. The code is stored as a Cloudflare Worker secret, not in this repository or the browser. Do not share it with students. To replace it, run:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler secret put TEACHER_CODE --config cloudflare-worker/wrangler.jsonc

## Board visibility

This board is public: every question and answer is visible to anyone who visits the website. Student names are optional. Students should use initials or no name and avoid personal information.

## Deploy changes

The front end deploys when changes are pushed to the main branch. Deploy Worker changes with:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config cloudflare-worker/wrangler.jsonc

The D1 schema migration is in cloudflare-worker/migrations/0001_initial.sql. For future migrations, use Wrangler's D1 migration commands with the remote database.

## Local preview

Open index.html in a browser. The cloudflare-config.js file points to the live API; set CLOUDFLARE_API_BASE to an empty string to use browser-only preview data.
