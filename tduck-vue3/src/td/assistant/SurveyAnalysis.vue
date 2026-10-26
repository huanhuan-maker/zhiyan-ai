<template>
  <section class="analysis-board" data-testid="assistant-analysis">
    <header class="analysis-heading"><div><span class="eyebrow">SURVEY INSIGHTS · V{{ result.version }}</span><h3>{{ result.title }}</h3><p>真实答卷 · {{ new Date(result.asOf).toLocaleString('zh-CN', {hour12:false}) }} 的数据快照</p></div><el-button size="small" @click="exportAnalysis">导出分析 JSON</el-button></header>
    <div class="metric-grid"><div><span>已回收答卷</span><strong>{{ result.answerCount }}<small>份</small></strong></div><div><span>纳入统计题目</span><strong>{{ stats.length }}<small>题</small></strong></div><div><span>有效题次 / 全部题次</span><strong>{{ validSlots }}<small>/ {{ totalSlots }}</small></strong></div><div><span>核心开放回答</span><strong>{{ result.openResponseCount ?? '—' }}<small>条</small></strong></div></div>
    <div v-if="!result.answerCount" class="empty-analysis">这个版本还没有收到答卷。收到数据后即可展示分布与趋势。</div>
    <template v-else>
      <div class="plot-grid">
        <article class="plot-card"><header><div><span class="plot-index">01</span><h4>回收趋势</h4></div><el-button text size="small" @click="saveImage('trend')">下载图</el-button></header><div ref="trendEl" class="chart" role="img" aria-label="按数据库提交日期统计的每日回收趋势" /><p>按服务端记录的提交日期统计；横轴逐日连续，缺少回收的日期记为零。</p></article>
        <article class="plot-card"><header><div><span class="plot-index">02</span><h4>逐题回答质量</h4></div><el-button text size="small" @click="saveImage('quality')">下载图</el-button></header><div ref="qualityEl" class="chart" role="img" aria-label="各题有效与缺失回答数量" /><p>缺失含空白或无效值。这里统计的是题次，不是完整答卷人数。</p></article>
      </div>
      <article class="plot-card distribution"><header><div><span class="plot-index">03</span><h4>题目分布</h4></div><el-button text size="small" :disabled="!selected" @click="saveImage('distribution')">下载图</el-button></header>
        <div v-if="numeric.length" class="distribution-controls"><el-select v-model="fieldId" aria-label="选择分析题目"><el-option v-for="(q,i) in numeric" :key="q.fieldId" :label="`${i+1}. ${q.label}`" :value="q.fieldId" /></el-select><el-radio-group v-model="chartType" size="small"><el-radio-button value="bar">柱状图</el-radio-button><el-radio-button value="donut" :disabled="!canDonut">环形图</el-radio-button></el-radio-group></div>
        <div v-if="selected" class="distribution-summary"><span>有效 <b>{{ selected.validCount }}</b></span><span>缺失 <b>{{ selected.missingCount }}</b></span><span v-if="selected.mean != null">评分均值 <b>{{ selected.mean }}</b></span><span>比例分母：本题有效回答 {{ selected.validCount }} 人</span></div>
        <div v-if="numeric.length" ref="distributionEl" class="chart distribution-chart" role="img" aria-label="所选题目选项人数分布" /><div v-else class="empty-analysis">本问卷没有支持分布图的选择或评分题，可查看开放回答及审核报告。</div>
        <p v-if="result.chartRequest?.fieldQuery && !matchedField">未找到题干包含“{{ result.chartRequest.fieldQuery }}”的可绘图题目，已展示可用题目；可在上方切换。</p>
        <p v-if="result.chartRequest?.chartType === 'donut' && !canDonut">这道题适合柱状图；多选占比不构成整体，评分按分值顺序呈现。</p>
        <p v-if="selected?.typeCode === 'CHECKBOX'">多选题每个选项均以本题有效回答人数为分母，合计可能超过 100%，使用柱状图展示。</p>
        <p v-else-if="selected">鼠标悬停或点按可查看人数及占本题有效回答的比例。评分分布与均值仅描述当前版本样本。</p>
      </article>
      <div class="reading-note"><strong>数据解读</strong><p v-for="(line,i) in observations" :key="i">{{ line }}</p></div>
    </template>
    <footer class="analysis-footnote">数值与比例由后端计算；图表只呈现当前问卷版本的样本事实。开放回答主题需查阅证据及人工审核报告，不能由词频推断总体观点。</footer>
  </section>
</template>

