let updateDisplayEl;
let nextTimeout;

const BASE_UPDATE_FPS = 60;
const DISPLAY_SPEED_DELAY = 300;
const POINT_COLOR_DEFAULT = "#f5f5f5";

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

const mixByOptions = (keys, values, options) =>
  [...keys].reduce((acc, key) => {
    return { ...acc, [key]: options[key] ?? values[key] };
  }, {});

const extendOffscreenCanvas = ($canvas, name) => {
  $canvas[name] = document.createElement("canvas");
  $canvas[name].width = $canvas.width;
  $canvas[name].height = $canvas.height;
};

const cordToKey = (x, y) => `${x}:${y}`;
const keyToCords = (key) => key.split(":");


// const getMaxValue = () => {
//     let maxValue = 0;
//     return (value, clear) => {
//         if (clear) maxValue = 0;
//         if (value > maxValue) {
//             maxValue = value;
//         }
//         return maxValue;
//     }
// }

const roundToDecimal = (num, dec = 1) =>
  Math.round(num * 10 ** dec) / 10 ** dec;

const getColor = () =>
  `rgb(${Math.round(Math.random() * 255)}, ${Math.round(
    Math.random() * 255
  )}, ${Math.round(Math.random() * 255)})`;

class Point {
  constructor(ctx, x, y, dx, dy, color) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.color = color ?? POINT_COLOR_DEFAULT;
    this.ctxWidth = ctx.canvas.width;
    this.ctxHeight = ctx.canvas.height;
  }

  clear() {
    const { ctx, x, y, dx, dy } = this;
    ctx.clearRect(x, y, dx, dy);
  }

  draw(options = {}) {
    const { ctx, x, y, dx, dy, color } = mixByOptions(
      ["ctx", "x", "y", "dx", "dy", "color"],
      this,
      options
    );
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, dx, dy);
    ctx.restore();
  }

  correctToBorders() {
    if (this.x + this.dx > this.ctxWidth) {
      this.x = 0;
    }
    if (this.y + this.dy > this.ctxHeight) {
      this.y = 0;
    }
    if (this.x < 0) {
      this.x = this.ctxWidth;
    }
    if (this.y < 0) {
      this.y = this.ctxHeight;
    }
  }

  update(params) {
    this.clear();
    [...Object.keys(params)].forEach((key) => (this[key] = params[key]));
    this.correctToBorders();
    this.draw();
  }
}

const includeFieldWithNeighbors = (x, y) => {
  const result = [];
  [-1, 0, 1].forEach((i) => {
    [-1, 0, 1].forEach((j) => {
      result.push(`${Number(x) + i}:${Number(y) + j}`);
    });
  });
  return result;
};

const fixBorderCoords = (x, min = 0, max) => {
  if (x <= min) {
    return max + x;
  }
  if (x > max) {
    return x - max;
  }
  return x;
};

