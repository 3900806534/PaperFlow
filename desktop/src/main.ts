import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");

// Float ball: robust two-way communication
import { getCurrentWindow, getAllWindows } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";

// Toggle main window when floatball is clicked
listen("floatball-click", async () => {
  const win = getCurrentWindow();
  try {
    const visible = await win.isVisible();
    if (visible) {
      await win.hide();
    } else {
      await win.show();
      await win.setFocus();
    }
  } catch (e) {
    console.error("Toggle window failed:", e);
  }
});

// Sync session state to floatball whenever it asks
listen("floatball-ready", async () => {
  try {
    const { usePaperStore } = await import("./stores/paper");
    const store = usePaperStore();
    const unanswered = (store.questionCount || 0) - (store.answeredCount || 0);
    await emit("session-updated", { unanswered: Math.max(0, unanswered) });
  } catch (e) {}
});

// Clean shutdown: close floatball when main window closes
getCurrentWindow().onCloseRequested(async () => {
  try {
    const wins = await getAllWindows();
    for (const w of wins) {
      if (w.label === "floatball") {
        await w.destroy();
      }
    }
  } catch (e) {}
});
