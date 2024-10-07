import {
  getRenderTimeCounter,
  cordToKey,
  roundToDecimal,
  noOftenThan,
  getRandomColor,
  convertPerSecToMs,
  getUnitArrayIndex,
  getCordsByUnitIndex,
  getNeighborsCords,
  mod,
} from "./utils.js";

import {
  GAME_ALIVE_COLOR,
  GAME_DEAD_COLOR,
  GAME_DEFAULT_AREA_SIZE_X,
  GAME_DEFAULT_AREA_SIZE_Y,
  GAME_CANVAS_WIDTH_DEFAULT,
  GAME_CANVAS_HEIGHT_DEFAULT,
  DISPLAY_SPEED_DELAY,
  BASE_UPDATE_FPS,
  GAME_EVENT_NAME,
  GAME_MAIN_CONTAINER_SELECTOR,
  CONTROL_PANEL_EVENT_NAME,
} from "./config.js";

import { WebGlCountGame } from "./webGl.js";
import { Dot } from "./figures.js";

let renderInterval;
let worker = null;

class Field {
  constructor(x, y, dx, dy, color) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.color = color;
  }

  get renderData() {
    return {
      x: this.x,
      y: this.y,
      dx: this.dx,
      dy: this.dy,
      color: this.color,
    };
  }
}

export class Game {
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

  constructor({ sizeX, sizeY, container, Figure = Dot, randomColor = false }) {
    this.state = "init";

    this.container = container;
    this.sizeX = sizeX ?? GAME_DEFAULT_AREA_SIZE_X;
    this.sizeY = sizeY ?? GAME_DEFAULT_AREA_SIZE_Y;
    this.Field = Field;
    this.Figure = Figure;
    this.randomColor = randomColor;

    this.fields = {};
    this.bgRenderMode = 0;
    this.history = [];
    this.currentAliveCoords = new Set();
    this.updateSceneData = {};
    this.stateMatrix = [];
    this.currentGeneration = 0;
    this.generationTime = 0;
    this.aliveCount = 0;
    this.maxFps = BASE_UPDATE_FPS;
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
  }

  get getGenerationInfo() {
    return {
      current: this.currentGeneration,
      time: this.generationTime,
      aliveCount: this.aliveCount,
      renderTime: this.renderTime,
    };
  }

  init() {
    this.createInitialStateMatrix();
    this.createCanvas();
    this.initCountEngine();
    this.createFields();
    this.createCacheFigure();
    this.initEventListeners();
    this.startRender();
    this.sendInitEvent({
      size: this.sizeX,
      maxFps: this.maxFps,
    });
  }

  initWorker(worker) {
    this.worker = worker;
    this.worker.onmessage = this.workerUpdateHandler;
  }

  initCountEngine() {
    if (WebGlCountGame.isWebGLAvailable()) {
      this.webGlCalc = new WebGlCountGame({
        x: this.sizeX,
        y: this.sizeY,
      });
      return;
    }

    try {
      worker = new Worker("calcScene.js");
      this.workerCalc = true;
      this.initWorker(worker);
    } catch (e) {
      console.warn("Worker api is not supported", e);
    }
  }

  createCanvas() {
    this._$container = document.querySelector(this.container);
    const { width, height } = this._$container.getBoundingClientRect();
    const gameWidth = Math.max(width, this.defaultCanvasSize.width) - 6;
    const gameHeight = Math.max(height, this.defaultCanvasSize.height) - 6;
    const rectSize = Math.min(gameWidth, gameHeight);
    this.bgCanvas = this.createCanvasElement({
      cn: "game-background",
    });
    this.layerCanvas = this.createCanvasElement({
      cn: "game-layer",
    });
    this.bgCanvas.width = this.layerCanvas.width = rectSize;
    this.bgCanvas.height = this.layerCanvas.height = rectSize;
    this.ctx = {
      bg: this.bgCanvas.getContext("2d", { alpha: false }),
      layer: this.layerCanvas.getContext("2d"),
    };
    this.ctx.bg.imageSmoothingEnabled = false;
    this.ctx.layer.imageSmoothingEnabled = false;
    this.width = this.layerCanvas.width;
    this.height = this.layerCanvas.height;
  }

  createInitialStateMatrix() {
    this.stateMatrix = new Uint8Array(this.sizeX * this.sizeY);
  }