<script setup>
import {computed,ref,watch,onMounted,onBeforeUnmount,nextTick} from 'vue'
import * as echarts from 'echarts'
import {downloadFile} from './download'
const props=defineProps({result:{type:Object,required:true}})
const stats=computed(()=>props.result.statistics||[]),numeric=computed(()=>stats.value.filter(q=>!['INPUT','TEXTAREA'].includes(q.typeCode)))
const validSlots=computed(()=>stats.value.reduce((n,q)=>n+Number(q.validCount||0),0)),totalSlots=computed(()=>stats.value.reduce((n,q)=>n+Number(q.totalCount||0),0))
const fieldId=ref(''),chartType=ref('bar'),trendEl=ref(),qualityEl=ref(),distributionEl=ref(),instances={}
const selected=computed(()=>numeric.value.find(q=>q.fieldId===fieldId.value)||numeric.value[0]),canDonut=computed(()=>['RADIO','SELECT','IMAGE_SELECT'].includes(selected.value?.typeCode))
const matchedField=computed(()=>numeric.value.find(q=>q.label?.includes(props.result.chartRequest?.fieldQuery||'\u0000')))
const palette=['#167d8d','#4279d4','#e9a34b','#6c9f79','#d77173','#8b82af','#70b5bf']
const base={color:palette,animationDuration:400,textStyle:{fontFamily:'Microsoft YaHei, sans-serif',fontSize:11,color:'#526479'},tooltip:{trigger:'axis',renderMode:'richText',confine:true},grid:{left:42,right:18,top:36,bottom:38},aria:{enabled:true}}
const observations=computed(()=>{const rows=[];const q=stats.value.reduce((a,b)=>Number(b.missingCount)>Number(a?.missingCount||0)?b:a,null);if(q?.missingCount)rows.push(`“${q.label}”缺失 ${q.missingCount} 份，建议结合题目是否必填及题意检查回答负担。`);const rate=stats.value.find(q=>q.typeCode==='RATE'&&q.mean!=null);if(rate)rows.push(`“${rate.label}”评分均值为 ${rate.mean}，有效分母 ${rate.validCount} 人。`);if(!rows.length)rows.push('当前已纳入统计的题目没有缺失记录；可结合选项分布继续查看。');rows.push('这些说明由当前统计值生成；未进行因果分析、显著性检验或总体推断。');return rows})
let observer
function draw(name,el,option){if(!el)return;if(!instances[name])instances[name]=echarts.init(el,null,{renderer:'canvas'});instances[name].setOption({...base,...option},true)}
function daily(){const source=props.result.daily||{},dates=Object.keys(source).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();if(!dates.length)return {labels:Object.keys(source),values:Object.values(source)};const labels=[],values=[],last=new Date(dates.at(-1)+'T00:00:00Z'),cursor=new Date(dates[0]+'T00:00:00Z');while(cursor<=last&&labels.length<3660){const key=cursor.toISOString().slice(0,10);labels.push(key);values.push(source[key]||0);cursor.setUTCDate(cursor.getUTCDate()+1)}if(cursor<=last)return {labels:Object.keys(source),values:Object.values(source)};if(source['日期未知']){labels.push('日期未知');values.push(source['日期未知'])}return {labels,values}}
async function render(){await nextTick();if(!props.result.answerCount)return;const d=daily();
  draw('trend',trendEl.value,{xAxis:{type:'category',data:d.labels,boundaryGap:false,axisLabel:{formatter:v=>v.slice(5)}},yAxis:{type:'value',minInterval:1,splitLine:{lineStyle:{color:'#eef2f6'}}},series:[{name:'当日回收',type:'line',smooth:false,symbolSize:6,data:d.values,lineStyle:{width:3},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#167d8d33'},{offset:1,color:'#167d8d00'}])}}]})
  draw('quality',qualityEl.value,{legend:{data:['有效','缺失'],top:2},xAxis:{type:'category',data:stats.value.map((q,i)=>`Q${i+1}`)},yAxis:{type:'value',minInterval:1,splitLine:{lineStyle:{color:'#eef2f6'}}},series:[{name:'有效',type:'bar',stack:'quality',barMaxWidth:30,data:stats.value.map(q=>({value:q.validCount,name:q.label}))},{name:'缺失',type:'bar',stack:'quality',itemStyle:{color:'#e5ad74'},data:stats.value.map(q=>({value:q.missingCount,name:q.label}))}]})
  const q=selected.value;if(!q)return;const entries=Object.entries(q.map||{});if(q.typeCode==='RATE')entries.sort((a,b)=>Number(a[0])-Number(b[0]));
  const values=entries.map(([name,value])=>({name,value,percent:q.percentages?.[name]??0})),tooltip={trigger:'item',renderMode:'richText',confine:true,formatter:p=>`${p.name}\n${p.value} 人 · 占有效回答 ${p.data.percent}%`}
  if(chartType.value==='donut'&&canDonut.value)draw('distribution',distributionEl.value,{tooltip,legend:{type:'scroll',bottom:0},series:[{name:q.label,type:'pie',radius:['42%','67%'],center:['50%','45%'],avoidLabelOverlap:true,itemStyle:{borderRadius:5,borderColor:'#fff',borderWidth:3},label:{formatter:'{b}: {c} 人'},data:values}]})
  else draw('distribution',distributionEl.value,{tooltip,grid:{left:20,right:64,top:14,bottom:30,containLabel:true},xAxis:{type:'value',minInterval:1,splitLine:{lineStyle:{color:'#eef2f6'}}},yAxis:{type:'category',inverse:true,data:entries.map(e=>e[0]),axisLabel:{width:130,overflow:'truncate'}},series:[{name:q.label,type:'bar',barMaxWidth:28,itemStyle:{borderRadius:[0,5,5,0]},label:{show:true,position:'right',formatter:p=>`${p.value} 人`},data:values}]})
}
function saveImage(name){const chart=instances[name];if(!chart)return;const link=document.createElement('a');link.href=chart.getDataURL({pixelRatio:2,backgroundColor:'#ffffff'});link.download=`问卷-${props.result.formKey}-V${props.result.version}-${name}.png`;link.click()}
function exportAnalysis(){downloadFile(JSON.stringify(props.result,null,2),`问卷分析-${props.result.formKey}-V${props.result.version}.json`)}
function applyRequest(){fieldId.value=matchedField.value?.fieldId||numeric.value[0]?.fieldId||'';chartType.value=props.result.chartRequest?.chartType==='donut'&&canDonut.value?'donut':'bar'}
watch(()=>props.result,()=>{applyRequest();render()},{deep:true})
watch([fieldId,chartType],()=>{if(!canDonut.value&&chartType.value==='donut')chartType.value='bar';render()})
onMounted(()=>{applyRequest();render();observer=new ResizeObserver(()=>Object.values(instances).forEach(c=>c.resize()));for(const el of [trendEl.value,qualityEl.value,distributionEl.value])if(el)observer.observe(el)})
onBeforeUnmount(()=>{observer?.disconnect();Object.values(instances).forEach(c=>c.dispose())})
</script>

<style scoped>
.analysis-board{--ink:#203d4d;--muted:#718191;margin:18px 0 10px;border:1px solid #dce7e9;border-radius:14px;background:linear-gradient(125deg,#eff7f6 0%,#f8fafc 43%,#f1f5fc 100%);padding:22px;color:var(--ink);font-family:'Microsoft YaHei','PingFang SC',sans-serif}.analysis-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.eyebrow{font-size:10px;letter-spacing:2px;color:#167d8d;font-weight:700}.analysis-heading h3{font-size:20px;line-height:1.6;margin:6px 0;overflow-wrap:anywhere}.analysis-heading p,.plot-card p{font-size:11px;line-height:1.8;color:var(--muted);margin:4px 0}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;border:1px solid #dce7e9;border-radius:10px;overflow:hidden;margin:20px 0;background:#dce7e9}.metric-grid>div{background:#ffffffd9;padding:16px}.metric-grid span{display:block;font-size:11px;color:var(--muted)}.metric-grid strong{display:block;font-size:30px;letter-spacing:-1px;margin-top:8px;font-variant-numeric:tabular-nums}.metric-grid small{font-size:12px;font-weight:400;margin-left:7px;letter-spacing:0}.plot-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.plot-card{min-width:0;background:#fff;border:1px solid #e2e9ed;padding:15px;border-radius:10px}.plot-card header{display:flex;align-items:center;justify-content:space-between}.plot-card header>div{display:flex;align-items:center;gap:9px}.plot-card h4{margin:0;font-size:13px}.plot-index{font-size:10px;font-weight:700;color:#167d8d;background:#eaf5f3;border-radius:4px;padding:4px 5px}.chart{height:240px;width:100%}.distribution{margin-top:14px}.distribution-chart{height:320px}.distribution-controls{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:16px}.distribution-controls .el-select{width:min(400px,100%)}.distribution-summary{display:flex;flex-wrap:wrap;gap:14px;color:var(--muted);font-size:11px;margin:16px 0}.distribution-summary b{color:var(--ink)}.reading-note{padding:16px 0 3px;font-size:12px;line-height:1.8}.reading-note p{margin:5px 0;color:#5e7080}.analysis-footnote{font-size:10px;line-height:1.8;color:var(--muted);margin-top:10px;border-top:1px solid #dce7e9;padding-top:12px}.empty-analysis{padding:32px 8px;color:var(--muted);font-size:13px;text-align:center}
@media(max-width:800px){.analysis-board{padding:12px}.analysis-heading{flex-direction:column;gap:6px}.analysis-heading h3{font-size:17px}.metric-grid{grid-template-columns:1fr 1fr;margin:14px 0}.metric-grid>div{padding:12px}.metric-grid strong{font-size:25px}.plot-grid{grid-template-columns:1fr}.distribution-controls{gap:8px}.chart{height:220px}.distribution-chart{height:300px}.plot-card{padding:12px}}
@media(prefers-reduced-motion:reduce){.analysis-board{scroll-behavior:auto}}
</style>
