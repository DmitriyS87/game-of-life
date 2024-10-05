import {
  getRenderTimeCounter,
  extendOffscreenCanvas,
  cordToKey,
  keyToCoords,
  roundToDecimal,
  fixBorderCoords,
  noOftenThan,
  getRandomColor,
} from "./utils.js";

import {
  GAME_ALIVE_COLOR,
  GAME_DEAD_COLOR,
  GAME_DEFAULT_AREA_SIZE_X,
  GAME_DEFAULT_AREA_SIZE_Y,
  GAME_CANVAS_WIDTH_DEFAULT,
  GAME_CANVAS_HEIGHT_DEFAULT,
  DISPLAY_SPEED_DELAY,
  nextSceneRenderDelay,
} from "./config.js";

import { WebGlCountGame } from "./webGl.js";

let nextTimeout;
let start = null;

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

class Field {
  constructor(x, y, dx, dy, color) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.color = color;
    //! looks like not needed
    this.isAlive = false;
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

  constructor({
    sizeX,
    sizeY,
    container,
    Figure = Dot,
    randomColor = false,
    worker,
  }) {
    this.state = "init";
    this.worker = worker;
    this.container = container;
    this.sizeX = sizeX ?? GAME_DEFAULT_AREA_SIZE_X;
    this.sizeY = sizeY ?? GAME_DEFAULT_AREA_SIZE_Y;
    this.Field = Field;
    this.Figure = Figure;
    this.randomColor = randomColor;

    this.fields = new Map();
    this.bgRenderMode = 0;
    this.history = [];
    this.defaultStateMatrix = Array.from({ length: this.sizeY }, () =>
      Array(this.sizeX).fill(0)
    );
    this.currentAliveCoords = new Set();
    this.updateSceneData = {};
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
  }

  get getGenerationInfo() {
    return {
      current: this.currentGeneration,
      time: this.generationTime,
      aliveCount: this.aliveCount,
      renderTime: this.renderTime,
    };
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
    const isAlive = this.currentAliveCoords.has(targetCoords);
    if (isAlive) {
      this.currentAliveCoords.delete(targetCoords);
      this.clearCoord(targetCoords);
    } else {
      this.currentAliveCoords.add(targetCoords);
      this.renderCoord(targetCoords);
    }
  }

  createCashFigure() {
    this.figure = new this.Figure({ mW: 100, mH: 100 });
  }

  workerUpdateHandler = (event) => {
    if (this.state === "calculation") {
      this.updateSceneData = event.data;
      this.currentGeneration++;
      this.aliveCount = this.updateSceneData.aliveSet.size;
      this.setState("play");
      this.generationTime = Date.now() - this.workerStartCount;
      this.workerStartCount = 0;
      this.renderTime = this.countRunTime(this.renderLayer.bind(this));
      this.updateGameInfo(this.getGenerationInfo);
      if (this.aliveCount === 0) {
        this.finish();
      }
    }
  };

  initWorker() {
    this.worker.onmessage = this.workerUpdateHandler;
  }

  init() {
    if (WebGlCountGame) {
      this.webGlCalc = new WebGlCountGame({
        x: this.sizeX,
        y: this.sizeY,
      });
    } else if (this.worker) {
      this.workerCalc = true;
      this.initWorker();
    }

    this.createCanvas();
    this.createFields();
    this.createCashFigure();
    this.initEventListeners();
    this.renderLoop();
  }

  updateFpsValue = getRenderTimeCounter(
    noOftenThan(
      (value) => this.updateGameInfo({ fps: 1000 / value }),
      DISPLAY_SPEED_DELAY
    )
  );

