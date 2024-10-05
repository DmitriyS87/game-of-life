import {
  GAME_MAIN_CONTAINER_SELECTOR,
} from "./config.js";

import { initControlPanel } from "./controlPannel.js";
import { Dot } from "./figures.js";
import { Game } from "./game.js";

let worker = null;
try {
  worker = new Worker("calcScene.js");
} catch (e) {
  console.log("Worker api is not supported", e);
}

const initGame = () => {
  try {
    const game = new Game({
      container: GAME_MAIN_CONTAINER_SELECTOR,
      Figure: Dot,
      randomColor: false,
      worker,
    });
    game.init();
  } catch (e) {
    console.error(`Game error: ${e}`);
  }
};

const init = () => {
  try {
    initControlPanel();
    initGame();
  } catch (e) {
    console.error("Something went wrong! ", e);
  }
};

document.addEventListener("readystatechange", (e) => {
  if (document.readyState === "complete") {
    init();
  }
});
