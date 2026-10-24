import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import LoginPage from "./pages/LoginPage.vue";
import WorkspacePage from "./pages/WorkspacePage.vue";
import PublicPage from "./pages/PublicPage.vue";
import "./style.css";
import { ensureDevSession } from "./api/autoLogin";

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
const app = createApp(App).use(router);
// 测试阶段:本地配置了自动登录账号时先建立会话再挂载,页面初始即为已登录状态(见 api/autoLogin.ts)。
ensureDevSession().finally(() => app.mount("#app"));
