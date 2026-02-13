// =========================================
//  GAME.JS - Motor de Jogo (Versão 2.6)
// =========================================

// Elementos do DOM
const listaEl = document.getElementById('lista-quizes');
const quizStage = document.getElementById('quiz-stage');
const barraProgressoEl = document.getElementById('barra-progresso-container');
const tituloEl = document.getElementById('titulo-quiz');
const descricaoEl = document.getElementById('descricao-quiz');
const displayTempoEl = document.getElementById('display-tempo');
const contadorPerguntasEl = document.getElementById('contador-perguntas');
const telaSelecaoEl = document.getElementById('tela-selecao');

// Estado Global do Jogo
window.perguntas = [];
window.indiceAtual = 0;
window.acertos = 0;
window.pontuacaoTotal = 0;
window.modoJogo = null;

let respondido = false;
let dicasRestantes = 2;
let tempoTotal = 30;
let tempoRestante = 30;
let timerInterval;

// =======================
// UTILITÁRIOS
// =======================

function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function converterMarkdownSimples(texto) {
  if (!texto) return '';
  return texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// =======================
// INICIALIZAÇÃO E CARREGAMENTO
// =======================

if (listaEl) {
  fetch('data/quizes/index.json')
    .then(res => res.json())
    .then(dados => {
      listaEl.innerHTML = dados
        .map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
        .join('');
    })
    .catch(() => {
      listaEl.innerHTML = '<p style="text-align:center;">Erro ao carregar lista de quizes.</p>';
    });
}

if (quizStage) {
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get('id');

  if (idQuiz) {
    fetch(`data/quizes/${idQuiz}.md`)
      .then(res => {
        if (!res.ok) throw new Error("Arquivo não encontrado");
        return res.text();
      })
      .then(text => {
        processarMarkdown(text);
        telaSelecaoEl.style.display = 'flex';
        quizStage.style.display = 'none';
      })
      .catch(err => {
        console.error(err);
        if (tituloEl) tituloEl.innerText = "Erro ao carregar";
        quizStage.innerHTML = '<p style="text-align:center">Não foi possível carregar os dados.</p>';
        quizStage.style.display = 'block';
      });
  }
}

// =======================
// PARSER DE MARKDOWN (BLOCOS MD)
// =======================

function processarMarkdown(md) {
  const linhas = md.replace(/\r\n/g, '\n').split('\n');
  let descricaoBuffer = '';
  let dentroBlocoDescricao = false;
  let todasPerguntas = [];
  let categoriaAtual = 'Geral';
  let perguntaAtual = null; 
  let ultimaOpcao = null;

  linhas.forEach((linha) => {
    const l = linha.trim();

    if (l.startsWith('```md')) { dentroBlocoDescricao = true; return; }
    if (l.startsWith('```') && dentroBlocoDescricao) { dentroBlocoDescricao = false; return; }
    if (dentroBlocoDescricao) { descricaoBuffer += linha + '\n'; return; }

    if (!l) return;

    if (l.startsWith('# ')) {
      if (tituloEl) tituloEl.innerText = l.replace('# ', '').trim();
      return;
    }

    if (l.startsWith('## ')) return;

    const matchCat = l.match(/^<!--(.*)-->/);
    if (matchCat) { categoriaAtual = matchCat[1].trim(); return; }

    if (l.startsWith('id:')) {
      if (perguntaAtual) salvarPergunta(perguntaAtual, todasPerguntas);
      perguntaAtual = {
        id: l.replace('id:', '').trim(),
        categoria: categoriaAtual,
        enunciado: '',
        opcoes: [],
        dica: null
      };
      return;
    }

    if (l.startsWith('### ')) {
      if (perguntaAtual) perguntaAtual.enunciado = l.replace('### ', '').trim();
      return;
    }

    if (l.startsWith('[ ]') || l.startsWith('[x]')) {
      if (perguntaAtual) {
        const isCorrect = l.startsWith('[x]');
        const text = l.replace(/\[(x| )\]/, '').trim();
        ultimaOpcao = { texto: text, correta: isCorrect, explicacao: null };
        perguntaAtual.opcoes.push(ultimaOpcao);
      }
      return;
    }

    if (l.startsWith('-!') && ultimaOpcao) {
      ultimaOpcao.explicacao = l.replace('-!', '').trim();
      return;
    }

    if (l.startsWith('-#') && perguntaAtual) {
      perguntaAtual.dica = l.replace('-#', '').trim();
      return;
    }
  });

  if (perguntaAtual) salvarPergunta(perguntaAtual, todasPerguntas);
  window.perguntas = todasPerguntas;
  
  if (descricaoEl && descricaoBuffer) {
    descricaoEl.innerHTML = converterMarkdownSimples(descricaoBuffer);
    descricaoEl.style.display = 'block';
  }
}

function salvarPergunta(p, lista) {
  const corretas = p.opcoes.filter(opt => opt.correta).length;
  if (corretas === 1) lista.push(p);
}

// =======================
// CONTROLE DE FLUXO
// =======================

window.iniciarJogo = function (modo) {
  if (window.perguntas.length === 0) return;

  window.modoJogo = modo;
  window.indiceAtual = 0;
  window.acertos = 0;
  window.pontuacaoTotal = 0;
  dicasRestantes = 2;
  tempoTotal = modo === 'desafio' ? 15 : 30;

  if (modo === 'desafio') document.body.classList.add('modo-desafio');
  else document.body.classList.remove('modo-desafio');

  // AJUSTE: Mantemos o título visível, apenas escondemos a descrição
  telaSelecaoEl.style.display = 'none';
  if (descricaoEl) descricaoEl.style.display = 'none';
  
  // Garantimos que o título continue visível e talvez menor/elegante
  if (tituloEl) {
      tituloEl.style.display = 'block';
      tituloEl.style.fontSize = '1.1rem'; // Reduz um pouco o tamanho durante o jogo
      tituloEl.style.opacity = '0.9';
  }
  
  quizStage.style.display = 'grid';
  barraProgressoEl.style.display = 'flex';
  displayTempoEl.style.display = 'block';
  contadorPerguntasEl.style.display = 'block';

  window.perguntas = embaralhar([...window.perguntas]);

  renderizarBarraProgresso();
  adicionarNovaPergunta(window.perguntas[0], false);
};

function renderizarBarraProgresso() {
  barraProgressoEl.innerHTML = '';
  if (window.modoJogo === 'desafio') {
    barraProgressoEl.innerHTML = `<div class="segmento-barra" id="seg-unico" style="flex: 1;"><div class="fill-tempo"></div></div>`;
  } else {
    barraProgressoEl.innerHTML = window.perguntas
      .map((_, i) => `<div class="segmento-barra" id="seg-${i}"><div class="fill-tempo"></div></div>`)
      .join('');
  }
}

function adicionarNovaPergunta(p, comAnimacao = true) {
  respondido = false;
  contadorPerguntasEl.innerText = `${window.indiceAtual + 1} / ${window.perguntas.length}`;

  const opcoesEmb = embaralhar([...p.opcoes]);
  const novoCard = document.createElement('div');
  novoCard.className = 'card-quiz';

  novoCard.innerHTML = `
        <div style="font-size:0.65rem; text-transform:uppercase; opacity:0.5; margin-bottom:4px; font-weight:800; letter-spacing:1px; text-align:center;">
            ${p.categoria}
        </div>
        <div class="pergunta">${p.enunciado}</div>
        <div class="lista-opcoes">
            ${opcoesEmb.map((op, i) => `
                <div class="opcao-wrapper">
                    <div class="opcao" data-is-correct="${op.correta}" onclick="verificarResposta(${i}, this)">
                        ${op.texto}
                    </div>
                    ${op.explicacao ? `
                        <div class="container-explicacao" style="display:none;">
                            <button class="btn-explicacao" onclick="this.nextElementSibling.style.display='block'; this.style.display='none'">
                                🎓 Por que?
                            </button>
                            <div class="box-explicacao" style="display:none;">
                                ${converterMarkdownSimples(op.explicacao)}
                            </div>
                        </div>
                    ` : ''}
                </div>`).join('')}
        </div>
        <div class="area-dica-container">
            ${p.dica ? `<button class="btn-dica-minimal" ${dicasRestantes <= 0 ? 'disabled' : ''} onclick="mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">💡 Dica <span class="contador-dica">${dicasRestantes}</span></button>` : ''}
            <div class="texto-dica-placeholder"></div>
        </div>
        <button id="btn-prox" onclick="transicaoProximaPergunta()">Próxima Questão ➜</button>
    `;

  if (comAnimacao) {
    novoCard.classList.add('pre-render-direita');
    const cardAntigo = quizStage.querySelector('.card-quiz.ativo');
    quizStage.appendChild(novoCard);
    void novoCard.offsetWidth;
    if (cardAntigo) {
      cardAntigo.classList.replace('ativo', 'saindo-esquerda');
      setTimeout(() => cardAntigo.remove(), 500);
    }
    novoCard.classList.replace('pre-render-direita', 'ativo');
  } else {
    novoCard.classList.add('ativo');
    quizStage.appendChild(novoCard);
  }

  iniciarTimer();
  animarBarraAtual();
}

function animarBarraAtual() {
  const idAlvo = window.modoJogo === 'desafio' ? 'seg-unico' : `seg-${window.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (!seg) return;
  seg.classList.remove('correto', 'errado');
  const fill = seg.querySelector('.fill-tempo');
  fill.style.transition = 'none';
  fill.style.width = '0%';
  void fill.offsetWidth;
  fill.style.transition = `width ${tempoTotal}s linear`;
  fill.style.width = '100%';
}

function iniciarTimer() {
  tempoRestante = tempoTotal;
  clearInterval(timerInterval);
  displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
  timerInterval = setInterval(() => {
    tempoRestante--;
    displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
    if (tempoRestante <= 0) {
      clearInterval(timerInterval);
      if (window.modoJogo === 'desafio') gameOverDesafio('Tempo esgotado!');
      else verificarResposta(-1, null);
    }
  }, 1000);
}

window.verificarResposta = function (index, el) {
  if (respondido) return;
  respondido = true;
  clearInterval(timerInterval);

  const idAlvo = window.modoJogo === 'desafio' ? 'seg-unico' : `seg-${window.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (seg) {
      const fill = seg.querySelector('.fill-tempo');
      fill.style.width = window.getComputedStyle(fill).width;
      fill.style.transition = 'none';
  }

  const card = document.querySelector('.card-quiz.ativo');
  const opcoes = card.querySelectorAll('.opcao');
  const explicacoes = card.querySelectorAll('.container-explicacao');
  let acertou = false;

  opcoes.forEach((opt, i) => {
    opt.classList.add('bloqueado');
    const isCorrect = opt.getAttribute('data-is-correct') === 'true';
    if (isCorrect) {
      opt.classList.add('correta');
      if (opt === el) acertou = true;
    } else if (opt === el) {
      opt.classList.add('errada');
    }
  });

  explicacoes.forEach(exp => {
      exp.style.display = 'block';
      exp.style.animation = 'fadeIn 0.5s ease';
  });

  if (acertou) {
    window.acertos++;
    let base = window.modoJogo === 'desafio' ? 15 : 10;
    window.pontuacaoTotal += (base + Math.round(base * (tempoRestante / tempoTotal)));
  }

  if (window.modoJogo === 'desafio' && !acertou) {
    setTimeout(() => gameOverDesafio(index === -1 ? 'Tempo Esgotado!' : 'Você Errou!'), 1200);
    return;
  }

  if (window.modoJogo === 'normal' && seg) seg.classList.add(acertou ? 'correto' : 'errado');
  card.querySelector('#btn-prox').style.display = 'block';
};

window.mostrarDica = function (btn, texto) {
  if (dicasRestantes <= 0) return;
  dicasRestantes--;
  btn.disabled = true;
  btn.innerHTML = `💡 Dica <span class="contador-dica">${dicasRestantes}</span>`;
  const area = document.querySelector('.card-quiz.ativo .texto-dica-placeholder');
  area.innerHTML = `<div class="box-dica-texto">${texto}</div>`;
};

window.transicaoProximaPergunta = function () {
  window.indiceAtual++;
  if (window.indiceAtual >= window.perguntas.length) mostrarResultadoFinal();
  else adicionarNovaPergunta(window.perguntas[window.indiceAtual], true);
};

function gameOverDesafio(motivo) {
  if (tituloEl) tituloEl.style.fontSize = '1.3rem';
  quizStage.innerHTML = `<div class="card-quiz ativo" style="text-align:center; border: 2px solid var(--error);"><h2 style="font-size:3rem;">☠️</h2><h3 style="color:var(--error);">${motivo}</h3><p>Fim de jogo no desafio.</p><button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer; margin-top:20px;">Tentar Novamente</button></div>`;
  displayTempoEl.style.display = 'none';
  contadorPerguntasEl.style.display = 'none';
  barraProgressoEl.style.display = 'none';
}

function mostrarResultadoFinal() {
  if (tituloEl) tituloEl.style.fontSize = '1.3rem';
  const porcentagem = (window.acertos / window.perguntas.length);
  const win = porcentagem >= 0.6;
  displayTempoEl.style.display = 'none';
  contadorPerguntasEl.style.display = 'none';
  barraProgressoEl.style.display = 'none';
  
  quizStage.innerHTML = `<div class="card-quiz ativo" style="text-align:center;"><h2>${win ? 'Incrível!' : 'Bom Treino!'}</h2><div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">${window.pontuacaoTotal} <span style="font-size:1.5rem">pts</span></div><p style="font-weight:600;">Você acertou ${window.acertos} de ${window.perguntas.length}</p><hr style="border:0; border-top:1px solid #eee; margin:20px 0;"><h3>Salvar no Ranking</h3><input type="text" id="input-nome-jogador" maxlength="15" placeholder="seu nome" oninput="this.value = this.value.toLowerCase().replace(/[^a-zà-úç ]/g, '')"><button id="btn-salvar-final" onclick="enviarPontuacao()" style="background:#2563eb; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; margin-top:10px;">💾 Salvar Conquista</button><button onclick="location.reload()" style="background:transparent; border:1px solid #ccc; padding:10px; width:100%; margin-top:10px; border-radius:12px; cursor:pointer;">Menu Principal</button></div>`;
  if (win) dispararConfete();
}

function dispararConfete() {
  const canvas = document.getElementById('canvas-confete');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({ length: 120 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height, w: Math.random() * 10 + 5, h: Math.random() * 10 + 5, color: ['#ff0', '#0f0', '#00f', '#f0f', '#0ff', '#fff'][Math.floor(Math.random() * 6)], s: Math.random() * 3 + 2, a: Math.random() * 360, }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.w, p.h); p.y += p.s; p.a += 0.1; if (p.y > canvas.height) p.y = -10; });
    if (canvas.width > 0) requestAnimationFrame(draw);
  }
  draw();
  setTimeout(() => { canvas.width = 0; }, 5000);
}

