const STORAGE_KEY = '5b-english-board-v1';
const API_BASE = String(window.CLOUDFLARE_API_BASE || '').replace(/\/$/, '');
const board = document.querySelector('#question-list');
const questionForm = document.querySelector('#question-form');
const boardStatus = document.querySelector('#board-status');
let questions = [];

function readLocalQuestions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
function saveLocalQuestions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
}
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function status(message, error = false) {
  boardStatus.textContent = message;
  boardStatus.classList.toggle('is-error', error);
}
async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The class board could not complete that request.');
  return payload;
}
function render() {
  board.replaceChildren();
  if (!questions.length) {
    const empty = make('div', 'empty-board');
    empty.append(make('span', 'empty-icon', '✎'));
    empty.append(make('h3', '', 'No questions yet'));
    empty.append(make('p', '', 'The teacher can add the first English question using the form. It will appear here, ready for everyone to answer.'));
    board.append(empty);
    return;
  }
  [...questions].reverse().forEach(question => {
    const card = make('article', 'question-card');
    const head = make('div', 'question-card-head');
    head.append(make('span', 'question-topic', question.topic || 'ENGLISH QUESTION'));
    const headRight = make('div', 'question-card-head');
    headRight.append(make('span', 'question-date', new Date(question.createdAt).toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'})));
    if (!API_BASE) {
      const remove = make('button', 'delete-question', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove this question from this browser');
      remove.addEventListener('click', () => {
        questions = questions.filter(item => item.id !== question.id);
        saveLocalQuestions(); render();
      });
      headRight.append(remove);
    }
    head.append(headRight);
    card.append(head, make('h3', '', question.text));

    const form = make('form', 'answer-form');
    const nameWrap = make('div');
    const nameLabel = make('label', '', 'NAME OR INITIALS · OPTIONAL');
    const name = make('input'); name.type = 'text'; name.maxLength = 40; name.autocomplete = 'nickname'; name.placeholder = 'e.g. Sam or S.';
    nameLabel.htmlFor = 'name-' + question.id; name.id = 'name-' + question.id; nameWrap.append(nameLabel, name);
    const answerWrap = make('div', 'answer-text-wrap');
    const answerLabel = make('label', '', 'YOUR ANSWER');
    const answer = make('textarea'); answer.rows = 3; answer.maxLength = 2000; answer.required = true; answer.placeholder = 'Share your thinking in your own words…';
    answerLabel.htmlFor = 'answer-' + question.id; answer.id = 'answer-' + question.id; answerWrap.append(answerLabel, answer);
    const submit = make('button', 'button', 'Send answer ↗'); submit.type = 'submit';
    form.append(nameWrap, answerWrap, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const responseText = answer.value.trim();
      if (!responseText) return;
      submit.disabled = true;
      try {
        if (API_BASE) {
          await api('/api/questions/' + encodeURIComponent(question.id) + '/answers', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({name: name.value.trim(), answer: responseText})
          });
          await loadRemoteQuestions();
          status('Your answer was added to the class board.');
        } else {
          question.answers.push({name: name.value.trim() || 'Student', text: responseText, createdAt: new Date().toISOString()});
          saveLocalQuestions(); render();
          status('Answer saved in this browser. It is not shared with the class yet.');
        }
      } catch {
        status('Could not save your answer. Please try again.', true);
      } finally {
        submit.disabled = false;
      }
    });
    card.append(form);
    const answers = make('div', 'answer-list');
    (question.answers || []).forEach(response => {
      const item = make('div', 'answer-item');
      item.append(make('strong', '', response.name || 'Student'));
      item.append(make('p', '', response.text));
      answers.append(item);
    });
    if ((question.answers || []).length) {
      card.append(answers, make('p', 'answer-count', question.answers.length + ' ' + (question.answers.length === 1 ? 'answer' : 'answers') + ' on the class board'));
    }
    board.append(card);
  });
}
async function loadRemoteQuestions() {
  const result = await api('/api/questions', {headers: {'Accept':'application/json'}});
  questions = Array.isArray(result.questions) ? result.questions : [];
  render();
}
questionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(questionForm);
  const text = String(data.get('question') || '').trim();
  if (!text) return;
  const button = questionForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    if (API_BASE) {
      const teacherCode = String(data.get('teacherCode') || '');
      if (!teacherCode) throw new Error('Enter the teacher access code to post a question.');
      await api('/api/questions', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'X-Teacher-Code': teacherCode},
        body: JSON.stringify({question:text, topic:String(data.get('topic') || '').trim()})
      });
      await loadRemoteQuestions();
      status('Question posted. Students can now share their answers.');
    } else {
      questions.push({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), text, topic: String(data.get('topic') || '').trim(), createdAt: new Date().toISOString(), answers: []});
      saveLocalQuestions(); render();
      status('Question saved in this browser. Connect the Cloudflare API to share it with students.');
    }
    questionForm.reset();
  } catch (error) {
    status(error.message || 'Could not post the question. Please try again.', true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#export-answers').addEventListener('click', () => {
  const rows = [['Question', 'Topic', 'Student', 'Answer', 'Submitted']];
  questions.forEach(question => (question.answers || []).forEach(answer => rows.push([question.text, question.topic, answer.name, answer.text, answer.createdAt])));
  if (rows.length === 1) { alert('There are no answers to download yet.'); return; }
  const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const link = make('a'); link.href = url; link.download = '5b-english-answers.csv'; link.click(); URL.revokeObjectURL(url);
});

if (API_BASE) {
  document.querySelector('#teacher-code').required = true;
  status('Loading the shared class board…');
  loadRemoteQuestions().then(() => status('Questions and answers are shared on this class board.')).catch(() => {
    status('The shared board could not be reached. Please try again later.', true);
  });
} else {
  questions = readLocalQuestions();
  render();
  status('Preview mode: changes are saved only in this browser.');
}
