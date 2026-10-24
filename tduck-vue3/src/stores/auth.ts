import { defineStore } from "pinia";
import { ref } from "vue";
import {
  TOKEN_KEY,
  login as requestLogin,
  currentUser,
  type Profile,
} from "../api";
import { ApiError } from "../api/client";

export const useAuth = defineStore("auth", () => {
  const token = ref(sessionStorage.getItem(TOKEN_KEY));
  const user = ref<Profile | null>(null);
  let revision = 0;
  let pending: Promise<void> | null = null;
  function logout() {
    revision++;
    token.value = null;
    user.value = null;
    pending = null;
    sessionStorage.removeItem(TOKEN_KEY);
  }
  function expire(requestToken: string) {
    if (requestToken === token.value) logout();
  }
  async function login(account: string, password: string) {
    const started = ++revision;
    const result = await requestLogin(account, password);
    if (started !== revision) return;
    if (!result || typeof result.token !== "string" || !result.token)
      throw new ApiError("protocol", "登录响应缺少凭证");
    if (result.needChangePassword)
      throw new ApiError(
        "business",
        "账号需要先修改初始密码，请在原版 TDuck 完成后再登录"
      );
    sessionStorage.setItem(TOKEN_KEY, result.token);
    token.value = result.token;
    user.value = {
      name: result.name || "调研用户",
      admin: result.admin ?? result.isAdmin,
    };
  }
  async function restore() {
    if (!token.value || user.value) return;
    if (pending) return pending;
    const started = revision;
    pending = currentUser()
      .then((profile) => {
        if (started === revision)
          user.value = {
            name: profile.name || "调研用户",
            admin: profile.admin ?? profile.isAdmin,
          };
      })
      .finally(() => {
        if (started === revision) pending = null;
      });
    return pending;
  }
  return { token, user, login, logout, expire, restore };
});
