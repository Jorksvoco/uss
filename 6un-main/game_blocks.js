const size = 20;
const game = document.getElementById("game");
const levelTitle = document.getElementById("levelTitle");

let cells = [];
for (let i = 0; i < size * size; i++) {
  const div = document.createElement("div");
  div.classList.add("cell");
  game.appendChild(div);
  cells.push(div);
}

const levels = [
  [
    "####################",
    "#.....##.....#....E#",
    "#A..#.....#..##...##",
    "#####.###.#..#....##",
    "#....W....#......###",
    "####################"
  ],
  [
    "####################",
    "#...........##...#.#",
    "#E..##..##..##A....#",
    "#######.......###..#",
    "#.W......####......#",
    "####################"
  ],
  [
    "####################",
    "#W..#......#......E#",
    "#...#...##.###A....#",
    "#..####.#.....##...#",
    "#.......##.........#",
    "####################"
  ],
  [
    "####################",
    "##...#....#...#...##",
    "#E.#...#..#.#.#.#..#",
    "#########...#...#..#",
    "#W.........######A.#",
    "####################"
  ],
  [
    "####################",
    "#E...........#..A..#",
    "###.##.###.###.###.#",
    "#...W...#...#......#",
    "#..####...#...#..###",
    "####################"
  ],
  [
    "####################",
    "#E###.#............#",
    "#..#..#.##########.#",
    "#..#.....####......#",
    "#....##A.###...W..##",
    "####################"
  ],
  [
    "####################",
    "#.........#A...#...#",
    "#.###.###...##...#.#",
    "#...#....#########.#",
    "#..E##...W.........#",
    "####################"
  ],
];

let currentLevel = 0;

let worm = [];
let snakeLayer = null;
let segmentElems = [];
const INITIAL_SEGMENTS = 3;
let apple = null;
let exitTile = null;
let blocks = new Set();
let lastDirection = 1; 
let gravityEnabled = true;

let combo = 0;
let score = 0;
let circleIndicators = []; 

const MOVE_REPEAT_MS = 180; 
let moveTimer = null;
let activeDir = 0; 

function getMaxUnlockedLevel() {
  const v = parseInt(localStorage.getItem('maxUnlockedLevel'));
  if (isNaN(v)) return 0; 
  return Math.max(0, Math.min(levels.length - 1, v));
}

function setMaxUnlockedLevel(idx) {
  const clamped = Math.max(0, Math.min(levels.length - 1, idx));
  localStorage.setItem('maxUnlockedLevel', String(clamped));
}

const eatSound = new Audio('./assets/applewormEat.mp3');
eatSound.preload = 'auto';
eatSound.volume = 0.25;

function getSoundEnabled() {
  const v = localStorage.getItem('soundEnabled');
  if (v === null) return true; 
  return v === '1' || v === 'true';
}
function setSoundEnabled(val) {
  localStorage.setItem('soundEnabled', val ? '1' : '0');
}
let soundEnabled = getSoundEnabled();

