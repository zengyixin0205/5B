# The Scraggies: Your Test, Our Confusion

A name-first English quiz website for Class 5B. Teachers can create quizzes with open-ended and multiple-choice questions. Each quiz is saved in Cloudflare D1 and gets a six-digit code. Students enter their name and that code to answer. Teachers use the same quiz code to open submissions; no separate teacher access code is required.

## Website and API

- Website: https://zengyixin0205.github.io/5B/
- Cloudflare Worker API: https://5b-english-api.zeng-yixin.workers.dev
- Cloudflare D1 database: `5b-english-board`

GitHub Pages hosts the website. Cloudflare Workers handles quiz creation, scoring, answer review, and AI requests. Cloudflare D1 stores quiz content, submissions, and short-lived hashed IP counters used to limit AI requests.

## ChatGPT helper

The teacher quiz builder can draft a short reading passage with an open-ended question. The answer vault can request suggested feedback on an open-ended answer. Feedback is a suggestion for the teacher, not an automatic grade. Passage topics and reviewed answer text are sent to the OpenAI API; the review request does not include the student's name. Avoid entering personal details.

Add an OpenAI API key to the Cloudflare Worker as a secret. Wrangler will prompt for the key; it is never stored in the repository or sent to the browser:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler secret put OPENAI_API_KEY --config cloudflare-worker/wrangler.jsonc

The default model is `gpt-6-luna`; set the optional `OPENAI_MODEL` Worker variable to change it. API usage may incur separate charges. See [OpenAI API pricing](https://platform.openai.com/pricing).

The AI endpoint allows up to 10 requests per hour per connection. Its per-hour counter stores a hashed address and is automatically removed after 48 hours.

## Quiz code and answer privacy

The same six-digit quiz code opens a quiz and its answer submissions, because no teacher access code is required. Anyone with a quiz code can view its submissions, so teachers should keep the code within the class and remind students not to include private details in answers.

## Deploy

The website deploys from the `main` branch through GitHub Pages. Deploy Worker changes with:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config cloudflare-worker/wrangler.jsonc

Apply new D1 schema migrations to the remote database with:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler d1 migrations apply 5b-english-board --remote --config cloudflare-worker/wrangler.jsonc

The Worker limits browser access to the GitHub Pages origin configured as `SITE_ORIGIN`.
