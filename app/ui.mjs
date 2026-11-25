import { evaluate, generate, rank } from './arena.mjs';

const roundLength = 45_000;
const solverDelay = 20_000;
const $ = (id) => document.getElementById(id);
const timer = $('clock');
const target = $('target');
const tiles = $('tiles');
const keys = $('keys');
const input = $('expression');
const submit = $('submit');
const feedback = $('feedback');
const practice = $('new-round');
const replay = $('proof-round');
const receipt = $('receipt');
const result = $('result');
let round = null;
let proof = null;
let interval = null;

function renderButtons() {
  tiles.replaceChildren(...Array.from({ length: 5 }, (_, index) => {
    const value = round?.challenge.tiles[index];
    const button = document.createElement('button');
    button.type = 'button';
    if (value) {
      button.textContent = value;
      button.setAttribute('aria-label', 'Use tile ' + value);
      button.addEventListener('click', () => append(String(value)));
    } else {
      button.setAttribute('aria-hidden', 'true');
    }
    return button;
  }));
  updateButtons();
}

function updateButtons() {
  const active = Boolean(round && !round.closed);
  const used = new Map();
  for (const character of input.value) {
    if (/[2-9]/.test(character)) used.set(character, (used.get(character) ?? 0) + 1);
  }

  for (const button of tiles.children) {
    const value = button.textContent;
    const count = used.get(value) ?? 0;
    button.disabled = !value || !active || count > 0;
    if (count) used.set(value, count - 1);
  }
  input.disabled = !active;
  submit.disabled = !active;
  for (const button of keys.children) button.disabled = !active;
}

function append(value) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (input.value.length - end + start + value.length > input.maxLength) return;
  input.setRangeText(value, start, end, 'end');
  input.focus({ preventScroll: true });
  updateButtons();
}

for (const [label, token] of [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['(', '('], [')', ')'], ['⌫', null]]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (token === null) button.setAttribute('aria-label', 'Backspace');
  button.addEventListener('click', () => {
    if (token !== null) {
      append(token);
    } else {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.setRangeText('', start === end ? Math.max(start - 1, 0) : start, end, 'end');
      input.focus({ preventScroll: true });
      updateButtons();
    }
  });
  keys.append(button);
}

function message(text, success = false) {
  feedback.textContent = text;
  feedback.dataset.success = success;
}

function detail(entry) {
  return entry.expression + ' · ' + (entry.elapsedMs / 1000).toFixed(1) + ' s';
}

function setRound(seed, chainProof) {
  const challenge = generate(seed);
  clearInterval(interval);
  round = {
    challenge,
    seed,
    chainProof,
    start: performance.now(),
    human: null,
    solver: { ...challenge.solver, elapsedMs: solverDelay },
    closed: false,
  };
  $('round-source').textContent = chainProof ? 'MagicBlock VRF · Devnet replay' : 'Practice · Browser entropy';
  target.textContent = challenge.target;
  $('human-result').textContent = '–';
  $('human-detail').textContent = 'Build an expression';
  $('solver-result').textContent = '–';
  $('solver-detail').textContent = 'Locks in at 20 seconds';
  result.textContent = 'The round is live';
  receipt.hidden = true;
  $('proof-links').hidden = !chainProof;
  if (chainProof) {
    const explorer = 'https://explorer.solana.com/tx/';
    $('request-link').href = explorer + chainProof.request + '?cluster=devnet';
    $('fulfillment-link').href = explorer + chainProof.fulfillment + '?cluster=devnet';
  }
  $('proof-description').textContent = chainProof
    ? 'This target and tile rack were generated from the 32-byte output of the linked MagicBlock callback.'
    : 'Practice round seed ' + seed.slice(0, 12) + '…';
  input.value = '';
  message('');
  renderButtons();
  updateTime();
  interval = setInterval(updateTime, 70);
  input.focus({ preventScroll: true });
}

function updateTime() {
  const elapsed = performance.now() - round.start;
  timer.textContent = (Math.max(0, roundLength - elapsed) / 1000).toFixed(1);
  if (elapsed >= solverDelay && $('solver-result').textContent === '–') {
    $('solver-detail').textContent = 'Expression locked';
    $('solver-result').textContent = round.solver.moves + ' moves';
  }
  if (elapsed >= roundLength && !round.closed) finish();
}

function finish() {
  clearInterval(interval);
  round.closed = true;
  const winner = rank(round.human, round.solver);
  $('solver-detail').textContent = detail(round.solver);
  $('solver-result').textContent = round.solver.moves + ' moves';
  result.textContent = { human: 'You win this round', solver: 'The solver wins this round', tie: 'The round is tied' }[winner];
  if (!round.human) $('human-detail').textContent = 'No valid score';
  receipt.hidden = false;
  updateButtons();
}

$('attempt-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!round || round.closed) return;
  const elapsedMs = Math.round(performance.now() - round.start);
  if (elapsedMs >= roundLength) {
    updateTime();
    return;
  }
  try {
    const candidate = evaluate(input.value, round.challenge.tiles, round.challenge.target);
    if (round.human && round.human.moves <= candidate.moves) {
      message('Your earlier expression still leads.');
      return;
    }
    round.human = { ...candidate, elapsedMs };
    $('human-result').textContent = candidate.moves + ' moves';
    $('human-detail').textContent = detail(round.human);
    message('Score locked. You can still improve it.', true);
  } catch (error) {
    message(error.message);
  }
});

practice.addEventListener('click', () => {
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  const seed = Array.from(entropy, (value) => value.toString(16).padStart(2, '0')).join('');
  setRound(seed, null);
});
replay.addEventListener('click', () => setRound(proof.seed, proof));
input.addEventListener('input', updateButtons);

receipt.addEventListener('click', () => {
  const { challenge, seed, chainProof, human, solver } = round;
  const data = {
    version: 1, seed, tiles: challenge.tiles, target: challenge.target, chainProof,
    human, solver, winner: rank(human, solver),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'livearena-' + seed.slice(0, 12) + '.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 250);
});

renderButtons();
try {
  const response = await fetch('./devnet.json');
  if (response.ok) {
    const candidate = await response.json();
    if (candidate.chain === 'devnet' && typeof candidate.request === 'string' && typeof candidate.fulfillment === 'string') {
      generate(candidate.seed);
      proof = candidate;
      replay.hidden = false;
    }
  }
} catch {
  // Practice is playable offline and when the app has no configured devnet receipt.
}
