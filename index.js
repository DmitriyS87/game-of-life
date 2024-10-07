import { initControlPanel } from "./controlPanel.js";
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
