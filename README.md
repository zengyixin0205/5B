# 5B English Quiz Room

A name-first English quiz website for Class 5B. The teacher can create quizzes with open-ended and multiple-choice questions. Each quiz is saved in Cloudflare D1 and gets a six-digit code. Students enter their name and the code to answer. Only someone with the teacher access code can view submissions and answer keys.

## Website and API

- Website: https://zengyixin0205.github.io/5B/
- Cloudflare Worker API: https://5b-english-api.zeng-yixin.workers.dev
- Cloudflare D1 database: `5b-english-board`

GitHub Pages hosts the website. Cloudflare Workers handles quiz creation, scoring, and submissions; Cloudflare D1 stores quiz content and answers.

## Teacher access

The teacher access code is a Cloudflare Worker secret and is never included in this repository. Enter it when creating a quiz or viewing submissions. Replace it with:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler secret put TEACHER_CODE --config cloudflare-worker/wrangler.jsonc

Quiz codes can be shared with students. Do not share the teacher access code with students.

## Deploy

The website deploys from the `main` branch through GitHub Pages. Deploy Worker changes with:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config cloudflare-worker/wrangler.jsonc

Apply new D1 schema migrations to the remote database with:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler d1 migrations apply 5b-english-board --remote --config cloudflare-worker/wrangler.jsonc

The Worker secret `TEACHER_CODE` must remain configured in Cloudflare. The Worker limits browser access to the GitHub Pages origin configured as `SITE_ORIGIN`.
