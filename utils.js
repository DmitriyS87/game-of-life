import { HIDDEN_CLASS } from "./config.js";

export const getRenderTimeCounter = (cb) => {
  let prevRenderTime = 0;
  return (newTime) => {
    const delta = newTime - prevRenderTime;
    if (typeof cb === "function") cb(delta);
    prevRenderTime = newTime;
    return delta;
  };
};

export const mixByOptions = (keys, values, options) => {
  keys.forEach((key) => {
    values[key] = options[key] ?? values[key];
  });
  return values;
};

export const extendOffscreenCanvas = ($canvas, name) => {
  $canvas[name] = document.createElement("canvas");
  $canvas[name].width = $canvas.width;
  $canvas[name].height = $canvas.height;
};

export const cordToKey = (x, y) => `${x}:${y}`;
export const keyToCoords = (key) => key.split(":").map(Number);
export const roundToDecimal = (num, dec = 1) =>
  Math.round(num * 10 ** dec) / 10 ** dec;
export const fixBorderCoords = (x, min = 0, max) => {
  if (x < min) {
    return max + x;
  }
  if (x >= max) {
    return x - max;
  }
  return x;
};

export const hideElement = (el) => {
  el.classList.add(HIDDEN_CLASS);
};
export const unHideElement = (el) => {
  el.classList.remove(HIDDEN_CLASS);
};
export const disableElement = (el) => {
  el.setAttribute("disabled", true);
};
export const enableElement = (el) => {
  el.removeAttribute("disabled");
};
export const printTextToEl = (text, el) => {
  el.innerText = text ?? '';
};
export const parseRGBaCords = (arrU8, size) => {
  const result = [];
  for (let i = 0; i < size; i++) {
    let row = [];
    for (let j = 0; j < size; j++) {
      const index = j * 4 + i * 4 * size;
      row.push(arrU8[index]);
    }
    result.push(row);
  }
  return result;
};
export const noOftenThan = (cb, delta = 0) => {
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
export const getRandomColor = () =>
  `rgb(${Math.round(Math.random() * 255)}, ${Math.round(
    Math.random() * 255
  )}, ${Math.round(Math.random() * 255)})`;
export const convertPerSecToMs = (v) => Math.round(1000 / v);
export const getUnitArrayIndex = (x, y, size) => y * size + x;
export const mod = (x, size) => ((x % size) + size) % size;
export const getNeighborsCords = (x, y, size) => {
  const result = [];
  const targets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];
  targets.forEach(([dx, dy]) => {
    const torX = mod(x + dx, size);
    const torY = mod(y + dy, size);
    result.push([torX, torY]);
  });
  return result;
};
export const getCordsByUnitIndex = (idx, size) => {
  const x = idx % size;
  return [x, (idx - x) / size]
}