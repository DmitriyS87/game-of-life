import { GAME_DEFAULT_AREA_SIZE_X } from "./config.js";
import {
  hideElement,
  unHideElement,
  disableElement,
  enableElement,
  printTextToEl,
} from "./utils.js";

const createEventToGame = ({action, data}) => new CustomEvent("life-game-event-controls", {
  detail: {
    action: action,
    data
  },
});

export const initControlPanel = () => {
    try {
      /* control elements */
      const startBtn = document.querySelector(".ctrl-btn.start");
      const stopBtn = document.querySelector(".ctrl-btn.stop");
      const resetBtn = document.querySelector(".ctrl-btn.reset");
      const generateBtn = document.querySelector(".ctrl-btn.generate");
      const gameControlsForm = document.querySelector(".game__controls");
      const gameSizeInput = document.querySelector(".game-size__input");
  
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

      const startEvent = createEventToGame({action: "start"});
      const stopEvent = createEventToGame({action: "stop"});
      const resetEvent = createEventToGame({action: "reset"});
      const generateEvent = createEventToGame({action: "generate"});

      const updateGameBoardSize = (v) => createEventToGame({action: "update", data: {size : v}});
  
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
      gameSizeInput
      gameSizeInput.addEventListener('change', (e) => {
        e.stopPropagation();
        const target = e?.target;
        const size = parseInt(target?.value, 10);
        if (Number.isInteger(size) && size > 2) {
          updateGameBoardSize(size);
          return
        }
        target.value = GAME_DEFAULT_AREA_SIZE_X;
        target.setAttribute("placeholder", GAME_DEFAULT_AREA_SIZE_X)
        console.error('You have to set integer number bigger than 2');
      })

      document.addEventListener("life-game-runtime-event", (e) => {
        e.stopPropagation();
        switch (e?.detail?.type) {
          case "new-generation":
            const UpdateHandler = {
              current: (data) => printTextToEl(data, generationNumber),
              time: (data) => printTextToEl(data + " ms", generationComputedTime),
              aliveCount: (data) => printTextToEl(data, generationAliveCount),
              renderTime: (data) => printTextToEl(data, generationRenderTime),
              fps: (data) => printTextToEl(data.toFixed(1), displayUpdateFrequency),
            };

            Object.keys(e.detail?.data || {}).forEach(
              (key) =>
                UpdateHandler[key] && UpdateHandler[key](e.detail?.data[key])
            );
            return;
          case "finish":
            switchStopToStart();
            return;
          default:
            console.error("Unhandled game event!");
            return;
        }
      });
    } catch (e) {
      console.error(`Control panel error. ${e}`)
    }
  };