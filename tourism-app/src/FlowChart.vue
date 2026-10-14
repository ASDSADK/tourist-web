<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Dashboard } from './types'
const props = defineProps<{ points: Dashboard['trend'] }>()
echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])
const container = ref<HTMLElement>()
let chart: echarts.ECharts | undefined
let observer: ResizeObserver | undefined
function draw() {
  chart?.setOption({
    color: ['#238563', '#dfa45b', '#5173a7'],
    tooltip: { trigger: 'axis' }, legend: { bottom: 0, icon: 'roundRect' },
    grid: { top: 42, left: 52, right: 52, bottom: 62 },
    xAxis: { type: 'time', axisLabel: { formatter: (value: number) => new Date(value).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' }) }, splitLine: { show: false } },
    yAxis: [
      { type: 'value', name: '进出 / 人次·5分钟', min: 0, splitLine: { lineStyle: { color: '#edf0eb' } } },
      { type: 'value', name: '在园 / 人次净额', min: 0, splitLine: { show: false } }
    ],
    series: [
      { name: '入园', type: 'line', connectNulls: false, showSymbol: false, data: props.points.map(p => [p.time, p.entered]) },
      { name: '出园', type: 'line', connectNulls: false, showSymbol: false, data: props.points.map(p => [p.time, p.exited]) },
      { name: '在园', type: 'line', yAxisIndex: 1, showSymbol: props.points.length === 1, lineStyle: { type: 'dashed' }, data: props.points.map(p => [p.time, p.occupancy]) }
    ]
  })
}
onMounted(() => { if (container.value) { chart = echarts.init(container.value); draw(); observer = new ResizeObserver(() => chart?.resize()); observer.observe(container.value) } })
watch(() => props.points, draw)
onUnmounted(() => { observer?.disconnect(); chart?.dispose() })
</script>
<template><div ref="container" class="flow-chart" role="img" aria-label="今日模拟客流曲线：入园、出园和在园趋势"></div></template>
