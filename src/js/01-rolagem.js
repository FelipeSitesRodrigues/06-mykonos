/* Rolagem suave com o Lenis no computador (inércia na roda do mouse, base do 05-guday). Fica de
   fora no toque e com movimento reduzido; ?lenis=0 desliga. O script só baixa depois do load,
   pra não disputar a rede com a foto do hero (LCP).
   Links internos (#secao) deslizam até a seção e param logo abaixo do header grudado. Os que
   abrem a gaveta (data-abrir) ficam com o 05-gaveta.js. Enter no teclado segue no salto nativo,
   que leva o foco junto. */
(function () {
  var MK = window.MK
  var topo = document.getElementById('topo')

  // altura do header que continua na tela depois de grudar
  function folga() {
    if (!topo) return 0
    var raiz = getComputedStyle(document.documentElement)
    var rem = parseFloat(raiz.fontSize) || 16
    return topo.offsetHeight - (parseFloat(raiz.getPropertyValue('--topo-sobra')) || 0) * rem
  }
  MK.irPara = function (hash) {
    var alvo = hash && hash.length > 1 && document.getElementById(hash.slice(1))
    if (!alvo) return
    if (MK.lenis) MK.lenis.scrollTo(alvo, { offset: -folga(), duration: 1.4 })
    else alvo.scrollIntoView({ behavior: MK.calmo ? 'auto' : 'smooth', block: 'start' })
  }

  var liga = matchMedia('(pointer: fine)').matches && !MK.calmo && new URLSearchParams(location.search).get('lenis') !== '0'
  function iniciar() {
    if (window.Lenis) MK.lenis = new window.Lenis({ lerp: 0.09, autoRaf: true })
  }
  function carregar() {
    var s = document.createElement('script')
    s.src = '/assets/js/lenis.min.js'
    s.onload = iniciar
    document.head.appendChild(s)
  }
  if (liga) {
    if (document.readyState === 'complete') carregar()
    else addEventListener('load', carregar, { once: true })
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]')
    if (!a || e.defaultPrevented || !e.detail || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (a.hasAttribute('data-abrir') || a.hasAttribute('data-fechar') || a.classList.contains('pular')) return
    var hash = a.getAttribute('href')
    if (hash.length < 2 || !document.getElementById(hash.slice(1))) return
    e.preventDefault()
    history.pushState(null, '', hash)
    MK.irPara(hash)
  })
})()
