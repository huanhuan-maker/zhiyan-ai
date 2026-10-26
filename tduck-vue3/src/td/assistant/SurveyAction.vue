<template>
  <section class="action-card" data-testid="assistant-action-preview">
    <header><el-tag type="warning" effect="plain">待确认</el-tag><strong>{{ labels[result.action] || result.action }}</strong></header>
    <h4>{{ result.title }}</h4><p>{{ result.effect }}</p>
    <div v-if="result.generation" class="generation">{{ result.generation.mode === 'MOCK' ? 'Mock 示例草稿（非真实模型）' : `模型生成 · ${result.generation.provider} / ${result.generation.model}` }}</div>
    <dl v-if="result.arguments.title"><dt>{{ result.action === 'RENAME' ? '新标题' : '标题' }}</dt><dd>{{ result.arguments.title }}</dd></dl>
    <dl v-if="'description' in result.arguments"><dt>简介</dt><dd>{{ result.arguments.description || '（清空）' }}</dd></dl>
    <div v-if="result.arguments.question" class="single-question"><p>第 {{ result.arguments.questionNo || '新增' }} 题</p><strong>{{ result.arguments.question.label }}</strong><p>{{ types[result.arguments.question.type] || result.arguments.question.type }} · {{ result.arguments.question.required ? '必填' : '选填' }}</p><p v-if="result.arguments.question.options">{{ result.arguments.question.options.join(' / ') }}</p><p v-if="result.arguments.question.rateMax">评分范围：1–{{ result.arguments.question.rateMax }}</p></div>
    <ol v-if="result.arguments.questions" class="draft-questions"><li v-for="(q,i) in result.arguments.questions" :key="i"><strong>{{ q.label }}</strong><span>{{ types[q.type] || q.type }} · {{ q.required ? '必填' : '选填' }}</span><p v-if="q.options">{{ q.options.join(' / ') }}</p><p v-if="q.rateMax">评分范围：1–{{ q.rateMax }}</p></li></ol>
    <el-collapse v-if="result.before?.title"><el-collapse-item title="查看变更前内容"><p>标题：{{ result.before.title }}</p><p>简介：{{ result.before.description || '无' }}</p><ol><li v-for="(q,i) in result.before.questions" :key="i">{{ q.label }}</li></ol></el-collapse-item></el-collapse>
    <p v-for="(w,i) in result.generation?.warnings || []" :key="i" class="generation">{{ w }}</p>
    <footer><span>{{ expired ? '预览已过期，请重新提问' : '确认后执行；30 分钟内有效' }}</span><div><el-button :disabled="busy" @click="$emit('decide',false)">取消</el-button><el-button type="primary" :disabled="busy || expired" :loading="busy" @click="$emit('decide',true)">确认执行</el-button></div></footer>
  </section>
</template>
<script setup>
import {computed,ref,onMounted,onBeforeUnmount} from 'vue'
const props=defineProps({result:{type:Object,required:true},busy:Boolean})
defineEmits(['decide'])
const now=ref(Date.now()),expired=computed(()=>new Date(props.result.expiresAt).getTime()<now.value)
let ticker;onMounted(()=>{ticker=setInterval(()=>{now.value=Date.now()},30000)});onBeforeUnmount(()=>clearInterval(ticker))
const labels={CREATE:'新建问卷草稿',RENAME:'修改标题',DESCRIBE:'修改简介',REPLACE_QUESTIONS:'替换草稿题目',ADD_QUESTION:'新增题目',EDIT_QUESTION:'修改题目',REMOVE_QUESTION:'删除题目',MOVE_QUESTION:'调整题目顺序',COPY:'复制问卷',PUBLISH:'发布问卷',STOP:'停止收集',ARCHIVE:'移入回收站'}
const types={RADIO:'单选',CHECKBOX:'多选',RATE:'评分',TEXT:'开放题',TEXTAREA:'开放题',INPUT:'单行文本'}
</script>
<style scoped>
.action-card{border:1px solid #e1d6ba;border-radius:10px;background:#fffdf7;padding:18px;margin-top:14px;font-size:13px;line-height:1.8;overflow-wrap:anywhere}.action-card header{display:flex;gap:10px;align-items:center}.action-card h4{margin:12px 0 4px;font-size:16px}.action-card p{margin:5px 0;color:#5f6876}.action-card dl{margin:12px 0}.action-card dt{font-size:11px;color:#82704a}.action-card dd{margin:0;white-space:pre-wrap}.draft-questions{padding-left:22px}.draft-questions li{padding:9px 0;border-bottom:1px solid #eee7d6}.draft-questions span{display:block;font-size:11px;color:#82704a}.generation{font-size:12px;color:#946c1b}.action-card footer{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:18px}.action-card footer>span{font-size:11px;color:#82704a}.action-card footer>div{display:flex;gap:8px}.action-card footer .el-button{margin:0}.action-card :deep(.el-collapse){--el-collapse-header-bg-color:transparent;--el-collapse-content-bg-color:transparent;margin-top:12px}
@media(max-width:600px){.action-card{padding:12px}.action-card footer>div{width:100%;justify-content:flex-end}}
</style>
