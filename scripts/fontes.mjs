/**
 * Fontes do site, servidas do próprio domínio (base do 02-nubank). Grava em src/assets/fonts e
 * escreve o @font-face em src/css/_fontes.css.
 *
 * - Benito (comprada na HipFonts, "../06 - Mykonos/Recursos Site/FONTES/benito"): Extra Bold no
 *   logo e nos títulos dos banners; Regular na frase da newsletter (no mockup, a única letra de
 *   contraste fora dos títulos). Corte pro que o site usa: ASCII, Latin-1 (acentos do português) e
 *   a pontuação tipográfica, com as features de layout (kern) mantidas.
 * - Jost 400, 500 e 600 (Google Fonts, pelo @fontsource/jost, já cortada em latin): menu,
 *   rótulos espaçados, preço e texto corrido; a 600 só nos títulos do rodapé e no "Assinar".
 * - Fallback com size-adjust medido contra a Arial: enquanto a fonte chega, o texto ocupa quase o
 *   mesmo espaço e a linha não quebra diferente (CLS). Um local() só por fonte: no Windows, a
 *   lista com três nomes ("Arial-BoldMT", "Helvetica"...) pesou ~100 ms no 1º layout com a CPU
 *   do celular (trace com 4x, 2026-10-19).
 *
 * Uso: node scripts/fontes.mjs   (ou npm run fontes)
 */
import { writeFileSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import opentype from 'opentype.js'

const BENITO = '../06 - Mykonos/Recursos Site/FONTES/benito'
const JOST = 'node_modules/@fontsource/jost/files'
const OUT = 'src/assets/fonts'
mkdirSync(OUT, { recursive: true })

let LETRAS = ''
for (let c = 0x20; c <= 0x7e; c++) LETRAS += String.fromCharCode(c)
for (let c = 0xa0; c <= 0xff; c++) LETRAS += String.fromCharCode(c)
LETRAS += '‘’“”•…'

const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
const kb = (b) => (b.length / 1024).toFixed(1) + ' KB'
const largura = (fonte, texto) => fonte.getAdvanceWidth(texto, fonte.unitsPerEm) / fonte.unitsPerEm
const pct = (v) => (v * 100).toFixed(2) + '%'
const arial = opentype.parse(ab(readFileSync('C:/Windows/Fonts/arial.ttf')))
const arialNegrito = opentype.parse(ab(readFileSync('C:/Windows/Fonts/arialbd.ttf')))

const saida = ['/* Gerado por scripts/fontes.mjs. Não editar à mão. */']
const face = (familia, peso, arq) => `@font-face {
  font-family: '${familia}';
  font-style: normal;
  font-weight: ${peso};
  font-display: swap;
  src: url('/assets/fonts/${arq}') format('woff2');
}`
// fallback: Arial com a largura da fonte de verdade (medida numa frase do próprio site)
function reserva(familia, fonte, base, local, amostra) {
  const ajuste = largura(fonte, amostra) / largura(base, amostra)
  const { ascender, descender, lineGap } = fonte.tables.hhea
  const upm = fonte.unitsPerEm
  const os2 = fonte.tables.os2
  console.log(`${familia}: maiúscula ${(os2.sCapHeight / upm).toFixed(3)} em, x ${(os2.sxHeight / upm).toFixed(3)} em, size-adjust ${pct(ajuste)}`)
  return `@font-face {
  font-family: '${familia} fallback';
  src: ${local};
  size-adjust: ${pct(ajuste)};
  ascent-override: ${pct(ascender / upm / ajuste)};
  descent-override: ${pct(Math.abs(descender) / upm / ajuste)};
  line-gap-override: ${pct((lineGap || 0) / upm / ajuste)};
}`
}

// ---------------------------------------------------------------- Benito
const benito = {}
for (const [arq, peso] of [['Benito Extra Bold.ttf', 800], ['Benito Regular.ttf', 400]]) {
  const bruto = readFileSync(path.join(BENITO, arq))
  const woff2 = await subsetFont(bruto, LETRAS, { targetFormat: 'woff2' })
  const nome = `benito-${peso}.woff2`
  writeFileSync(path.join(OUT, nome), woff2)
  console.log(`ok ${nome} ${kb(bruto)} → ${kb(woff2)}`)
  saida.push(face('Benito', peso, nome))
  benito[peso] = opentype.parse(ab(bruto))
}

// ---------------------------------------------------------------- Jost
for (const peso of [400, 500, 600]) {
  const nome = `jost-${peso}.woff2`
  copyFileSync(path.join(JOST, `jost-latin-${peso}-normal.woff2`), path.join(OUT, nome))
  saida.push(face('Jost', peso, nome))
}
// a métrica sai do .ttf do Jost 500 que já estava nos recursos (mesmo desenho da fonte do Google)
const jost = opentype.parse(ab(readFileSync('../06 - Mykonos/Recursos Site/FONTES/jost-500.ttf')))

saida.push(reserva('Benito', benito[800], arialNegrito, "local('Arial Bold')", 'VERÃO NO MAR EGEU. DESLIGUE O DIA.'))
saida.push(reserva('Jost', jost, arial, "local('Arial')", 'Acetato e metal, lente polarizada e um estojo que aguenta areia, barco e mala.'))

mkdirSync('src/css', { recursive: true })
writeFileSync('src/css/_fontes.css', saida.join('\n') + '\n')
console.log('src/css/_fontes.css gravado')