function updateSoundButton() {
  const btn = document.getElementById('soundToggle');
  if (!btn) return;
  
  if (soundEnabled) {
    btn.title = 'Sound: ON (click to toggle)';
    btn.classList.remove('off');
    btn.setAttribute('aria-pressed', 'true');
  } else {
    btn.title = 'Sound: OFF (click to toggle)';
    btn.classList.add('off');
    btn.setAttribute('aria-pressed', 'false');
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  setSoundEnabled(soundEnabled);
  updateSoundButton();
}

function createInitialWorm(headIndex) {
  const row = Math.floor(headIndex / size);
  const col = headIndex % size;

  const tryPlace = (startCol, step) => {
    const arr = [];
    for (let k = 0; k < INITIAL_SEGMENTS; k++) {
      const c = startCol + k * step;
      if (c < 0 || c >= size) return null;
      const idx = row * size + c;
      if (cells[idx] && cells[idx].classList.contains('wall')) return null;
      arr.push(idx);
    }
    return arr;
  };

  if (col >= INITIAL_SEGMENTS - 1) {
    const place = tryPlace(col - (INITIAL_SEGMENTS - 1), 1);
    if (place) return place;
  }

  if (col <= size - INITIAL_SEGMENTS) {
    const place = tryPlace(col, 1);
    if (place) return place;
  }

  const fallback = [];
  for (let k = INITIAL_SEGMENTS - 1; k >= 0; k--) {
    const c = Math.max(0, Math.min(size - 1, col - k));
    fallback.push(row * size + c);
  }
  return fallback;
}

function ensureSnakeLayer() {
  if (!snakeLayer) {
    snakeLayer = document.createElement('div');
    snakeLayer.className = 'snakeLayer';
    game.appendChild(snakeLayer);
  }
}

function ensureSegments() {
  ensureSnakeLayer();
  while (segmentElems.length < worm.length) {
    const s = document.createElement('div');
    s.className = 'segment';
    snakeLayer.appendChild(s);
    segmentElems.push(s);
  }
  while (segmentElems.length > worm.length) {
    const s = segmentElems.pop();
    if (s && s.parentNode) s.parentNode.removeChild(s);
  }
}

function updateSegments() {
  ensureSegments();
  for (let i = 0; i < worm.length; i++) {
    const idx = worm[i];
    const row = Math.floor(idx / size);
    const col = idx % size;
    const el = segmentElems[i];
    if (!el) continue;
    el.style.left = (col * 100 / size) + '%';
    el.style.top = (row * 100 / size) + '%';
    el.classList.toggle('head', i === worm.length - 1);

    const isHead = (i === worm.length - 1);
    const d = lastDirection;
    let rot = 0;
    if (d === -size) rot = 0;
    if (d === 1) rot = 90;
    if (d === size) rot = 180;
    if (d === -1) rot = 270;
    if (isHead) {
      el.style.transform = `rotate(${rot}deg)`;
    } else {
      el.style.transform = '';
    }
  }
}

function spawnAppleParticles(index) {
  ensureSnakeLayer();
  const row = Math.floor(index / size);
  const col = index % size;
  const centerLeft = (col + 0.5) * 100 / size + '%';
  const centerTop = (row + 0.5) * 100 / size + '%';
  const colors = ['#ff6b6b','#ff9f43','#ffd166','#ff3b3b','#ff4757','#ff6348'];
  const count = 15; 
  
  createFlashEffect(centerLeft, centerTop);
  createCircleIndicator(centerLeft, centerTop);
  
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const sz = 8 + Math.floor(Math.random() * 10);
    p.style.width = sz + 'px';
    p.style.height = sz + 'px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = centerLeft;
    p.style.top = centerTop;
    
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const velocity = 80 + Math.random() * 60;
    p.style.setProperty('--angle', angle);
    p.style.setProperty('--velocity', velocity + 'px');
    p.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
    snakeLayer.appendChild(p);
    p.addEventListener('animationend', () => {
      if (p.parentNode) p.parentNode.removeChild(p);
    });
  }
  
  combo++;
  score += 10 + (combo * 2);
  updateComboDisplay();
  updateScoreDisplay();
}

function createFlashEffect(left, top) {
  ensureSnakeLayer();
  const flash = document.createElement('div');
  flash.className = 'circle-flash';
  flash.style.left = left;
  flash.style.top = top;
  snakeLayer.appendChild(flash);
  
  setTimeout(() => {
    if (flash.parentNode) flash.parentNode.removeChild(flash);
  }, 800);
}

function createCircleIndicator(left, top) {
  ensureSnakeLayer();
  const indicator = document.createElement('div');
  indicator.className = 'circle-indicator';
  indicator.style.left = left;
  indicator.style.top = top;
  snakeLayer.appendChild(indicator);
  
  setTimeout(() => {
    if (indicator.parentNode) indicator.parentNode.removeChild(indicator);
  }, 600);
}

function updateComboDisplay() {
  let comboEl = document.getElementById('comboDisplay');
  if (!comboEl) {
    comboEl = document.createElement('div');
    comboEl.id = 'comboDisplay';
    comboEl.className = 'combo-display';
    document.getElementById('hud').appendChild(comboEl);
  }
  if (combo > 0) {
    comboEl.textContent = `x${combo}`;
    comboEl.style.display = 'block';
    
    const fontSize = Math.min(56, 32 + combo * 0.6);
    comboEl.style.fontSize = fontSize + 'px';
    
    const red = Math.min(255, combo * 2.5);
    comboEl.style.color = `rgb(255, ${255 - red}, ${255 - red})`;
  } else {
    comboEl.style.display = 'none';
  }
}

function updateScoreDisplay() {
  return;
}

function resetCombo() {
  combo = 0;
  updateComboDisplay();
}

/* ------------------------------------
   LOAD LEVEL
------------------------------------- */
function loadLevel(n) {
  if (moveTimer) {
    clearInterval(moveTimer);
    moveTimer = null;
    activeDir = 0;
  }

  levelTitle.textContent = "Level " + (n + 1);

  worm = [];
  apple = null;
  exitTile = null;
  blocks = new Set();

  const map = levels[n];

  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      const char = map[r][c];
      const index = r * size + c;

      cells[index].className = 'cell';

      if (char === '#') cells[index].classList.add('wall');

      if (char === 'W') {
        worm = createInitialWorm(index);
      }

      if (char === 'A') {
        apple = index;
        cells[index].classList.add('apple');
      }

      if (char === 'E') {
        exitTile = index;
        cells[index].classList.add('exit');
      }

      if (char === 'B') {
        blocks.add(index);
        cells[index].classList.add('block');
      }
    }
  }

  draw();
}

