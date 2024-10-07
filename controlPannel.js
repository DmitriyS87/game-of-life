import {
  BASE_UPDATE_FPS,
  CONTROL_PANEL_EVENT_NAME,
  GAME_CONTROL_FPS_ID,
  GAME_CONTROL_GENERATE,
  GAME_CONTROL_RESET,
  GAME_CONTROL_SIZE_ID,
  GAME_CONTROL_START,
  GAME_CONTROL_STOP,
  GAME_CONTROLS_FORM,
  GAME_DEFAULT_AREA_SIZE_X,
  GAME_DISPLAY_ALIVE_COUNT,
  GAME_DISPLAY_GEN_COUNT,
  GAME_DISPLAY_TIME_COUNT,
  GAME_DISPLAY_TIME_RENDER,
  GAME_DISPLAY_UPD_TIME,
  GAME_EVENT_NAME,
} from "./config.js";
import {
  hideElement,
  unHideElement,
  disableElement,
  enableElement,
  printTextToEl,
} from "./utils.js";

let screenSizeValue = "";
let maxFpsValue = "";
let defaultScreenSize = "";

export const initControlPanel = () => {
  try {
    /* control elements */
    const gameControlsForm = document.querySelector(GAME_CONTROLS_FORM);
    const startBtn = document.querySelector(GAME_CONTROL_START);
    const stopBtn = document.querySelector(GAME_CONTROL_STOP);
    const resetBtn = document.querySelector(GAME_CONTROL_RESET);
    const generateBtn = document.querySelector(GAME_CONTROL_GENERATE);
    const gameSizeInput = document.getElementById(GAME_CONTROL_SIZE_ID);
    const gameFpsInput = document.getElementById(GAME_CONTROL_FPS_ID);

    /* display elements */
    const displayUpdateFrequency = document.querySelector(GAME_DISPLAY_UPD_TIME);
    const generationNumber = document.querySelector(GAME_DISPLAY_GEN_COUNT);
    const generationComputedTime = document.querySelector(GAME_DISPLAY_TIME_COUNT);
    const generationRenderTime = document.querySelector(GAME_DISPLAY_TIME_RENDER);
    const generationAliveCount = document.querySelector(GAME_DISPLAY_ALIVE_COUNT);

    /* control panel events */
    const startEvent = createControlPanelEventMsg({ action: "start" });
    const stopEvent = createControlPanelEventMsg({ action: "stop" });
    const resetEvent = createControlPanelEventMsg({ action: "reset" });
    const generateEvent = createControlPanelEventMsg({ action: "generate" });

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

    document.addEventListener(GAME_EVENT_NAME, (e) => {
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

function initScreenSizeEventListeners(gameSizeInput) {
  try {
    const updateGameBoardSize = (v) =>
      createControlPanelEventMsg({ action: "update", data: { size: v } });

    gameSizeInput.addEventListener("input", (event) => {
      screenSizeValue = event.target.value;
      if (!/^\d+$/.test(screenSizeValue)) {
        screenSizeValue = screenSizeValue.slice(0, -1);
        gameSizeInput.value = screenSizeValue;
      }
    });

    gameSizeInput.addEventListener("focus", () => {
      screenSizeValue = "";
    });

    gameSizeInput.addEventListener("blur", (e) => {
      const target = e.target;
      const size = Number(screenSizeValue);
      if (Number.isInteger(size) && size >= 2) {
        document.dispatchEvent(updateGameBoardSize(size));
        screenSizeValue = "";
        target.setAttribute("placeholder", size);
        return;
      }
      target.value = "";
      screenSizeValue = GAME_DEFAULT_AREA_SIZE_X;
      target.setAttribute("placeholder", GAME_DEFAULT_AREA_SIZE_X);
      document.dispatchEvent(updateGameBoardSize(GAME_DEFAULT_AREA_SIZE_X));
      console.error("You have to set integer number bigger than 2");
    });
  } catch (e) {
    throw new Error(`Cant init game size controller: ${e}`);
  }
}

function initFPSEventListeners(gameFpsInput) {
  try {
    const updateGameMaxFps = (v) =>
      createControlPanelEventMsg({ action: "update", data: { maxFps: v } });

    gameFpsInput.addEventListener("input", (event) => {
      maxFpsValue = event.target.value;
      if (!/^[\d,\.]+$/.test(maxFpsValue)) {
        maxFpsValue = maxFpsValue.slice(0, -1);
        gameFpsInput.value = maxFpsValue;
      }
    });

    gameFpsInput.addEventListener("blur", (e) => {
      const target = e.target;
      const newValue = Number(maxFpsValue);
      if (!Number.isNaN(newValue) && newValue >= 0.1) {
        document.dispatchEvent(updateGameMaxFps(newValue));
        target.setAttribute("placeholder", newValue);
        return;
      }
      target.value = "";
      maxFpsValue = BASE_UPDATE_FPS;
      target.setAttribute("placeholder", BASE_UPDATE_FPS);
      document.dispatchEvent(updateGameMaxFps(BASE_UPDATE_FPS));
      console.error("You have to set number bigger than 0.1");
    });
  } catch (e) {
    throw new Error(`Cant init game maxFps controller: ${e}`);
  }
}

function createControlPanelEventMsg({ action, data }) {
  return new CustomEvent(CONTROL_PANEL_EVENT_NAME, {
    detail: {
      action: action,
      data,
    },
  });
}

function updateInputPlaceholder(el, value) {
  el.setAttribute("placeholder", value);
}
