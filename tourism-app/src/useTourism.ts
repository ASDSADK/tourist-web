import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Content, Dashboard } from './types'
import { makeStaticDashboard, staticContent } from './staticDemo'
export function useTourism() {
  const staticDemo = import.meta.env.VITE_STATIC_DEMO === 'true'
  const dashboard = ref<Dashboard | null>(null)
  const content = ref<Content | null>(null)
  const connected = ref(false)
  const error = ref('')
  const now = ref(Date.now())
  let events: EventSource | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  const controller = new AbortController()
  const stale = computed(() => !dashboard.value?.latest || now.value - Date.parse(dashboard.value.latest.sampledAt) > 30000)
  async function load() {
    try {
      const responses = await Promise.all(['/api/dashboard', '/api/content'].map(url => fetch(url, { signal: controller.signal })))
      if (responses.some(response => !response.ok)) throw new Error('服务返回异常')
      const [data, information] = await Promise.all(responses.map(response => response.json()))
      dashboard.value = data
      content.value = information
      error.value = ''
    } catch (cause) {
      if (!controller.signal.aborted) error.value = '暂时无法连接数据服务，请确认本地后端已启动。'
    }
  }
  onMounted(() => {
    if (staticDemo) {
      content.value = staticContent
      dashboard.value = makeStaticDashboard()
      timer = setInterval(() => { now.value = Date.now(); dashboard.value = makeStaticDashboard(now.value) }, 15000)
      return
    }
    void load()
    events = new EventSource('/api/events')
    events.addEventListener('snapshot', event => {
      try { dashboard.value = JSON.parse((event as MessageEvent).data); connected.value = true; error.value = '' }
      catch { error.value = '收到的数据格式异常' }
    })
    events.onerror = () => { connected.value = false }
    timer = setInterval(() => { now.value = Date.now(); if (!connected.value || !content.value) void load() }, 15000)
  })
  onUnmounted(() => { events?.close(); if (timer) clearInterval(timer); controller.abort() })
  return { dashboard, content, connected, stale, error, staticDemo }
}
