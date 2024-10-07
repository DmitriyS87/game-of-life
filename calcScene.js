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
const countNeighbors = (coordsSet, gameBoardSize) => {
  const result = new Map();
  coordsSet.forEach((coords) => {
    const [x, y] = keyToCoords(coords);
    const neighbors = getNeighborsCoords(x, y, gameBoardSize.width, gameBoardSize.height);

    neighbors.forEach((coords) => {
      if (!result.has(coords)) {
        result.set(coords, 0);
      }
      result.set(coords, result.get(coords) + 1);
    });
  });
  return result;
};


const calculateNextScene = ({oldAliveSet, gameBoardSize, rules}) => {
  let coordsToHide = null;
  let coordsToRender = null;

  const newAliveCoords = new Set();
  const survivedCoords = new Set();
  let deadCoords = new Set();

  const countedNeighbors = countNeighbors(oldAliveSet, gameBoardSize);

  countedNeighbors.forEach((count, coords) => {
    const isAlive = oldAliveSet.has(coords);
    if (isAlive) {
      oldAliveSet.delete(coords);
      const { maxAlive, minAlive } = rules[1];
      if (count >= minAlive && count <= maxAlive) {
        survivedCoords.add(coords);
      } else {
        deadCoords.add(coords);
      }
    } else {
      const { aliveMinCount } = rules[0];
      if (count === aliveMinCount) {
        newAliveCoords.add(coords);
      }
    }
  });

  if (oldAliveSet.size) {
    deadCoords = new Set([...deadCoords, ...oldAliveSet]);
  }

  const aliveSet = new Set([...survivedCoords, ...newAliveCoords]);
  coordsToHide = deadCoords;
  coordsToRender = newAliveCoords;
  return {
    coordsToHide,
    coordsToRender,
    aliveSet
  }
}

self.onmessage = function (event) {
  const data = event.data;
  const result = calculateNextScene(data);

  self.postMessage(result);
};
