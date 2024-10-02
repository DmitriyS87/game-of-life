let updateDisplayEl;
let nextTimeout;

/* SETTINGS */
const GAME_MAIN_CONTAINER_SELECTOR = ".game-screen";
const GAME_ALIVE_COLOR = "blue";
const GAME_DEAD_COLOR = "#f5f5f5";
const GAME_AREA_SIZE_X = 20;
const GAME_AREA_SIZE_Y = 20;
const GAME_CANVAS_WIDTH_DEFAULT = 320;
const GAME_CANVAS_HEIGHT_DEFAULT = 320;

const BASE_UPDATE_FPS = 8;
const DISPLAY_SPEED_DELAY = 300;

const HIDDEN_CLASS = "visually-hidden";

const nextSceneRenderDelay = Math.round(1000 / BASE_UPDATE_FPS);

const getRenderTimeCounter = (cb) => {
  let prevRenderTime = 0;
  return (newTime) => {
    const delta = newTime - prevRenderTime;
    if (typeof cb === "function") cb(delta);
    prevRenderTime = newTime;
    return delta;
  };
};

const mixByOptions = (keys, values, options) => {
  keys.forEach((key) => {
    values[key] = options[key] ?? values[key];
  });
  return values;
};

const extendOffscreenCanvas = ($canvas, name, { width, height } = {}) => {
  $canvas[name] = document.createElement("canvas");
  $canvas[name].width = width ?? $canvas.width;
  $canvas[name].height = height ?? $canvas.height;
};

const cordToKey = (x, y) => `${x}:${y}`;
const keyToCoords = (key) => key.split(":").map(Number);
const roundToDecimal = (num, dec = 1) =>
  Math.round(num * 10 ** dec) / 10 ** dec;
const fixBorderCoords = (x, min = 0, max) => {
  if (x < min) {
    return max + x;
  }
  if (x >= max) {
    return x - max;
  }
  return x;
};

const hideElement = (el) => {
  el.classList.add(HIDDEN_CLASS);
};
const unHideElement = (el) => {
  el.classList.remove(HIDDEN_CLASS);
};
const disableElement = (el) => {
  el.setAttribute("disabled", true);
};
const enableElement = (el) => {
  el.removeAttribute("disabled");
};
const printTextToEl = (text, el) => {
  el.innerText = text;
};
const noOftenThan = (cb, delta = 0) => {
  let lastTime = Date.now();
  return (args) => {
    const now = Date.now();
    if (now - lastTime < delta) {
      return;
    }
    lastTime = now;
    return cb(args);
  };
};
const printUpdateTime = (timeDelta) => {
  const fps = (1000 / timeDelta).toFixed(1);
  updateDisplayEl.innerText = fps;
};

const getRandomColor = () =>
  `rgb(${Math.round(Math.random() * 255)}, ${Math.round(
    Math.random() * 255
  )}, ${Math.round(Math.random() * 255)})`;

class GameField {
  constructor(ctx, x, y, dx, dy, color) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.color = color;
    this.ctxWidth = ctx.canvas.width;
    this.ctxHeight = ctx.canvas.height;
  }

  get renderData() {
    return {
      ...this,
    };
  }

  clear() {
    const { ctx, x, y, dx, dy } = this;
    ctx.clearRect(x, y, dx, dy);
  }

  draw(img) {
    const { ctx, x, y, dx, dy } = this;
    ctx.drawImage(img, x, y, dx, dy);
  }
}

class Figure {
  constructor(ctx, x, y, dx, dy, color) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.color = color;
    this.ctxWidth = ctx.canvas.width;
    this.ctxHeight = ctx.canvas.height;
  }

  clear() {
    const { ctx, x, y, dx, dy } = this;
    ctx.clearRect(x, y, dx, dy);
  }

  draw() {
    throw new Error('You have to implement method "draw" for your Figure');
  }
  update() {
    throw new Error('You have to implement method "update" for your Figure');
  }
}

class Square extends Figure {
  constructor(ctx, x, y, dx, dy, color) {
    super(ctx, x, y, dx, dy, color);
    this.countVisibleSquareSize();
  }

  countVisibleSquareSize() {
    this.vDX = roundToDecimal(this.dx - this.dx * 0.15);
    this.vDY = roundToDecimal(this.dy - this.dy * 0.15);
  }

