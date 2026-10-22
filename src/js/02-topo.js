/* Header compacto: quando a parte de cima dele sai da tela (ele já grudou), o miolo desce pro
   meio da barra que sobrou e o logo diminui (CSS). Quem avisa é a sentinela, sem ouvir rolagem. */
(function () {
  var topo = document.getElementById('topo')
  var sentinela = document.querySelector('.topo__sentinela')
  if (!topo || !sentinela || !('IntersectionObserver' in window)) return
  new IntersectionObserver(function (lista) {
    var e = lista[0]
    topo.classList.toggle('compacto', !e.isIntersecting && e.boundingClientRect.top < 0)
  }).observe(sentinela)
})()
