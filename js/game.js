"use strict";

// --- НАСТРОЙКА CANVAS И ЯДРА ИГРЫ ---
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("start-button");
const gameMusic = document.getElementById("game-music");

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// --- СОСТОЯНИЕ ИГРЫ ---
const GAME_STATE = {
  LOADING: -1,
  MENU: 0,
  RUNNING: 1,
  DEAD: 2,
};
let gameState = GAME_STATE.LOADING;

// --- СИСТЕМА ЗАГРУЗКИ ---
let assetsLoaded = 0;
const TOTAL_ASSETS = 10; // mascot + background + 5 падающих объектов + 3 бонуса
let loadingProgress = 0; // от 0 до 100

// --- ВРЕМЯ И ТАЙМЕРЫ ---
let lastTime = 0;
let elapsedTime = 0;

// --- СИСТЕМА РЕКОРДОВ ---
const STORAGE_KEY = "mascot_game_records";
let currentSessionTime = 0;
let bestTime = loadBestTime();

function loadBestTime() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? parseFloat(saved) : 0;
}

function saveBestTime(time) {
  if (time > bestTime) {
    bestTime = time;
    localStorage.setItem(STORAGE_KEY, time.toString());
  }
}

// --- ЗАГРУЗКА АССЕТОВ ---
const mascotImage = new Image();
mascotImage.src = "assets/images/mascot.png";
const backgroundImage = new Image();
backgroundImage.src = "assets/images/background.png";

// --- БОНУСЫ: Загрузка изображений ---
const potionImage = new Image();
potionImage.src = "assets/images/health_potion.png";
const shieldImage = new Image();
shieldImage.src = "assets/images/shield_item.png";
const slowImage = new Image();
slowImage.src = "assets/images/slow_time.png";

// Функция для создания фолбэка 40x40 для бонусов
function createBonusFallback(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 40, 40);

  // Добавляем простой символ для различения
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.fillText(color === "green" ? "+" : color === "blue" ? "S" : "T", 20, 25);

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

// Загрузка изображений для падающих объектов с поддержкой разных форматов
const fallingObjectImages = new Array(5); // ИСПРАВЛЕНИЕ 1: Массив с фиксированным размером
const fallingObjectExtensions = ["png", "jpg"]; // поддерживаем и PNG и JPG

// Функция для обновления прогресса загрузки
function updateLoadingProgress() {
  assetsLoaded++;
  loadingProgress = Math.floor((assetsLoaded / TOTAL_ASSETS) * 100);
  console.log(
    `Загружено ассетов: ${assetsLoaded}/${TOTAL_ASSETS} (${loadingProgress}%)`
  );

  if (assetsLoaded === TOTAL_ASSETS) {
    console.log("Все ассеты загружены, переход к меню");
    gameState = GAME_STATE.MENU;
    startButton.style.display = "block";
  }
}

// ИСПРАВЛЕНИЕ 3: Полностью замененная функция для корректной расстановки изображений
function loadImageWithFallback(
  basePath,
  fileNumber,
  targetIndex,
  extensions,
  callback
) {
  let currentExtensionIndex = 0;

  function tryLoadImage() {
    const img = new Image();
    const extension = extensions[currentExtensionIndex];
    img.src = `${basePath}_${fileNumber}.${extension}`;

    img.onload = () => {
      // Присваиваем изображение в нужную позицию в массиве
      fallingObjectImages[targetIndex] = img;
      callback();
    };

    img.onerror = () => {
      currentExtensionIndex++;
      if (currentExtensionIndex < extensions.length) {
        tryLoadImage();
      } else {
        console.warn(
          `Не удалось загрузить изображение falling_object_${fileNumber}`
        );
        // Создаем fallback изображение и ставим его на нужное место
        const fallbackImg = createFallbackImage();
        fallingObjectImages[targetIndex] = fallbackImg;
        callback();
      }
    };
  }

  tryLoadImage();
}

