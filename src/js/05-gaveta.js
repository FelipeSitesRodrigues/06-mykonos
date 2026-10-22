/* Gaveta: o painel lateral da loja. Um <dialog> só (modal: prende o foco, fecha no Esc e
   devolve o foco pra quem abriu), com várias vistas:
   - menu (celular, sai da esquerda) · colecao:sol|selene · busca · produto:id · sacola
   - conta · marca · ajuda:trocas|frete|contato
   Qualquer elemento com data-abrir="vista:param" abre a vista. Dentro da gaveta, a vista
   anterior vai pra pilha e a seta de voltar aparece. Entrada em .7 s, saída em .42 s (sair é
   mais rápido que entrar); o conteúdo entra em cascata (.entra). Só transform e opacity. */
(function () {
  var MK = window.MK
  var dlg = document.getElementById('gaveta')
  if (!dlg || typeof dlg.showModal !== 'function') return
  var raiz = document.documentElement
  var corpo = dlg.querySelector('.gaveta__corpo')
  var pe = dlg.querySelector('.gaveta__pe')
  var titulo = dlg.querySelector('.gaveta__titulo')
  var voltar = dlg.querySelector('[data-voltar]')
  var fundo = document.createElement('div')
  fundo.className = 'gaveta__fundo'
  fundo.setAttribute('data-fechar', '')
  dlg.insertBefore(fundo, dlg.firstChild)

  var pilha = []
  var atual = null
  var lado = 'direita'
  var timer = 0
  var SAIDA = MK.calmo ? 0 : 420

  // ---------------------------------------------------------------- peças
  function icone(nome) {
    return '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + nome + '-light"/></svg>'
  }
  function foto(f, alt, classe, sizes) {
    return '<picture class="' + classe + '"><source type="image/avif" srcset="' + f.avif + '" sizes="' + sizes + '">' +
      '<img src="' + f.src + '" srcset="' + f.webp + '" sizes="' + sizes + '" width="' + f.w + '" height="' + f.h + '" alt="' + MK.esc(alt) + '" decoding="async"></picture>'
  }
  var TAM_CARD = '(min-width: 34em) 14rem, 46vw'
  function card(p, i) {
    return '<li class="card card--gaveta entra" style="--i:' + i + '">' +
      '<a class="card__link" href="#produto-' + p.id + '" data-abrir="produto:' + p.id + '">' +
      '<span class="card__fotos"><span class="card__trilho" data-trilho>' +
      foto(p.produto, p.altProduto, 'card__quadro', TAM_CARD) +
      foto(p.pessoa, '', 'card__quadro card__quadro--pessoa', TAM_CARD) +
      '</span></span>' +
      '<span class="card__nome">' + MK.esc(p.nome) + '</span>' +
      '<span class="card__preco">' + MK.reais(p.preco) + '</span></a>' +
      '<span class="card__pontos" aria-hidden="true"><i></i><i></i></span>' +
      '<button class="card__add" type="button" data-adicionar="' + p.id + '" aria-label="Adicionar ' + MK.esc(p.nome) + ' à sacola">Adicionar à sacola</button></li>'
  }
  function modelo(id) {
    var t = document.getElementById(id)
    return t ? '<div class="entra">' + t.innerHTML + '</div>' : ''
  }
  function linha(p) {
    return (MK.dados.linhas[p.linha] || {}).titulo || ''
  }

  // ---------------------------------------------------------------- vistas
  var VISTAS = {
    menu: function () {
      return { titulo: 'Menu', lado: 'esquerda', corpo: modelo('tpl-menu') }
    },
    colecao: function (qual) {
      var l = MK.dados.linhas[qual]
      if (!l) return null
      var lista = MK.dados.produtos.filter(function (p) { return p.linha === qual })
      return {
        titulo: l.titulo,
        corpo: '<p class="gaveta__intro entra">' + MK.esc(l.texto) + '</p>' +
          '<ul class="grade grade--gaveta" role="list">' + lista.map(function (p, i) { return card(p, i + 1) }).join('') + '</ul>',
      }
    },
    busca: function () {
      return {
        titulo: 'Buscar',
        corpo: '<div class="busca entra"><div class="campo"><input class="campo__input" id="busca-q" type="search" autocomplete="off" spellcheck="false" placeholder=" ">' +
          '<label class="campo__rotulo" for="busca-q">Nome, cor ou formato</label></div>' +
          '<p class="busca__conta" role="status" aria-live="polite"></p></div>' +
          '<ul class="grade grade--gaveta" role="list" data-resultados></ul>',
        depois: busca,
        foco: '#busca-q',
      }
    },
    produto: function (id) {
      var p = MK.produto(id)
      if (!p) return null
      var TAM = '(min-width: 34em) 15rem, 50vw'
      return {
        titulo: linha(p),
        corpo: '<article class="produto">' +
          '<div class="produto__fotos entra">' + foto(p.produto, p.altProduto, 'produto__foto', TAM) + foto(p.pessoa, p.altPessoa, 'produto__foto', TAM) + '</div>' +
          '<h3 class="produto__nome entra" style="--i:1">' + MK.esc(p.nome) + '</h3>' +
          '<p class="produto__resumo entra" style="--i:1">' + MK.esc(p.resumo) + '</p>' +
          '<p class="produto__preco entra" style="--i:2">' + MK.reais(p.preco) + '</p>' +
          '<p class="produto__condicoes entra" style="--i:2">6x de ' + MK.reais(p.preco / 6) + ' sem juros ou ' + MK.reais(p.preco * 0.95) + ' no Pix</p>' +
          '<p class="produto__desc entra" style="--i:3">' + MK.esc(p.descricao) + '</p>' +
          '<ul class="produto__detalhes entra" style="--i:4" role="list"><li>Estojo rígido azul e flanela listrada</li><li>Garantia de 1 ano</li><li>Troca em 30 dias</li></ul>' +
          '</article>',
        pe: '<button class="botao" type="button" data-adicionar="' + p.id + '">Adicionar à sacola</button>',
      }
    },
    sacola: function () {
      var itens = MK.sacola.itens()
      if (!itens.length) {
        return {
          titulo: 'Sacola',
          corpo: '<div class="vazio entra"><p>Sua sacola está vazia.</p><p><a class="link" href="#linhas" data-abrir="colecao:sol">Ver a coleção</a></p></div>',
        }
      }
      var t = MK.sacola.totais()
      return {
        titulo: 'Sacola (' + MK.sacola.qtd() + ')',
        corpo: '<ul class="sacola" role="list">' + itens.map(function (it, i) { return itemSacola(MK.produto(it.id), it.qtd, i) }).join('') + '</ul>' +
          (t.unidades % 2 ? '<p class="sacola__dica entra" style="--i:' + itens.length + '">Compre 1, leve 2: escolha mais um óculos e o de menor valor sai por nossa conta.</p>' : ''),
        pe: totais(t),
      }
    },
    conta: function () {
      return { titulo: 'Entrar', corpo: modelo('tpl-conta'), depois: conta, foco: '#conta-email' }
    },
    marca: function () {
      return { titulo: 'A marca', corpo: modelo('tpl-marca') }
    },
    ajuda: function (secao) {
      return {
        titulo: 'Ajuda',
        corpo: modelo('tpl-ajuda'),
        depois: function () {
          var el = secao && corpo.querySelector('#ajuda-' + secao)
          if (el && secao !== 'trocas') corpo.scrollTop = el.offsetTop - corpo.offsetTop - 24
        },
      }
    },
  }

  function itemSacola(p, qtd, i) {
    return '<li class="sacola__item entra" style="--i:' + i + '">' +
      foto(p.produto, '', 'sacola__foto', '5.5rem') +
      '<div class="sacola__info"><p class="sacola__nome">' + MK.esc(p.nome) + '</p>' +
      '<p class="sacola__linha">' + MK.esc(linha(p)) + '</p>' +
      '<div class="sacola__qtd"><button type="button" data-menos="' + p.id + '" aria-label="Tirar um ' + MK.esc(p.nome) + '">' + icone('minus') + '</button>' +
      '<span>' + qtd + '<span class="sr-only"> na sacola</span></span>' +
      '<button type="button" data-mais="' + p.id + '" aria-label="Mais um ' + MK.esc(p.nome) + '">' + icone('plus') + '</button></div></div>' +
      '<div class="sacola__dir"><p class="sacola__preco">' + MK.reais(p.preco * qtd) + '</p>' +
      '<button class="sacola__remover" type="button" data-remover="' + p.id + '">Remover<span class="sr-only"> ' + MK.esc(p.nome) + '</span></button></div></li>'
  }
  function totais(t) {
    var l = '<div><dt>Subtotal</dt><dd>' + MK.reais(t.subtotal) + '</dd></div>'
    if (t.desconto) l += '<div class="totais__promo"><dt>Compre 1, leve 2</dt><dd>-' + MK.reais(t.desconto) + '</dd></div>'
    l += '<div><dt>Frete</dt><dd>' + (t.freteGratis ? 'Grátis' : 'Calculado pelo CEP') + '</dd></div>'
    l += '<div class="totais__total"><dt>Total</dt><dd>' + MK.reais(t.total) + '</dd></div>'
    return '<dl class="totais">' + l + '</dl>' +
      '<p class="totais__nota">' + MK.reais(t.total * 0.95) + ' no Pix ou 6x de ' + MK.reais(t.total / 6) + ' sem juros</p>' +
      (t.freteGratis ? '' : '<p class="totais__nota">Faltam ' + MK.reais(t.faltaFrete) + ' pro frete grátis.</p>') +
      '<button class="botao" type="button" data-finalizar>Finalizar compra</button>' +
      '<p class="totais__aviso" role="status" aria-live="polite"></p>'
  }

  // ---------------------------------------------------------------- busca e conta
  var semAcento = function (t) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
  function busca() {
    var q = corpo.querySelector('#busca-q')
    var res = corpo.querySelector('[data-resultados]')
    var conta = corpo.querySelector('.busca__conta')
    var primeira = true
    function filtrar() {
      var termos = semAcento(q.value).split(/\s+/).filter(Boolean)
      var lista = MK.dados.produtos.filter(function (p) {
        var alvo = semAcento(p.busca)
        return termos.every(function (t) { return alvo.indexOf(t) > -1 })
      })
      var html = lista.map(function (p, i) { return card(p, i + 1) }).join('')
      res.innerHTML = primeira ? html : html.replace(/ entra/g, '')
      primeira = false
      conta.textContent = lista.length ? lista.length + (lista.length > 1 ? ' modelos' : ' modelo') : ''
      if (!lista.length) res.innerHTML = '<li class="vazio">Nenhum modelo com esse nome. Tente “tartaruga”, “dourado” ou “âmbar”.</li>'
      MK.trilhos(res)
    }
    q.addEventListener('input', filtrar)
    filtrar()
  }
  function conta() {
    var form = corpo.querySelector('.conta__form')
    if (!form) return
    var input = form.querySelector('input')
    var campo = form.querySelector('.campo')
    var msg = form.querySelector('.conta__msg')
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      if (!MK.emailOk(input.value)) {
        campo.classList.add('erro')
        msg.classList.add('erro')
        msg.textContent = input.value.trim() ? 'Confira o e-mail: falta o @ ou o domínio.' : 'Escreva o seu e-mail.'
        input.focus()
        return
      }
      campo.classList.remove('erro')
      msg.classList.remove('erro')
      msg.textContent = 'Pronto. Numa loja de verdade, o link de acesso chegaria no seu e-mail agora (este é um site conceito).'
      form.classList.add('enviado')
    })
  }

  // ---------------------------------------------------------------- abrir, trocar e fechar
  function desenhar(nome, param, quieto) {
    var v = VISTAS[nome] && VISTAS[nome](param)
    if (!v) return false
    atual = { nome: nome, param: param }
    titulo.textContent = v.titulo || ''
    corpo.innerHTML = quieto ? (v.corpo || '').replace(/ entra(?=["\s])/g, '') : v.corpo || ''
    if (!quieto) corpo.scrollTop = 0
    pe.innerHTML = v.pe || ''
    pe.hidden = !v.pe
    voltar.hidden = !pilha.length
    dlg.setAttribute('data-vista', nome)
    if (v.depois) v.depois(param)
    MK.trilhos(corpo)
    if (v.foco && !MK.toque) {
      var f = corpo.querySelector(v.foco)
      if (f) f.focus({ preventScroll: true })
    }
    return true
  }

  function abrir(nome, param, empilhar) {
    var novoLado = nome === 'menu' ? 'esquerda' : 'direita'
    if (dlg.open && novoLado !== lado) {
      fechar(function () { abrir(nome, param) })
      return
    }
    clearTimeout(timer)
    if (dlg.open && empilhar && atual && (atual.nome !== nome || atual.param !== param)) pilha.push(atual)
    if (!dlg.open) pilha = []
    if (!desenhar(nome, param)) return
    if (dlg.open) return
    lado = novoLado
    dlg.classList.toggle('gaveta--esquerda', lado === 'esquerda')
    // trava a página atrás; a barra de rolagem some e o vão dela vira padding, pra nada pular
    var barra = innerWidth - raiz.clientWidth
    dlg.showModal()
    raiz.classList.add('travado')
    if (barra > 0) document.body.style.paddingRight = barra + 'px'
    if (MK.lenis) MK.lenis.stop()
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { dlg.classList.add('aberta') })
    })
  }

  function fechar(depois) {
    if (!dlg.open) return
    dlg.classList.remove('aberta')
    clearTimeout(timer)
    timer = setTimeout(function () {
      dlg.close()
      raiz.classList.remove('travado')
      document.body.style.paddingRight = ''
      if (MK.lenis) MK.lenis.start()
      corpo.innerHTML = ''
      pe.innerHTML = ''
      pilha = []
      atual = null
      if (depois) depois()
    }, SAIDA)
  }

  dlg.addEventListener('cancel', function (e) {
    e.preventDefault()
    fechar()
  })

  MK.sacola.ouvir(function () {
    if (dlg.open && atual && atual.nome === 'sacola') desenhar('sacola', null, true)
  })

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-abrir], [data-fechar], [data-voltar], [data-adicionar], [data-mais], [data-menos], [data-remover], [data-finalizar]')
    if (!el) return
    if (el.hasAttribute('data-abrir')) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return
      e.preventDefault()
      var partes = el.getAttribute('data-abrir').split(':')
      abrir(partes[0], partes[1], dlg.contains(el))
    } else if (el.hasAttribute('data-fechar')) {
      var href = el.getAttribute('href')
      if (href && href.charAt(0) === '#') {
        e.preventDefault()
        fechar(function () { MK.irPara(href) })
      } else fechar()
    } else if (el.hasAttribute('data-voltar')) {
      var anterior = pilha.pop()
      if (anterior) desenhar(anterior.nome, anterior.param)
    } else if (el.hasAttribute('data-adicionar')) {
      MK.sacola.adicionar(el.getAttribute('data-adicionar'))
      abrir('sacola', null, dlg.contains(el))
    } else if (el.hasAttribute('data-mais')) {
      MK.sacola.mudar(el.getAttribute('data-mais'), 1)
    } else if (el.hasAttribute('data-menos')) {
      MK.sacola.mudar(el.getAttribute('data-menos'), -1)
    } else if (el.hasAttribute('data-remover')) {
      MK.sacola.remover(el.getAttribute('data-remover'))
    } else if (el.hasAttribute('data-finalizar')) {
      var aviso = pe.querySelector('.totais__aviso')
      if (aviso) aviso.textContent = 'Este é um site conceito: a compra não é finalizada e nada é cobrado.'
    }
  })

  // link de produto aberto direto (#produto-hydra): abre a gaveta dele
  var m = /^#produto-([\w-]+)$/.exec(location.hash)
  if (m && MK.produto(m[1])) abrir('produto', m[1])
})()
