import { initControlPanel } from "./controlPannel.js";
import { initGame } from "./game.js";

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
