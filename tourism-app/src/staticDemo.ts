import type { Content, Dashboard } from './types'
export const staticContent: Content = {
  mode: 'simulation', bookingUrl: null,
  weather: { condition: '多云', temperature: 26, range: '22–30°C', humidity: 72, note: '演示天气，未接入气象服务' },
  attractions: [
    { id: 'yuanjiajie', name: '袁家界', description: '石峰之间，云海之上', total: 3000, remaining: 860, status: '可预约' },
    { id: 'jinbianxi', name: '金鞭溪', description: '沿溪漫步，探索山谷', total: 2000, remaining: 1240, status: '可预约' },
    { id: 'tianzishan', name: '天子山', description: '登高远眺，群峰尽收', total: 2500, remaining: 180, status: '余量较少' }
  ],
  news: [
    { id: 'notice', tag: '公告', title: '游览前请查看各景点预约余量，合理安排路线', detail: '本条为演示公告。预约余量是示例数据，实际预约以官方小程序为准。', source: '网页演示样例' },
    { id: 'weather', tag: '天气', title: '山地天气变化较快，建议准备雨具与防滑鞋', detail: '本条为演示天气提示，不代表实时预报。', source: '网页演示样例' },
    { id: 'guide', tag: '指南', title: '先看客流，再选时段，让游览更从容', detail: '本页面运行于 GitHub Pages，曲线由浏览器模拟生成，没有连接 UE 或景区设备。', source: '网页演示样例' }
  ]
}
export function makeStaticDashboard(now = Date.now()): Dashboard {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
  const day = formatter.format(now)
  const trend: Dashboard['trend'] = []
  let enteredToday = 0, exitedToday = 0
  const lastBucket = Math.floor(now / 300000) * 300000
  for (let i = 0; i < 24; i++) {
    const time = lastBucket - (23 - i) * 300000
    if (formatter.format(time) !== day) continue
    const entered = Math.round(600 + 280 * Math.sin(i / 4) + 100 * Math.sin(now / 600000 + i))
    const exited = Math.min(enteredToday + entered - exitedToday, Math.round(400 + 170 * Math.sin(i / 5)))
    enteredToday += entered; exitedToday += exited
    trend.push({ time, entered, exited, occupancy: enteredToday - exitedToday })
  }
  return {
    parkId: 'zhangjiajie-demo', day, capacity: 30000, sameDay: true, stale: false, trend,
    latest: { parkId: 'zhangjiajie-demo', sessionId: 'browser-demo', sequence: 0, sampledAt: new Date(now).toISOString(), source: 'browser-demo', enteredToday, exitedToday, occupancy: enteredToday - exitedToday }
  }
}
