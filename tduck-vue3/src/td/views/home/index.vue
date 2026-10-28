<template>
  <div class="home-container">
    <div class="content-container">
      <aside class="menu-box" aria-label="知研 AI 工作台导航">
        <div class="logo-wrapper" @click="$router.push({ path: '/' })">
          <img src="@/assets/images/logo-tduck-ce.svg" alt="TDUCK" class="home-logo-img" />
          <span class="brand-divider" />
          <div class="brand-copy">
            <strong>知研 AI</strong>
            <span>问卷工作台</span>
          </div>
        </div>
        <nav class="menu-view">
          <div
            v-for="menu in menuList"
            v-show="!menu.admin || (menu.admin && getUserInfo && getUserInfo.admin)"
            :key="menu.route"
            :class="defaultActiveMenu === menu.route ? 'menu-item-active menu-item' : 'menu-item'"
            @click="menuClickHandle(menu)"
          >
            <font-icon :class="menu.icon" class="menu-icon" />
            <span class="menu-label">{{ menu.name }}</span>
          </div>
        </nav>
        <div class="menu-footer">
          <div class="menu-support">
            <i class="el-icon-info" />
            <span>本地研究数据<br />安全保存在当前环境</span>
          </div>
          <button class="logout-action-btn" @click="logoutHandle">
            <i class="el-icon-switch-button" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main class="view-container">
        <header class="header-container">
          <div class="header-title">
            <h1>{{ headerTitle }}</h1>
            <p>{{ headerSubtitle }}</p>
          </div>
          <div class="right-header">
            <el-popover placement="bottom-end" trigger="click" width="220" popper-class="workbench-user-popover">
              <div class="user-person-menu">
                <div v-if="getUserInfo" class="user-profile-summary">
                  <img :src="getUserInfo.avatar" class="popover-avatar" alt="用户头像" />
                  <div class="popover-meta">
                    <p class="nick-name">{{ getUserInfo.name || '未命名用户' }}</p>
                    <span class="user-role-badge">{{ getUserInfo.admin ? '系统管理员' : '普通用户' }}</span>
                  </div>
                </div>
                <el-divider />
                <div class="person-menu-links">
                  <div class="person-menu-item" @click="$router.push({ path: '/home/member' })">
                    <i class="el-icon-user" />
                    <span>我的账户</span>
                  </div>
                  <div class="person-menu-item logout-item" @click="logoutHandle">
                    <i class="el-icon-switch-button" />
                    <span>退出登录</span>
                  </div>
                </div>
              </div>
              <template #reference>
                <button class="avatar-trigger-wrapper" aria-label="账户菜单">
                  <span v-if="getUserInfo" class="avatar-text">{{ userInitial }}</span>
                  <img v-else class="user-avatar" src="@/assets/images/logo-blue.png" alt="" />
                  <i class="el-icon-arrow-down" />
                </button>
              </template>
            </el-popover>
          </div>
        </header>
        <div class="router-view-wrapper">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import store from '@/store'
import router from '@/router'

