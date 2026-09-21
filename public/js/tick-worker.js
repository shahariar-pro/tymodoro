/**
 * tick-worker.js - Web Worker tick timer
 * Emits tick messages every 250ms independent of main thread tab throttling.
 */
let intervalId = null;

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "start") {
    if (!intervalId) {
      intervalId = setInterval(() => {
        self.postMessage("tick");
      }, 250);
    }
  } else if (data === "stop") {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
});
