<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { init, use, type ECharts } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
const props = defineProps<{ count: number }>();
const element = ref<HTMLDivElement>();
let chart: ECharts | undefined, observer: ResizeObserver | undefined;
function draw() {
  chart?.setOption({
    grid: { left: 52, right: 24, top: 28, bottom: 36 },
    tooltip: {},
    xAxis: { type: "category", data: ["MySQL 诊断记录"] },
    yAxis: { type: "value", minInterval: 1 },
    series: [
      {
        type: "bar",
        data: [props.count],
        barWidth: 70,
        itemStyle: { color: "#287668", borderRadius: [7, 7, 0, 0] },
        label: { show: true, position: "top" },
      },
    ],
  });
}
onMounted(() => {
  chart = init(element.value!);
  draw();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(element.value!);
});
watch(() => props.count, draw);
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>
<template>
  <div
    ref="element"
    class="chart"
    role="img"
    :aria-label="`MySQL 诊断记录数量 ${count}`"
  ></div>
</template>
