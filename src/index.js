import { GAME_MAIN_CONTAINER_SELECTOR } from "./config.js";

import { initControlPanel } from "./controlPannel.js";
import { Dot } from "./figures.js";
import { Game } from "./game.js";

const initGame = () => {
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
