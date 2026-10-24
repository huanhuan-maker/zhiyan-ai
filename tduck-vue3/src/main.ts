import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/dist/index.css";
import "./style.css";
import App from "./App.vue";
import { router, safeRedirect } from "./router";
import { useAuth } from "./stores/auth";
import { onSessionExpired } from "./api";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
onSessionExpired((token) => {
  const auth = useAuth();
  if (auth.token !== token) return;
  auth.expire(token);
  void router.replace({
    path: "/login",
    query: {
      reason: "expired",
      redirect: safeRedirect(router.currentRoute.value.fullPath),
    },
  });
});
app.mount("#app");
