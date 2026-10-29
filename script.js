const API_BASE = String(window.CLOUDFLARE_API_BASE || '').replace(/\/$/, '');
const nameForm = document.querySelector('#name-form');
const nameInput = document.querySelector('#student-name');
const screens = [...document.querySelectorAll('.screen')];
let userName = sessionStorage.getItem('5b-name') || '';
let currentQuiz = null;
let currentResults = null;

function show(id) { screens.forEach(el => el.classList.toggle('active', el.id === id)); window.scrollTo({top:0, behavior:'smooth'}); }
function status(id, message, error) { const el = document.querySelector(id); el.textContent = message || ''; el.classList.toggle('is-error', Boolean(error)); }
function node(tag, className, value) { const el = document.createElement(tag); if (className) el.className = className; if (value !== undefined) el.textContent = value; return el; }
async function api(path, options) {
  if (!API_BASE) throw new Error('Cloud storage is not connected yet.');
  const response = await fetch(API_BASE + path, options || {});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not complete that request.');
  return data;
}
function enterRoom(name) {
  userName = name.trim(); sessionStorage.setItem('5b-name', userName);
  document.querySelector('#welcome-name').textContent = userName;
  show('home-screen');
}
nameForm.addEventListener('submit', event => { event.preventDefault(); if (nameInput.value.trim()) enterRoom(nameInput.value); });
if (userName) enterRoom(userName);
document.querySelector('#change-name').addEventListener('click', () => { show('name-screen'); nameInput.value = userName; nameInput.focus(); });
document.querySelector('#open-create').addEventListener('click', () => { show('create-screen'); });
document.querySelector('#open-join').addEventListener('click', () => { const form = document.querySelector('#join-form'); form.classList.toggle('hidden'); if (!form.classList.contains('hidden')) document.querySelector('#quiz-code').focus(); });
document.querySelector('#open-results').addEventListener('click', () => show('results-screen'));
document.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', () => show('home-screen')));

const builder = document.querySelector('#builder-questions');
function addBuilderQuestion() {
  const fragment = document.querySelector('#question-template').content.cloneNode(true);
  const article = fragment.querySelector('.builder-question');
  const type = fragment.querySelector('.type-input');
  const optionsArea = fragment.querySelector('.options-area');
  const options = fragment.querySelector('.options-input');
  const correct = fragment.querySelector('.correct-input');
  const updateOptions = () => {
    const lines = options.value.split('\n').map(x => x.trim()).filter(Boolean);
    const previous = correct.value;
    correct.replaceChildren();
    lines.forEach((line, index) => { const option = node('option', '', line); option.value = String(index); correct.append(option); });
    if (previous && Number(previous) < lines.length) correct.value = previous;
  };
  type.addEventListener('change', () => { const on = type.value === 'mcq'; optionsArea.classList.toggle('hidden', !on); options.required = on; correct.required = on; });
  options.addEventListener('input', updateOptions);
  updateOptions();
  fragment.querySelector('.remove-question').addEventListener('click', () => { article.remove(); renumberQuestions(); });
  builder.append(fragment); renumberQuestions();
  return article;
}
function renumberQuestions() { [...builder.querySelectorAll('.builder-question')].forEach((el, i) => { el.querySelector('.question-number').textContent = 'QUESTION ' + (i + 1); }); }
document.querySelector('#add-question').addEventListener('click', addBuilderQuestion);
addBuilderQuestion();