const PAGE_SIZE = 12; 
let menuPage = 0;

function buildMenu() {
  const list = document.getElementById('levelList');
  const pageIndicator = document.getElementById('pageIndicator');
  if (!list) return;
  list.innerHTML = '';
  const totalPages = Math.max(1, Math.ceil(levels.length / PAGE_SIZE));
  
  if (menuPage < 0) menuPage = 0;
  if (menuPage >= totalPages) menuPage = totalPages - 1;

  const start = menuPage * PAGE_SIZE;
  const end = Math.min(levels.length, start + PAGE_SIZE);

  const unlockedIndex = getMaxUnlockedLevel();
  const unlockedCount = Math.max(1, Math.min(levels.length, unlockedIndex + 1));

  for (let i = start; i < end; i++) {
    const tile = document.createElement('button');
    tile.className = 'level-tile';
    
    const label = (i + 1).toString().padStart(2, '0');
    tile.textContent = label;
    if (i < unlockedCount) {
      tile.classList.add('green');
      tile.addEventListener('click', () => {
        currentLevel = i;
        hideMenu();
        loadLevel(currentLevel);
      });
    } else {
      tile.classList.add('locked');
      tile.disabled = true;
    }
    
    if (i === currentLevel) {
      tile.classList.remove('green');
      tile.classList.add('red');
    }
    list.appendChild(tile);
  }

  const fillCount = PAGE_SIZE - (end - start);
  for (let j = 0; j < fillCount; j++) {
    const filler = document.createElement('div');
    filler.style.width = '110px';
    filler.style.height = '110px';
    filler.style.visibility = 'hidden';
    list.appendChild(filler);
  }

  if (pageIndicator) pageIndicator.textContent = `Page ${menuPage + 1} / ${totalPages}`;

  const prevBtn = document.getElementById('menuPrev');
  const nextBtn = document.getElementById('menuNext');
  const pageInd = document.getElementById('pageIndicator');
  if (totalPages <= 1) {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (pageInd) pageInd.style.display = 'none';
  } else {
    if (prevBtn) prevBtn.style.display = '';
    if (nextBtn) nextBtn.style.display = '';
    if (pageInd) pageInd.style.display = '';
  }
}

function prevMenuPage() { menuPage = Math.max(0, menuPage - 1); buildMenu(); }
function nextMenuPage() { menuPage = Math.min(Math.ceil(levels.length / PAGE_SIZE) - 1, menuPage + 1); buildMenu(); }

function showMenu() {
  const menu = document.getElementById('menu');
  if (!menu) return;
  menu.classList.remove('hidden');
  menu.classList.add('show');
}

function hideMenu() {
  const menu = document.getElementById('menu');
  if (!menu) return;
  menu.classList.add('hidden');
  menu.classList.remove('show');
}

// Initial setup

document.addEventListener('DOMContentLoaded', () => {
  buildMenu();
  const close = document.getElementById('closeMenu');
  if (close) close.addEventListener('click', () => hideMenu());
  
  showMenu();
  
  const soundBtn = document.getElementById('soundToggle');
  if (soundBtn) {
    soundBtn.addEventListener('click', toggleSound);
    updateSoundButton();
  }
  
  const menu = document.getElementById('menu');
  if (menu) {
    menu.addEventListener('click', (ev) => {
      if (ev.target === menu) hideMenu();
    });
  }
  
  const prev = document.getElementById('menuPrev');
  const next = document.getElementById('menuNext');
  if (prev) prev.addEventListener('click', prevMenuPage);
  if (next) next.addEventListener('click', nextMenuPage);
  
  updateScoreDisplay();
  updateComboDisplay();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const menu = document.getElementById('menu');
    if (!menu) return;
    if (menu.classList.contains('hidden')) showMenu(); else hideMenu();
  }
});

document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (/^[1-9]$/.test(k)) {
    const idx = parseInt(k, 10) - 1;
    if (idx >= 0 && idx < levels.length) {
      if (idx <= getMaxUnlockedLevel()) {
        currentLevel = idx;
        hideMenu();
        loadLevel(currentLevel);
      }
    }
  }
});

/* ------------------------------------
   MOVEMENT
------------------------------------- */