// =========================================
//  GAME.JS - Motor de Jogo (Versão 2.6)
// =========================================

// Elementos do DOM
const listaEl = document.getElementById('lista-quizes');
const quizStage = document.getElementById('quiz-stage');
const barraProgressoEl = document.getElementById('barra-progresso-container');
const tituloEl = document.getElementById('titulo-quiz');
const descricaoEl = document.getElementById('descricao-quiz');
const displayTempoEl = document.getElementById('display-tempo');
const contadorPerguntasEl = document.getElementById('contador-perguntas');
const telaSelecaoEl = document.getElementById('tela-selecao');

// Estado Global do Jogo
window.perguntas = [];
window.indiceAtual = 0;
window.acertos = 0;
window.pontuacaoTotal = 0;
window.modoJogo = null;

let respondido = false;
let dicasRestantes = 2;
let tempoTotal = 30;
let tempoRestante = 30;
let timerInterval;

// =======================
// UTILITÁRIOS
// =======================

function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function converterMarkdownSimples(texto) {
  if (!texto) return '';
  return texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// =======================
// INICIALIZAÇÃO E CARREGAMENTO
// =======================

if (listaEl) {
  fetch('data/quizes/index.json')
    .then(res => res.json())
    .then(dados => {
      listaEl.innerHTML = dados
        .map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
        .join('');
    })
    .catch(() => {
      listaEl.innerHTML = '<p style="text-align:center;">Erro ao carregar lista de quizes.</p>';
    });
}

if (quizStage) {
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get('id');

  if (idQuiz) {
    fetch(`data/quizes/${idQuiz}.md`)
      .then(res => {
        if (!res.ok) throw new Error("Arquivo não encontrado");
        return res.text();
      })
      .then(text => {
        processarMarkdown(text);
        telaSelecaoEl.style.display = 'flex';
        quizStage.style.display = 'none';
      })
      .catch(err => {
        console.error(err);
        if (tituloEl) tituloEl.innerText = "Erro ao carregar";
        quizStage.innerHTML = '<p style="text-align:center">Não foi possível carregar os dados.</p>';
        quizStage.style.display = 'block';
      });
  }
}

// =======================
// PARSER DE MARKDOWN (BLOCOS MD)
// =======================

function processarMarkdown(md) {
  const linhas = md.replace(/\r\n/g, '\n').split('\n');
  let descricaoBuffer = '';
  let dentroBlocoDescricao = false;
  let todasPerguntas = [];
  let categoriaAtual = 'Geral';
  let perguntaAtual = null; 
  let ultimaOpcao = null;

  linhas.forEach((linha) => {
    const l = linha.trim();

    if (l.startsWith('```md')) { dentroBlocoDescricao = true; return; }
    if (l.startsWith('```') && dentroBlocoDescricao) { dentroBlocoDescricao = false; return; }
    if (dentroBlocoDescricao) { descricaoBuffer += linha + '\n'; return; }

    if (!l) return;

    if (l.startsWith('# ')) {
      if (tituloEl) tituloEl.innerText = l.replace('# ', '').trim();
      return;
    }

    if (l.startsWith('## ')) return;

    const matchCat = l.match(/^<!--(.*)-->/);
    if (matchCat) { categoriaAtual = matchCat[1].trim(); return; }

    if (l.startsWith('id:')) {
      if (perguntaAtual) salvarPergunta(perguntaAtual, todasPerguntas);
      perguntaAtual = {
        id: l.replace('id:', '').trim(),
        categoria: categoriaAtual,
        enunciado: '',
        opcoes: [],
        dica: null
      };
      return;
    }

    if (l.startsWith('### ')) {
      if (perguntaAtual) perguntaAtual.enunciado = l.replace('### ', '').trim();
      return;
    }

    if (l.startsWith('[ ]') || l.startsWith('[x]')) {
      if (perguntaAtual) {
        const isCorrect = l.startsWith('[x]');
        const text = l.replace(/\[(x| )\]/, '').trim();
        ultimaOpcao = { texto: text, correta: isCorrect, explicacao: null };
        perguntaAtual.opcoes.push(ultimaOpcao);
      }
      return;
    }

    if (l.startsWith('-!') && ultimaOpcao) {
      ultimaOpcao.explicacao = l.replace('-!', '').trim();
      return;
    }

    if (l.startsWith('-#') && perguntaAtual) {
      perguntaAtual.dica = l.replace('-#', '').trim();
      return;
    }
  });

  if (perguntaAtual) salvarPergunta(perguntaAtual, todasPerguntas);
  window.perguntas = todasPerguntas;
  
  if (descricaoEl && descricaoBuffer) {
    descricaoEl.innerHTML = converterMarkdownSimples(descricaoBuffer);
    descricaoEl.style.display = 'block';
  }
}

function salvarPergunta(p, lista) {
  const corretas = p.opcoes.filter(opt => opt.correta).length;
  if (corretas === 1) lista.push(p);
}

// =======================
// CONTROLE DE FLUXO
// =======================

window.iniciarJogo = function (modo) {
  if (window.perguntas.length === 0) return;

  window.modoJogo = modo;
  window.indiceAtual = 0;
  window.acertos = 0;
  window.pontuacaoTotal = 0;
  dicasRestantes = 2;
  tempoTotal = modo === 'desafio' ? 15 : 30;

  if (modo === 'desafio') document.body.classList.add('modo-desafio');
  else document.body.classList.remove('modo-desafio');

  // AJUSTE: Mantemos o título visível, apenas escondemos a descrição
  telaSelecaoEl.style.display = 'none';
  if (descricaoEl) descricaoEl.style.display = 'none';
  
  // Garantimos que o título continue visível e talvez menor/elegante
  if (tituloEl) {
      tituloEl.style.display = 'block';
      tituloEl.style.fontSize = '1.1rem'; // Reduz um pouco o tamanho durante o jogo
      tituloEl.style.opacity = '0.9';
  }
  
  quizStage.style.display = 'grid';
  barraProgressoEl.style.display = 'flex';
  displayTempoEl.style.display = 'block';
  contadorPerguntasEl.style.display = 'block';

  window.perguntas = embaralhar([...window.perguntas]);

  renderizarBarraProgresso();
  adicionarNovaPergunta(window.perguntas[0], false);
};

function renderizarBarraProgresso() {
  barraProgressoEl.innerHTML = '';
  if (window.modoJogo === 'desafio') {
    barraProgressoEl.innerHTML = `<div class="segmento-barra" id="seg-unico" style="flex: 1;"><div class="fill-tempo"></div></div>`;
  } else {
    barraProgressoEl.innerHTML = window.perguntas
      .map((_, i) => `<div class="segmento-barra" id="seg-${i}"><div class="fill-tempo"></div></div>`)
      .join('');
  }
}

function adicionarNovaPergunta(p, comAnimacao = true) {
  respondido = false;
  contadorPerguntasEl.innerText = `${window.indiceAtual + 1} / ${window.perguntas.length}`;

  const opcoesEmb = embaralhar([...p.opcoes]);
  const novoCard = document.createElement('div');
  novoCard.className = 'card-quiz';

  novoCard.innerHTML = `
        <div style="font-size:0.65rem; text-transform:uppercase; opacity:0.5; margin-bottom:4px; font-weight:800; letter-spacing:1px; text-align:center;">
            ${p.categoria}
        </div>
        <div class="pergunta">${p.enunciado}</div>
        <div class="lista-opcoes">
            ${opcoesEmb.map((op, i) => `
                <div class="opcao-wrapper">
                    <div class="opcao" data-is-correct="${op.correta}" onclick="verificarResposta(${i}, this)">
                        ${op.texto}
                    </div>
                    ${op.explicacao ? `
                        <div class="container-explicacao" style="display:none;">
                            <button class="btn-explicacao" onclick="this.nextElementSibling.style.display='block'; this.style.display='none'">
                                🎓 Por que?
                            </button>
                            <div class="box-explicacao" style="display:none;">
                                ${converterMarkdownSimples(op.explicacao)}
                            </div>
                        </div>
                    ` : ''}
                </div>`).join('')}
        </div>
        <div class="area-dica-container">
            ${p.dica ? `<button class="btn-dica-minimal" ${dicasRestantes <= 0 ? 'disabled' : ''} onclick="mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">💡 Dica <span class="contador-dica">${dicasRestantes}</span></button>` : ''}
            <div class="texto-dica-placeholder"></div>
        </div>
        <button id="btn-prox" onclick="transicaoProximaPergunta()">Próxima Questão ➜</button>
    `;

  if (comAnimacao) {
    novoCard.classList.add('pre-render-direita');
    const cardAntigo = quizStage.querySelector('.card-quiz.ativo');
    quizStage.appendChild(novoCard);
    void novoCard.offsetWidth;
    if (cardAntigo) {
      cardAntigo.classList.replace('ativo', 'saindo-esquerda');
      setTimeout(() => cardAntigo.remove(), 500);
    }
    novoCard.classList.replace('pre-render-direita', 'ativo');
  } else {
    novoCard.classList.add('ativo');
    quizStage.appendChild(novoCard);
  }

  iniciarTimer();
  animarBarraAtual();
}

function animarBarraAtual() {
  const idAlvo = window.modoJogo === 'desafio' ? 'seg-unico' : `seg-${window.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (!seg) return;
  seg.classList.remove('correto', 'errado');
  const fill = seg.querySelector('.fill-tempo');
  fill.style.transition = 'none';
  fill.style.width = '0%';
  void fill.offsetWidth;
  fill.style.transition = `width ${tempoTotal}s linear`;
  fill.style.width = '100%';
}

function iniciarTimer() {
  tempoRestante = tempoTotal;
  clearInterval(timerInterval);
  displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
  timerInterval = setInterval(() => {
    tempoRestante--;
    displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
    if (tempoRestante <= 0) {
      clearInterval(timerInterval);
      if (window.modoJogo === 'desafio') gameOverDesafio('Tempo esgotado!');
      else verificarResposta(-1, null);
    }
  }, 1000);
}

window.verificarResposta = function (index, el) {
  if (respondido) return;
  respondido = true;
  clearInterval(timerInterval);

  const idAlvo = window.modoJogo === 'desafio' ? 'seg-unico' : `seg-${window.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (seg) {
      const fill = seg.querySelector('.fill-tempo');
      fill.style.width = window.getComputedStyle(fill).width;
      fill.style.transition = 'none';
  }

  const card = document.querySelector('.card-quiz.ativo');
  const opcoes = card.querySelectorAll('.opcao');
  const explicacoes = card.querySelectorAll('.container-explicacao');
  let acertou = false;

  opcoes.forEach((opt, i) => {
    opt.classList.add('bloqueado');
    const isCorrect = opt.getAttribute('data-is-correct') === 'true';
    if (isCorrect) {
      opt.classList.add('correta');
      if (opt === el) acertou = true;
    } else if (opt === el) {
      opt.classList.add('errada');
    }
  });

  explicacoes.forEach(exp => {
      exp.style.display = 'block';
      exp.style.animation = 'fadeIn 0.5s ease';
  });

  if (acertou) {
    window.acertos++;
    let base = window.modoJogo === 'desafio' ? 15 : 10;
    window.pontuacaoTotal += (base + Math.round(base * (tempoRestante / tempoTotal)));
  }

  if (window.modoJogo === 'desafio' && !acertou) {
    setTimeout(() => gameOverDesafio(index === -1 ? 'Tempo Esgotado!' : 'Você Errou!'), 1200);
    return;
  }

  if (window.modoJogo === 'normal' && seg) seg.classList.add(acertou ? 'correto' : 'errado');
  card.querySelector('#btn-prox').style.display = 'block';
};

window.mostrarDica = function (btn, texto) {
  if (dicasRestantes <= 0) return;
  dicasRestantes--;
  btn.disabled = true;
  btn.innerHTML = `💡 Dica <span class="contador-dica">${dicasRestantes}</span>`;
  const area = document.querySelector('.card-quiz.ativo .texto-dica-placeholder');
  area.innerHTML = `<div class="box-dica-texto">${texto}</div>`;
};

window.transicaoProximaPergunta = function () {
  window.indiceAtual++;
  if (window.indiceAtual >= window.perguntas.length) mostrarResultadoFinal();
  else adicionarNovaPergunta(window.perguntas[window.indiceAtual], true);
};

function gameOverDesafio(motivo) {
  if (tituloEl) tituloEl.style.fontSize = '1.3rem';
  quizStage.innerHTML = `<div class="card-quiz ativo" style="text-align:center; border: 2px solid var(--error);"><h2 style="font-size:3rem;">☠️</h2><h3 style="color:var(--error);">${motivo}</h3><p>Fim de jogo no desafio.</p><button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer; margin-top:20px;">Tentar Novamente</button></div>`;
  displayTempoEl.style.display = 'none';
  contadorPerguntasEl.style.display = 'none';
  barraProgressoEl.style.display = 'none';
}

function mostrarResultadoFinal() {
  if (tituloEl) tituloEl.style.fontSize = '1.3rem';
  const porcentagem = (window.acertos / window.perguntas.length);
  const win = porcentagem >= 0.6;
  displayTempoEl.style.display = 'none';
  contadorPerguntasEl.style.display = 'none';
  barraProgressoEl.style.display = 'none';
  
  quizStage.innerHTML = `<div class="card-quiz ativo" style="text-align:center;"><h2>${win ? 'Incrível!' : 'Bom Treino!'}</h2><div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">${window.pontuacaoTotal} <span style="font-size:1.5rem">pts</span></div><p style="font-weight:600;">Você acertou ${window.acertos} de ${window.perguntas.length}</p><hr style="border:0; border-top:1px solid #eee; margin:20px 0;"><h3>Salvar no Ranking</h3><input type="text" id="input-nome-jogador" maxlength="15" placeholder="seu nome" oninput="this.value = this.value.toLowerCase().replace(/[^a-zà-úç ]/g, '')"><button id="btn-salvar-final" onclick="enviarPontuacao()" style="background:#2563eb; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; margin-top:10px;">💾 Salvar Conquista</button><button onclick="location.reload()" style="background:transparent; border:1px solid #ccc; padding:10px; width:100%; margin-top:10px; border-radius:12px; cursor:pointer;">Menu Principal</button></div>`;
  if (win) dispararConfete();
}

function dispararConfete() {
  const canvas = document.getElementById('canvas-confete');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({ length: 120 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height, w: Math.random() * 10 + 5, h: Math.random() * 10 + 5, color: ['#ff0', '#0f0', '#00f', '#f0f', '#0ff', '#fff'][Math.floor(Math.random() * 6)], s: Math.random() * 3 + 2, a: Math.random() * 360, }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.w, p.h); p.y += p.s; p.a += 0.1; if (p.y > canvas.height) p.y = -10; });
    if (canvas.width > 0) requestAnimationFrame(draw);
  }
  draw();
  setTimeout(() => { canvas.width = 0; }, 5000);
}