const getNeighborsCords = (x, y, maxX, maxY) => {
  const result = [];
  [-1, 0, 1].forEach((i) => {
    [-1, 0, 1].forEach((j) => {
      if (i !== 0 && j !== 0) {
        result.push(`${fixBorderCoords(Number(x) + i, 0, maxX)}:${fixBorderCoords(Number(y) + j, 0, maxY)}`);
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
    width: 640,
    height: 480,
  };
  aliveColor = "red";
  deadColor = "gray";

  constructor({ sizeX, sizeY, container }) {
    this.container = container;
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.fields = {};
    this.bgRenderMode = 0;
    this.history = [];
    this.defaultStateMatrix = Array.from({ length: sizeY }, () =>
      Array(sizeX).fill(0)
    );
    this.aliveCordsSet = null;
    this.stateMatrix = [];
    this.updateMatrix = [];
    this.rules = {
      0: {
        aliveMinCount: 3,
      },
      1: {
        minAlive: 2,
        maxAlive: 3,
      },
    };

    this.init();
  }

  createCanvasElement({ cn }) {
    const $background = document.createElement("canvas");
    $background.classList.add(cn);
    $background.innerHTML = `Your browser doesn't appear to support the HTML5
    <code>&lt;canvas&gt;</code> element.
    `;
    this._$container.appendChild($background);
    return $background;
  }

  createCanvas() {
    this._$container = document.querySelector(".game__screen");
    const { width, height } = this._$container.getBoundingClientRect();
    const gameWidth =
      Math.max(width, this.defaultCanvasSize.width) - this.screenPadding.xY * 2;
    const gameHeight =
      Math.max(height, this.defaultCanvasSize.height) -
      this.screenPadding.tB * 2;
    this.bgCanvas = this.createCanvasElement({
      cn: "game-background",
    });
    this.layerCanvas = this.createCanvasElement({
      cn: "game-layer",
    });
    this.bgCanvas.width = this.layerCanvas.width = gameWidth;
    this.bgCanvas.height = this.layerCanvas.height = gameHeight;
    this.ctx = {
      bg: this.bgCanvas.getContext("2d", { alpha: false }),
      layer: this.layerCanvas.getContext("2d"),
    };
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

  prepareBgCache() {
    Object.entries(this.fields).forEach(([key, point], idx) => {
      // point.draw({ctx: this.bgCanvas.offscreenCanvasDead.getContext('2d')});
      point.draw({
        ctx: this.bgCanvas.offscreenCanvasDead.getContext("2d"),
        color: this.deadColor,
      });
      point.draw({
        ctx: this.bgCanvas.offscreenCanvasAlive.getContext("2d"),
        color: this.aliveColor,
      });
    });
  }

  initEventListeners() {
    document.addEventListener("life-game-event", (e) => {
      e.stopPropagation();
      switch (e?.detail?.action) {
        case "start":
          this.start();
          return;
        case "pause":
          this.pause();
          return;
        case "finish":
          this.finish();
          return;
        case "generate":
          this.generate();
          return;

        default:
          console.error("unhandled game event!");
          return;
      }
    });
  }

  init() {
    this.createCanvas();
    this.createFields();
    this.prepareBgCache();
    this.renderBg();
    this.initEventListeners();
  }

  createFields() {
    const { ctx, sizeX, sizeY, width, height } = this;
    this._pointWidth = roundToDecimal(width / sizeX);
    this._pointHeight = roundToDecimal(height / sizeY);
    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        const positionX = x * this._pointWidth;
        const positionY = y * this._pointHeight;
        this.fields[`${x}:${y}`] = new Point(
          ctx.layer,
          positionX,
          positionY,
          this._pointWidth,
          this._pointHeight,
          getColor()
        );
      }
    }
  }

  clear() {
    const { ctx, width, height } = this;
    ctx.bg.clearRect(0, 0, width, height);
    ctx.layer.clearRect(0, 0, width, height);
  }

  createRandomFirstGeneration() {
    this.aliveCordsSet = new Set();
    this.stateMatrix = [...this.defaultStateMatrix].map((row, x) => {
      return row.map((el, y) => {
        const val = Math.random() < 0.9 ? 0 : 1;
        if (val === 1) this.aliveCordsSet.add(cordToKey(x, y));
        // if (val) this.updateMatrix.push({ [cordToKey(row, el)]: 1 });
      });
    });

    console.log("generate", { initial: this.aliveCordsSet });
    this.setState("renderGenerated");
  }

  generateNext() {
    const newAliveSet = new Set();
    const countedNeighbors = {};
    this.aliveCordsSet.forEach((cords) => {
      const [x, y] = keyToCords(cords);
      const neighbors = getNeighborsCords(x, y, this.sizeX, this.sizeY);
      neighbors.forEach((cords) => {
        if (!countedNeighbors[cords]) {
          countedNeighbors[cords] = 0
        }
        countedNeighbors[cords]++
      })
    })
    for (const [cords, count] of Object.entries(countedNeighbors)) {
      const isAlive = this.aliveCordsSet.has(cords);
      if (isAlive) {
        const { maxAlive, minAlive } = this.rules[1];
        if (count >= minAlive && count <= maxAlive) {
          newAliveSet.add(cords);
        }
      } else {
        const { aliveMinCount } = this.rules[0];
        if (count === aliveMinCount) {
          newAliveSet.add(cords);
        }
      }
    }
    this.aliveCordsSet = newAliveSet;
  }

  clearLayer() {
    const ctx = this.ctx.layer;
    ctx.clearRect(0,0, this.width, this.height);
  }

  renderLayer(aliveCords) {
    // ! unused ctx here - field has own on created
    const ctx = this.ctx.layer;
    aliveCords.forEach((cords) => {
      const field = this.fields[cords];
      field.draw({ ctx, color: this.aliveColor });
    })
  }

  draw() {
    this.clear();
    this.renderBg();
    this.renderLayer(this.aliveCordsSet);
  }

  updateScene() {
    const startTime = Date.now();
    this.generateNext();
    const countingTime = (Date.now() - startTime).toFixed(3) + " ms";
    console.log("countingTime:  ", countingTime)
    this.clearLayer();
    this.renderLayer(this.aliveCordsSet);
    if (this.aliveCordsSet.size === 0) {
      this.setState("finish");
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
    this.setState("play");
  }
  pause() {
    this.setState("pause");
  }
  finish() {
    this.setState("finish");
  }
  generate() {
    if (this.state !== "play") {
      this.createRandomFirstGeneration();
      this.draw();
    }
  }
  togglePoint() {

  }
}

const initControlPanel = () => {
  const startBtn = document.querySelector(".ctrl-btn.start");
  const pauseBtn = document.querySelector(".ctrl-btn.pause");
  const finishBtn = document.querySelector(".ctrl-btn.finish");
  const generateBtn = document.querySelector(".ctrl-btn.generate");

  const startEvent = new CustomEvent("life-game-event", {
    detail: {
      action: "start",
    },
  });
  const pauseEvent = new CustomEvent("life-game-event", {
    detail: {
      action: "pause",
    },
  });
  const finishEvent = new CustomEvent("life-game-event", {
    detail: {
      action: "finish",
    },
  });
  const generateEvent = new CustomEvent("life-game-event", {
    detail: {
      action: "generate",
    },
  });

  startBtn.addEventListener("click", () => document.dispatchEvent(startEvent));
  pauseBtn.addEventListener("click", () => document.dispatchEvent(pauseEvent));
  finishBtn.addEventListener("click", () =>
    document.dispatchEvent(finishEvent)
  );
  generateBtn.addEventListener("click", () =>
    document.dispatchEvent(generateEvent)
  );

  updateDisplayEl = document.querySelector(".update-time");
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
    const printUpdateTime = (timeDelta) => {
      updateDisplayEl.innerText = timeDelta.toFixed(1) + "ms";
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

    const printTime = getRenderTimeCounter(
      noOftenThan(printUpdateTime, DISPLAY_SPEED_DELAY)
    );

    const game = new Game({ sizeX: 20, sizeY: 20, container: "game__screen" });
    game.init();
    // have to move it inside game
    const render = () => {
      game.updateGameScreen();

      nextTimeout = setTimeout(
        () =>
          requestAnimationFrame((timeRendered) => {
            clearTimeout(nextTimeout);
            printTime(timeRendered);
            render();
          }),
        nextSceneRenderDelay
      );
    };

    render();
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
