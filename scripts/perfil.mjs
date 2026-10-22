/**
 * Perfil do carregamento no celular: CPU 4x mais lenta (como o Lighthouse), trace do Chrome e o
 * resumo das tarefas longas, com o que cada uma fez (estilo, layout, script, pintura).
 * Uso: node scripts/perfil.mjs [rota]
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'

const ROTA = process.argv[2] || '/'
mkdirSync('lighthouse', { recursive: true })
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true })
const cdp = await page.createCDPSession()
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
// rede do celular do Lighthouse (150 ms de ida e volta, 1,6 Mbps)
if (process.env.REDE !== '0') await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
await page.tracing.start({ path: 'lighthouse/perfil.json', categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing'] })
await page.goto('http://localhost:3406' + ROTA, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.tracing.stop()
await browser.close()

const { traceEvents } = JSON.parse(readFileSync('lighthouse/perfil.json', 'utf8'))
const principal = traceEvents.find((e) => e.name === 'TracingStartedInBrowser')
const tarefas = traceEvents.filter((e) => e.name === 'RunTask' && e.dur > 50000).sort((a, b) => a.ts - b.ts)
const t0 = traceEvents.find((e) => e.name === 'navigationStart' || e.name === 'markAsMainFrame')?.ts || tarefas[0]?.ts || 0
console.log(`${tarefas.length} tarefas longas (> 50 ms)`)
for (const t of tarefas) {
  const dentro = traceEvents.filter((e) => e.tid === t.tid && e.pid === t.pid && e.ts >= t.ts && e.ts + (e.dur || 0) <= t.ts + t.dur && e.dur)
  const soma = {}
  // filhos diretos da tarefa (o que ela fez), somados por nome
  for (const e of dentro) if (e !== t && e.name !== 'RunTask') soma[e.name] = (soma[e.name] || 0) + e.dur / 1000
  const lista = Object.entries(soma).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([n, d]) => `${n} ${d.toFixed(0)}`)
  const layout = dentro.filter((e) => e.name === 'Layout').sort((a, b) => b.dur - a.dur)[0]
  const estilo = dentro.filter((e) => e.name === 'UpdateLayoutTree').sort((a, b) => b.dur - a.dur)[0]
  console.log(`\n${((t.ts - t0) / 1000).toFixed(0)} ms · ${(t.dur / 1000).toFixed(0)} ms: ${lista.join(' · ')}`)
  if (layout) console.log(`  maior layout ${(layout.dur / 1000).toFixed(0)} ms, ${JSON.stringify(layout.args?.beginData || {}).slice(0, 160)}`)
  if (estilo) console.log(`  maior estilo ${(estilo.dur / 1000).toFixed(0)} ms, elementos ${estilo.args?.elementCount ?? '?'}`)
}
void principal
