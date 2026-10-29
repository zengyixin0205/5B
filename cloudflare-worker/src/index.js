const corsHeaders = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Teacher-Code',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
});

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 8000) throw new Error('Request is too large.');
  const text = await request.text();
  if (text.length > 8000) throw new Error('Request is too large.');
  return JSON.parse(text || '{}');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.SITE_ORIGIN || 'https://zengyixin0205.github.io';
    if (origin && origin !== allowedOrigin) return new Response('Origin not allowed.', {status:403});
    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, {status:204});
      return new Response(null, {status:204, headers:corsHeaders(origin)});
    }
    if (!['GET', 'POST'].includes(request.method)) return json({error:'Method not allowed.'}, 405, origin);

    try {
      if (url.pathname === '/api/questions' && request.method === 'GET') {
        const questions = await env.DB.prepare(
          'SELECT id, question, topic, created_at FROM questions ORDER BY created_at DESC LIMIT 100'
        ).all();
        const answers = await env.DB.prepare(
          'SELECT id, question_id, student_name, answer_text, created_at FROM answers ORDER BY created_at ASC LIMIT 1000'
        ).all();
        const byQuestion = new Map();
        for (const answer of answers.results || []) {
          const list = byQuestion.get(answer.question_id) || [];
          list.push({id:answer.id, name:answer.student_name, text:answer.answer_text, createdAt:answer.created_at});
          byQuestion.set(answer.question_id, list);
        }
        return json({questions:(questions.results || []).map(row => ({
          id:row.id, text:row.question, topic:row.topic, createdAt:row.created_at,
          answers:byQuestion.get(row.id) || []
        }))}, 200, origin);
      }

      if (url.pathname === '/api/questions' && request.method === 'POST') {
        if (!env.TEACHER_CODE) return json({error:'Teacher posting is not configured yet.'}, 503, origin);
        const submittedCode = request.headers.get('X-Teacher-Code') || '';
        if (submittedCode !== env.TEACHER_CODE) return json({error:'That teacher access code is not correct.'}, 401, origin);
        const body = await readJson(request);
        const question = String(body.question || '').trim();
        const topic = String(body.topic || '').trim();
        if (question.length < 3 || question.length > 500) return json({error:'Write a question between 3 and 500 characters.'}, 400, origin);
        if (topic.length > 50) return json({error:'Keep the topic to 50 characters or fewer.'}, 400, origin);
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await env.DB.prepare('INSERT INTO questions (id, question, topic, created_at) VALUES (?, ?, ?, ?)')
          .bind(id, question, topic, createdAt).run();
        return json({id, question, topic, createdAt}, 201, origin);
      }

      const answerMatch = url.pathname.match(/^\/api\/questions\/([a-f0-9-]{36})\/answers$/i);
      if (answerMatch && request.method === 'POST') {
        const questionId = answerMatch[1];
        const exists = await env.DB.prepare('SELECT id FROM questions WHERE id = ?').bind(questionId).first();
        if (!exists) return json({error:'This question could not be found.'}, 404, origin);
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        const answer = String(body.answer || '').trim();
        if (name.length > 40) return json({error:'Keep names or initials to 40 characters or fewer.'}, 400, origin);
        if (answer.length < 1 || answer.length > 2000) return json({error:'Write an answer of up to 2,000 characters.'}, 400, origin);
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await env.DB.prepare('INSERT INTO answers (id, question_id, student_name, answer_text, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(id, questionId, name || 'Student', answer, createdAt).run();
        return json({id, questionId, name:name || 'Student', answer, createdAt}, 201, origin);
      }
      return json({error:'Not found.'}, 404, origin);
    } catch (error) {
      if (error instanceof SyntaxError) return json({error:'Please send valid JSON.'}, 400, origin);
      return json({error:'The class board could not complete that request.'}, 500, origin);
    }
  }
};
