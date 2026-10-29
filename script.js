const STORAGE_KEY = '5b-english-board-v1';
const board = document.querySelector('#question-list');
const questionForm = document.querySelector('#question-form');

function readQuestions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

let questions = readQuestions();
function saveQuestions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
}
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
    const remove = make('button', 'delete-question', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove this question from this browser');
    remove.addEventListener('click', () => {
      questions = questions.filter(item => item.id !== question.id);
      saveQuestions(); render();
    });
    headRight.append(remove); head.append(headRight);
    card.append(head, make('h3', '', question.text));

    const form = make('form', 'answer-form');
    const nameWrap = make('div');
    const nameLabel = make('label', '', 'NAME OR INITIALS · OPTIONAL');
    const name = make('input'); name.type = 'text'; name.maxLength = 40; name.autocomplete = 'nickname'; name.placeholder = 'e.g. Sam or S.';
    nameLabel.htmlFor = `name-${question.id}`; name.id = `name-${question.id}`; nameWrap.append(nameLabel, name);
    const answerWrap = make('div', 'answer-text-wrap');
    const answerLabel = make('label', '', 'YOUR ANSWER');
    const answer = make('textarea'); answer.rows = 3; answer.maxLength = 2000; answer.required = true; answer.placeholder = 'Share your thinking in your own words…';
    answerLabel.htmlFor = `answer-${question.id}`; answer.id = `answer-${question.id}`; answerWrap.append(answerLabel, answer);
    const submit = make('button', 'button', 'Send answer ↗'); submit.type = 'submit';
    form.append(nameWrap, answerWrap, submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const response = answer.value.trim();
      if (!response) return;
      question.answers.push({name: name.value.trim() || 'Student', text: response, createdAt: new Date().toISOString()});
      saveQuestions(); render();
    });
    card.append(form);
    const answers = make('div', 'answer-list');
    question.answers.forEach(response => {
      const item = make('div', 'answer-item');
      item.append(make('strong', '', response.name));
      item.append(make('p', '', response.text));
      answers.append(item);
    });
    if (question.answers.length) {
      card.append(answers, make('p', 'answer-count', `${question.answers.length} ${question.answers.length === 1 ? 'answer' : 'answers'} saved in this browser`));
    }
    board.append(card);
  });
}

questionForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(questionForm);
  const text = String(data.get('question') || '').trim();
  if (!text) return;
  questions.push({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), text, topic: String(data.get('topic') || '').trim(), createdAt: new Date().toISOString(), answers: []});
  saveQuestions(); questionForm.reset(); render();
});

document.querySelector('#export-answers').addEventListener('click', () => {
  const rows = [['Question', 'Topic', 'Student', 'Answer', 'Submitted']];
  questions.forEach(question => question.answers.forEach(answer => rows.push([question.text, question.topic, answer.name, answer.text, answer.createdAt])));
  if (rows.length === 1) { alert('There are no answers to download yet.'); return; }
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const link = make('a'); link.href = url; link.download = '5b-english-answers.csv'; link.click(); URL.revokeObjectURL(url);
});

render();
