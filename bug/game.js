const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const menuButton = document.getElementById('menu-button');
const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('gameover-screen');
const gameoverText = document.getElementById('gameover-text');
const score1Label = document.getElementById('score1');
const stamina1Label = document.getElementById('stamina1');

const state = {
  running: false,
  width: 900,
  height: 600,
  foods: [],
  feces: [],
  sound: null,
  keys: {},
};

const players = [
  {
    id: 1,
    x: 180,
    y: 220,
    color: '#e8df4a',
    controls: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', dash: 'KeyF' },
    score: 0,
    stamina: 100,
    radius: 16,
  },
];

const gameOptions = {
  foodCount: 18,
  fecesCount: 6,
  foodRadius: 14,
  fecesRadius: 12,
  staminaDecay: 0.011,
  dashCost: 6,
  dashSpeed: 7,
  walkSpeed: 3.6,
  recovery: 28,
};

function createAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return new AudioContext();
}

function playTone(type, frequency, duration, volume = 0.16) {
  if (!state.sound) return;
  const osc = state.sound.createOscillator();
  const gain = state.sound.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(state.sound.destination);
  osc.start();
  osc.stop(state.sound.currentTime + duration);
}

function playPop() {
  playTone('triangle', 430, 0.08, 0.12);
}

function playHit() {
  playTone('square', 220, 0.12, 0.18);
}

function playMenu() {
  playTone('sine', 320, 0.2, 0.14);
}

function playGameOver() {
  playTone('sawtooth', 140, 0.32, 0.18);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function resetGame() {
  state.foods = Array.from({ length: gameOptions.foodCount }, () => createFood());
  state.feces = Array.from({ length: gameOptions.fecesCount }, () => createFeces());
  players.forEach((player) => {
    player.score = 0;
    player.stamina = 100;
  });
  state.running = true;
  score1Label.textContent = '0';
  stamina1Label.textContent = '100';
}

function createFood() {
  return {
    x: randomBetween(40, state.width - 40),
    y: randomBetween(40, state.height - 40),
    radius: gameOptions.foodRadius,
    infected: false,
  };
}

function createFeces() {
  return {
    x: randomBetween(40, state.width - 40),
    y: randomBetween(40, state.height - 40),
    radius: gameOptions.fecesRadius,
    used: false,
  };
}

function showScreen(target) {
  [mainMenu, gameScreen, gameOverScreen].forEach((screen) => {
    screen.classList.toggle('active', screen === target);
  });
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function updateStamina(player, elapsed) {
  player.stamina = clamp(player.stamina - gameOptions.staminaDecay * elapsed, 0, 100);
}

function updatePlayer(player, elapsed) {
  const { up, down, left, right, dash } = player.controls;
  let dx = 0;
  let dy = 0;
  if (state.keys[up]) dy -= 1;
  if (state.keys[down]) dy += 1;
  if (state.keys[left]) dx -= 1;
  if (state.keys[right]) dx += 1;
  const moving = dx !== 0 || dy !== 0;
  const speed = state.keys[dash] && player.stamina > gameOptions.dashCost ? gameOptions.dashSpeed : gameOptions.walkSpeed;
  if (moving) {
    const length = Math.hypot(dx, dy) || 1;
    player.x += (dx / length) * speed;
    player.y += (dy / length) * speed;
    if (state.keys[dash] && player.stamina > gameOptions.dashCost) {
      player.stamina = clamp(player.stamina - gameOptions.dashCost * 0.8, 0, 100);
    }
  }
  player.x = clamp(player.x, player.radius, state.width - player.radius);
  player.y = clamp(player.y, player.radius, state.height - player.radius);
  updateStamina(player, elapsed);
}

function collectFood(player) {
  for (const food of state.foods) {
    if (food.infected) continue;
    const dist = Math.hypot(player.x - food.x, player.y - food.y);
    if (dist < player.radius + food.radius) {
      food.infected = true;
      player.score += 1;
      playPop();
      score1Label.textContent = player.score;
    }
  }
}

function collectFeces(player) {
  for (const feces of state.feces) {
    if (feces.used) continue;
    const dist = Math.hypot(player.x - feces.x, player.y - feces.y);
    if (dist < player.radius + feces.radius) {
      feces.used = true;
      player.stamina = clamp(player.stamina + gameOptions.recovery, 0, 100);
      playHit();
      stamina1Label.textContent = Math.round(player.stamina);
    }
  }
}

function updateGui() {
  stamina1Label.textContent = Math.round(players[0].stamina);
}

function drawScene() {
  ctx.clearRect(0, 0, state.width, state.height);

  drawBackground();
  state.foods.forEach(drawFood);
  state.feces.forEach(drawFeces);
  players.forEach(drawPlayer);
  drawTips();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(1, '#0b1018');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < state.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }
}

function drawFood(food) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = food.infected ? '#ff4b4b' : '#85ff7c';
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 2;
  ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFeces(feces) {
  if (feces.used) return;
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = '#b37f2c';
  ctx.strokeStyle = '#00000044';
  ctx.lineWidth = 2;
  ctx.arc(feces.x, feces.y, feces.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#00000055';
  ctx.fillRect(feces.x - 5, feces.y - 4, 10, 10);
  ctx.restore();
}

function drawPlayer(player) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = player.color;
  ctx.shadowColor = player.color;
  ctx.shadowBlur = 18;
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e2126';
  ctx.beginPath();
  ctx.arc(player.x - 5, player.y - 3, player.radius * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x + 6, player.y - 2, player.radius * 0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawTips() {
  ctx.fillStyle = '#ffffffcc';
  ctx.font = '16px Arial';
  ctx.fillText('Dash costs stamina. Eat feces to recover.', 18, state.height - 18);
}

let lastTimestamp = 0;
function gameLoop(timestamp) {
  if (!state.running) return;
  const elapsed = Math.min(timestamp - lastTimestamp, 33);
  lastTimestamp = timestamp;

  players.forEach((player) => {
    updatePlayer(player, elapsed);
    collectFood(player);
    collectFeces(player);
  });

  updateGui();
  drawScene();

  const playerDead = players[0].stamina <= 0;
  const allInfected = state.foods.every((food) => food.infected);
  if (playerDead || allInfected) {
    endGame(allInfected);
    return;
  }

  requestAnimationFrame(gameLoop);
}

function endGame() {
  state.running = false;
  gameoverText.textContent = `Game over! Final score: ${players[0].score}`;
  showScreen(gameOverScreen);
  playGameOver();
}

function handleKeyDown(event) {
  state.keys[event.code] = true;
}

function handleKeyUp(event) {
  state.keys[event.code] = false;
}

function handleStart() {
  if (!state.sound) {
    state.sound = createAudioContext();
  }
  if (state.sound.state === 'suspended') {
    state.sound.resume();
  }

  resetGame();
  showScreen(gameScreen);
  lastTimestamp = performance.now();
  requestAnimationFrame(gameLoop);
  playMenu();
}

function handleRestart() {
  handleStart();
}

function handleMenu() {
  showScreen(mainMenu);
  state.running = false;
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
startButton.addEventListener('click', handleStart);
restartButton.addEventListener('click', handleRestart);
menuButton.addEventListener('click', handleMenu);

showScreen(mainMenu);
