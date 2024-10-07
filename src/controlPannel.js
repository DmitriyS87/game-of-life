import { BASE_UPDATE_FPS, GAME_DEFAULT_AREA_SIZE_X } from "./config.js";
import {
  hideElement,
  unHideElement,
  disableElement,
  enableElement,
  printTextToEl,
} from "./utils.js";

let screenSize = "";
let maxFps = "";
let defaultScreenSize = "";

const createEventToGame = ({ action, data }) =>
  new CustomEvent("life-game-event-controls", {
    detail: {
      action: action,
      data,
    },
  });

const updateInputPlaceholder = (el, value) => {
  el.setAttribute("placeholder", value);
};

const initScreenSizeEventListeners = (gameSizeInput) => {
  try {
    const updateGameBoardSize = (v) =>
      createEventToGame({ action: "update", data: { size: v } });

    gameSizeInput.addEventListener("input", (event) => {
      screenSize = event.target.value;
      if (!/^\d+$/.test(screenSize)) {
        screenSize = screenSize.slice(0, -1);
        gameSizeInput.value = screenSize;
      }
    });

    gameSizeInput.addEventListener("focus", () => {
      screenSize = "";
    });

    gameSizeInput.addEventListener("blur", (e) => {
      const target = e.target;
      const size = Number(screenSize);
      if (Number.isInteger(size) && size >= 2) {
        document.dispatchEvent(updateGameBoardSize(size));
        screenSize = "";
        target.setAttribute("placeholder", size);
        return;
      }
      target.value = "";
      screenSize = GAME_DEFAULT_AREA_SIZE_X;
      target.setAttribute("placeholder", GAME_DEFAULT_AREA_SIZE_X);
      document.dispatchEvent(updateGameBoardSize(GAME_DEFAULT_AREA_SIZE_X));
      console.error("You have to set integer number bigger than 2");
    });
  } catch (e) {
    throw new Error(`Cant init game size controller: ${e}`);
  }
};

const initFPSEventListeners = (gameFpsInput) => {
  try {
    const updateGameMaxFps = (v) =>
      createEventToGame({ action: "update", data: { maxFps: v } });

    gameFpsInput.addEventListener("input", (event) => {
      maxFps = event.target.value;
      if (!/^[\d,\.]+$/.test(maxFps)) {
        maxFps = maxFps.slice(0, -1);
        gameFpsInput.value = maxFps;
      }
    });

    gameFpsInput.addEventListener("blur", (e) => {
      const target = e.target;
      const newValue = Number(maxFps);
      if (!Number.isNaN(newValue) && newValue >= 0.1) {
        document.dispatchEvent(updateGameMaxFps(newValue));
        target.setAttribute("placeholder", newValue);
        return;
      }
      target.value = "";
      maxFps = BASE_UPDATE_FPS;
      target.setAttribute("placeholder", BASE_UPDATE_FPS);
      document.dispatchEvent(updateGameMaxFps(BASE_UPDATE_FPS));
      console.error("You have to set number bigger than 0.1");
    });
  } catch (e) {
    throw new Error(`Cant init game maxFps controller: ${e}`);
  }
};

export const initControlPanel = () => {
  try {
    /* control elements */
    const startBtn = document.querySelector(".ctrl-btn.start");
    const stopBtn = document.querySelector(".ctrl-btn.stop");
    const resetBtn = document.querySelector(".ctrl-btn.reset");
    const generateBtn = document.querySelector(".ctrl-btn.generate");
    const gameControlsForm = document.querySelector(".game__controls");
    const gameSizeInput = document.getElementById("game-size");
    const gameFpsInput = document.getElementById("game-fps");

    /* display elements */
    const displayUpdateFrequency = document.querySelector(".update-time");
    const generationNumber = document.querySelector(".generation-number");
    const generationComputedTime = document.querySelector(
      ".generation-computed"
    );
    const generationRenderTime = document.querySelector(
      ".generation-render-time"
    );
    const generationAliveCount = document.querySelector(
      ".generation-alive-count"
    );

    const startEvent = createEventToGame({ action: "start" });
    const stopEvent = createEventToGame({ action: "stop" });
    const resetEvent = createEventToGame({ action: "reset" });
    const generateEvent = createEventToGame({ action: "generate" });

    const switchStartToStop = () => {
      hideElement(startBtn);
      unHideElement(stopBtn);
      disableElement(startBtn);
    };

    const switchStopToStart = () => {
      hideElement(stopBtn);
      enableElement(startBtn);
      unHideElement(startBtn);
    };

    gameControlsForm.addEventListener("submit", function (e) {
      e.preventDefault();
      e.stopPropagation();
      document.dispatchEvent(startEvent);
      switchStartToStop();
    });
    stopBtn.addEventListener("click", () => {
      document.dispatchEvent(stopEvent);
      switchStopToStart();
    });

    resetBtn.addEventListener("click", () =>
      document.dispatchEvent(resetEvent)
    );
    generateBtn.addEventListener("click", () =>
      document.dispatchEvent(generateEvent)
    );

    initScreenSizeEventListeners(gameSizeInput);
    initFPSEventListeners(gameFpsInput);

    const setInitialGameInfo = ({ size, maxFps }) => {
      defaultScreenSize = size;
      updateInputPlaceholder(gameSizeInput, defaultScreenSize);
      updateInputPlaceholder(gameFpsInput, maxFps);
    };

    document.addEventListener("life-game-runtime-event", (e) => {
      e.stopPropagation();
      switch (e?.detail?.type) {
        case "new-generation":
          const UpdateHandler = {
            current: (data) => printTextToEl(data, generationNumber),
            time: (data) => printTextToEl(data + " ms", generationComputedTime),
            aliveCount: (data) => printTextToEl(data, generationAliveCount),
            renderTime: (data) => printTextToEl(data, generationRenderTime),
            fps: (data) =>
              printTextToEl(data.toFixed(1), displayUpdateFrequency),
          };

          Object.keys(e.detail?.data || {}).forEach(
            (key) =>
              UpdateHandler[key] && UpdateHandler[key](e.detail?.data[key])
          );
          return;
        case "init":
          setInitialGameInfo(e?.detail?.data);
        case "finish":
          switchStopToStart();
          return;
        default:
          console.error("Unhandled game event!");
          return;
      }
    });
  } catch (e) {
    console.error(`Control panel error. ${e}`);
  }
};
