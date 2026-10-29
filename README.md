# The Scraggies: Your Test, Our Confusion

A name-first English quiz website for Class 5B. Teachers can create quizzes with open-ended and multiple-choice questions. Each quiz is saved in Cloudflare D1 and gets a six-digit code. Students enter their name and that code to answer. Teachers use the same quiz code to open submissions; no separate teacher access code is required.

## Website and API

- Website: https://zengyixin0205.github.io/5B/
- Cloudflare Worker API: https://5b-english-api.zeng-yixin.workers.dev
- Cloudflare D1 database: `5b-english-board`

GitHub Pages hosts the website. Cloudflare Workers handles quiz creation, scoring, answer review, and AI requests. Cloudflare D1 stores quiz content, submissions, and short-lived hashed IP counters used to limit AI requests.

## AI classroom assistant

The teacher quiz builder can draft a short reading passage with an open-ended question. The answer vault can request suggested feedback on an open-ended answer. Feedback is a suggestion for the teacher, not an automatic grade. AI requests use Cloudflare Workers AI with Meta's `@cf/meta/llama-3.2-1b-instruct` model. Passage topics and reviewed answer text are sent to Cloudflare; review requests do not include the student's name. Avoid entering personal details and review generated material before using it.

The Worker has a Workers AI binding configured in `cloudflare-worker/wrangler.jsonc`; no external API key is required. Deploy with:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler deploy --config cloudflare-worker/wrangler.jsonc

TinyLlama (`@cf/tinyllama/tinyllama-1.1b-chat-v1.0`) is no longer listed as an available Workers AI model, so the site uses Cloudflare's currently supported 1B Llama instruction model instead. See the [Cloudflare model catalog](https://developers.cloudflare.com/workers-ai/models/).

The AI endpoint allows up to 10 requests per hour per connection. Its per-hour counter stores a hashed address and is automatically removed after 48 hours. Workers AI usage is billed according to Cloudflare's [model pricing](https://developers.cloudflare.com/workers-ai/models/llama-3.2-1b-instruct/).

## Quiz code and answer privacy

The same six-digit quiz code opens a quiz and its answer submissions, because no teacher access code is required. Anyone with a quiz code can view its submissions, so teachers should keep the code within the class and remind students not to include private details in answers.

## Deploy

The website deploys from the `main` branch through GitHub Pages. Apply new D1 schema migrations to the remote database with:

    npm exec --yes --package=wrangler@4.155.0 -- wrangler d1 migrations apply 5b-english-board --remote --config cloudflare-worker/wrangler.jsonc

The Worker limits browser access to the GitHub Pages origin configured as `SITE_ORIGIN`.
