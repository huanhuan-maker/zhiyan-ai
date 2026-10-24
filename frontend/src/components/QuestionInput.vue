<script setup lang="ts">
import { computed } from "vue";
import { type AnswerValue, type Question } from "../api/surveys";
const props = defineProps<{ question: Question; modelValue: AnswerValue | undefined; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: AnswerValue] }>();
const selected = computed(() => Array.isArray(props.modelValue) ? props.modelValue : []);
const scores = computed(() => Array.from({ length: Math.max(0, Math.min(21, (props.question.max ?? 5) - (props.question.min ?? 1) + 1)) }, (_, i) => (props.question.min ?? 1) + i));
function choose(id: string, checked: boolean) {
  emit("update:modelValue", checked ? [...selected.value, id] : selected.value.filter(value => value !== id));
}
</script>
<template>
  <div class="answer-control">
    <div v-if="question.type === 'SINGLE'" class="choice-list">
      <label v-for="option in question.options" :key="option.id" class="choice-label"><input type="radio" :name="question.id" :value="option.id" :checked="modelValue === option.id" :disabled="disabled" @change="emit('update:modelValue', option.id)" /><span>{{ option.label }}</span></label>
      <button v-if="!question.required && modelValue" type="button" class="text-button" :disabled="disabled" @click="emit('update:modelValue', null)">清除选择</button>
    </div>
    <div v-else-if="question.type === 'MULTIPLE'" class="choice-list">
      <label v-for="option in question.options" :key="option.id" class="choice-label"><input type="checkbox" :checked="selected.includes(option.id)" :disabled="disabled" @change="choose(option.id, ($event.target as HTMLInputElement).checked)" /><span>{{ option.label }}</span></label>
    </div>
    <div v-else-if="question.type === 'SCALE'">
      <div class="scale-options"><label v-for="score in scores" :key="score" :class="['score-label', { chosen: modelValue === score }]"><input type="radio" :name="question.id" :checked="modelValue === score" :disabled="disabled" @change="emit('update:modelValue', score)" /><span>{{ score }}</span></label></div>
      <button v-if="!question.required && modelValue !== undefined && modelValue !== null" type="button" class="text-button" :disabled="disabled" @click="emit('update:modelValue', null)">清除评分</button>
    </div>
    <textarea v-else :value="typeof modelValue === 'string' ? modelValue : ''" :disabled="disabled" rows="4" maxlength="5000" :aria-label="question.text" placeholder="请写下你的真实想法（最多 5000 字）" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"></textarea>
  </div>
</template>