  createCacheFigure() {
    if (this.aliveCacheFigure) {
      this.aliveCacheFigure.remove();
      this.aliveCacheFigure = null;
    }
    const cellWidth = this._fieldWidth;
    const cellHeight = this._fieldHeight;

    this.aliveCacheFigure = document.createElement("canvas");
    this.aliveCacheFigure.width = cellWidth;
    this.aliveCacheFigure.height = cellHeight;
    const ctx = this.aliveCacheFigure.getContext("2d");

    this.figure = new this.Figure({ mW: 100, mH: 100 });
    const img = this.figure.getImage();

    function drawImageContain(ctx, image, x, y, cellWidth, cellHeight) {
      const imgWidth = image.width;
      const imgHeight = image.height;
      const imgAspectRatio = imgWidth / imgHeight;
      const cellAspectRatio = cellWidth / cellHeight;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imgAspectRatio > cellAspectRatio) {
        drawWidth = cellWidth;
        drawHeight = cellWidth / imgAspectRatio;
        offsetX = 0;
        offsetY = (cellHeight - drawHeight) / 2;
      } else {
        drawWidth = cellHeight * imgAspectRatio;
        drawHeight = cellHeight;
        offsetX = (cellWidth - drawWidth) / 2;
        offsetY = 0;
      }

      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    }

