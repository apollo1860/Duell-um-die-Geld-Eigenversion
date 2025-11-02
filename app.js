/* ===== App-State ===== */
let deck = [];
let cursor = -1;
let current = null;
let nextHintToUnlock = 0;

/* ===== DOM ===== */
const nextBtn = document.getElementById('nextQuestionBtn');
const qText  = document.getElementById('questionText');
const questionCard = document.getElementById('questionCard');
const hintBtns = [
  document.getElementById('hintBtn1'),
  document.getElementById('hintBtn2'),
  document.getElementById('hintBtn3')
];
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalBackdrop = modal.querySelector('[data-dismiss]');
const bgCanvas = document.getElementById('bgCanvas');

/* ===== Utils ===== */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function fetchQuestions(){
  const res = await fetch('data/questions.json', { cache: 'no-store' });
  if(!res.ok) throw new Error('Konnte Fragen nicht laden');
  const data = await res.json();
  if(!data?.questions?.length) throw new Error('Keine Fragen vorhanden');
  return data.questions;
}

function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function resetHintButtons(){
  nextHintToUnlock = 0;
  hintBtns.forEach((btn, idx) => {
    btn.disabled = idx !== 0;
    btn.classList.remove('used');
    btn.setAttribute('aria-disabled', btn.disabled ? 'true':'false');
  });
}

function presentQuestion(q){
  current = q;
  qText.textContent = q.question;

  // dezente Reveal-Animation für die Karte
  questionCard.classList.remove('reveal');
  // Force reflow für erneute Animation
  void questionCard.offsetWidth;
  questionCard.classList.add('reveal');

  resetHintButtons();
}

async function nextQuestion(){
  if(deck.length === 0 || cursor >= deck.length - 1){
    const questions = await fetchQuestions();
    deck = shuffle(questions);
    cursor = -1;
  }
  cursor += 1;
  presentQuestion(deck[cursor]);
}

function openHint(index){
  if(index !== nextHintToUnlock) return;
  modalBody.textContent = current.hints[index] ?? '—';
  modal.setAttribute('aria-hidden','false');

  const btn = hintBtns[index];
  btn.classList.add('used');

  // Nächsten Hinweis freischalten
  nextHintToUnlock += 1;
  if(nextHintToUnlock < hintBtns.length){
    hintBtns[nextHintToUnlock].disabled = false;
    hintBtns[nextHintToUnlock].setAttribute('aria-disabled','false');
  }
}

function closeModal(){
  modal.setAttribute('aria-hidden','true');
  const idx = Math.min(nextHintToUnlock, 2);
  if(!hintBtns[idx].disabled) hintBtns[idx].focus({preventScroll:true});
}

/* ===== Micro-Interactions ===== */
// Ripple auf Hinweischips
function addRipple(e){
  const btn = e.currentTarget;
  if(btn.disabled) return;

  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  btn.appendChild(ripple);

  ripple.addEventListener('animationend', () => ripple.remove(), { once:true });
}

// Tastaturkürzel
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false'){
    e.preventDefault(); closeModal();
  }
  if(e.key === 'Enter' && modal.getAttribute('aria-hidden') === 'true'){
    e.preventDefault(); nextBtn.click();
  }
  if(['1','2','3'].includes(e.key) && modal.getAttribute('aria-hidden') === 'true'){
    const idx = Number(e.key) - 1;
    if(!hintBtns[idx].disabled) hintBtns[idx].click();
  }
});

/* ===== Subtiles Bokeh/Partikel-Background ===== */
function startBokeh(){
  if(prefersReducedMotion || !bgCanvas) return;
  const ctx = bgCanvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w, h;

  function resize(){
    w = bgCanvas.clientWidth = window.innerWidth;
    h = bgCanvas.clientHeight = window.innerHeight;
    bgCanvas.width = Math.floor(w * dpr);
    bgCanvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener('resize', resize);

  const dots = Array.from({length: 26}).map(() => ({
    x: Math.random()*w,
    y: Math.random()*h,
    r: 8 + Math.random()*26,
    vx: (-0.15 + Math.random()*0.3),
    vy: (-0.12 + Math.random()*0.24),
    hue: Math.random() < 0.5 ? 150 : 210, // Mint/Blau
    a: 0.08 + Math.random()*0.12
  }));

  function tick(){
    ctx.clearRect(0,0,w,h);
    for(const d of dots){
      d.x += d.vx; d.y += d.vy;
      if(d.x < -60) d.x = w + 60;
      if(d.x > w + 60) d.x = -60;
      if(d.y < -60) d.y = h + 60;
      if(d.y > h + 60) d.y = -60;

      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r*2.2);
      g.addColorStop(0, `hsla(${d.hue}, 80%, 70%, ${d.a})`);
      g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r*2, 0, Math.PI*2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ===== Wireup ===== */
nextBtn.addEventListener('click', nextQuestion);

hintBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const idx = Number(e.currentTarget.dataset.index);
    if(!e.currentTarget.disabled) openHint(idx);
  });
  btn.addEventListener('pointerdown', addRipple);
});

closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

/* Startzustand */
qText.textContent = 'Drücke „Nächste Frage“';
startBokeh();
