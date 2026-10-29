const corsHeaders = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Teacher-Code',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
});

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {status:status || 200, headers:{...corsHeaders(origin || ''), 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}});
}
async function readJson(request) {
  const text = await request.text();
  if (text.length > 20000) throw new Error('Request is too large.');
  return JSON.parse(text || '{}');
}
function teacherAuthorized(request, env) { return Boolean(env.TEACHER_CODE && request.headers.get('X-Teacher-Code') === env.TEACHER_CODE); }
function cleanText(value) { return String(value == null ? '' : value).trim(); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.SITE_ORIGIN || 'https://zengyixin0205.github.io';
    if (origin && origin !== allowedOrigin) return new Response('Origin not allowed.', {status:403});
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:origin ? corsHeaders(origin) : {}});
    if (!['GET','POST'].includes(request.method)) return json({error:'Method not allowed.'},405,origin);
    try {
      if (url.pathname === '/api/quizzes' && request.method === 'POST') {
        if (!env.TEACHER_CODE) return json({error:'Teacher access is not configured.'},503,origin);
        if (!teacherAuthorized(request,env)) return json({error:'That teacher access code is not correct.'},401,origin);
        const body = await readJson(request);
        const title = cleanText(body.title);
        const creator = cleanText(body.createdBy).slice(0,40) || 'Teacher';
        const questions = Array.isArray(body.questions) ? body.questions : [];
        if (title.length < 1 || title.length > 80) return json({error:'Enter a title up to 80 characters.'},400,origin);
        if (!questions.length || questions.length > 20) return json({error:'Add between 1 and 20 questions.'},400,origin);
        const normalized = [];
        for (const question of questions) {
          const prompt = cleanText(question.prompt);
          const type = question.type === 'mcq' ? 'mcq' : question.type === 'open' ? 'open' : '';
          if (!type || prompt.length < 3 || prompt.length > 500) return json({error:'Each question needs a prompt between 3 and 500 characters.'},400,origin);
          if (type === 'mcq') {
            const options = Array.isArray(question.options) ? question.options.map(cleanText) : [];
            const correctIndex = Number(question.correctIndex);
            if (options.length < 2 || options.length > 6 || options.some(x => !x || x.length > 200) || new Set(options.map(x => x.toLowerCase())).size !== options.length) return json({error:'Each multiple-choice question needs 2–6 different choices, each up to 200 characters.'},400,origin);
            if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return json({error:'Choose the correct answer for each multiple-choice question.'},400,origin);
            normalized.push({prompt,type,options,correctIndex});
          } else normalized.push({prompt,type,options:[],correctIndex:null});
        }
        let code = '';
        for (let attempt=0; attempt<8; attempt++) {
          code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6,'0');
          const exists = await env.DB.prepare('SELECT code FROM quiz_files WHERE code = ?').bind(code).first();
          if (!exists) break;
          code = '';
        }
        if (!code) return json({error:'Could not create a unique quiz code. Please try again.'},503,origin);
        const quizId = crypto.randomUUID(); const createdAt = new Date().toISOString();
        const statements = [env.DB.prepare('INSERT INTO quiz_files (id, code, title, created_by, created_at) VALUES (?, ?, ?, ?, ?)').bind(quizId,code,title,creator,createdAt)];
        normalized.forEach((q,index) => statements.push(env.DB.prepare('INSERT INTO quiz_questions (id, quiz_id, position, prompt, question_type, options_json, correct_index) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(),quizId,index,q.prompt,q.type,JSON.stringify(q.options),q.correctIndex)));
        await env.DB.batch(statements);
        return json({code,title,createdAt},201,origin);
      }

      const quizMatch = url.pathname.match(/^\/api\/quizzes\/(\d{6})$/);
      if (quizMatch && request.method === 'GET') {
        const quiz = await env.DB.prepare('SELECT id, code, title FROM quiz_files WHERE code = ?').bind(quizMatch[1]).first();
        if (!quiz) return json({error:'Quiz code not found. Check the code and try again.'},404,origin);
        const result = await env.DB.prepare('SELECT id, prompt, question_type, options_json FROM quiz_questions WHERE quiz_id = ? ORDER BY position').bind(quiz.id).all();
        return json({code:quiz.code,title:quiz.title,questions:(result.results || []).map(row=>({id:row.id,prompt:row.prompt,type:row.question_type,options:JSON.parse(row.options_json)}))},200,origin);
      }

      const submissionsMatch = url.pathname.match(/^\/api\/quizzes\/(\d{6})\/submissions$/);
      if (submissionsMatch && request.method === 'POST') {
        const quiz = await env.DB.prepare('SELECT id, code FROM quiz_files WHERE code = ?').bind(submissionsMatch[1]).first();
        if (!quiz) return json({error:'Quiz code not found.'},404,origin);
        const body = await readJson(request); const studentName = cleanText(body.studentName); const answers = Array.isArray(body.answers) ? body.answers : [];
        if (studentName.length < 1 || studentName.length > 40) return json({error:'Enter a name up to 40 characters.'},400,origin);
        const questionResult = await env.DB.prepare('SELECT id, question_type, options_json, correct_index FROM quiz_questions WHERE quiz_id = ? ORDER BY position').bind(quiz.id).all();
        const questions = questionResult.results || [];
        if (!questions.length || answers.length !== questions.length || new Set(answers.map(item=>String(item.questionId))).size !== questions.length) return json({error:'Please answer every question.'},400,origin);
        const answerMap = new Map(answers.map(item=>[String(item.questionId),cleanText(item.answer)]));
        const saved = []; let score=0; let totalMcq=0;
        for (const question of questions) {
          const answer=answerMap.get(question.id);
          if (answer == null || !answer || answer.length > 2000) return json({error:'Please answer every question. Answers must be 2,000 characters or fewer.'},400,origin);
          let isCorrect=null;
          if (question.question_type === 'mcq') {
            totalMcq++;
            const options=JSON.parse(question.options_json);
            if (!/^\d+$/.test(answer) || Number(answer) >= options.length) return json({error:'Choose one of the listed answer choices.'},400,origin);
            isCorrect=Number(answer)===question.correct_index; if(isCorrect) score++;
          }
          saved.push({questionId:question.id,answer,isCorrect});
        }
        const id=crypto.randomUUID(); const createdAt=new Date().toISOString();
        await env.DB.prepare('INSERT INTO quiz_submissions (id, quiz_id, student_name, answers_json, score, total_mcq, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id,quiz.id,studentName,JSON.stringify(saved),score,totalMcq,createdAt).run();
        return json({id,score,totalMcq},201,origin);
      }

      if (submissionsMatch && request.method === 'GET') {
        if (!env.TEACHER_CODE) return json({error:'Teacher access is not configured.'},503,origin);
        if (!teacherAuthorized(request,env)) return json({error:'That teacher access code is not correct.'},401,origin);
        const quiz = await env.DB.prepare('SELECT id, code, title FROM quiz_files WHERE code = ?').bind(submissionsMatch[1]).first();
        if (!quiz) return json({error:'Quiz code not found.'},404,origin);
        const qs = await env.DB.prepare('SELECT id, prompt, question_type, options_json, correct_index FROM quiz_questions WHERE quiz_id = ? ORDER BY position').bind(quiz.id).all();
        const questionMap = new Map((qs.results || []).map(q=>[q.id,q]));
        const submissions = await env.DB.prepare('SELECT id, student_name, answers_json, score, total_mcq, created_at FROM quiz_submissions WHERE quiz_id = ? ORDER BY created_at DESC').bind(quiz.id).all();
        return json({code:quiz.code,title:quiz.title,submissions:(submissions.results || []).map(row=>({id:row.id,studentName:row.student_name,score:row.score,totalMcq:row.total_mcq,createdAt:row.created_at,answers:JSON.parse(row.answers_json).map(a=>{
          const q=questionMap.get(a.questionId); const options=q ? JSON.parse(q.options_json) : [];
          return {prompt:q ? q.prompt : '',type:q ? q.question_type : 'open',answer:q && q.question_type==='mcq' ? (options[Number(a.answer)] || '') : a.answer,correct:q && q.question_type==='mcq' ? Boolean(a.isCorrect) : null,correctAnswer:q && q.question_type==='mcq' ? options[q.correct_index] : ''};
        })}))},200,origin);
      }
      return json({error:'Not found.'},404,origin);
    } catch (error) {
      if (error instanceof SyntaxError) return json({error:'Please send valid JSON.'},400,origin);
      return json({error:error.message === 'Request is too large.' ? error.message : 'The quiz room could not complete that request.'},500,origin);
    }
  }
};
