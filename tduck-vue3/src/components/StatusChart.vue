<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from "vue";
import { init, use, type EChartsType } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
use([BarChart, GridComponent, CanvasRenderer]);
const props = defineProps<{ counts: number[] }>();
const container = ref<HTMLDivElement>();
let chart: EChartsType | undefined;
let observer: ResizeObserver | undefined;
function render() {
  chart?.setOption({
    animation: false,
    grid: { top: 3, bottom: 3, left: 0, right: 0 },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", data: ["当前目录"], show: false },
    series: props.counts.map((count, i) => ({
      type: "bar",
      stack: "status",
      barWidth: 16,
      data: [count],
      itemStyle: { color: ["#bdc9c5", "#218575", "#ddbb7c"][i] },
      silent: true,
    })),
  });
}
onMounted(() => {
  chart = init(container.value!);
  render();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(container.value!);
});
watch(() => props.counts, render, { deep: true });
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>
<template>
  <div
    ref="container"
    class="status-chart"
    role="img"
    :aria-label="`当前目录问卷状态：未发布 ${counts[0]}，收集中 ${counts[1]}，已停止 ${counts[2]}`"
  ></div>
</template>
