/**
 * Imagens do site em src/assets/img, em AVIF e WebP e em várias larguras pra srcset, com o
 * manifesto.json (largura, altura e peso de cada arquivo, pro width/height do <img>). Base do
 * 02-nubank. Origem: "../06 - Mykonos/Recursos Site".
 *
 * - Banners do ChatGPT (BANNERS/, gerados no mesmo chat do mockup v2): o desktop sai inteiro (o
 *   CSS recorta com object-fit) e o celular sai num recorte em pé (CORTES_MOVEL, em px da
 *   imagem original), centrado no casal ou nos óculos.
 * - Cards (PRODUTOS/cards/, 500x625): óculos sozinho e a pessoa usando, a troca do hover.
 * - Favicons: o coqueiro do logo (MARCA/final/coqueiro.svg) em azul Grécia.
 * - Imagem de compartilhamento: o casal do hero com o logo branco.
 *
 * Uso: node scripts/imagens.mjs   (ou npm run imagens)
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const R = '../06 - Mykonos/Recursos Site'
const OUT = 'src/assets/img'
const RAIZ = 'src/raiz'
const AZUL = '#0D5EAF'

mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT)) rmSync(path.join(OUT, f), { recursive: true, force: true })
mkdirSync(RAIZ, { recursive: true })
const manifesto = {}

async function gravar(pipeline, nome) {
  const info = await pipeline.toFile(path.join(OUT, nome))
  manifesto[nome] = { w: info.width, h: info.height, kb: Math.round(info.size / 1024) }
}

// uma imagem (arquivo ou buffer) em várias larguras, AVIF e WebP
async function variantes(origem, nome, larguras, { q = 78, qAvif = 54 } = {}) {
  for (const w of larguras) {
    for (const f of ['avif', 'webp']) {
      let p = sharp(origem).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' })
      p = f === 'avif' ? p.avif({ quality: qAvif, effort: 8, chromaSubsampling: '4:4:4' }) : p.webp({ quality: q, effort: 6, smartSubsample: true })
      await gravar(p, `${nome}-${w}.${f}`)
    }
  }
}

const recorte = (arq, { x, y = 0, w, h }) => sharp(arq).extract({ left: x, top: y, width: w, height: h }).png().toBuffer()

// ---------------------------------------------------------------- banners e fotos de seção
const B = (n) => path.join(R, 'BANNERS', `${n}.png`)
// recorte em pé do celular, em px da imagem original
const CORTES_MOVEL = {
  hero: { x: 838, w: 753, h: 941 }, // o casal inteiro, do ombro dele ao lenço dela (4:5)
  compre1leve2: { x: 700, y: 0, w: 941, h: 941 }, // os dois óculos, com o mar atrás (1:1)
  selene: { x: 650, w: 819, h: 1024 }, // o NYX no deck e a bandeira (4:5)
  'linha-sol': { x: 355, w: 819, h: 1024 }, // as lentes do NAXOS no meio (4:5)
  'linha-selene': { x: 390, w: 819, h: 1024 }, // o NYX no lençol, com as luzes da vila (4:5)
}

await variantes(B('hero'), 'hero', [960, 1280, 1672], { qAvif: 56 })
await variantes(await recorte(B('hero'), CORTES_MOVEL.hero), 'hero-movel', [480, 753], { qAvif: 56 })
await variantes(B('compre1leve2'), 'compre', [960, 1280, 1672])
await variantes(await recorte(B('compre1leve2'), CORTES_MOVEL.compre1leve2), 'compre-movel', [480, 941])
await variantes(B('selene'), 'selene', [960, 1280, 1536])
await variantes(await recorte(B('selene'), CORTES_MOVEL.selene), 'selene-movel', [480, 819])
await variantes(B('linha-sol'), 'linha-sol', [720, 1080, 1536])
await variantes(await recorte(B('linha-sol'), CORTES_MOVEL['linha-sol']), 'linha-sol-movel', [400, 640])
await variantes(B('linha-selene'), 'linha-selene', [720, 1080, 1536])
await variantes(await recorte(B('linha-selene'), CORTES_MOVEL['linha-selene']), 'linha-selene-movel', [400, 640])
await variantes(B('marca'), 'marca', [640, 900, 1122])

// ---------------------------------------------------------------- cards (produto e pessoa)
const CARDS = path.join(R, 'PRODUTOS', 'cards')
for (const arq of readdirSync(CARDS).filter((f) => /-(produto|pessoa)\.png$/.test(f)).sort()) {
  await variantes(path.join(CARDS, arq), arq.replace('.png', ''), [400, 500], { q: 80, qAvif: 58 })
}

// ---------------------------------------------------------------- favicons
const coqueiro = readFileSync(path.join(R, 'MARCA/final/coqueiro.svg'), 'utf8')
const coqueiroAzul = coqueiro.replace('fill="currentColor"', `fill="${AZUL}"`)
writeFileSync(path.join(RAIZ, 'favicon.svg'), coqueiroAzul)
// ícone quadrado: coqueiro azul no branco, com respiro
async function icone(lado, folga) {
  const dentro = lado - folga * 2
  const desenho = await sharp(Buffer.from(coqueiroAzul), { density: 600 }).resize(dentro, dentro, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  return sharp({ create: { width: lado, height: lado, channels: 4, background: '#ffffff' } }).composite([{ input: desenho, left: folga, top: folga }]).png().toBuffer()
}
writeFileSync(path.join(RAIZ, 'favicon-32.png'), await icone(32, 2))
writeFileSync(path.join(RAIZ, 'apple-touch-icon.png'), await icone(180, 26))
// .ico com um PNG de 32 dentro (formato aceito por todos os navegadores)
const png32 = await icone(32, 2)
const cab = Buffer.alloc(22)
cab.writeUInt16LE(0, 0)
cab.writeUInt16LE(1, 2)
cab.writeUInt16LE(1, 4)
cab.writeUInt8(32, 6)
cab.writeUInt8(32, 7)
cab.writeUInt8(0, 8)
cab.writeUInt8(0, 9)
cab.writeUInt16LE(1, 10)
cab.writeUInt16LE(32, 12)
cab.writeUInt32LE(png32.length, 14)
cab.writeUInt32LE(22, 18)
writeFileSync(path.join(RAIZ, 'favicon.ico'), Buffer.concat([cab, png32]))

// ---------------------------------------------------------------- compartilhamento (1200x630)
const logoBranco = readFileSync(path.join(R, 'MARCA/final/mykonos-wordmark.svg'), 'utf8').replace('fill="currentColor"', 'fill="#ffffff"')
const logoOg = await sharp(Buffer.from(logoBranco), { density: 300 }).resize({ width: 380 }).png().toBuffer()
const fundoOg = await sharp(B('hero')).resize({ width: 1200, height: 630, fit: 'cover', position: 'centre' }).toBuffer()
await sharp(fundoOg)
  .composite([{ input: logoOg, left: 64, top: 630 - 64 - Math.round((380 * 755) / 4262) }])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(path.join(OUT, 'og-mykonos.jpg'))
  .then((info) => (manifesto['og-mykonos.jpg'] = { w: info.width, h: info.height, kb: Math.round(info.size / 1024) }))

writeFileSync(path.join(OUT, 'manifesto.json'), JSON.stringify(manifesto, null, 1))
const total = Object.values(manifesto).reduce((s, m) => s + m.kb, 0)
console.log(`ok ${Object.keys(manifesto).length} arquivos, ${total} KB no total`)
for (const n of ['hero-1672.avif', 'hero-movel-753.avif', 'compre-1672.avif', 'selene-1536.avif', 'marca-1122.avif', 'hydra-produto-500.avif']) console.log(`  ${n}: ${manifesto[n]?.kb} KB`)
