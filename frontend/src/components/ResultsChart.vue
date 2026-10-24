<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { init, use, type ECharts } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { type QuestionResult } from "../api/surveys";
use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
const props = defineProps<{ result: QuestionResult }>();
const element=ref<HTMLDivElement>(); let chart:ECharts|undefined,observer:ResizeObserver|undefined;
function draw(){chart?.setOption({
  animation:false,grid:{left:52,right:24,top:28,bottom:100},
  tooltip:{trigger:'axis',renderMode:'richText'},
  xAxis:{type:'category',data:props.result.options.map(o=>o.label),axisLabel:{interval:0,rotate:props.result.options.length>5?25:0,width:110,overflow:'truncate'}},
  yAxis:{type:'value',minInterval:1,name:'有效人数'},
  series:[{type:'bar',data:props.result.options.map(o=>o.numerator),barMaxWidth:65,itemStyle:{color:'#287668',borderRadius:[6,6,0,0]},label:{show:true,position:'top'}}]
},true);}
onMounted(()=>{chart=init(element.value!);draw();observer=new ResizeObserver(()=>chart?.resize());observer.observe(element.value!);});
watch(()=>props.result,draw,{deep:true});onBeforeUnmount(()=>{observer?.disconnect();chart?.dispose();});
</script>
<template><div ref="element" class="chart results-chart" role="img" :aria-label="`${result.text}，有效人数 ${result.denominator}，各选项人数详见下方表格`"></div></template>
