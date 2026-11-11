(() => {
  'use strict';

  const SIZE = 5;
  const GOAL = 2048;
  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const blockCountEl = document.getElementById('block-count');
  const messageEl = document.getElementById('message');
  const statusEl = document.getElementById('status-text');
  const progressEl = document.getElementById('goal-progress');
  const goalValueEl = document.getElementById('goal-value');
  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlay-title');
  const overlayCopyEl = document.getElementById('overlay-copy');
  const overlayIconEl = document.getElementById('overlay-icon');
  const continueButton = document.getElementById('continue-button');
  const shuffleButton = document.getElementById('shuffle-button');
  const shuffleCountEl = document.getElementById('shuffle-count');
  const soundButton = document.getElementById('sound-toggle');

  let cells = [];
  let score = 0;
  let best = Number(localStorage.getItem('ciftle-best') || 0);
  let shuffles = 1;
  let selected = null;
  let press = null;
  let ghost = null;
  let soundOn = false;
  let audioContext = null;
  let won = false;
  let ended = false;

  function tileClass(value) {
    return `v${Math.min(value, 2048)}`;
  }

  function render() {
    boardEl.innerHTML = '';
    cells.forEach((value, index) => {
      const cell = document.createElement('div');
      cell.className = `cell${value ? ' filled' : ''}${selected === index ? ' selected' : ''}`;
      cell.dataset.index = String(index);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', value ? `Blok ${value}` : 'Boş alan');
      if (value) {
        const tile = document.createElement('div');
        tile.className = `tile ${tileClass(value)}`;
        tile.textContent = value;
        cell.appendChild(tile);
      }
      boardEl.appendChild(cell);
    });
    const count = cells.filter(Boolean).length;
    blockCountEl.textContent = `${count} BLOK`;
    scoreEl.textContent = score.toLocaleString('tr-TR');
    bestEl.textContent = best.toLocaleString('tr-TR');
    shuffleCountEl.textContent = String(shuffles);
    shuffleButton.disabled = shuffles === 0;
    shuffleButton.classList.toggle('disabled', shuffles === 0);
    goalValueEl.textContent = GOAL.toLocaleString('tr-TR');
    const largest = Math.max(2, ...cells);
    progressEl.style.width = `${Math.min(100, Math.log2(largest / 2) / Math.log2(GOAL / 2) * 100)}%`;
    if (!selected) statusEl.textContent = ended ? 'OYUN BİTTİ' : 'HAMLE BEKLİYOR';
    else statusEl.textContent = 'EŞLEŞTİRMEK İÇİN SÜRÜKLE';
  }

  function say(text) {
    messageEl.textContent = text;
  }

  function randomEmpty(excluded = -1) {
    const empty = [];
    cells.forEach((value, index) => {
      if (!value && index !== excluded) empty.push(index);
    });
    return empty.length ? empty[Math.floor(Math.random() * empty.length)] : -1;
  }

  function addRandomTile() {
    const index = randomEmpty();
    if (index < 0) return false;
    cells[index] = Math.random() < 0.88 ? 2 : 4;
    return true;
  }

  function startGame() {
    cells = Array(SIZE * SIZE).fill(0);
    score = 0;
    shuffles = 1;
    selected = null;
    won = false;
    ended = false;
    overlayEl.hidden = true;
    const startingValues = [2, 2, 2, 4, 4, 4, 4, 8, 8, 8, 16, 16, 16, 32];
    startingValues.forEach((value) => {
      const index = randomEmpty();
      if (index >= 0) cells[index] = value;
    });
    say('Aynı sayıdaki iki bloğu eşleştir.');
    render();
  }

  function hasPair() {
    const values = cells.filter(Boolean);
    return new Set(values).size < values.length;
  }

  function showOverlay(kind) {
    ended = kind === 'end';
    overlayEl.hidden = false;
    if (kind === 'win') {
      overlayIconEl.textContent = '✦';
      overlayTitleEl.textContent = 'Muhteşem!';
      overlayCopyEl.textContent = '2048 bloğunu yaptın. İstersen daha da ileri git.';
      continueButton.innerHTML = 'DEVAM ET <span>→</span>';
      continueButton.hidden = false;
    } else {
      overlayIconEl.textContent = '↻';
      overlayTitleEl.textContent = 'Hamle kalmadı';
      overlayCopyEl.textContent = `Son skorun ${score.toLocaleString('tr-TR')}. Yeni bir tur deneyelim mi?`;
      continueButton.innerHTML = 'YENİDEN OYNA <span>→</span>';
      continueButton.hidden = false;
    }
  }

  function finishIfNeeded() {
    render();
    if (!won && Math.max(...cells) >= GOAL) {
      won = true;
      say('2048! Hedefine ulaştın, devam edebilirsin.');
      showOverlay('win');
      return;
    }
    if (!hasPair()) {
      ended = true;
      selected = null;
      render();
      say('Eşleşecek blok kalmadı.');
      showOverlay('end');
    }
  }

  function playTone(type = 'merge') {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      const notes = type === 'merge' ? [523.25, 659.25, 783.99] : [392, 523.25, 659.25, 1046.5];
      notes.forEach((frequency, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, now + index * .055);
        gain.gain.exponentialRampToValueAtTime(.06, now + index * .055 + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, now + index * .055 + .19);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(now + index * .055);
        osc.stop(now + index * .055 + .2);
      });
    } catch (error) {
      // Audio is an optional enhancement; gameplay works without it.
    }
  }

  function moveTile(from, to) {
    if (ended || from === to || !cells[from]) return;
    const source = cells[from];
    const target = cells[to];
    if (target && source !== target) {
      selected = from;
      say(`Aynı sayıları birleştir: ${source} ≠ ${target}`);
      render();
      return;
    }
    if (!target) {
      cells[to] = source;
      cells[from] = 0;
      selected = null;
      say('Güzel hamle. Şimdi aynı sayıdaki blokları bul.');
      render();
      return;
    }

    const result = target * 2;
    cells[to] = result;
    cells[from] = 0;
    selected = null;
    score += result;
    if (score > best) {
      best = score;
      localStorage.setItem('ciftle-best', String(best));
    }
    addRandomTile();
    playTone(result >= 128 ? 'big' : 'merge');
    say(`Harika! ${target} + ${target} = ${result} · +${result} puan`);
    finishIfNeeded();
  }

  function cellAt(point) {
    const element = document.elementFromPoint(point.x, point.y);
    const cell = element?.closest('.cell');
    return cell ? Number(cell.dataset.index) : null;
  }

  boardEl.addEventListener('pointerdown', (event) => {
    if (ended || event.button > 0) return;
    const cell = event.target.closest('.cell');
    if (!cell) return;
    event.preventDefault();
    press = {
      index: Number(cell.dataset.index),
      x: event.clientX,
      y: event.clientY,
      moved: false,
      pointerId: event.pointerId,
    };
    const value = cells[press.index];
    if (value) {
      const sourceTile = cell.querySelector('.tile');
      ghost = sourceTile.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
      document.body.appendChild(ghost);
      cell.classList.add('is-dragging');
    }
  });

  document.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press.moved = true;
    if (ghost) {
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
    }
    boardEl.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    if (press.moved) {
      const target = cellAt({ x: event.clientX, y: event.clientY });
      const targetEl = target === null ? null : boardEl.children[target];
      if (targetEl && target !== press.index) targetEl.classList.add('drop-target');
    }
  });

  document.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    const current = press;
    const destination = cellAt({ x: event.clientX, y: event.clientY });
    const sourceHasTile = Boolean(cells[current.index]);
    if (ghost) ghost.remove();
    ghost = null;
    boardEl.querySelectorAll('.is-dragging,.drop-target').forEach((el) => el.classList.remove('is-dragging', 'drop-target'));
    press = null;

    if (current.moved) {
      if (sourceHasTile && destination !== null) moveTile(current.index, destination);
      return;
    }
    if (selected !== null && selected !== current.index) {
      moveTile(selected, current.index);
      return;
    }
    if (sourceHasTile) {
      selected = selected === current.index ? null : current.index;
      say(selected === null ? 'Aynı sayıdaki iki bloğu eşleştir.' : `Seçildi: ${cells[selected]}. Aynı sayının üzerine sürükle.`);
      render();
    } else if (selected !== null) {
      moveTile(selected, current.index);
    }
  });

  shuffleButton.addEventListener('click', () => {
    if (!shuffles || ended) return;
    shuffles -= 1;
    const occupied = cells.map((value, index) => value ? index : -1).filter((index) => index >= 0);
    if (occupied.length < 2) {
      addRandomTile();
      addRandomTile();
    }
    const spots = cells.map((value, index) => value ? index : -1).filter((index) => index >= 0);
    const values = spots.map((index) => cells[index]);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    spots.forEach((index, i) => { cells[index] = values[i]; });
    if (!hasPair() && spots.length >= 2) {
      const first = spots[Math.floor(Math.random() * spots.length)];
      let second = first;
      while (second === first) second = spots[Math.floor(Math.random() * spots.length)];
      cells[second] = cells[first];
    }
    selected = null;
    ended = false;
    overlayEl.hidden = true;
    say('Tahta karıştı. Eşleşme fırsatını yakala!');
    render();
  });

  document.getElementById('reset-button').addEventListener('click', startGame);
  continueButton.addEventListener('click', () => {
    if (ended) {
      startGame();
      return;
    }
    overlayEl.hidden = true;
    say('Harika oynuyorsun. Yeni rekor için devam!');
  });
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.classList.toggle('sound-enabled', soundOn);
    soundButton.setAttribute('aria-label', soundOn ? 'Ses efektleri açık' : 'Ses efektleri kapalı');
    if (soundOn) playTone('merge');
  });

  startGame();
})();
