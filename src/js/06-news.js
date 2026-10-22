/* Newsletter: o form mora num <template> e só entra na página quando a seção chega perto da
   tela (form no HTML faz o preenchimento automático forçar layout no 1º quadro, memória do
   080). Valida o e-mail na hora e responde na mesma linha. */
(function () {
  var MK = window.MK
  var vaga = document.querySelector('[data-news]')
  var tpl = document.getElementById('tpl-news')
  if (!vaga || !tpl) return

  function montar() {
    if (vaga.childElementCount) return
    vaga.appendChild(tpl.content.cloneNode(true))
    var form = vaga.querySelector('form')
    var input = form.querySelector('input')
    var campo = form.querySelector('.campo')
    var msg = form.querySelector('.news__msg')
    var erro = function (texto) {
      campo.classList.add('erro')
      msg.classList.add('erro')
      msg.textContent = texto
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      if (!input.value.trim()) return erro('Escreva o seu e-mail.')
      if (!MK.emailOk(input.value)) return erro('Confira o e-mail: falta o @ ou o domínio.')
      campo.classList.remove('erro')
      msg.classList.remove('erro')
      msg.textContent = 'Pronto. As próximas coleções chegam antes no seu e-mail.'
      form.classList.add('enviado')
      input.blur()
    })
    input.addEventListener('input', function () {
      if (campo.classList.contains('erro') && MK.emailOk(input.value)) {
        campo.classList.remove('erro')
        msg.classList.remove('erro')
        msg.textContent = ''
      }
    })
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (lista) {
      if (!lista[0].isIntersecting) return
      io.disconnect()
      montar()
    }, { rootMargin: '600px 0px' })
    io.observe(vaga)
  } else {
    montar()
  }
})()
