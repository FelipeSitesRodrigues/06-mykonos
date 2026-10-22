/* Base: o objeto MK que os outros arquivos usam (dados dos 9 modelos, preço em reais, e-mail). */
(function () {
  var MK = (window.MK = window.MK || {})
  MK.calmo = matchMedia('(prefers-reduced-motion: reduce)').matches
  MK.toque = matchMedia('(hover: none), (pointer: coarse)').matches

  var dados = document.getElementById('dados-produtos')
  MK.dados = dados ? JSON.parse(dados.textContent) : { produtos: [], linhas: {} }
  MK.produto = function (id) {
    for (var i = 0; i < MK.dados.produtos.length; i++) if (MK.dados.produtos[i].id === id) return MK.dados.produtos[i]
    return null
  }

  // R$ 449 quando é inteiro, R$ 426,55 quando tem centavo, R$ 1.347 com milhar
  var inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
  var centavos = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  MK.reais = function (v) {
    var redondo = Math.round(v * 100) / 100
    return 'R$ ' + (redondo % 1 === 0 ? inteiro.format(redondo) : centavos.format(redondo))
  }
  MK.emailOk = function (t) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(t).trim())
  }
  MK.esc = function (t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
})()
