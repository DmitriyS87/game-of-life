const getUnitArrayIndex = (x, y, size) => y * size + x;
const getCordsByUnitIndex = (idx, size) => {
  const x = idx % size;
  return [x, (idx - x) / size];
};
const mod = (x, size) => ((x % size) + size) % size;
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

const countNextState = (stateMatrix, { width, height }) => {
  const newStateMatrix = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let aliveNeighbors = 0;
      const neighbors = getNeighborsCords(x, y, width);
      neighbors.forEach(([x, y]) => {
        const isAlive = stateMatrix[getUnitArrayIndex(x, y, width)] === 1;
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

const countNextRenderChanges = (oldState, newState, size) => {
  const changedFields = [];
  for (let idx = 0; idx < newState.length; idx++) {
    const [x, y] = getCordsByUnitIndex(idx, size);
    if (newState[idx] === 1) {
      if (oldState[idx] !== 1) {
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

const calculateNextScene = ({ stateMatrix, gameBoardSize }) => {
  const newStateMatrix = countNextState(stateMatrix, gameBoardSize);
  const { changedFields } = countNextRenderChanges(
    stateMatrix,
    newStateMatrix,
    gameBoardSize.width
  );
  return {
    changedFields,
    newStateMatrix,
  };
};

self.onmessage = function (event) {
  try {
    const data = event.data;
    const result = calculateNextScene(data);

    self.postMessage(result);
  } catch (e) {
    throw new Error(`WORKER ERROR ${e}`);
  }
};