document.querySelector('#quiz-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const questions = [...builder.querySelectorAll('.builder-question')].map(item => {
    const q = {prompt:item.querySelector('.prompt-input').value.trim(), type:item.querySelector('.type-input').value};
    if (q.type === 'mcq') { q.options = item.querySelector('.options-input').value.split('\n').map(x => x.trim()).filter(Boolean); q.correctIndex = Number(item.querySelector('.correct-input').value); }
    return q;
  });
  button.disabled = true; status('#create-status', 'Sending your quiz to the cloud… by very reliable internet pigeon.');
  try {
    const result = await api('/api/quizzes', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:document.querySelector('#quiz-title').value.trim(), createdBy:userName, questions})});
    document.querySelector('#created-code-value').textContent = result.code;
    document.querySelector('#created-code').classList.remove('hidden');
    status('#create-status', 'Quiz saved! The pigeon has excellent punctuality.');
    document.querySelector('#created-code').scrollIntoView({behavior:'smooth',block:'center'});
  } catch (error) { status('#create-status', error.message, true); }
  finally { button.disabled = false; }
});
document.querySelector('#copy-code').addEventListener('click', async () => { await navigator.clipboard.writeText(document.querySelector('#created-code-value').textContent); document.querySelector('#copy-code').textContent = 'Copied ✓'; });

let generatedPassage = '';
document.querySelector('#passage-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button=event.currentTarget.querySelector('button[type="submit"]'); button.disabled=true;
  status('#passage-status','ChatGPT is thinking very hard about punctuation…');
  try {
    const result=await api('/api/teacher/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'passage',topic:document.querySelector('#passage-topic').value.trim(),notes:document.querySelector('#passage-notes').value.trim()})});
    generatedPassage=result.text;
    document.querySelector('#generated-passage').value=generatedPassage;
    document.querySelector('#passage-result').classList.remove('hidden');
    status('#passage-status','Draft ready! Give it a quick teacher check before adding it.');
  } catch(error) { status('#passage-status',error.message,true); }
  finally { button.disabled=false; }
});
document.querySelector('#use-generated-passage').addEventListener('click',()=>{
  const text=document.querySelector('#generated-passage').value.trim();
  if(!text) return;
  let target=[...builder.querySelectorAll('.builder-question')].reverse().find(item=>item.querySelector('.type-input').value==='open');
  if(!target) target=addBuilderQuestion();
  const type=target.querySelector('.type-input'); type.value='open'; type.dispatchEvent(new Event('change'));
  const prompt=target.querySelector('.prompt-input'); prompt.value=text; prompt.focus();
  status('#create-status','Passage added as an open-ended question. Edit the draft before you publish!');
  builder.scrollIntoView({behavior:'smooth',block:'center'});
});

document.querySelector('#join-form').addEventListener('submit', async event => {
  event.preventDefault(); const code = document.querySelector('#quiz-code').value.trim();
  status('#home-status', 'Opening quiz…');
  try { await openQuiz(code); status('#home-status', ''); }
  catch (error) { status('#home-status', error.message, true); }
});
async function openQuiz(code) {
  const result = await api('/api/quizzes/' + encodeURIComponent(code));
  currentQuiz = result;
  document.querySelector('#quiz-heading').textContent = result.title;
  document.querySelector('#quiz-student').textContent = 'Good luck, ' + userName + ' — may the commas be with you. Quiz code: ' + result.code;
  const container = document.querySelector('#quiz-questions'); container.replaceChildren();
  result.questions.forEach((question, index) => {
    const block = node('article', 'take-question'); block.append(node('span','question-number','QUESTION ' + (index + 1)), node('h3','',question.prompt));
    if (question.type === 'mcq') {
      question.options.forEach((option, optionIndex) => {
        const label = node('label','radio-option'); const input = node('input'); input.type='radio'; input.name='answer-' + question.id; input.value=String(optionIndex); input.required=true; label.append(input,node('span','',option)); block.append(label);
      });
    } else { const answer = node('textarea','student-answer'); answer.name='answer-' + question.id; answer.maxLength=2000; answer.rows=4; answer.placeholder='Use your words. Dramatic hand gestures are optional.'; answer.required=true; block.append(answer); }
    container.append(block);
  });
  status('#quiz-status',''); show('quiz-screen');
}
document.querySelector('#take-quiz-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled=true;
  const answers = currentQuiz.questions.map(q => { const field = event.currentTarget.elements['answer-' + q.id]; return {questionId:q.id, answer:field.type === 'radio' ? field.value : field.value.trim()}; });
  try {
    const result = await api('/api/quizzes/' + encodeURIComponent(currentQuiz.code) + '/submissions', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentName:userName,answers})});
    status('#quiz-status', result.totalMcq ? (result.score === result.totalMcq ? 'Perfect score! Your brain deserves a tiny party. ' : result.score === 0 ? 'Answers saved! The commas believe in you. ' : 'Answers saved! Your brain did some excellent thinking. ') + 'Score: ' + result.score + ' / ' + result.totalMcq + '.' : 'Answers safely delivered to Mrs Wrong. Release the tiny celebration pigeon.');
    button.textContent='Submitted ✓';
  } catch (error) { status('#quiz-status',error.message,true); button.disabled=false; }
});