  printFPS(timeRendered) {
    if (this.state === "play") {
      this.updateFpsValue(timeRendered);
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

  createFields() {
    const Field = this.Field;
    const decimalsCount = Math.round(
      Math.max(
        GAME_DEFAULT_AREA_SIZE_X / this.width,
        GAME_DEFAULT_AREA_SIZE_Y / this.height,
        1
      )
    );
    const { ctx, sizeX, sizeY, width, height, randomColor } = this;
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
        const positionX = x * this._fieldWidth;
        const positionY = y * this._fieldHeight;
        this.fields.set(
          `${x}:${y}`,
          new Field(
            positionX,
            positionY,
            this._fieldWidth,
            this._fieldHeight,
            randomColor ? getRandomColor() : this.aliveColor
          )
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
    this.generationTime = 0;
    this.aliveCount = 0;
    this.renderTime = 0;
  }

  createRandomFirstGeneration() {
    this.currentGeneration = 1;
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

    const currentAliveCoords = new Set([...survivedCoords, ...newAliveCoords]);
    this.currentGeneration++;
    this.aliveCount = currentAliveCoords.size;

    this.updateSceneData = {
      coordsToHide: deadCoords,
      coordsToRender: newAliveCoords,
      aliveSet: currentAliveCoords,
    };
  }

  clearLayer() {
    const ctx = this.ctx.layer;
    ctx.clearRect(0, 0, this.width, this.height);
  }

  reset() {
    this.clearLayer();
    this.updateSceneData = {};
    this.currentAliveCoords = new Set();
    this.currentGeneration = 0;
    this.resetGameInfo();
  }

  resetGameInfo() {
    this.currentGeneration = 0;
    this.generationTime = 0;
    this.aliveCount = 0;
    this.renderTime = 0;
    this.updateGameInfo(this.getGenerationInfo);
  }

  drawFieldImg(img, x, y) {
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
      ctx.drawImage(image, x + offsetX, y + offsetY, drawWidth, drawHeight);
    }

    drawImageContain(
      this.ctx.layer,
      img,
      x,
      y,
      this._fieldWidth,
      this._fieldHeight
    );
  }

  renderCoord(coords) {
    const field = this.fields.get(coords);
    const { x, y, color } = field.renderData;
    const img = this.figure.getImage();
    this.drawFieldImg(img, x, y);
  }

  clearCoord(coords) {
    const field = this.fields.get(coords);
    const { x, y, dx, dy } = field.renderData;
    this.ctx.layer.clearRect(x, y, dx, dy);
  }

  renderLayer() {
    const ctx = this.ctx.layer;
    ctx.beginPath();
    if (
      this.updateSceneData.coordsToHide ||
      this.updateSceneData.coordsToRender
    ) {
      const { aliveSet, coordsToHide, coordsToRender } = this.updateSceneData;
      coordsToRender.forEach((coords) => {
        this.renderCoord(coords);
      });
      coordsToHide.forEach((coords) => {
        this.clearCoord(coords);
      });
      this.currentAliveCoords = new Set([...aliveSet]);
    } else {
      const aliveCoords = this.currentAliveCoords;
      aliveCoords.forEach((coords) => {
        this.renderCoord(coords);
      });
    }
    ctx.closePath();
  }

  draw() {
    this.clear();
    this.countRunTime(this.renderLayer.bind(this));
  }

  countRunTime(fn) {
    const startTime = Date.now();
    fn();
    return Date.now() - startTime;
  }

  updateScene() {
    if (this.state === "play") {
      if (this.webGlCalc) {
        this.generationTime = this.countRunTime(() => {
          this.currentAliveCoords = this.webGlCalc.countAliveSet(
            this.currentAliveCoords
          );
        });
        this.clear();
        this.currentGeneration++;
        this.aliveCount = this.currentAliveCoords.size;
        this.renderTime = this.countRunTime(this.renderLayer.bind(this));
        this.updateGameInfo(this.getGenerationInfo);
        if (this.currentAliveCoords.size === 0 && this.state === "play") {
          this.finish();
        }
      } else if (this.workerCalc) {
        const messageBody = {
          oldAliveSet: this.currentAliveCoords,
          gameBoardSize: { width: this.sizeX, height: this.sizeY },
          rules: this.rules,
        };
        this.worker.postMessage(messageBody);
        this.workerStartCount = Date.now();
        this.setState("calculation");
      } else {
        this.generationTime = this.countRunTime(this.generateNext.bind(this));
        this.renderTime = this.countRunTime(this.renderLayer.bind(this));
        this.updateGameInfo(this.getGenerationInfo);
        if (this.currentAliveCoords.size === 0 && this.state === "play") {
          this.finish();
        }
      }
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
    this.setState("play");
  }
  pause() {
    this.setState("pause");
  }
  finish() {
    this.setState("finish");
    this.onFinish();
  }
  createRandomGeneration() {
    this.generationTime = this.countRunTime(
      this.createRandomFirstGeneration.bind(this)
    );
  }
  generate() {
    if (this.state !== "play") {
      this.resetRuntimeCounters();
      this.updateGameInfo(this.getGenerationInfo);
      this.createRandomGeneration();
      this.renderTime = this.countRunTime(this.draw.bind(this));
      this.updateGameInfo(this.getGenerationInfo);
    }
  }
  togglePoint() {}

  updateGameInfo(data) {
    const newGenerationEvent = new CustomEvent("life-game-runtime-event", {
      detail: {
        type: "new-generation",
        data,
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