function keyToDir(key) {
  if (key === 'w' || key === 'arrowup') return -size;
  if (key === 's' || key === 'arrowdown') return size;
  if (key === 'a' || key === 'arrowleft') return -1;
  if (key === 'd' || key === 'arrowright') return 1;
  return 0;
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  const dir = keyToDir(key);

  if (key === 'r') {
    loadLevel(currentLevel);
    return;
  }

  if (dir !== 0) {
    e.preventDefault();

    if (activeDir !== dir) {
      if (moveTimer) {
        clearInterval(moveTimer);
        moveTimer = null;
      }
      activeDir = dir;
      
      move(dir);
      moveTimer = setInterval(() => move(activeDir), MOVE_REPEAT_MS);
    }
    return;
  }
});

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  const dir = keyToDir(key);
  if (dir !== 0 && dir === activeDir) {
    if (moveTimer) {
      clearInterval(moveTimer);
      moveTimer = null;
    }
    activeDir = 0;
  }
});

function move(direction) {
  if (direction !== 0) lastDirection = direction;
  const head = worm[worm.length - 1];
  const next = head + direction;

  if (next < 0 || next >= size * size) return;
  if (direction === 1 && head % size === size - 1) return;
  if (direction === -1 && head % size === 0) return;

  const tail = worm[0];
  const movingIntoTailButNotGrowing = (next === tail && next !== apple);

  // Handle movable blocks
  if (blocks.has(next)) {
    // Blocks can only be pushed horizontally
    if (direction === 1 || direction === -1) {
      const blockTarget = next + direction;

      if (blockTarget < 0 || blockTarget >= size * size) return;
      if (direction === 1 && next % size === size - 1) return;
      if (direction === -1 && next % size === 0) return;

      if (cells[blockTarget].classList.contains('wall')) return;
      if (blocks.has(blockTarget)) return;

      const pushingIntoTail = (blockTarget === tail && next !== apple);
      if (worm.includes(blockTarget) && !pushingIntoTail) return;

      blocks.delete(next);
      blocks.add(blockTarget);
      cells[next].classList.remove('block');
      cells[blockTarget].classList.add('block');
    } else {
      // Treat blocks as solid for vertical moves (including gravity)
      return;
    }
  }

  if (cells[next].classList.contains('wall')) {
    resetCombo();
    const row = Math.floor(next / size);
    const col = next % size;
    const centerLeft = (col + 0.5) * 100 / size + '%';
    const centerTop = (row + 0.5) * 100 / size + '%';
    createFlashEffect(centerLeft, centerTop);
    return;
  }

  if (worm.includes(next) && !movingIntoTailButNotGrowing) return;

  worm.push(next);

  if (next === apple) {
    cells[apple].classList.remove('apple');
    try {
      if (soundEnabled) {
        eatSound.currentTime = 0;
        eatSound.play().catch(() => {});
      }
    } catch (err) {}
    try { spawnAppleParticles(next); } catch (err) {}
    apple = null;
  } else {
    worm.shift();
  }

  if (next === exitTile && apple === null) {
    const nextLevel = currentLevel + 1;
    if (nextLevel >= levels.length) {
      alert('Palju õnne sa võitsid!');
      setMaxUnlockedLevel(levels.length - 1);
      currentLevel = 0;
    } else {
      setMaxUnlockedLevel(Math.max(getMaxUnlockedLevel(), nextLevel));
      currentLevel = nextLevel;
    }

    buildMenu();
    loadLevel(currentLevel);
    return;
  }

  draw();
}

function isSupported(index) {
  const below = index + size;
  if (below >= size * size) return true;
  if (cells[below].classList.contains('wall')) return true;
  if (blocks.has(below)) return true;
  return false;
}

function applyBlockGravity() {
  const ordered = Array.from(blocks).sort((a, b) => b - a);
  let anyMoved = false;
  for (const idx of ordered) {
    if (isSupported(idx)) continue;
    
    const below = idx + size;
    if (below >= size * size) continue;
    if (worm.includes(below)) continue;

    blocks.delete(idx);
    blocks.add(below);
    cells[idx].classList.remove('block');
    cells[below].classList.add('block');
    anyMoved = true;
  }
  return anyMoved;
}

function applyWormGravity() {
  const hasSupport = worm.some(seg => isSupported(seg));
  if (hasSupport) return false;
  
  for (const seg of worm) {
    const below = seg + size;
    if (below >= size * size) return false;
    if (cells[below].classList.contains('wall')) return false;
    if (blocks.has(below)) return false;
  }
  
  for (let i = 0; i < worm.length; i++) {
    worm[i] += size;
  }
  
  draw();
  return true;
}

const GRAVITY_TICK_MS = 200;
setInterval(() => {
  if (!gravityEnabled) return;
  
  applyBlockGravity();
  
  applyWormGravity();
}, GRAVITY_TICK_MS);

function draw() {
  cells.forEach((cell) => {
    if (!cell.classList.contains('wall') &&
        !cell.classList.contains('apple') &&
        !cell.classList.contains('exit') &&
        !cell.classList.contains('block')) {
      cell.className = 'cell';
    }
  });
  updateSegments();
}