document.querySelector('#results-form').addEventListener('submit', async event => {
  event.preventDefault(); const form=event.currentTarget; const button=form.querySelector('button'); button.disabled=true; status('#results-status','Loading answers…');
  const code=document.querySelector('#results-quiz-code').value.trim();
  try {
    currentResults=await api('/api/quizzes/'+encodeURIComponent(code)+'/submissions');
    renderResults(currentResults); status('#results-status',currentResults.submissions.length ? currentResults.submissions.length+' submission'+(currentResults.submissions.length===1?'':'s')+' for “'+currentResults.title+'”. The answer vault is open!' : 'No answers yet. The answer vault is dramatically empty.');
  } catch(error) { status('#results-status',error.message,true); }
  finally { button.disabled=false; }
});
function renderResults(data) {
  const list=document.querySelector('#results-list'); list.replaceChildren();
  data.submissions.forEach(submission=>{
    const card=node('article','result-card'); card.append(node('h3','',submission.studentName),node('p','result-date',new Date(submission.createdAt).toLocaleString()));
    if(submission.totalMcq) card.append(node('p','result-score','Multiple-choice: '+submission.score+' / '+submission.totalMcq));
    submission.answers.forEach(answer=>{
      const item=node('div','result-answer'); item.append(node('b','',answer.prompt),node('p','',answer.answer));
      if(answer.type==='mcq') item.append(node('small',answer.correct?'answer-correct':'answer-wrong',answer.correct?'Correct':'Correct answer: '+answer.correctAnswer));
      else {
        const review=node('button','secondary-button review-answer','Ask ChatGPT for feedback'); review.type='button';
        const feedback=node('p','ai-feedback hidden'); feedback.setAttribute('aria-live','polite');
        review.addEventListener('click',async()=>{
          review.disabled=true; feedback.classList.remove('hidden'); feedback.textContent='ChatGPT is reading carefully. It promises not to mark in red ink…';
          try { const result=await api('/api/teacher/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'review',question:answer.prompt,answer:answer.answer})}); feedback.textContent=result.text; }
          catch(error) { feedback.textContent=error.message; }
          finally { review.disabled=false; }
        });
        item.append(review,feedback);
      }
      card.append(item);
    });
    list.append(card);
  });
  document.querySelector('#export-results').classList.toggle('hidden',data.submissions.length===0);
}
document.querySelector('#export-results').addEventListener('click', () => {
  if(!currentResults) return; const rows=[['Quiz','Student','Question','Answer','Correct answer','Submitted']];
  currentResults.submissions.forEach(s=>s.answers.forEach(a=>rows.push([currentResults.title,s.studentName,a.prompt,a.answer,a.correctAnswer||'',s.createdAt])));
  const csv=rows.map(row=>row.map(x=>'"'+String(x||'').replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const link=node('a'); link.href=url; link.download='5b-quiz-answers-'+currentResults.code+'.csv'; link.click(); URL.revokeObjectURL(url);
});
