/* Sacola: os itens ficam no navegador (localStorage, quando ele deixa) e o número aparece no
   ícone do header. Promoção "Compre 1, leve 2": a cada dois óculos, o de menor valor sai de
   graça (os mais baratos da sacola, metade das unidades, arredondando pra baixo).
   Frete grátis a partir de R$ 399 e 5% de desconto no Pix, como na ficha da marca. */
(function () {
  var MK = window.MK
  var CHAVE = 'mykonos-sacola'
  var FRETE_GRATIS = 399
  var itens = []
  try { itens = JSON.parse(localStorage.getItem(CHAVE)) || [] } catch (e) { itens = [] }
  itens = itens.filter(function (i) { return i && MK.produto(i.id) && i.qtd > 0 })
  var ouvintes = []

  function mudou() {
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)) } catch (e) { /* aba anônima: segue sem guardar */ }
    ouvintes.forEach(function (f) { f() })
  }
  function achar(id) {
    for (var i = 0; i < itens.length; i++) if (itens[i].id === id) return itens[i]
    return null
  }

  MK.sacola = {
    itens: function () { return itens.map(function (i) { return { id: i.id, qtd: i.qtd } }) },
    qtd: function () { return itens.reduce(function (s, i) { return s + i.qtd }, 0) },
    adicionar: function (id) {
      if (!MK.produto(id)) return
      var i = achar(id)
      if (i) i.qtd++
      else itens.push({ id: id, qtd: 1 })
      mudou()
    },
    mudar: function (id, passo) {
      var i = achar(id)
      if (!i) return
      i.qtd += passo
      if (i.qtd <= 0) itens = itens.filter(function (x) { return x !== i })
      mudou()
    },
    remover: function (id) {
      itens = itens.filter(function (x) { return x.id !== id })
      mudou()
    },
    totais: function () {
      var unidades = []
      itens.forEach(function (i) {
        var p = MK.produto(i.id)
        for (var k = 0; k < i.qtd; k++) unidades.push(p.preco)
      })
      unidades.sort(function (a, b) { return a - b })
      var gratis = Math.floor(unidades.length / 2)
      var soma = function (l) { return l.reduce(function (s, v) { return s + v }, 0) }
      var subtotal = soma(unidades)
      var desconto = soma(unidades.slice(0, gratis))
      var total = subtotal - desconto
      return {
        unidades: unidades.length,
        subtotal: subtotal,
        desconto: desconto,
        total: total,
        freteGratis: total >= FRETE_GRATIS,
        faltaFrete: Math.max(0, FRETE_GRATIS - total),
      }
    },
    ouvir: function (f) { ouvintes.push(f) },
  }

  // número no ícone da sacola, com um pulinho quando muda
  var qtdEl = document.querySelector('[data-qtd]')
  var botao = document.querySelector('.topo__sacola')
  function pintar(animar) {
    if (!qtdEl || !botao) return
    var n = MK.sacola.qtd()
    qtdEl.textContent = n
    qtdEl.hidden = !n
    botao.setAttribute('aria-label', n ? 'Abrir a sacola, ' + n + (n > 1 ? ' itens' : ' item') : 'Abrir a sacola')
    if (animar && n && !MK.calmo) {
      qtdEl.classList.remove('pulo')
      void qtdEl.offsetWidth
      qtdEl.classList.add('pulo')
    }
  }
  pintar(false)
  MK.sacola.ouvir(function () { pintar(true) })
})()
