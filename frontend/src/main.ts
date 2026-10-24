import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import LoginPage from "./pages/LoginPage.vue";
import WorkspacePage from "./pages/WorkspacePage.vue";
import PublicPage from "./pages/PublicPage.vue";
import "./style.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: WorkspacePage },
    { path: "/login", component: LoginPage },
    { path: "/public", component: PublicPage },
    { path: "/public/:token", component: PublicPage },
    { path: "/surveys/new", component: () => import("./pages/SurveyEditorPage.vue") },
    { path: "/surveys/:id/edit", component: () => import("./pages/SurveyEditorPage.vue") },
    { path: "/surveys/:id/results", component: () => import("./pages/ResultsPage.vue") },
    {
      path: "/statistics",
      component: () => import("./pages/StatisticsPage.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
createApp(App).use(router).mount("#app");
