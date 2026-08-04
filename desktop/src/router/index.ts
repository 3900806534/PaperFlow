import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("../views/HomeView.vue"),
    },
    {
      path: "/paper/:id",
      name: "paper-detail",
      component: () => import("../views/PaperDetail.vue"),
    },
    {
      path: "/practice/:paperId",
      name: "practice",
      component: () => import("../views/PracticeView.vue"),
    },
    {
      path: "/wrongbook",
      name: "wrongbook",
      component: () => import("../views/WrongBook.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("../views/SettingsView.vue"),
    },
  ],
});

export default router;