  draw(options = {}) {
    const { ctx, x, y, dx, dy, color } = mixByOptions(
      ["ctx", "x", "y", "dx", "dy", "color"],
      this,
      options
    );
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, this.vDX, this.vDY);
    ctx.restore();
  }

  update(params = {}) {
    this.clear();
    [...Object.keys(params)].forEach((key) => (this[key] = params[key]));
    this.draw();
  }
}

class Dot extends Figure {
  constructor(ctx, x, y, dx, dy, color) {
    super(ctx, x, y, dx, dy, color);
    this.countParams();
  }

  countParams() {
    this.cX = Math.round(this.x + this.dx / 2);
    this.cY = Math.round(this.y + this.dy / 2);
    this.r = Math.round(
      Math.min((this.dx - 0.1 * this.dx) / 2, (this.dy - 0.1 * this.dy) / 2)
    );
  }

  draw(options = {}) {
    const { ctx, x, y, dx, dy, color } = mixByOptions(
      ["ctx", "x", "y", "dx", "dy", "color"],
      this,
      options
    );
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.cX, this.cY, this.r, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();
  }

  update(params = {}) {
    this.clear();
    [...Object.keys(params)].forEach((key) => (this[key] = params[key]));
    this.countParams();
    this.draw();
  }
}

const getNeighborsCoords = (x, y, maxX, maxY) => {
  const result = [];
  [-1, 0, 1].forEach((i) => {
    [-1, 0, 1].forEach((j) => {
      if (!(i === 0 && j === 0)) {
        result.push(
          `${fixBorderCoords(Number(x) + i, 0, maxX)}:${fixBorderCoords(
            Number(y) + j,
            0,
            maxY
          )}`
        );
      }
    });
  });
  return result;
};

class Game {
  screenPadding = {
    xY: 12,
    tB: 16,
  };
  defaultCanvasSize = {
    width: GAME_CANVAS_WIDTH_DEFAULT,
    height: GAME_CANVAS_HEIGHT_DEFAULT,
  };
  aliveColor = GAME_ALIVE_COLOR;
  deadColor = GAME_DEAD_COLOR;

  constructor({
    sizeX,
    sizeY,
    container,
    Figure = Square,
    randomColor = false,
  }) {
    this.container = container;
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.Figure = Figure;
    this.randomColor = randomColor;

    this.fields = {};
    this.bgRenderMode = 0;
    this.history = [];
    this.defaultStateMatrix = Array.from({ length: sizeY }, () =>
      Array(sizeX).fill(0)
    );
    this.currentAliveCoords = new Set();
    this.stateMatrix = [];
    this.updateMatrix = [];
    this.currentGeneration = 0;
    this.generationTime = 0;
    this.rules = {
      0: {
        aliveMinCount: 3,
      },
      1: {
        minAlive: 2,
        maxAlive: 3,
      },
    };

    this.draw.bind(this);
    this.updateScene.bind(this);
    this.updateGameScreen.bind(this);
    this.renderLayer.bind(this);
    this.prepareGameSettings.bind(this);
  }

  get getGenerationInfo() {
    return {
      current: this.currentGeneration,
      time: this.generationTime,
      aliveCount: this.aliveCount,
      renderTime: this.renderTime,
    };
  }

  createCanvasLayer({ cn }) {
    const $layer = document.createElement("canvas");
    $layer.classList.add(cn);
    $layer.innerHTML = `Your browser doesn't appear to support the HTML5
    <code>&lt;canvas&gt;</code> element.
    `;
    return $layer;
  }

  createCanvas() {
    // !refactor it
    this._$container = document.querySelector(this.container);
    const { width, height } = this._$container.getBoundingClientRect();
    const gameWidth = Math.max(width, this.defaultCanvasSize.width) - 6;
    const gameHeight = Math.max(height, this.defaultCanvasSize.height) - 6;
    const rectSize = Math.min(gameWidth, gameHeight);
    this.bgCanvas = this.createCanvasLayer({
      cn: "game-background",
    });
    this.layerCanvas = this.createCanvasLayer({
      cn: "game-layer",
    });
    this.bgCanvas.width = this.layerCanvas.width = rectSize;
    this.bgCanvas.height = this.layerCanvas.height = rectSize;
    this.ctx = {
      bg: this.bgCanvas.getContext("2d"),
      // bg: this.bgCanvas.getContext("2d", { alpha: false }),
      layer: this.layerCanvas.getContext("2d"),
    };
    this.ctx.bg.imageSmoothingEnabled = false;
    this.ctx.layer.imageSmoothingEnabled = false;
    this._$container.appendChild(this.bgCanvas);
    this._$container.appendChild(this.layerCanvas);
    this.width = this.bgCanvas.width;
    this.height = this.bgCanvas.height;
    extendOffscreenCanvas(this.bgCanvas, "offscreenCanvasDead");
    extendOffscreenCanvas(this.bgCanvas, "offscreenCanvasAlive");
  }

