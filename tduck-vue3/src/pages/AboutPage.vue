<template>
  <div class="page-heading">
    <div>
      <div class="eyebrow muted">VERSION NOTES</div>
      <h1>一段新的探索<span class="heading-dot">.</span></h1>
      <p>知研 × TDuck · Vue 3 迁移第一阶段</p>
    </div>
  </div>
  <section class="detail-card about-card">
    <span class="version-pill">V0.1 / PHASE 01</span>
    <h2>保留成熟能力，逐步向前。</h2>
    <p>
      本版支持现有账号登录、退出、问卷搜索、目录浏览和题目详情查看。状态概览来自后端查询返回的问卷数量。
    </p>
    <p>
      表单设计、填写、发布、答卷管理及统计分析继续使用原版 TDuck。本阶段尚未接入
      AI 功能。
    </p>
    <el-alert
      title="退出会清除当前页面的登录凭证；原版后端尚无 Token 注销接口。请勿在公用电脑保留登录。"
      type="info"
      :closable="false"
      show-icon
    />
    <p class="muted">
      新界面采用 Vue 3、TypeScript、Vite、Vue Router、Pinia、Element Plus 与
      Apache ECharts。业务继续由 TDuck 的 Spring Boot、MyBatis-Plus 和 MySQL
      提供。
    </p>
  </section>
</template>