    drawImageContain(ctx, img, 0, 0, cellWidth, cellHeight);
    this.cachedFigure = this.aliveCacheFigure;
  }

  reloadCountEngine() {
    if (this.webGlCalc) {
      this.webGlCalc.destroy();
      this.webGlCalc = new WebGlCountGame({
        x: this.sizeX,
        y: this.sizeY,
      });
    }
  }

  createFields() {
    const Field = this.Field;
    const decimalsCount = 2;
    const { sizeX, sizeY, width, height, randomColor } = this;
    this._fieldWidth = Math.max(
      roundToDecimal(width / sizeX, decimalsCount),
      1
    );
    this._fieldHeight = Math.max(
      roundToDecimal(height / sizeY, decimalsCount),
      1
    );
    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        const positionX = roundToDecimal(x * this._fieldWidth);
        const positionY = roundToDecimal(y * this._fieldHeight);
        this.fields[cordToKey(x, y)] = new Field(
          positionX,
          positionY,
          this._fieldWidth,
          this._fieldHeight,
          randomColor ? getRandomColor() : this.aliveColor
        );
      }
    }
  }

  createRandomFirstGeneration() {
    this.aliveCount = 0;
    this.currentGeneration = 1;
    this.currentAliveCoords = new Set();
    this.stateMatrix = new Uint8Array(this.sizeX * this.sizeY);
    for (let y = 0; y < this.sizeY; y++) {
      for (let x = 0; x < this.sizeX; x++) {
        if (Math.random() < 0.6 ? 0 : 1) {
          this.stateMatrix[getUnitArrayIndex(x, y, this.sizeX)] = 1;
          this.aliveCount++;
        }
      }
    }
    this.updateDisplayGameInfo(this.getGenerationInfo);
    this.setState("renderGenerated");
  }

  generateNext() {
    const newStateMatrix = this.countNextState(this.stateMatrix, { width: this.sizeX, height: this.sizeY });
    const { changedFields } = this.countNextRenderChanges(
      this.stateMatrix,
      newStateMatrix,
      this.sizeX
    );

    this.stateMatrix = newStateMatrix;
    this.changedFields = changedFields;
  }

  clear() {
    const { ctx, width, height } = this;
    ctx.bg.clearRect(0, 0, width, height);
    ctx.layer.clearRect(0, 0, width, height);
  }

  draw() {
    this.clear();
    this.countRunTime(this.renderLayer.bind(this));
  }

  renderLayer() {
    const ctx = this.ctx.layer;
    ctx.beginPath();
    if (this.changedFields) {
      this.changedFields.forEach(({ x, y, state }) => {
        state === 1
          ? this.renderCoord(cordToKey(x, y))
          : this.clearCoord(cordToKey(x, y));
      });
      this.changedFields = null;
    } else {
      this.stateMatrix.forEach((val, idx) => {
        if (val === 1) {
          const [x, y] = getCordsByUnitIndex(idx, this.sizeX);
          this.renderCoord(cordToKey(x, y));
        }
      });
    }

    ctx.closePath();
  }

  clearLayer() {
    const ctx = this.ctx.layer;
    ctx.clearRect(0, 0, this.width, this.height);
  }

  printFPS(timeRendered) {
    if (this.state === "play") {
      this.updateFpsValue(timeRendered);
    }
  }

  updateGameScreen(params) {
    if (this.state === "play") {
      this.updateScene();
    }
  }

  updateScene() {
    if (this.state === "play") {
      if (this.workerCalc) {
        const messageBody = {
          stateMatrix: this.stateMatrix,
          oldAliveSet: this.currentAliveCoords,
          gameBoardSize: { width: this.sizeX, height: this.sizeY },
          rules: this.rules,
        };
        this.worker.postMessage(messageBody);
        this.workerStartCount = Date.now();
        this.setState("workerCalc");
        return;
      }
      if (this.webGlCalc) {
        this.generationTime = this.countRunTime(() => {
          const { newStateMatrix, changedFields } =
            this.webGlCalc.countNextGeneration(this.stateMatrix);
          this.stateMatrix = newStateMatrix;
          this.changedFields = changedFields;
          this.countAliveCount();
        });
        this.currentGeneration++;
        this.renderTime = this.countRunTime(this.renderLayer.bind(this));
        this.updateDisplayGameInfo(this.getGenerationInfo);
        if (this.aliveCount === 0) {
          this.finish();
        }
      } else {
        this.generationTime = this.countRunTime(this.generateNext.bind(this));
        this.renderTime = this.countRunTime(this.renderLayer.bind(this));
        this.currentGeneration++;
        this.updateDisplayGameInfo(this.getGenerationInfo);
        if (this.aliveCount === 0) {
          this.finish();
        }
      }
    }
  }

  workerUpdateHandler = (event) => {
    if (this.state === "workerCalc") {
      const { newStateMatrix, changedFields, stayAliveFields } = event.data;
      this.stateMatrix = newStateMatrix;
      this.changedFields = changedFields;
      this.countAliveCount();

      // this.aliveCount = this.updateSceneData.aliveSet.size;
      this.setState("play");
      this.generationTime = Date.now() - this.workerStartCount;
      this.workerStartCount = 0;

      this.currentGeneration++;
      this.renderTime = this.countRunTime(this.renderLayer.bind(this));
      this.updateDisplayGameInfo(this.getGenerationInfo);
      if (this.aliveCount === 0 && this.state === "play") {
        this.finish();
      }
    }
  };

  start() {
    this.setState("play");
  }
  pause() {
    this.setState("pause");
  }
  reset() {
    this.clearLayer();
    this.createInitialStateMatrix();
    this.updateSceneData = {};
    this.currentAliveCoords = new Set();
    this.resetRuntimeCounters();
    this.updateDisplayGameInfo(this.getGenerationInfo);
  }
  finish() {
    this.setState("finish");
    this.onFinish();
  }

  updateSize(size) {
    this.reset();
    this.fields = {};
    this.sizeX = size;
    this.sizeY = size;
    this.createFields();
    this.createCacheFigure();
    this.reloadCountEngine();
  }

  startRender() {
    this.nextSceneRenderDelay = convertPerSecToMs(this.maxFps);
    renderInterval && clearInterval(renderInterval);
    this.renderLoop();
  }

  generate() {
    if (this.state !== "play") {
      this.resetRuntimeCounters();
      this.updateDisplayGameInfo(this.getGenerationInfo);
      this.createRandomGeneration();
      this.renderTime = this.countRunTime(this.draw.bind(this));
      this.updateDisplayGameInfo(this.getGenerationInfo);
    }
  }

  initEventListeners() {
    document.addEventListener(CONTROL_PANEL_EVENT_NAME, (e) => {
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
        case "update":
          const { size, maxFps } = e.detail.data;
          if (size) {
            this.updateSize(Number(size));
          }
          if (maxFps) {
            this.maxFps = maxFps;
            this.startRender();
          }
          return;
        case "generate":
          this.generate();
          return;

        default:
          console.error("Unhandled game event!");
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
    const index = getUnitArrayIndex(targetX, targetY, this.sizeX);
    const isAlive = this.stateMatrix[index] === 1;
    if (isAlive) {
      this.stateMatrix[index] = 0;
      this.aliveCount--;
      this.clearCoord(targetCoords);
    } else {
      this.stateMatrix[index] = 1;
      this.aliveCount++;
      this.renderCoord(targetCoords);
    }
    this.updateDisplayGameInfo(this.getGenerationInfo);
  }

  sendInitEvent(data) {
    document.dispatchEvent(
      this.createGameEventMsg({
        type: "init",
        data,
      })
    );
  }

  updateDisplayGameInfo(data) {
    document.dispatchEvent(
      this.createGameEventMsg({
        type: "new-generation",
        data,
      })
    );
  }

  onFinish() {
    document.dispatchEvent(this.createGameEventMsg({ type: "finish" }));
  }

  createGameEventMsg({ type, data }) {
    return new CustomEvent(GAME_EVENT_NAME, {
      detail: {
        type,
        data,
      },
    });
  }

  countAliveCount() {
    this.aliveCount = this.stateMatrix.reduce((a, v) => a + v, 0);
  }

  countRunTime(fn) {
    const startTime = Date.now();
    fn();
    return Date.now() - startTime;
  }

  createCanvasElement({ cn }) {
    const $layer = document.createElement("canvas");
    $layer.classList.add(cn);
    $layer.innerHTML = `Your browser doesn't appear to support the HTML5
      <code>&lt;canvas&gt;</code> element.
      `;
    this._$container.appendChild($layer);
    return $layer;
  }

  createRandomGeneration() {
    this.generationTime = this.countRunTime(
      this.createRandomFirstGeneration.bind(this)
    );
    this.countAliveCount();
  }

  countNextState = (stateMatrix, { width, height }) => {
    const newStateMatrix = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let aliveNeighbors = 0;
        const neighbors = getNeighborsCords(x, y, width);
        neighbors.forEach(([x, y]) => {
          const torX = mod(x, width);
          const torY = mod(y, height);
          const isAlive =
            stateMatrix[getUnitArrayIndex(torX, torY, width)] === 1;
          if (isAlive) {
            aliveNeighbors++;
          }
        });

        const current = stateMatrix[getUnitArrayIndex(x, y, width)];
        let newState = 0;
        if (current === 1) {
          if (aliveNeighbors === 2 || aliveNeighbors === 3) {
            newState = 1;
          }
        } else if (aliveNeighbors == 3) {
          newState = 1;
        }
        newStateMatrix[getUnitArrayIndex(x, y, width)] = newState;
      }
    }

    return newStateMatrix;
  };

  countNextRenderChanges = (oldState, newState, size) => {
    const changedFields = [];
    for (let idx = 0; idx < newState.length; idx++) {
      const [x, y] = getCordsByUnitIndex(idx, size);
      if (newState[idx] === 1) {
        if (oldState[idx] !== 1) {
          changedFields.push({ x, y, state: 1 });
        } else {
          changedFields.push({ x, y, state: 1 });
        }
      } else {
        if (oldState[idx] === 1) {
          changedFields.push({ x, y, state: 0 });
        }
      }
    }
    return {
      changedFields,
    };
  };

  renderCoord(coords) {
    const field = this.fields[coords];
    const { x, y } = field.renderData;
    const img = this.cachedFigure;
    this.ctx.layer.drawImage(img, x, y);
  }

  clearCoord(coords) {
    const field = this.fields[coords];
    const { x, y, dx, dy } = field.renderData;
    this.ctx.layer.clearRect(x, y, dx, dy);
  }

  resetRuntimeCounters() {
    this.currentGeneration = 0;
    this.generationTime = 0;
    this.aliveCount = 0;
    this.renderTime = 0;
  }

  setState(value) {
    this.state = value;
  }

  updateFpsValue = getRenderTimeCounter(
    noOftenThan(
      (value) => this.updateDisplayGameInfo({ fps: 1000 / value }),
      DISPLAY_SPEED_DELAY
    )
  );

  renderLoop() {
    const render = () => {
      this.updateGameScreen();
      renderInterval = setInterval(
        () =>
          requestAnimationFrame((timeRendered) => {
            this.printFPS(timeRendered);
            this.updateGameScreen();
          }),
        this.nextSceneRenderDelay
      );
    };

    render();
  }
}

export const initGame = () => {
  try {
    const game = new Game({
      container: GAME_MAIN_CONTAINER_SELECTOR,
      Figure: Dot,
      randomColor: false,
    });
    game.init();
  } catch (e) {
    console.error(`Game error: ${e}`);
  }
};
