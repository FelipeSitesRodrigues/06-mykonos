/* Entrada ao rolar: põe .visivel quando o bloco chega na tela (o CSS faz o resto, só com
   transform e opacity). Com movimento reduzido ou sem IntersectionObserver, tudo já nasce no
   lugar. A foto com cortina observa o próprio <a>/<div>, que não tem clip-path, então o
   observador enxerga (memória do reveal com clip-path).
   No toque, cada card tem um trilho com as duas fotos (óculos e pessoa): os traços embaixo
   mostram qual está na tela. MK.trilhos também serve pros cards que a gaveta monta. */
(function () {
  var MK = window.MK
  var alvos = document.querySelectorAll('.revelar, .revelar-foto, .banner, .marca__titulo')
  var ver = function (el) { el.classList.add('visivel') }
  if (MK.calmo || !('IntersectionObserver' in window)) {
    alvos.forEach(ver)
  } else {
    var io = new IntersectionObserver(function (lista) {
      lista.forEach(function (e) {
        if (!e.isIntersecting) return
        ver(e.target)
        io.unobserve(e.target)
      })
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 })
    alvos.forEach(function (el) { io.observe(el) })
  }

  MK.trilhos = function (raiz) {
    if (!MK.toque || !('IntersectionObserver' in window)) return
    raiz.querySelectorAll('[data-trilho]').forEach(function (trilho) {
      var card = trilho.closest('.card')
      var pessoa = trilho.querySelector('.card__quadro--pessoa')
      if (!card || !pessoa) return
      new IntersectionObserver(function (lista) {
        card.classList.toggle('na-pessoa', lista[0].intersectionRatio > 0.55)
      }, { root: trilho, threshold: [0.45, 0.55, 0.65] }).observe(pessoa)
    })
  }
  MK.trilhos(document)
})()
