/**
 * Testa as interações da loja no Chrome (puppeteer-core) e tira print de cada passo em
 * revisao/interacoes/: hover do card, sacola com a promoção, busca, coleção, produto, menu do
 * celular e newsletter. Falha (código 1) se algum passo não achar o que esperava.
 *
 * Uso: node scripts/interacoes.mjs [--base http://localhost:3406]
 */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const iBase = args.indexOf('--base')
const BASE = iBase > -1 ? args[iBase + 1] : 'http://localhost:3406'
const OUT = path.resolve('revisao/interacoes')
mkdirSync(OUT, { recursive: true })
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))

const falhas = []
const conferir = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${msg}`)
  if (!ok) falhas.push(msg)
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--no-first-run'] })
try {
  // ---------------------------------------------------------------- computador
  const page = await browser.newPage()
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(BASE + '/?lenis=0', { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle2' })
  await page.evaluate(() => document.fonts.ready)

  // hover no card: a foto da pessoa aparece e o botão sobe
  await page.evaluate(() => document.querySelector('#mais-vendidos').scrollIntoView({ block: 'center' }))
  await espera(1400)
  await page.hover('.vendidos .card:nth-child(2) .card__fotos')
  await espera(1200)
  const hover = await page.evaluate(() => {
    const c = document.querySelector('.vendidos .card:nth-child(2)')
    return { pessoa: getComputedStyle(c.querySelector('.card__quadro--pessoa')).opacity, botao: getComputedStyle(c.querySelector('.card__add')).opacity }
  })
  conferir(hover.pessoa === '1' && hover.botao === '1', `hover no card: pessoa ${hover.pessoa}, botão ${hover.botao}`)
  await page.screenshot({ path: path.join(OUT, '01-hover-card.png'), clip: await page.evaluate(() => { const r = document.querySelector('.vendidos .grade').getBoundingClientRect(); return { x: 0, y: r.top + scrollY - 40, width: 1440, height: r.height + 80 } }) })

  // adicionar dois: a sacola abre com a promoção
  await page.click('.vendidos .card:nth-child(2) .card__add')
  await espera(1100)
  conferir(await page.evaluate(() => document.getElementById('gaveta').open && document.querySelector('.gaveta').dataset.vista === 'sacola'), 'adicionar abre a sacola')
  await page.click('[data-fechar].gaveta__fechar')
  await espera(700)
  await page.hover('.vendidos .card:nth-child(4) .card__fotos')
  await espera(600)
  await page.click('.vendidos .card:nth-child(4) .card__add')
  await espera(1200)
  // o preço sai com espaço que não quebra (R$ 449 numa linha só): normaliza pra comparar
  const sacola = await page.evaluate(() => ({
    itens: document.querySelectorAll('.sacola__item').length,
    promo: document.querySelector('.totais__promo dd')?.textContent.replace(/ /g, ' '),
    total: document.querySelector('.totais__total dd')?.textContent.replace(/ /g, ' '),
    qtd: document.querySelector('[data-qtd]').textContent,
  }))
  conferir(sacola.itens === 2 && sacola.promo === '-R$ 449' && sacola.total === 'R$ 449' && sacola.qtd === '2', `sacola: ${JSON.stringify(sacola)}`)
  await page.screenshot({ path: path.join(OUT, '02-sacola.png') })

  // finalizar mostra o aviso de site conceito
  await page.click('[data-finalizar]')
  await espera(300)
  conferir(/site conceito/.test(await page.evaluate(() => document.querySelector('.totais__aviso').textContent)), 'finalizar avisa que é site conceito')

  // Esc fecha
  await page.keyboard.press('Escape')
  await espera(700)
  conferir(await page.evaluate(() => !document.getElementById('gaveta').open), 'Esc fecha a gaveta')

  // busca: "ambar" (sem acento) acha o Nyx
  await page.click('[data-abrir="busca"]')
  await espera(900)
  await page.type('#busca-q', 'ambar')
  await espera(500)
  const busca = await page.evaluate(() => [...document.querySelectorAll('[data-resultados] .card__nome')].map((n) => n.textContent))
  conferir(busca.length === 1 && busca[0] === 'Nyx', `busca "ambar": ${busca.join(', ')}`)
  await page.screenshot({ path: path.join(OUT, '03-busca.png') })
  // no campo de busca, o 1º Esc limpa o texto (padrão do navegador); o 2º fecha
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await espera(700)
  conferir(await page.evaluate(() => !document.getElementById('gaveta').open), 'Esc duas vezes fecha a busca')

  // coleção Selene e produto com voltar
  await page.click('.topo__nav a[data-abrir="colecao:selene"]')
  await espera(1200)
  const colecao = await page.evaluate(() => document.querySelectorAll('.grade--gaveta .card').length)
  conferir(colecao === 3, `coleção Selene com ${colecao} modelos`)
  await page.screenshot({ path: path.join(OUT, '04-colecao-selene.png') })
  await page.click('.grade--gaveta .card:nth-child(2) .card__link')
  await espera(1200)
  const produto = await page.evaluate(() => ({ nome: document.querySelector('.produto__nome')?.textContent, voltar: !document.querySelector('[data-voltar]').hidden }))
  conferir(produto.nome === 'Astra' && produto.voltar, `produto Astra com voltar: ${JSON.stringify(produto)}`)
  await page.screenshot({ path: path.join(OUT, '05-produto.png') })
  await page.click('[data-voltar]')
  await espera(600)
  conferir(await page.evaluate(() => document.querySelector('.gaveta').dataset.vista === 'colecao'), 'voltar leva pra coleção')
  await page.keyboard.press('Escape')
  await espera(700)

  // newsletter: e-mail errado avisa, certo agradece
  await page.evaluate(() => document.querySelector('#novidades').scrollIntoView({ block: 'center' }))
  await espera(1500)
  await page.type('#news-email', 'felipe@')
  await page.keyboard.press('Enter')
  await espera(300)
  const errado = await page.evaluate(() => document.querySelector('.news__msg').textContent)
  await page.focus('#news-email')
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.type('#news-email', 'felipe@exemplo.com')
  await page.keyboard.press('Enter')
  await espera(300)
  const certo = await page.evaluate(() => document.querySelector('.news__msg').textContent)
  conferir(/Confira/.test(errado) && /Pronto/.test(certo), `newsletter: "${errado}" / "${certo}"`)
  await page.screenshot({ path: path.join(OUT, '06-newsletter.png'), clip: await page.evaluate(() => { const r = document.querySelector('#novidades').getBoundingClientRect(); return { x: 0, y: r.top + scrollY, width: 1440, height: r.height } }) })

  conferir(!erros.length, `sem erro no console${erros.length ? ': ' + erros.join(' | ') : ''}`)
  await page.close()

  // ---------------------------------------------------------------- celular
  const cel = await browser.newPage()
  const errosCel = []
  cel.on('pageerror', (e) => errosCel.push(e.message))
  await cel.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await cel.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await cel.evaluate(() => document.fonts.ready)
  await cel.tap('.topo__menu')
  await espera(1100)
  conferir(await cel.evaluate(() => document.getElementById('gaveta').open && document.querySelector('.gaveta').classList.contains('gaveta--esquerda')), 'menu do celular abre pela esquerda')
  await cel.screenshot({ path: path.join(OUT, '07-menu-celular.png') })
  await cel.tap('.menu__principal a[data-abrir="colecao:sol"]')
  await espera(1800)
  const solCel = await cel.evaluate(() => ({ vista: document.querySelector('.gaveta').dataset.vista, esquerda: document.querySelector('.gaveta').classList.contains('gaveta--esquerda'), cards: document.querySelectorAll('.grade--gaveta .card').length }))
  conferir(solCel.vista === 'colecao' && !solCel.esquerda && solCel.cards === 6, `do menu pra coleção Sol (pela direita): ${JSON.stringify(solCel)}`)
  await cel.screenshot({ path: path.join(OUT, '08-colecao-celular.png') })
  // trilho do card: arrasta pra pessoa e o traço muda
  await cel.evaluate(() => { const t = document.querySelector('.grade--gaveta .card [data-trilho]'); t.scrollTo({ left: t.clientWidth, behavior: 'instant' }) })
  await espera(500)
  conferir(await cel.evaluate(() => document.querySelector('.grade--gaveta .card').classList.contains('na-pessoa')), 'trilho do card no toque marca a foto da pessoa')
  conferir(!errosCel.length, `celular sem erro${errosCel.length ? ': ' + errosCel.join(' | ') : ''}`)
} finally {
  await browser.close()
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\ntudo certo')
process.exit(falhas.length ? 1 : 0)
