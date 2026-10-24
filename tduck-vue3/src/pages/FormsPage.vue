<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRouter, useRoute } from "vue-router";
import {
  getForms,
  statusLabel,
  typeLabel,
  type FormRecord,
  type Page,
} from "../api";
import { errorMessage } from "../api/client";
import StatusChart from "../components/StatusChart.vue";
const route = useRoute();
const router = useRouter();
const name = ref("");
const status = ref(0);
const page = ref(1);
const size = 10;
const listing = ref<Page<FormRecord> | null>(null);
const counts = ref<number[] | null>(null);
const loading = ref(false);
const error = ref("");
const summaryError = ref("");
const folderId = computed(() =>
  /^\d+$/.test(String(route.query.folder ?? ""))
    ? Number(route.query.folder)
    : 0
);
const total = ref<number | null>(null);
let sequence = 0;
async function load(reset = false) {
  if (reset) page.value = 1;
  const ticket = ++sequence;
  loading.value = true;
  error.value = "";
  summaryError.value = "";
  listing.value = null;
  counts.value = null;
  total.value = null;
  const base = {
    current: page.value,
    size,
    folderId: folderId.value,
    name: name.value.trim(),
    status: status.value || undefined,
  };
  const [rows, summary] = await Promise.allSettled([
    getForms(base),
    Promise.all(
      [undefined, 1, 2, 3].map((state) =>
        getForms({ ...base, current: 1, size: 1, folder: false, status: state })
      )
    ),
  ]);
  if (ticket !== sequence) return;
  if (rows.status === "fulfilled") listing.value = rows.value;
  else error.value = errorMessage(rows.reason);
  if (summary.status === "fulfilled") {
    total.value = summary.value[0]!.total;
    counts.value = summary.value.slice(1).map((result) => result.total);
  } else summaryError.value = errorMessage(summary.reason);
  loading.value = false;
}
function openFolder(row: FormRecord) {
  void router.push({ path: "/forms", query: { folder: row.id } });
}
onMounted(() => {
  void load();
});
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="eyebrow muted">RESEARCH WORKSPACE</div>
      <h1>我的问卷<span class="heading-dot">.</span></h1>
      <p>管理你的每一次调研，让真实的声音被看见。</p>
    </div>
    <el-button @click="load()" :loading="loading" plain
      >↻ &nbsp; 刷新数据</el-button
    >
  </div>
  <section class="overview" aria-label="问卷状态概览">
    <div class="overview-total">
      <span class="metric-label">{{
        folderId ? "当前目录问卷" : "根目录问卷"
      }}</span
      ><strong>{{ total ?? "—" }}<small>份</small></strong
      ><span class="muted metric-note">按名称筛选 · 不含子目录</span>
    </div>
    <div class="overview-status">
      <div class="summary-heading">
        <span>问卷状态分布</span
        ><span class="muted">{{ counts ? "实时数据" : "等待加载" }}</span>
      </div>
      <StatusChart v-if="counts && total" :counts="counts" />
      <div v-else class="empty-chart"></div>
      <div class="status-legend">
        <span v-for="(label, i) in ['未发布', '收集中', '已停止']" :key="label"
          ><i :class="`legend-${i}`"></i>{{ label
          }}<b>{{ counts?.[i] ?? "—" }}</b></span
        >
      </div>
      <small v-if="summaryError" role="alert" class="text-error"
        >概览暂不可用：{{ summaryError }}</small
      >
    </div>
    <div class="overview-note">
      <span class="note-symbol">↗</span><strong>从一个好问题开始</strong>
      <p>保持好奇，持续探索。<br />你的下一份发现，正在路上。</p>
    </div>
  </section>
  <section class="list-panel">
    <div class="panel-header">
      <div class="tabs">
        <span class="selected">{{ folderId ? "目录内问卷" : "全部问卷" }}</span
        ><span class="count-pill">{{ listing?.total ?? "—" }}</span>
      </div>
      <span class="muted list-caption"
        >{{ folderId ? "当前目录" : "根目录" }} ·
        {{ listing?.total ?? "—" }} 个项目</span
      >
    </div>
    <div class="filter-bar">
      <el-input
        v-model="name"
        aria-label="搜索问卷名称"
        placeholder="搜索问卷名称…"
        clearable
        maxlength="100"
        @keyup.enter="load(true)"
        @clear="load(true)"
      /><el-select
        v-model="status"
        aria-label="问卷状态筛选"
        @change="load(true)"
        ><el-option label="全部状态" :value="0" /><el-option
          v-for="s in [1, 2, 3]"
          :key="s"
          :label="statusLabel(s)"
          :value="s" /></el-select
      ><el-button @click="load(true)" :disabled="loading">搜索</el-button
      ><RouterLink v-if="folderId" to="/forms" class="back-root"
        >← 返回根目录</RouterLink
      >
    </div>
    <div v-if="error" class="state-area">
      <div role="alert" class="error-box">{{ error }}</div>
      <el-button @click="load()">重新加载</el-button>
    </div>
    <el-skeleton v-else-if="loading" :rows="5" animated class="table-loading" />
    <template v-else-if="listing">
      <el-table
        v-if="listing.records.length"
        :data="listing.records"
        row-key="id"
        class="forms-table"
      >
        <el-table-column label="问卷名称" min-width="270"
          ><template #default="{ row }"
            ><div class="form-name">
              <span class="form-icon" :class="{ folder: row.folder }">{{
                row.folder ? "▰" : "▤"
              }}</span>
              <div>
                <button
                  v-if="row.folder"
                  class="text-button"
                  @click="openFolder(row)"
                >
                  {{ row.textName || row.name }}</button
                ><RouterLink
                  v-else
                  :to="`/forms/${encodeURIComponent(row.formKey)}`"
                  >{{ row.textName || row.name }}</RouterLink
                ><small>{{
                  row.folder ? "文件夹" : (row.typeDesc || typeLabel(row.type))
                }}</small>
              </div>
            </div></template
          ></el-table-column
        >
        <el-table-column label="状态" width="130"
          ><template #default="{ row }"
            ><span
              v-if="!row.folder"
              class="status-tag"
              :class="`status-${row.status}`"
              ><i></i>{{ statusLabel(row.status) }}</span
            ><span v-else class="muted">—</span></template
          ></el-table-column
        >
        <el-table-column label="最近更新" min-width="170"
          ><template #default="{ row }"
            ><span class="table-time">{{
              row.updateTime || row.createTime || "未记录"
            }}</span></template
          ></el-table-column
        >
        <el-table-column label="操作" width="120" align="right"
          ><template #default="{ row }"
            ><button
              v-if="row.folder"
              class="text-button"
              @click="openFolder(row)"
            >
              打开 →</button
            ><RouterLink
              v-else
              class="detail-link"
              :to="`/forms/${encodeURIComponent(row.formKey)}`"
              >查看详情 ↗</RouterLink
            ></template
          ></el-table-column
        >
      </el-table>
      <el-empty
        v-else
        :description="
          name || status ? '没有符合条件的问卷' : '这个目录还没有问卷'
        "
        :image-size="85"
      />
      <div class="pagination">
        <span class="muted"
          >共 {{ listing.total }} 个项目，每页 {{ size }} 个</span
        ><el-pagination
          v-model:current-page="page"
          :page-size="size"
          :total="listing.total"
          layout="prev, pager, next"
          @current-change="load()"
        />
      </div>
    </template>
  </section>
  <div class="phase-note">
    <span>ⓘ</span> 当前版本支持问卷查看。问卷设计、发布和答题继续使用原有
    TDuck。
  </div>
</template>
