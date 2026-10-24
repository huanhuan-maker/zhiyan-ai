<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  getForm,
  getFormItems,
  statusLabel,
  typeLabel,
  itemTypeLabel,
  type FormItem,
  type FormRecord,
} from "../api";
import { errorMessage } from "../api/client";
import { plainText as text } from "../utils/text";
const route = useRoute();
const form = ref<FormRecord | null>(null);
const items = ref<FormItem[]>([]);
const loading = ref(true);
const error = ref("");
async function load() {
  loading.value = true;
  error.value = "";
  form.value = null;
  items.value = [];
  try {
    // First confirm owner access, then fetch editor metadata, never the public details endpoint.
    const record = await getForm(String(route.params.key));
    const fields = await getFormItems(record.formKey);
    form.value = record;
    items.value = fields;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
function options(item: FormItem): string[] {
  const values = item.scheme?.options;
  return Array.isArray(values)
    ? values
        .slice(0, 100)
        .map((option) =>
          typeof option === "object" && option !== null
            ? text(String(option.label ?? option.value ?? ""))
            : text(String(option))
        )
    : [];
}
onMounted(() => {
  void load();
});
</script>
<template>
  <RouterLink to="/forms" class="back-link">← 返回问卷工作台</RouterLink>
  <el-skeleton v-if="loading" :rows="7" animated class="detail-card" />
  <div v-else-if="error" class="detail-card state-area">
    <div role="alert" class="error-box">{{ error }}</div>
    <el-button @click="load()">重新加载</el-button>
  </div>
  <template v-else-if="form">
    <div class="page-heading detail-heading">
      <div>
        <div class="eyebrow muted">QUESTIONNAIRE / OVERVIEW</div>
        <h1>{{ text(form.textName || form.name) }}</h1>
        <p>
          {{ form.typeDesc || typeLabel(form.type) }} <span class="separator">/</span> 问卷详情
        </p>
      </div>
      <span class="status-tag" :class="`status-${form.status}`"
        ><i></i>{{ statusLabel(form.status) }}</span
      >
    </div>
    <section class="detail-card">
      <div class="detail-meta">
        <div>
          <span>问卷标识</span><strong>{{ form.formKey }}</strong>
        </div>
        <div>
          <span>创建时间</span
          ><strong>{{ form.createTime || "未记录" }}</strong>
        </div>
        <div>
          <span>最近更新</span
          ><strong>{{ form.updateTime || "未记录" }}</strong>
        </div>
      </div>
      <p class="form-description">
        {{ text(form.description) || "这份问卷暂未添加说明。" }}
      </p>
    </section>
    <section class="detail-card question-section">
      <div class="section-heading">
        <h2>
          题目内容 <span class="count-pill">{{ items.length }}</span>
        </h2>
        <span class="muted">仅查看</span>
      </div>
      <el-empty
        v-if="!items.length"
        description="这份问卷还没有题目"
        :image-size="70"
      />
      <article
        v-for="(item, index) in items"
        :key="item.id || item.formItemId"
        class="question-item"
      >
        <span class="question-number">{{
          String(index + 1).padStart(2, "0")
        }}</span>
        <div>
          <div class="question-type">
            {{ itemTypeLabel(item.type) }}
            <span v-if="item.required" class="required-label">必填</span>
          </div>
          <h3>{{ text(item.textLabel || item.label) || "未命名题目" }}</h3>
          <ul v-if="options(item).length" class="question-options">
            <li v-for="(option, i) in options(item)" :key="i">
              <span></span>{{ option }}
            </li>
          </ul>
          <p v-else class="muted question-placeholder">
            {{ text(item.placeholder) || "该题的填写与交互请在原版问卷中查看" }}
          </p>
        </div>
      </article>
    </section>
    <div class="phase-note">
      ⓘ
      此处展示题目元数据，不是填写预览。复杂题型、显隐逻辑与表单设计器尚未迁移。
    </div>
  </template>
</template>