  renderBg() {
    if (this.bgRenderMode === 0) {
      this.ctx.bg.drawImage(this.bgCanvas.offscreenCanvasDead, 0, 0);
      return;
    }
    this.ctx.bg.drawImage(this.bgCanvas.offscreenCanvasAlive, 0, 0);
  }

  // prepareBgCache() {
  //   Object.entries(this.fields).forEach(([key, point], idx) => {
  //     point.draw({
  //       ctx: this.bgCanvas.offscreenCanvasDead.getContext("2d"),
  //       color: this.deadColor,
  //     });
  //     point.draw({
  //       ctx: this.bgCanvas.offscreenCanvasAlive.getContext("2d"),
  //       color: !this.randomColor ? this.aliveColor : undefined,
  //     });
  //   });
  // }

  initEventListeners() {
    document.addEventListener("life-game-event-controls", (e) => {
      e.stopPropagation();
      switch (e?.detail?.action) {
        case "start":
          this.start();
          return;
        case "stop":
          this.pause();
          return;
        case "reset":
          this.reset();
          return;
        case "generate":
          this.generate();
          return;

        default:
          console.error("unhandled game event!");
          return;
      }
    });
    document.addEventListener("click", (e) => {
      if (this._$container.contains(e.target)) {
        e.stopPropagation();
        e.preventDefault();
        const x = e.offsetX;
        const y = e.offsetY;
        this.handleGameAreaClick({ x, y });
      }
    });
  }

  handleGameAreaClick({ x, y }) {
    const targetX = Math.floor(x / this._fieldWidth);
    const targetY = Math.floor(y / this._fieldHeight);
    const targetCoords = cordToKey(targetX, targetY);
    const target = this.fields[targetCoords];
    const isAlive = this.currentAliveCoords.has(targetCoords);
    if (isAlive) {
      this.currentAliveCoords.delete(targetCoords);
      target.clear();
    } else {
      this.currentAliveCoords.add(targetCoords);
      target.draw(this.aliveImg);
      // target.update({ color: this.aliveColor });
    }
  }

  prepareGameSettings() {
    this.createFields();
    this.createAliveImage();
  }

  init() {
    this.createCanvas();
    this.prepareGameSettings();
    this.initEventListeners();
    this.renderLoop();
    // this.prepareBgCache();
    // this.renderBg();
  }

  renderCounter = getRenderTimeCounter(
    noOftenThan(printUpdateTime, DISPLAY_SPEED_DELAY)
  );

  printFPS(timeRendered) {
    if (this.state === "play") {
      this.renderCounter(timeRendered);
    }
  }

  renderLoop() {
    const render = () => {
      this.updateGameScreen();

      nextTimeout = setTimeout(
        () =>
          requestAnimationFrame((timeRendered) => {
            clearTimeout(nextTimeout);
            this.printFPS(timeRendered);
            render();
          }),
        nextSceneRenderDelay
      );
    };

    render();
  }

  createAliveImage() {
    this.bgCanvas.offscreenCanvasField = null;
    const width = Math.max(10, this._fieldWidth);
    const height = Math.max(10, this._fieldHeight);
    extendOffscreenCanvas(this.bgCanvas, "offscreenCanvasField", {
      width,
      height,
    });
    const ctx = this.bgCanvas.offscreenCanvasField.getContext("2d");
    const figure = new this.Figure(ctx, 0, 0, width, height, this.aliveColor);
    figure.draw();
    this.aliveImg = this.bgCanvas.offscreenCanvasField;
  }

