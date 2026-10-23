<template>
  <div class="eyebrow">RESEARCH WORKSPACE</div>
  <h1>从一个好问题开始。</h1>
  <p class="intro">
    欢迎来到知研 AI。先连接可靠的基础环境，再开展有据可查的调研。
  </p>
  <section class="hero">
    <div>
      <span class="pill">M0 · 工程搭建与环境联通</span>
      <h2>把好奇，变成有依据的洞察。</h2>
      <p>
        结构化问卷、有限预算主动追问与可信统计。<br />当前先完成真实数据库与前后端的连接。
      </p>
      <RouterLink to="/statistics" class="button"
        >开始环境诊断 <span>↗</span></RouterLink
      >
    </div>
    <div class="hero-mark" aria-hidden="true">
      <div class="orbit"></div>
      <span>问</span><i>探索</i><b>证据</b>
    </div>
  </section>
  <div class="section-heading">
    <h2>工作台</h2>
    <span class="muted">基础页面已就绪 · 业务功能按阶段开放</span>
  </div>
  <div class="cards">
    <section class="card">
      <span class="card-icon">01</span>
      <h3>环境诊断</h3>
      <p>经 Spring Boot 与 MyBatis-Plus，向真实 MySQL 插入并读取诊断记录。</p>
      <RouterLink to="/statistics" class="text-link">检查连接 →</RouterLink>
    </section>
    <section class="card">
      <span class="card-icon">02</span>
      <h3>我的调查</h3>
      <p>尚未创建调查。问卷创建、发布与回收将在 M1 人工批准后开发。</p>
      <span class="badge">M1 待开放</span>
    </section>
    <section class="card">
      <span class="card-icon">03</span>
      <h3>可信分析</h3>
      <p>当前仅有环境诊断图表，没有答卷、调查结果或 AI 分析。</p>
      <span class="badge">统计业务待开放</span>
    </section>
  </div>
  <section class="notice">
    <strong>本阶段交付边界</strong>
    <p>
      登录会话、页面骨架、健康检查与真实 Mapper 读写；未接入任何真实或 Mock
      AI，不生成演示答卷。
    </p>
  </section>
</template>
