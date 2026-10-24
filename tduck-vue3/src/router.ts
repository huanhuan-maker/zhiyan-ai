import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "./stores/auth";
export function safeRedirect(value: unknown): string {
  return typeof value === "string" &&
    /^\/forms(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/.test(value) &&
    !value.includes("\\")
    ? value
    : "/forms";
}
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      component: () => import("./pages/LoginPage.vue"),
      meta: { public: true },
    },
    { path: "/", redirect: "/forms" },
    { path: "/forms", component: () => import("./pages/FormsPage.vue") },
    { path: "/forms/:key", component: () => import("./pages/DetailPage.vue") },
    { path: "/about", component: () => import("./pages/AboutPage.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/forms" },
  ],
});
router.beforeEach((to) => {
  const auth = useAuth();
  if (!to.meta.public && !auth.token)
    return { path: "/login", query: { redirect: safeRedirect(to.fullPath) } };
});