  createFields() {
    const decimalsCount = Math.round(
      Math.max(GAME_AREA_SIZE_X / this.width, GAME_AREA_SIZE_Y / this.height, 1)
    );
    const { ctx, sizeX, sizeY, width, height, randomColor } = this;
    this._fieldWidth = roundToDecimal(width / sizeX, decimalsCount);
    this._fieldHeight = roundToDecimal(height / sizeY, decimalsCount);
    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        const positionX = x * this._fieldWidth;
        const positionY = y * this._fieldHeight;
        this.fields[`${x}:${y}`] = new GameField(
          ctx.layer,
          positionX,
          positionY,
          this._fieldWidth,
          this._fieldHeight,
          randomColor ? getRandomColor() : this.aliveColor
        );
      }
    }
  }

  clear() {
    const { ctx, width, height } = this;
    ctx.bg.clearRect(0, 0, width, height);
    ctx.layer.clearRect(0, 0, width, height);
  }

  resetRuntimeCounters() {
    this.currentGeneration = 0;
  }

  createRandomFirstGeneration() {
    this.currentAliveCoords = new Set();
    this.stateMatrix = [...this.defaultStateMatrix].map((row, x) => {
      return row.map((el, y) => {
        const val = Math.random() < 0.6 ? 0 : 1;
        if (val === 1) this.currentAliveCoords.add(cordToKey(x, y));
      });
    });
    this.setState("renderGenerated");
  }

  generateNext() {
    const countNeighbors = (coordsSet) => {
      const result = new Map();
      coordsSet.forEach((coords) => {
        const [x, y] = keyToCoords(coords);
        const neighbors = getNeighborsCoords(x, y, this.sizeX, this.sizeY);

        neighbors.forEach((coords) => {
          if (!result.has(coords)) {
            result.set(coords, 0);
          }
          result.set(coords, result.get(coords) + 1);
        });
      });
      return result;
    };

    this.coordsToHide = null;
    this.coordsToRender = null;

    const newAliveCoords = new Set();
    const survivedCoords = new Set();
    let deadCoords = new Set();

    const countedNeighbors = countNeighbors(this.currentAliveCoords);

    countedNeighbors.forEach((count, coords) => {
      const isAlive = this.currentAliveCoords.has(coords);
      if (isAlive) {
        this.currentAliveCoords.delete(coords);
        const { maxAlive, minAlive } = this.rules[1];
        if (count >= minAlive && count <= maxAlive) {
          survivedCoords.add(coords);
        } else {
          deadCoords.add(coords);
        }
      } else {
        const { aliveMinCount } = this.rules[0];
        if (count === aliveMinCount) {
          newAliveCoords.add(coords);
        }
      }
    });

    if (this.currentAliveCoords.size) {
      deadCoords = new Set([...deadCoords, ...this.currentAliveCoords]);
    }

    this.currentAliveCoords = new Set([...survivedCoords, ...newAliveCoords]);
    this.coordsToHide = deadCoords;
    this.coordsToRender = newAliveCoords;

    this.currentGeneration++;
    this.aliveCount = this.currentAliveCoords.size;
  }

  clearLayer() {
    const ctx = this.ctx.layer;
    ctx.clearRect(0, 0, this.width, this.height);
  }

  reset() {
    this.clearLayer();
    this.currentAliveCoords = new Set();
    this.currentGeneration = 0;
  }

  renderLayer() {
    const ctx = this.ctx.layer;
    ctx.beginPath();
    if (this.coordsToHide || this.coordsToRender) {
      this.coordsToRender.forEach((coords) => {
        const field = this.fields[coords];
        field.draw(this.aliveImg);
        // field.draw({ ctx, color: this.aliveColor });
      });
      this.coordsToHide.forEach((coords) => {
        const field = this.fields[coords];
        field.clear();
        // field.draw({ ctx, color: this.deadColor });
      });
      this.coordsToHide = this.coordsToRender = null;
    } else {
      const aliveCoords = this.currentAliveCoords;
      // ! unused ctx here - field has own on created
      aliveCoords.forEach((coords) => {
        const field = this.fields[coords];
        field.draw(this.aliveImg);
        // field.draw({ ctx, color: this.aliveColor });
      });
    }
    ctx.closePath();
  }

  draw() {
    this.clear();
    this.renderBg();
    this.renderLayer();
  }

  countRunTime(fn) {
    const startTime = Date.now();
    fn();
    return Date.now() - startTime;
  }

  updateScene() {
    this.generationTime = this.countRunTime(this.generateNext.bind(this));
    this.renderTime = this.countRunTime(this.renderLayer.bind(this));
    this.onNextGeneration();
    // this.clearLayer();
    // const newCoords = this.aliveCoordsSet;
    if (this.currentAliveCoords.size === 0 && this.state === "play") {
      this.finish();
    }
  }

  updateGameScreen(params) {
    if (this.state === "play") {
      this.updateScene();
    }
  }

  setState(value) {
    this.state = value;
  }

  start() {
    // this.checkGameSettings
    // this.checkFirstGeneration
    // this.resetRuntimeCounters();
    this.setState("play");
  }
  pause() {
    this.setState("pause");
  }
  finish() {
    this.setState("finish");
    this.onFinish();
  }
  generate() {
    if (this.state !== "play") {
      this.createRandomFirstGeneration();
      this.resetRuntimeCounters();
      this.draw();
    }
  }
  togglePoint() {}

  onNextGeneration() {
    const newGenerationEvent = new CustomEvent("life-game-runtime-event", {
      detail: {
        type: "new-generation",
        data: this.getGenerationInfo,
      },
    });
    document.dispatchEvent(newGenerationEvent);
  }

  onFinish() {
    const newGenerationEvent = new CustomEvent("life-game-runtime-event", {
      detail: {
        type: "finish",
      },
    });
    document.dispatchEvent(newGenerationEvent);
  }
}