// Создание fallback изображения
function createFallbackImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext("2d");

  // Рисуем простой цветной квадрат
  ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 50%)`;
  ctx.fillRect(0, 0, 50, 50);

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

// Загружаем основные изображения
mascotImage.onload = updateLoadingProgress;
mascotImage.onerror = () => {
  console.warn("Не удалось загрузить mascot.png");
  updateLoadingProgress();
};

backgroundImage.onload = updateLoadingProgress;
backgroundImage.onerror = () => {
  console.warn("Не удалось загрузить background.png");
  updateLoadingProgress();
};

// Загрузка бонусов с фолбэком
potionImage.onload = updateLoadingProgress;
potionImage.onerror = () => {
  console.warn("Не удалось загрузить health_potion.png, используем фолбэк");
  updateLoadingProgress();
};

shieldImage.onload = updateLoadingProgress;
shieldImage.onerror = () => {
  console.warn("Не удалось загрузить shield_item.png, используем фолбэк");
  updateLoadingProgress();
};

slowImage.onload = updateLoadingProgress;
slowImage.onerror = () => {
  console.warn("Не удалось загрузить slow_time.png, используем фолбэк");
  updateLoadingProgress();
};

// ИСПРАВЛЕНИЕ 2: Обновленный цикл загрузки
for (let i = 1; i <= 5; i++) {
  loadImageWithFallback(
    "assets/images/falling_object",
    i, // Номер файла (1, 2, 3, 4, 5)
    i - 1, // Целевой индекс в массиве (0, 1, 2, 3, 4)
    fallingObjectExtensions,
    updateLoadingProgress
  );
}

// --- СИСТЕМА БОНУСОВ ---
let bonuses = [];
let nextBonusTime = 0;
let shieldActive = false;
let shieldTimer = 0;
let slowActive = false;
let slowTimer = 0;
let blockSlowCoef = 1.0;

function getRandomBonusSpawnTime() {
  return 25 + Math.random() * 55; // 25-80 секунд
}

function spawnRandomBonus() {
  const bonusTypes = ["potion", "shield", "slow"];
  const randomType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];

  let bonusImage;
  if (randomType === "potion") {
    bonusImage =
      potionImage.complete && potionImage.naturalWidth > 0
        ? potionImage
        : createBonusFallback("green");
  } else if (randomType === "shield") {
    bonusImage =
      shieldImage.complete && shieldImage.naturalWidth > 0
        ? shieldImage
        : createBonusFallback("blue");
  } else {
    // slow
    bonusImage =
      slowImage.complete && slowImage.naturalWidth > 0
        ? slowImage
        : createBonusFallback("purple");
  }

  bonuses.push({
    type: randomType,
    x: Math.random() * (GAME_WIDTH - 40),
    y: GAME_HEIGHT - 45,
    width: 40,
    height: 40,
    image: bonusImage,
    toRemove: false,
  });

  nextBonusTime = elapsedTime + getRandomBonusSpawnTime();
}

function activatePotion() {
  player.hp = Math.min(100, player.hp + 15);
  console.log("Зелье использовано! HP восстановлено на 15");
}

function activateShield() {
  shieldActive = true;
  shieldTimer = 10;
  console.log("Щит активирован на 10 секунд");
}

function activateSlow() {
  slowActive = true;
  slowTimer = 5;
  blockSlowCoef = 0.6; // замедление на 40%
  console.log("Замедление блоков активировано на 5 секунд");
}

// --- ОБРАБОТКА ВВОДА ---
const input = { keys: new Set() };
const preventKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"];
window.addEventListener("keydown", (e) => {
  if (preventKeys.includes(e.code)) e.preventDefault();
  input.keys.add(e.code);
});
window.addEventListener("keyup", (e) => {
  input.keys.delete(e.code);
});

// --- МУЗЫКАЛЬНАЯ СИСТЕМА ---
function playGameMusic() {
  try {
    gameMusic.currentTime = 0;
    gameMusic.volume = 0.6;
    const playPromise = gameMusic.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.log("Не удалось запустить музыку:", error);
      });
    }
  } catch (error) {
    console.log("Ошибка воспроизведения музыки:", error);
  }
}

function stopGameMusic() {
  try {
    gameMusic.pause();
    gameMusic.currentTime = 0;
  } catch (error) {
    console.log("Ошибка остановки музыки:", error);
  }
}

// --- ФИЗИЧЕСКИЕ КОНСТАНТЫ ---
const GRAVITY = 980 / 2;
const BASE_PLAYER_SPEED = 250;
let PLAYER_SPEED = BASE_PLAYER_SPEED;
const BASE_JUMP_FORCE = 200;
const JUMP_FORCE = BASE_JUMP_FORCE;

// --- SPAWN НАСТРОЙКИ ---
const spawnIntervals = [
  0, 3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0,
];
let spawnIndex = 0;
let nextSpawnTime = spawnIntervals[0];
let spawnCount = 2;

// --- ПЕРЕМЕННЫЕ ИГРЫ ---
let player = null;
const fallingObjects = [];

// --- ФУНКЦИЯ ДЛЯ ВЫБОРА РАНДОМНОГО ИЗОБРАЖЕНИЯ ---
function getRandomFallingObjectImage() {
  if (
    fallingObjectImages.length === 0 ||
    fallingObjectImages.some((img) => !img)
  ) {
    return createFallbackImage();
  }
  const randomIndex = Math.floor(Math.random() * fallingObjectImages.length);
  return fallingObjectImages[randomIndex];
}

// --- ФАБРИКА ИГРОКА ---
function createPlayer() {
  return {
    image: mascotImage,
    x: GAME_WIDTH / 2 - 35,
    y: GAME_HEIGHT - 70,
    width: 70,
    height: 70,
    vx: 0,
    vy: 0,
    isGrounded: true,
    facing: 1,
    hp: 100,
  };
}

// --- ФАБРИКА ПАДАЮЩЕГО ОБЪЕКТА ---
function createFallingObject() {
  const size = 50;
  const imageIndex = Math.floor(Math.random() * fallingObjectImages.length);
  const selectedImage =
    fallingObjectImages.length > 0 && fallingObjectImages[imageIndex]
      ? fallingObjectImages[imageIndex]
      : createFallbackImage();

  // falling_object_1.png (первое изображение в массиве) наносит 25 урона, остальные 10
  const damage = imageIndex === 0 ? 25 : 10;

  return {
    x: Math.random() * (GAME_WIDTH - size),
    y: -size,
    width: size,
    height: size,
    vy: 0,
    image: selectedImage,
    damage: damage,
  };
}

// --- ИНИЦИАЛИЗАЦИЯ ИГРЫ ---
function init() {
  console.log("Инициализация игры");
  player = createPlayer();
  fallingObjects.length = 0;
  bonuses.length = 0;
  elapsedTime = 0;
  currentSessionTime = 0;
  spawnIndex = 0;
  nextSpawnTime = spawnIntervals[0];
  nextBonusTime = getRandomBonusSpawnTime(); // Первый бонус через случайное время
  spawnCount = 2;
  PLAYER_SPEED = BASE_PLAYER_SPEED;

  // Сброс эффектов
  shieldActive = false;
  shieldTimer = 0;
  slowActive = false;
  slowTimer = 0;
  blockSlowCoef = 1.0;

  gameState = GAME_STATE.RUNNING;
  startButton.style.display = "none";

  // Запускаем музыку
  playGameMusic();
}

// --- ОТРИСОВКА ЗАГРУЗОЧНОГО ЭКРАНА ---
function drawLoadingScreen() {
  // Вычисляем затемнение: от 80% (0%) до 0% (100%)
  const darknessOpacity = 0.8 * (1 - loadingProgress / 100);

  // Очищаем экран черным цветом
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Применяем затемнение
  ctx.fillStyle = `rgba(0, 0, 0, ${darknessOpacity})`;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Прогресс-бар
  const barWidth = 300;
  const barHeight = 6;
  const barX = (GAME_WIDTH - barWidth) / 2;
  const barY = GAME_HEIGHT - 80;

  // Фон прогресс-бара
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

  // Заполнение прогресс-бара
  const progressWidth = (loadingProgress / 100) * barWidth;
  ctx.fillStyle = "white";
  ctx.fillRect(barX, barY, progressWidth, barHeight);

  // Текст "Loading..."
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Loading...", GAME_WIDTH / 2, barY - 15);
  ctx.textAlign = "left";
}

// --- ОБНОВЛЕНИЕ ЛОГИКИ ---
function update(deltaTime) {
  if (gameState !== GAME_STATE.RUNNING) return;

  elapsedTime += deltaTime;
  currentSessionTime = elapsedTime;

  // --- ОБНОВЛЕНИЕ ТАЙМЕРОВ БОНУСОВ ---
  if (shieldActive) {
    shieldTimer -= deltaTime;
    if (shieldTimer <= 0) {
      shieldActive = false;
      console.log("Действие щита закончилось");
    }
  }

  if (slowActive) {
    slowTimer -= deltaTime;
    if (slowTimer <= 0) {
      slowActive = false;
      blockSlowCoef = 1.0;
      console.log("Действие замедления закончилось");
    }
  }

  // --- СПАВН БОНУСОВ ---
  if (elapsedTime >= nextBonusTime) {
    spawnRandomBonus();
  }

  // Спавн падающих объектов по расписанию
  if (elapsedTime >= nextSpawnTime) {
    for (let i = 0; i < spawnCount; i++) {
      if (fallingObjects.length < 1000) {
        fallingObjects.push(createFallingObject());
      }
    }
    spawnIndex++;
    let interval = spawnIntervals[spawnIndex];
    if (interval === undefined) {
      interval = 0.2;
      spawnCount = 1;
    } else {
      spawnCount = interval > 1.0 ? 2 : 1;
    }
    nextSpawnTime += interval;
  }

  // Движение игрока
  player.vx = 0;
  if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) {
    player.vx = -PLAYER_SPEED;
    player.facing = -1;
  }
  if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) {
    player.vx = PLAYER_SPEED;
    player.facing = 1;
  }
  if (
    (input.keys.has("KeyW") ||
      input.keys.has("ArrowUp") ||
      input.keys.has("Space")) &&
    player.isGrounded
  ) {
    player.vy = -JUMP_FORCE;
    player.isGrounded = false;
    PLAYER_SPEED = BASE_PLAYER_SPEED * 1.4;
  }

  // Обновление падающих объектов (с учетом замедления)
  for (let obj of fallingObjects) {
    obj.vy += GRAVITY * deltaTime * blockSlowCoef;
    obj.y += obj.vy * deltaTime * blockSlowCoef;

    // Столкновение с игроком
    if (
      obj.x < player.x + player.width &&
      obj.x + obj.width > player.x &&
      obj.y < player.y + player.height &&
      obj.y + obj.height > player.y
    ) {
      obj.toRemove = true;

      // Урон наносится только если щит не активен
      if (!shieldActive) {
        const damage = obj.damage || 10; // По умолчанию 10, если damage не установлен
        player.hp = Math.max(0, player.hp - damage);
        if (player.hp === 0) {
          gameState = GAME_STATE.DEAD;
          stopGameMusic();
          saveBestTime(currentSessionTime);
          createRetryButton();
        }
      }
    }

    if (obj.y > GAME_HEIGHT) obj.toRemove = true;
  }

  // --- ОБНОВЛЕНИЕ И КОЛЛИЗИИ БОНУСОВ ---
  for (let bonus of bonuses) {
    // Проверка коллизии с игроком
    if (
      bonus.x < player.x + player.width &&
      bonus.x + bonus.width > player.x &&
      bonus.y < player.y + player.height &&
      bonus.y + bonus.height > player.y
    ) {
      // Активация бонуса
      if (bonus.type === "potion") {
        activatePotion();
      } else if (bonus.type === "shield") {
        activateShield();
      } else if (bonus.type === "slow") {
        activateSlow();
      }

      bonus.toRemove = true;
    }
  }

  // Очистка помеченных объектов
  for (let i = fallingObjects.length - 1; i >= 0; i--) {
    if (fallingObjects[i].toRemove) fallingObjects.splice(i, 1);
  }

  for (let i = bonuses.length - 1; i >= 0; i--) {
    if (bonuses[i].toRemove) bonuses.splice(i, 1);
  }

  // Физика игрока
  player.vy += GRAVITY * deltaTime;
  player.x += player.vx * deltaTime;
  player.y += player.vy * deltaTime;

  const floorY = GAME_HEIGHT - player.height;
  if (player.y > floorY) {
    player.y = floorY;
    player.vy = 0;
    player.isGrounded = true;
    PLAYER_SPEED = BASE_PLAYER_SPEED;
  }
  if (player.x < 0) player.x = 0;
  if (player.x > GAME_WIDTH - player.width)
    player.x = GAME_WIDTH - player.width;
}

// --- ОТРИСОВКА ---
function draw() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Загрузочный экран
  if (gameState === GAME_STATE.LOADING) {
    drawLoadingScreen();
    return;
  }

  // Фон
  if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
    ctx.drawImage(backgroundImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
  } else {
    // Fallback фон
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  // Падающие объекты
  for (let obj of fallingObjects) {
    if (obj.image && obj.image.complete && obj.image.naturalWidth > 0) {
      ctx.drawImage(obj.image, obj.x, obj.y, obj.width, obj.height);
    } else {
      // Fallback
      ctx.fillStyle = "rgba(255,255,0,0.8)";
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    }
  }

  // --- ОТРИСОВКА БОНУСОВ ---
  for (let bonus of bonuses) {
    if (bonus.image) {
      ctx.drawImage(bonus.image, bonus.x, bonus.y, bonus.width, bonus.height);
    } else {
      // Fallback для бонусов
      ctx.fillStyle =
        bonus.type === "potion"
          ? "green"
          : bonus.type === "shield"
          ? "blue"
          : "purple";
      ctx.fillRect(bonus.x, bonus.y, bonus.width, bonus.height);
    }
  }

  // Игрок
  if (player) {
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y);
    ctx.scale(player.facing, 1);

    if (player.image.complete && player.image.naturalWidth > 0) {
      ctx.drawImage(
        player.image,
        -player.width / 2,
        0,
        player.width,
        player.height
      );
    } else {
      // Fallback для игрока
      ctx.fillStyle = "purple";
      ctx.fillRect(-player.width / 2, 0, player.width, player.height);
    }
    ctx.restore();

    // --- ЭФФЕКТ ЩИТА ВОКРУГ ИГРОКА ---
    if (shieldActive) {
      ctx.save();
      const shieldRadius = 45;
      const centerX = player.x + player.width / 2;
      const centerY = player.y + player.height / 2;

      // Анимация щита (пульсация)
      const pulseEffect = Math.sin(elapsedTime * 8) * 0.1 + 0.9;

      ctx.beginPath();
      ctx.arc(centerX, centerY, shieldRadius * pulseEffect, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 140, 255, ${0.6 * pulseEffect})`;
      ctx.lineWidth = 5;
      ctx.stroke();

      // Внутренний эффект
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        (shieldRadius - 10) * pulseEffect,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = `rgba(100, 200, 255, ${0.3 * pulseEffect})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    }
  }

  // HUD
  if (player && gameState === GAME_STATE.RUNNING) {
    const barX = 20,
      barY = 20,
      barW = 200,
      barH = 24;
    ctx.fillStyle = "#222";
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = "gray";
    ctx.fillRect(barX, barY, barW, barH);
    const hpWidth = (player.hp / 100) * barW;
    const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    gradient.addColorStop(0, "#ff4b4b");
    gradient.addColorStop(1, "#ff0000");
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, hpWidth, barH);
    ctx.fillStyle = "white";
    ctx.font = "18px Arial";
    ctx.fillText(`HP: ${player.hp}`, barX + 4, barY + barH - 6);
    ctx.fillText(`Time: ${elapsedTime.toFixed(1)}s`, barX, barY + barH + 30);

    // Показываем активные эффекты
    if (shieldActive) {
      ctx.fillStyle = "cyan";
      ctx.fillText(
        `Shield: ${shieldTimer.toFixed(1)}s`,
        barX,
        barY + barH + 55
      );
    }
    if (slowActive) {
      ctx.fillStyle = "purple";
      ctx.fillText(`Slow: ${slowTimer.toFixed(1)}s`, barX, barY + barH + 80);
    }
  }

  // Меню
  if (gameState === GAME_STATE.MENU) {
    const w = 150,
      h = 150;
    if (mascotImage.complete && mascotImage.naturalWidth > 0) {
      ctx.drawImage(
        mascotImage,
        (GAME_WIDTH - w) / 2,
        (GAME_HEIGHT - h) / 2,
        w,
        h
      );
    } else {
      // Fallback для меню
      ctx.fillStyle = "purple";
      ctx.fillRect((GAME_WIDTH - w) / 2, (GAME_HEIGHT - h) / 2, w, h);
    }
  }

  // Экран смерти
  if (gameState === GAME_STATE.DEAD) {
    ctx.fillStyle = "rgba(255,0,0,0.5)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "white";
    ctx.font = "72px Arial";
    ctx.textAlign = "center";
    ctx.fillText("reDEAD", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);

    ctx.font = "24px Arial";
    ctx.fillText(
      `Session: ${currentSessionTime.toFixed(1)}s`,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 20
    );
    ctx.fillText(
      `Best Time: ${bestTime.toFixed(1)}s`,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 50
    );

    ctx.textAlign = "left";
  }
}

// --- КНОПКА reTRY AGAIN ---
function createRetryButton() {
  const btn = document.createElement("button");
  btn.textContent = "reTRY AGAIN";
  Object.assign(btn.style, {
    position: "absolute",
    left: "50%",
    top: "70%",
    transform: "translate(-50%, -50%)",
    padding: "15px 30px",
    fontSize: "24px",
    fontWeight: "bold",
    color: "white",
    backgroundColor: "#8a2be2",
    border: "2px solid white",
    borderRadius: "10px",
    cursor: "pointer",
  });
  btn.addEventListener("click", () => {
    btn.remove();
    init();
  });
  document.getElementById("game-container").appendChild(btn);
}

// --- ГЛАВНЫЙ ЦИКЛ ---
function gameLoop(timestamp) {
  const deltaTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(deltaTime);
  draw();
  requestAnimationFrame(gameLoop);
}

// --- СТАРТ ИГРЫ ---
startButton.addEventListener("click", () => {
  if (gameState === GAME_STATE.MENU) {
    init();
    lastTime = performance.now();
  }
});

// Запускаем цикл для отображения загрузки
requestAnimationFrame(gameLoop);
