/**
 * Build da MYKONOS (loja conceito de óculos, marca fictícia). HTML, CSS e JS estático em dist/
 * (base do 02-nubank).
 *
 *   node build.mjs              página em dist/index.html
 *   node build.mjs --publicar   dist do zero (antes de subir)
 *
 * Como funciona:
 * - src/index.html é o molde. <!-- @parcial NOME --> puxa src/partials/NOME.html.
 * - CSS: src/css/_*.css primeiro (fontes e base), depois os outros em ordem de nome. Entra
 *   minificado num <style>. JS: mesma regra em src/js, num <script> no fim do <body>; cada
 *   arquivo é um IIFE.
 * - {{cfg.caminho}} puxa qualquer valor do site.config.json; {{ano}} é o ano atual.
 * - <i data-i="nome" data-w="light" class="..."></i> vira <svg><use> apontando pro sprite
 *   (Phosphor, node_modules/@phosphor-icons/core), montado só com os ícones usados. O peso
 *   "marca" pega o desenho próprio em src/svg/<nome>.svg (o logo e o coqueiro), com o viewBox dele.
 * - <img data-img="nome" sizes="..." alt="..."> vira <picture> com AVIF e WebP em srcset, width e
 *   height, a partir de src/assets/img/manifesto.json (npm run imagens). data-picture="classe"
 *   põe classe no <picture>. data-preload (na imagem do LCP) gera o <link rel="preload"> no topo.
 *   Direção de arte: data-img-movel="outro" data-movel-media="(max-width: 47.99em)"
 *   data-movel-sizes="100vw" põe antes as <source media> com o recorte do celular.
 * - <!-- @cards hydra,psarou --> vira os cards da grade (src/dados/produtos.json), com a foto do
 *   óculos e a da pessoa (a troca do hover). <!-- @produtos --> grava os 9 modelos num JSON
 *   pro JS montar a gaveta (coleção, busca, produto e sacola).
 * - <!-- @schema --> recebe o JSON-LD.
 * - Avisa: travessão no texto, img sem alt/width/height, id repetido, âncora sem destino,
 *   marcador {{...}} que sobrou, CSS com chave desbalanceada e mais de um h1.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, copyFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const P = (...a) => path.join(RAIZ, ...a)
const DIST = P('dist')
const cfg = JSON.parse(readFileSync(P('site.config.json'), 'utf8'))
const produtos = JSON.parse(readFileSync(P('src/dados/produtos.json'), 'utf8'))
const manifesto = existsSync(P('src/assets/img/manifesto.json')) ? JSON.parse(readFileSync(P('src/assets/img/manifesto.json'), 'utf8')) : {}
const avisos = []

// ---------------------------------------------------------------- utilidades
function gravar(arq, conteudo) {
  mkdirSync(path.dirname(arq), { recursive: true })
  writeFileSync(arq, conteudo)
}

function copiarPasta(de, para) {
  if (!existsSync(de)) return
  mkdirSync(para, { recursive: true })
  for (const nome of readdirSync(de)) {
    if (nome.startsWith('.') || nome === 'manifesto.json') continue
    const a = path.join(de, nome)
    const b = path.join(para, nome)
    const st = statSync(a)
    if (st.isDirectory()) copiarPasta(a, b)
    else if (!existsSync(b) || statSync(b).size !== st.size || statSync(b).mtimeMs < st.mtimeMs) copyFileSync(a, b)
  }
}

function lerParcial(nome) {
  const arq = P('src/partials', `${nome}.html`)
  if (!existsSync(arq)) {
    avisos.push(`parcial ausente: ${nome}`)
    return `<!-- parcial ${nome} ainda não existe -->`
  }
  return readFileSync(arq, 'utf8')
}

function juntar(pasta, ext) {
  if (!existsSync(P(pasta))) return ''
  const todos = readdirSync(P(pasta)).filter((f) => f.endsWith(ext))
  const ordem = [...todos.filter((f) => f.startsWith('_')).sort(), ...todos.filter((f) => !f.startsWith('_')).sort()]
  return ordem
    .map((f) => {
      const c = readFileSync(P(pasta, f), 'utf8')
      if (ext === '.css') {
        const abre = (c.match(/{/g) || []).length
        const fecha = (c.match(/}/g) || []).length
        if (abre !== fecha) avisos.push(`CSS com chaves desbalanceadas: ${f} (${abre} abre, ${fecha} fecha)`)
      }
      return c
    })
    .join(ext === '.js' ? '\n;\n' : '\n')
}

// Minificação conservadora: só comentário e espaço redundante. Não mexe em espaço perto de ":"
// ou ">", que muda o sentido de seletor (".a :is(.b)").
function minCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/,\s+/g, ',')
    .replace(/;}/g, '}')
    .trim()
}

function minJs(js) {
  // só tira comentário (de bloco que abre no começo da linha, e de linha inteira) e linhas em
  // branco; o JS é pequeno
  return js
    .replace(/(^|\n)[ \t]*\/\*[\s\S]*?\*\//g, '$1')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n')
}

function valor(caminho) {
  const v = caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg)
  if (v === undefined) avisos.push(`config sem o caminho: ${caminho}`)
  return v ?? ''
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const reais = (n) => 'R$&nbsp;' + n.toFixed(2).replace('.', ',').replace(/,00$/, '')

// ---------------------------------------------------------------- ícones (sprite com <use>)
const usados = new Map()
function icone(nome, peso = 'light', classe = '') {
  const id = `i-${nome}-${peso}`
  if (!usados.has(id)) {
    const marca = peso === 'marca'
    const arq = marca ? P('src/svg', `${nome}.svg`) : P('node_modules/@phosphor-icons/core/assets', peso, `${nome}${peso === 'regular' ? '' : '-' + peso}.svg`)
    if (!existsSync(arq)) {
      avisos.push(`ícone não existe: ${nome} (${peso})`)
      return ''
    }
    const svg = readFileSync(arq, 'utf8')
    const caixa = marca ? (svg.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 256 256' : '0 0 256 256'
    const miolo = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim()
    usados.set(id, `<symbol id="${id}" viewBox="${caixa}">${miolo}</symbol>`)
  }
  const cls = ['i', classe].filter(Boolean).join(' ')
  const caixa = peso === 'marca' ? usados.get(id).match(/viewBox="([^"]+)"/)[1] : null
  return `<svg class="${cls}"${caixa ? ` viewBox="${caixa}"` : ''} aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`
}

// ---------------------------------------------------------------- imagens (<picture> com AVIF e WebP)
function versoes(nome, ext) {
  return Object.entries(manifesto)
    .map(([arq, m]) => ({ arq, m, w: Number((arq.match(new RegExp(`^${nome}-(\\d+)\\.${ext}$`)) || [])[1]) }))
    .filter((v) => v.w)
    .sort((a, b) => a.w - b.w)
}
const srcset = (vs) => vs.map((v) => `/assets/img/${v.arq} ${v.m.w}w`).join(', ')
const attr = (s, nome) => (s.match(new RegExp(`\\s${nome}="([^"]*)"`)) || [])[1]
const temAttr = (s, nome) => new RegExp(`\\s${nome}(\\s|=|$)`).test(s)
const semAttr = (s, ...nomes) => nomes.reduce((t, n) => t.replace(new RegExp(`\\s${n}(="[^"]*")?(?=[\\s>/]|$)`, 'g'), ''), s)
const preloads = []

function imagens(html) {
  return html.replace(/<img\b([^>]*?)\sdata-img="([\w-]+)"([^>]*)>/g, (tag, antes, nome, depois) => {
    let attrs = antes + depois
    const sizes = attr(attrs, 'sizes') || '100vw'
    const classePicture = attr(attrs, 'data-picture')
    const preload = temAttr(attrs, 'data-preload')
    const movel = attr(attrs, 'data-img-movel')
    const movelMedia = attr(attrs, 'data-movel-media')
    const movelSizes = attr(attrs, 'data-movel-sizes') || '100vw'
    attrs = semAttr(attrs, 'data-picture', 'data-preload', 'sizes', 'data-img-movel', 'data-movel-media', 'data-movel-sizes')
    const vw = versoes(nome, 'webp')
    const va = versoes(nome, 'avif')
    if (!vw.length) {
      avisos.push(`data-img sem arquivo no manifesto: ${nome}`)
      return tag
    }
    const fontes = []
    const mvw = movel ? versoes(movel, 'webp') : []
    const mva = movel ? versoes(movel, 'avif') : []
    if (movel && !mvw.length) avisos.push(`data-img-movel sem arquivo no manifesto: ${movel}`)
    if (mvw.length) {
      const maior = mvw[mvw.length - 1].m
      const dims = ` width="${maior.w}" height="${maior.h}"`
      if (mva.length) fontes.push(`<source type="image/avif" media="${movelMedia}" srcset="${srcset(mva)}" sizes="${movelSizes}"${dims}>`)
      fontes.push(`<source type="image/webp" media="${movelMedia}" srcset="${srcset(mvw)}" sizes="${movelSizes}"${dims}>`)
    }
    if (va.length) fontes.push(`<source type="image/avif" srcset="${srcset(va)}" sizes="${sizes}">`)
    const principal = vw[vw.length - 1]
    const img = `<img src="/assets/img/${principal.arq}" srcset="${srcset(vw)}" sizes="${sizes}" width="${principal.m.w}" height="${principal.m.h}"${attrs}>`
    if (preload) {
      const lista = va.length ? va : vw
      const fora = mvw.length ? ` media="not all and ${movelMedia}"` : ''
      preloads.push(`<link rel="preload" as="image" type="image/${va.length ? 'avif' : 'webp'}" imagesrcset="${srcset(lista)}" imagesizes="${sizes}"${fora} fetchpriority="high">`)
      if (mvw.length) {
        const ml = mva.length ? mva : mvw
        preloads.push(`<link rel="preload" as="image" type="image/${mva.length ? 'avif' : 'webp'}" imagesrcset="${srcset(ml)}" imagesizes="${movelSizes}" media="${movelMedia}" fetchpriority="high">`)
      }
    }
    return `<picture${classePicture ? ` class="${classePicture}"` : ''}>${fontes.join('')}${img}</picture>`
  })
}

// ---------------------------------------------------------------- cards da grade
const porId = Object.fromEntries(produtos.map((p) => [p.id, p]))
const TAM_CARD = '(min-width: 56.25em) 22vw, (min-width: 48em) 45vw, 46vw'
function card(p, i) {
  return `<li class="card revelar" style="--i:${i}">
          <a class="card__link" href="#produto-${p.id}" data-abrir="produto:${p.id}">
            <span class="card__fotos"><span class="card__trilho" data-trilho>
              <img data-img="${p.id}-produto" data-picture="card__quadro" sizes="${TAM_CARD}" alt="${esc(p.altProduto)}" loading="lazy" decoding="async">
              <img data-img="${p.id}-pessoa" data-picture="card__quadro card__quadro--pessoa" sizes="${TAM_CARD}" alt="" loading="lazy" decoding="async">
            </span></span>
            <span class="card__nome">${esc(p.nome)}</span>
            <span class="card__preco">${reais(p.preco)}</span>
          </a>
          <span class="card__pontos" aria-hidden="true"><i></i><i></i></span>
          <button class="card__add" type="button" data-adicionar="${p.id}" aria-label="Adicionar ${esc(p.nome)} à sacola">Adicionar à sacola</button>
        </li>`
}
function cards(ids) {
  return ids
    .split(',')
    .map((s) => s.trim())
    .map((id, i) => {
      if (!porId[id]) {
        avisos.push(`card de produto que não existe: ${id}`)
        return ''
      }
      return card(porId[id], i)
    })
    .join('\n        ')
}

// os 9 modelos pro JS (gaveta): textos, preço e as fotos em AVIF e WebP
function foto(nome) {
  const vw = versoes(nome, 'webp')
  const va = versoes(nome, 'avif')
  if (!vw.length) avisos.push(`foto de produto sem arquivo no manifesto: ${nome}`)
  const maior = vw[vw.length - 1]
  return { avif: srcset(va), webp: srcset(vw), src: maior ? `/assets/img/${maior.arq}` : '', w: maior?.m.w || 500, h: maior?.m.h || 625 }
}
function produtosJson() {
  const lista = produtos.map(({ busca, ...p }) => ({ ...p, busca: `${p.nome} ${p.linha} ${busca}`.toLowerCase(), produto: foto(`${p.id}-produto`), pessoa: foto(`${p.id}-pessoa`) }))
  return `<script type="application/json" id="dados-produtos">${JSON.stringify({ produtos: lista, linhas: cfg.linhas }).replace(/</g, '\\u003c')}</script>`
}

// ---------------------------------------------------------------- dados estruturados
function schema() {
  const base = (cfg.dominio || '').replace(/\/$/, '')
  const marca = {
    '@type': 'Organization',
    '@id': `${base}/#mykonos`,
    name: 'MYKONOS',
    description: 'Marca fictícia de óculos de sol e de lente âmbar para a noite, inspirada nas ilhas gregas. Site conceito por Felipe Rodrigues.',
    logo: `${base}/favicon.svg`,
  }
  const site = { '@type': 'WebSite', '@id': `${base}/#site`, name: 'MYKONOS', inLanguage: 'pt-BR', publisher: { '@id': marca['@id'] } }
  if (base) site.url = `${base}/`
  const vendidos = produtos.filter((p) => p.maisVendido).sort((a, b) => a.maisVendido - b.maisVendido)
  const lista = {
    '@type': 'ItemList',
    name: 'Mais vendidos',
    itemListElement: vendidos.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: `Óculos ${p.nome}`,
        description: p.descricao,
        image: `${base}${foto(`${p.id}-produto`).src}`,
        brand: { '@id': marca['@id'] },
        offers: { '@type': 'Offer', price: p.preco.toFixed(2), priceCurrency: 'BRL', availability: 'https://schema.org/InStock' },
      },
    })),
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [marca, site, lista] })}</script>`
}

// ---------------------------------------------------------------- montagem
function montar() {
  let html = readFileSync(P('src/index.html'), 'utf8')
  for (let n = 0; n < 4 && /<!--\s*@parcial\s/.test(html); n++) html = html.replace(/<!--\s*@parcial\s+([\w-]+)\s*-->/g, (_, nome) => lerParcial(nome))
  html = html.replace(/<!--\s*@cards\s+([\w,\s-]+?)\s*-->/g, (_, ids) => cards(ids))
  html = html.replace('<!-- @produtos -->', () => produtosJson())
  html = html.replace('<!-- @js -->', () => `<script>${minJs(juntar('src/js', '.js'))}</script>`)
  html = html.replace('<!-- @css -->', () => `<style>${minCss(juntar('src/css', '.css'))}</style>`)
  html = html.replace(/<i data-i="([\w-]+)"(?: data-w="(\w+)")?(?: class="([^"]*)")?><\/i>/g, (_, nome, peso, classe) => icone(nome, peso || 'light', classe || ''))
  html = html.replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, c) => esc(valor(c)))
  html = html.replace(/\{\{ano\}\}/g, String(new Date().getFullYear()))
  html = html.replace('<!-- @schema -->', () => schema())
  html = imagens(html)
  html = html.replace('<!-- @preload -->', () => preloads.join('\n  '))
  html = html.replace('<!-- @sprite -->', () => `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;overflow:hidden">${[...usados.values()].join('')}</svg>`)
  html = html.replace('<!-- @robots -->', cfg.indexar ? '<meta name="robots" content="index, follow, max-image-preview:large">' : '<meta name="robots" content="noindex, nofollow">')
  const base = (cfg.dominio || '').replace(/\/$/, '')
  html = html.replace(
    '<!-- @meta-dominio -->',
    base
      ? `<link rel="canonical" href="${base}/">\n  <meta property="og:url" content="${base}/">\n  <meta property="og:image" content="${base}/assets/img/og-mykonos.jpg">`
      : '<meta property="og:image" content="/assets/img/og-mykonos.jpg">',
  )
  return html
}

function verificar(html) {
  const $ = cheerio.load(html)
  $('script, style').remove()
  const texto = $('body').text()
  const tracos = texto.match(/.{0,30}[—–].{0,30}/g)
  if (tracos) avisos.push(`travessão no texto (regra da casa): ${tracos.slice(0, 4).map((s) => JSON.stringify(s.trim())).join(' | ')}`)
  const sobrou = html.match(/\{\{[^}]+\}\}/g)
  if (sobrou) avisos.push(`marcadores sem valor: ${[...new Set(sobrou)].join(', ')}`)
  $('img').each((_, el) => {
    const src = ($(el).attr('src') || '?').slice(0, 60)
    if ($(el).attr('alt') === undefined) avisos.push(`img sem alt: ${src}`)
    if (!$(el).attr('width') || !$(el).attr('height')) avisos.push(`img sem width/height (salto de layout): ${src}`)
  })
  const ids = {}
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')
    ids[id] = (ids[id] || 0) + 1
  })
  for (const [id, n] of Object.entries(ids)) if (n > 1) avisos.push(`id repetido: #${id} (${n}x)`)
  $('a[href^="#"]').each((_, el) => {
    const alvo = $(el).attr('href').slice(1)
    // #produto-x abre a gaveta do produto (JS); sem JS, cai no topo da grade
    if (alvo && !ids[alvo] && !alvo.startsWith('produto-')) avisos.push(`âncora sem destino: #${alvo}`)
  })
  if ($('h1').length !== 1) avisos.push(`${$('h1').length} h1 na página (precisa ser 1)`)
}

// ---------------------------------------------------------------- execução
if (process.argv.includes('--publicar')) rmSync(DIST, { recursive: true, force: true })
copiarPasta(P('src/assets'), path.join(DIST, 'assets'))
copiarPasta(P('src/raiz'), DIST)
// rolagem suave (00-rolagem.js): o Lenis vem do node_modules, sem o comentário do mapa de fonte
const lenis = readFileSync(P('node_modules/lenis/dist/lenis.min.js'), 'utf8')
gravar(path.join(DIST, 'assets/js/lenis.min.js'), lenis.replace(/\/\/# sourceMappingURL=\S+\s*$/, ''))

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`
const html = montar()
verificar(html)
gravar(path.join(DIST, 'index.html'), html)
const base = (cfg.dominio || '').replace(/\/$/, '')
gravar(path.join(DIST, 'robots.txt'), cfg.indexar ? `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}` : 'User-agent: *\nDisallow: /\n')
if (base && cfg.indexar) gravar(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`)
console.log(`ok dist/index.html ${kb(html)} (${usados.size} ícones no sprite)`)
if (avisos.length) console.log(`AVISOS:\n  ${[...new Set(avisos)].join('\n  ')}`)