export default {
  name: 'NewIndex',
  components: {},
  data() {
    return {
      defaultActiveMenu: '/home',
      menuList: [
        { route: '/home/ai', name: 'AI 建卷', icon: 'el-icon-magic-stick' },
        { route: '/home', name: '我的问卷', icon: 'fa-pencil-square' },
        { route: '/home/assistant', name: '问卷助手', icon: 'el-icon-chat-dot-round' },
        { route: '/home/knowledge', name: '问卷知识库', icon: 'el-icon-collection' },
        { route: '/manage/user', name: '用户管理', icon: 'fa-user', admin: true },
        { route: '/manage/system', name: '系统配置', icon: 'el-icon-s-tools', admin: true }
      ]
    }
  },
  computed: {
    getStore() {
      return store
    },
    getUserInfo() {
      try {
        return JSON.parse(this.getStore.getters['user/userInfo'])
      } catch (e) {
        return {}
      }
    },
    userInitial() {
      const name = this.getUserInfo && this.getUserInfo.name
      return name ? String(name).trim().slice(0, 1).toUpperCase() : '研'
    },
    headerTitle() {
      const active = this.menuList.find((item) => item.route === this.defaultActiveMenu)
      return active ? active.name : '问卷工作台'
    },
    headerSubtitle() {
      if (this.defaultActiveMenu === '/home/ai') return '描述研究目标，生成可编辑问卷，再逐题精修导入。'
      if (this.defaultActiveMenu === '/home') return '管理、发布并持续收集你的调查问卷。'
      if (this.defaultActiveMenu === '/home/assistant') return '用自然语言查询自己的问卷、统计和原文证据。'
      if (this.defaultActiveMenu === '/home/knowledge') return '让调查资料可检索，让每个结论有据可查。'
      return '知研 AI 学术调查工作台。'
    }
  },
  watch: { '$route.path'(path) { this.defaultActiveMenu = path } },
  created() {
    let user = this.getStore.getters['user/userInfo'] || {}
    if (!user) {
      this.$router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    } else if (this.$route.path == '/') {
      this.$router.push({ path: '/home' })
    }
    if (this.$route.path) {
      this.defaultActiveMenu = this.$route.path
    }
  },
  methods: {
    menuClickHandle(menu) {
      this.$router.replace({ path: menu.route })
    },
    logoutHandle() {
      this.$confirm('您确定要退出登录吗？', '退出确认', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          this.$store.dispatch('user/logout').then(() => router.push({ path: '/login' }))
        })
        .catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.home-container {
  display: flex;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  color: var(--zy-text);
  background: var(--zy-page);
  font-family: var(--zy-font-family);
}
.content-container {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.menu-box {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 232px;
  padding: 22px 14px 18px;
  background: var(--zy-surface);
  border-right: 1px solid var(--zy-border);
}
.logo-wrapper {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 10px 22px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--zy-border-light);
}
.home-logo-img {
  display: block;
  width: auto;
  max-width: 116px;
  max-height: 30px;
  flex-shrink: 0;
}
.brand-divider {
  width: 1px;
  height: 22px;
  margin: 0 12px;
  background: var(--zy-border);
}
.brand-copy {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  white-space: nowrap;
  gap: 2px;
  strong { font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }
  span { color: var(--zy-text-secondary); font-size: 11px; }
}
.menu-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding-top: 16px;
  overflow-y: auto;
}
.menu-item {
  display: flex;
  align-items: center;
  min-height: 42px;
  padding: 0 13px;
  color: var(--zy-text-regular);
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--zy-radius-sm);
  transition: color 0.15s ease, background-color 0.15s ease;
  &:hover { color: var(--zy-text); background: var(--zy-surface-subtle); }
  &.menu-item-active {
    color: var(--zy-accent);
    font-weight: 500;
    background: #edf8f4;
  }
}
.menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  margin-right: 12px;
  font-size: 15px;
}
.menu-footer {
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--zy-border-light);
}
.menu-support {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 0 13px 16px;
  color: var(--zy-text-secondary);
  font-size: 11px;
  line-height: 1.6;
}
.logout-action-btn {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 38px;
  padding: 0 13px;
  color: var(--zy-text-regular);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--zy-radius-sm);
  &:hover { color: var(--zy-danger); background: #fef2f2; }
}
.view-container {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.header-container {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  padding: 0 32px;
  background: var(--zy-surface);
  border-bottom: 1px solid var(--zy-border);
}
.header-title {
  min-width: 0;
  h1 { margin: 0 0 4px; overflow: hidden; font-size: 18px; font-weight: 600; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
  p { margin: 0; color: var(--zy-text-secondary); font-size: 12px; }
}
.right-header {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
}
.header-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--zy-text-secondary);
  cursor: pointer;
  background: var(--zy-surface-subtle);
  border: 1px solid var(--zy-border);
  border-radius: 50%;
  &:hover { color: var(--zy-text); }
}
.avatar-trigger-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 38px;
  padding: 0 10px;
  color: var(--zy-text-regular);
  cursor: pointer;
  background: var(--zy-surface);
  border: 1px solid var(--zy-border);
  border-radius: 20px;
}
.avatar-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: #fff;
  font-size: 12px;
  background: var(--zy-accent);
  border-radius: 50%;
}
.avatar-trigger-wrapper > i { color: var(--zy-text-placeholder); font-size: 11px; }
.router-view-wrapper {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
.user-person-menu {
  .user-profile-summary { display: flex; gap: 12px; align-items: center; }
  .popover-avatar { width: 40px; height: 40px; object-fit: cover; border-radius: 50%; }
  .popover-meta { display: flex; flex-direction: column; gap: 4px; }
  .nick-name { margin: 0; font-size: 14px; font-weight: 600; }
  .user-role-badge { align-self: flex-start; color: var(--zy-text-secondary); font-size: 12px; }
  .person-menu-item {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 8px;
    color: var(--zy-text-regular);
    font-size: 13px;
    cursor: pointer;
    border-radius: var(--zy-radius-sm);
    &:hover { color: var(--zy-primary); background: var(--zy-primary-soft); }
    &.logout-item:hover { color: var(--zy-danger); background: #fef2f2; }
  }
  .el-divider--horizontal { margin: 12px 0; }
}
@media (max-width: 767px) {
  .content-container { flex-direction: column; }
  .menu-box {
    width: 100%;
    padding: 10px 12px;
    border-right: 0;
    border-bottom: 1px solid var(--zy-border);
  }
  .logo-wrapper { display: none; }
  .menu-view {
    flex: none;
    flex-direction: row;
    gap: 4px;
    padding: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
  .menu-item {
    flex: 0 0 auto;
    min-height: 34px;
    padding: 0 10px;
    font-size: 12px;
    white-space: nowrap;
  }
  .menu-icon { margin-right: 6px; font-size: 13px; }
  .menu-footer { display: none; }
  .header-container { min-height: 64px; padding: 0 16px; }
  .header-title h1 { font-size: 16px; }
  .header-title p { display: none; }
  .header-icon-btn { display: none; }
  .avatar-trigger-wrapper { min-height: 34px; padding: 0 8px; }
}
</style>

<style lang="scss">
.workbench-user-popover.el-popover {
  padding: 14px !important;
  border-color: var(--zy-border) !important;
  border-radius: var(--zy-radius-md) !important;
  box-shadow: var(--zy-shadow-popup) !important;
}
</style>