const initControlPanel = () => {
  /* control elements */
  const startBtn = document.querySelector(".ctrl-btn.start");
  const stopBtn = document.querySelector(".ctrl-btn.stop");
  const resetBtn = document.querySelector(".ctrl-btn.reset");
  const generateBtn = document.querySelector(".ctrl-btn.generate");
  const gameControlsForm = document.querySelector(".game__controls");

  /* display elements */
  updateDisplayEl = document.querySelector(".update-time");
  const generationNumber = document.querySelector(".generation-number");
  const generationComputedTime = document.querySelector(".generation-computed");
  const generationRenderTime = document.querySelector(
    ".generation-render-time"
  );
  const generationAliveCount = document.querySelector(
    ".generation-alive-count"
  );
  const startEvent = new CustomEvent("life-game-event-controls", {
    detail: {
      action: "start",
    },
  });
  const stopEvent = new CustomEvent("life-game-event-controls", {
    detail: {
      action: "stop",
    },
  });
  const resetEvent = new CustomEvent("life-game-event-controls", {
    detail: {
      action: "reset",
    },
  });
  const generateEvent = new CustomEvent("life-game-event-controls", {
    detail: {
      action: "generate",
    },
  });

  const switchStartToStop = () => {
    hideElement(startBtn);
    unHideElement(stopBtn);
    disableElement(startBtn);
  };

  const switchStopToStart = () => {
    hideElement(stopBtn);
    enableElement(startBtn);
    unHideElement(startBtn);
  };

  gameControlsForm.addEventListener("submit", function (e) {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(startEvent);
    switchStartToStop();
  });
  stopBtn.addEventListener("click", () => {
    document.dispatchEvent(stopEvent);
    switchStopToStart();
  });

  resetBtn.addEventListener("click", () => document.dispatchEvent(resetEvent));
  generateBtn.addEventListener("click", () =>
    document.dispatchEvent(generateEvent)
  );
  document.addEventListener("life-game-runtime-event", (e) => {
    e.stopPropagation();
    switch (e?.detail?.type) {
      case "new-generation":
        const { current, time, aliveCount, renderTime } = e.detail.data;
        printTextToEl(current, generationNumber);
        printTextToEl(time + " ms", generationComputedTime);
        printTextToEl(aliveCount, generationAliveCount);
        printTextToEl(renderTime, generationRenderTime);
        return;
      case "finish":
        switchStopToStart();
        return;
      default:
        console.error("unhandled game event!");
        return;
    }
  });
  /* 
ACTIONS
start btn
stop
size
generate
apply mouse

INDICATORS
time shift between generation
*/
};

const initGame = () => {
  try {
    const printFPS = getRenderTimeCounter(
      noOftenThan(printUpdateTime, DISPLAY_SPEED_DELAY)
    );

    const game = new Game({
      sizeX: GAME_AREA_SIZE_X,
      sizeY: GAME_AREA_SIZE_Y,
      container: GAME_MAIN_CONTAINER_SELECTOR,
      Figure: Square,
      randomColor: true,
    });
    game.init();
  } catch (e) {
    throw new Error(`Can't setup canvas. ${e}`);
  }
};

const init = () => {
  try {
    initControlPanel();
    initGame();
  } catch (e) {
    console.error(e);
  }
};

document.addEventListener("readystatechange", (e) => {
  if (document.readyState === "complete") {
    init();
  }
});
