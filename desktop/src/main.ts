import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");

// Float ball: toggle main window
import { getCurrentWindow, getAllWindows } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

listen("floatball-click", async () => {
  const win = getCurrentWindow();
  const visible = await win.isVisible();
  if (visible) {
    await win.hide();
  } else {
    await win.show();
    await win.setFocus();
  }
});

// When main window closes, close floatball too
getCurrentWindow().onCloseRequested(async () => {
  const wins = await getAllWindows();
  for (const w of wins) {
    if (w.label === "floatball") {
      await w.close();
    }
  }
});
