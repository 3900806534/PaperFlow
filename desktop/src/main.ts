import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");

// Toggle main window when floatball clicked
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
    console.error(e);
  }
});
