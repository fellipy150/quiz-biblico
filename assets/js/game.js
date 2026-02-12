// =========================================
//  GAME.JS - Motor de Jogo (Versão 2.0)
// =========================================

// Elementos do DOM
const listaEl = document.getElementById('lista-quizes');
const quizStage = document.getElementById('quiz-stage');
const barraProgressoEl = document.getElementById('barra-progresso-container');
const tituloEl = document.getElementById('titulo-quiz');
const descricaoEl = document.getElementById('descricao-quiz'); // Novo elemento
const displayTempoEl = document.getElementById('display-tempo');
const contadorPerguntasEl = document.getElementById('contador-perguntas');
const telaSelecaoEl = document.getElementById('tela-selecao');

// Estado Global
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
// UTILS
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
// INICIALIZAÇÃO
// =======================
if (listaEl) {
  // Carrega lista na Home
  fetch('data/quizes/index.json')
    .then((res) => res.json())
    .then((dados) => {
      listaEl.innerHTML = dados
        .map((q) => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
        .join('');
    })
    .catch(err => {
      console.error(err);
      listaEl.innerHTML = '<p>Erro ao carregar lista de quizes.</p>';
    });
}

if (quizStage) {
  // Carrega Quiz Específico
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get('id');

  if (idQuiz) {
    fetch(`data/quizes/${idQuiz}.md`)
      .then((res) => {
        if (!res.ok) throw new Error("Erro de rede");
        return res.text();
      })
      .then((text) => {
        processarMarkdown(text);
        telaSelecaoEl.style.display = 'flex';
        quizStage.style.display = 'none';
      })
      .catch((err) => {
        console.error(err);
        tituloEl.innerText = "Erro";
        quizStage.innerHTML = '<p style="text-align:center">Erro ao carregar o arquivo do quiz.</p>';
      });
  }
}

// =======================
// PARSER DE MARKDOWN (NOVO ENGINE)
// =======================
function processarMarkdown(md) {
  const linhas = md.replace(/\r\n/g, '\n').split('\n');

  let tituloPagina = '';
  let descricaoBuffer = '';
  let lendoDescricao = false;

  let todasPerguntas = [];
  let categoriaAtual = 'Geral';
  
  // Objeto temporário para construção
  let perguntaAtual = null; 
  let ultimaOpcao = null;

  linhas.forEach((linha) => {
    const l = linha.trim();
    if (!l && !lendoDescricao) return; // Pula linhas vazias fora da descrição

    // 1. Títulos
    if (l.startsWith('# ')) {
      // Título interno (opcional, ignorado ou usado para log)
      return;
    }
    if (l.startsWith('## ')) {
      tituloPagina = l.replace('## ', '').trim();
      if (tituloEl) tituloEl.innerText = tituloPagina;
      lendoDescricao = true; // Começa a capturar descrição
      return;
    }

    // 2. Detectar Quebra de Fluxo (Fim da descrição)
    // Se encontrar categoria, ID ou pergunta, para de ler descrição
    if (l.match(/^<!--(.*)-->/) || l.startsWith('id:') || l.startsWith('###')) {
      lendoDescricao = false;
    }

    // 3. Acumular Descrição
    if (lendoDescricao) {
      if (l !== '') descricaoBuffer += linha + '\n';
      return;
    }

    // 4. Categorias <!-- Nome -->
    const matchCat = l.match(/^<!--(.*)-->/);
    if (matchCat) {
      categoriaAtual = matchCat[1].trim();
      return;
    }

    // 5. ID da Pergunta (Início de novo bloco)
    if (l.startsWith('id:')) {
      // Salva a pergunta anterior se existir
      if (perguntaAtual) {
        validarEPush(perguntaAtual, todasPerguntas);
      }

      const idRaw = l.replace('id:', '').trim();
      
      // Inicia nova pergunta
      perguntaAtual = {
        id: idRaw,
        categoria: categoriaAtual,
        enunciado: '',
        opcoes: [],
        dica: null
      };
      
      // Validação básica de ID Hex
      if (!/^[0-9a-fA-F]{10}$/.test(idRaw)) {
        console.warn(`Aviso: ID "${idRaw}" pode não seguir o padrão 10hex.`);
      }
      return;
    }

    // 6. Enunciado
    if (l.startsWith('### ')) {
      if (perguntaAtual) {
        perguntaAtual.enunciado = l.replace('### ', '').trim();
      }
      return;
    }

    // 7. Alternativas [ ] ou [x]
    if (l.startsWith('[ ]') || l.startsWith('[x]')) {
      if (perguntaAtual) {
        const isCorrect = l.startsWith('[x]');
        const text = l.replace(/\[(x| )\]/, '').trim();
        
        ultimaOpcao = {
          texto: text,
          correta: isCorrect,
          explicacao: null
        };
        perguntaAtual.opcoes.push(ultimaOpcao);
      }
      return;
    }

    // 8. Explicação da Alternativa -!
    if (l.startsWith('-!') && ultimaOpcao) {
      ultimaOpcao.explicacao = l.replace('-!', '').trim();
      return;
    }

    // 9. Dica da Pergunta -#
    if (l.startsWith('-#') && perguntaAtual) {
      perguntaAtual.dica = l.replace('-#', '').trim();
      return;
    }
  });

  // Empurra a última pergunta do arquivo
  if (perguntaAtual) {
    validarEPush(perguntaAtual, todasPerguntas);
  }

  // Finalização
  window.perguntas = todasPerguntas;
  
  if (descricaoEl && descricaoBuffer) {
    descricaoEl.innerHTML = converterMarkdownSimples(descricaoBuffer);
    descricaoEl.style.display = 'block';
  } else if (descricaoEl) {
    descricaoEl.style.display = 'none';
  }
}

function validarEPush(pergunta, arrayDestino) {
  // Validação: Exatamente 1 correta
  const corretas = pergunta.opcoes.filter(op => op.correta).length;
  if (corretas !== 1) {
    console.error(`ERRO CRÍTICO na pergunta ID ${pergunta.id}: Encontradas ${corretas} respostas corretas.`);
    return; // Não adiciona pergunta quebrada
  }
  arrayDestino.push(pergunta);
}

// =======================
// CONTROLE DE FLUXO
// =======================
window.iniciarJogo = function (modo) {
  if (window.perguntas.length === 0) {
    alert("Nenhuma pergunta carregada!");
    return;
  }

  window.modoJogo = modo;
  window.indiceAtual = 0;
  window.acertos = 0;
  window.pontuacaoTotal = 0;
  dicasRestantes = 2;
  tempoTotal = modo === 'desafio' ? 15 : 30;

  if (modo === 'desafio') document.body.classList.add('modo-desafio');
  else document.body.classList.remove('modo-desafio');

  // Ajustes de UI
  telaSelecaoEl.style.display = 'none';
  if (descricaoEl) descricaoEl.style.display = 'none'; // Esconde descrição durante jogo
  if (tituloEl) tituloEl.style.display = 'none'; // Opcional: esconde título para focar
  
  quizStage.style.display = 'grid';
  barraProgressoEl.style.display = 'flex';
  displayTempoEl.style.display = 'block';
  contadorPerguntasEl.style.display = 'block';

  // Embaralhar a ordem das perguntas globalmente para o jogo
  window.perguntas = embaralhar(window.perguntas);

  renderizarBarraProgresso();
  adicionarNovaPergunta(window.perguntas[0], false);
};

function renderizarBarraProgresso() {
  barraProgressoEl.innerHTML = '';
  if (window.modoJogo === 'desafio') {
    barraProgressoEl.innerHTML = `
            <div class="segmento-barra" id="seg-unico" style="flex: 1;">
                <div class="fill-tempo"></div>
            </div>`;
  } else {
    barraProgressoEl.innerHTML = window.perguntas
      .map(
        (_, i) => `<div class="segmento-barra" id="seg-${i}"><div class="fill-tempo"></div></div>`
      )
      .join('');
  }
}

// =======================
// RENDERIZAÇÃO DA PERGUNTA
// =======================
function adicionarNovaPergunta(p, comAnimacao = true) {
  respondido = false;
  contadorPerguntasEl.innerText = `${window.indiceAtual + 1} / ${window.perguntas.length}`;

  // Embaralha opções (mantém explicação atrelada ao objeto)
  const opcoesEmb = embaralhar([...p.opcoes]);
  
  const novoCard = document.createElement('div');
  novoCard.className = 'card-quiz';

  // Template da Pergunta
  novoCard.innerHTML = `
        ${p.categoria ? `<div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:#6b7280; margin-bottom:5px;">${p.categoria}</div>` : ''}
        <div class="pergunta">${p.enunciado}</div>
        
        <div class="lista-opcoes">
            ${opcoesEmb.map((op, i) => `
                <div class="opcao-wrapper">
                    <div class="opcao" data-is-correct="${op.correta}" onclick="verificarResposta(${i}, this)">
                        ${op.texto}
                    </div>
                    ${op.explicacao ? `
                        <button class="btn-explicacao" style="display:none;" onclick="toggleExplicacao(this)">
                            🎓 Ver Explicação
                        </button>
                        <div class="box-explicacao" style="display:none;">
                            ${converterMarkdownSimples(op.explicacao)}
                        </div>
                    ` : ''}
                </div>`
            ).join('')}
        </div>

        <div class="area-dica-container">
            ${p.dica ? `
                <button class="btn-dica-minimal" ${dicasRestantes <= 0 ? 'disabled' : ''} onclick="mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">
                    💡 Ver Dica <span class="contador-dica">${dicasRestantes}</span>
                </button>
            ` : ''}
            <div class="texto-dica-placeholder"></div>
        </div>
        
        <button id="btn-prox" onclick="transicaoProximaPergunta()">Próxima Pergunta ➜</button>
    `;

  // Lógica de Animação
  if (comAnimacao) {
    novoCard.classList.add('pre-render-direita');
    const cardAntigo = quizStage.querySelector('.card-quiz.ativo');
    quizStage.appendChild(novoCard);
    
    // Força reflow
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

// Pequena função auxiliar para o botão de explicação
window.toggleExplicacao = function(btn) {
    const box = btn.nextElementSibling;
    if (box.style.display === 'none') {
        box.style.display = 'block';
        btn.innerText = '🔼 Ocultar Explicação';
    } else {
        box.style.display = 'none';
        btn.innerText = '🎓 Ver Explicação';
    }
}

function animarBarraAtual() {
  const idAlvo = window.modoJogo === 'desafio' ? 'seg-unico' : `seg-${window.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (!seg) return;

  // Limpa estados anteriores
  seg.classList.remove('correto', 'errado');

  const fill = seg.querySelector('.fill-tempo');
  fill.style.transition = 'none';
  fill.style.width = '0%';
  void fill.offsetWidth; // Força reflow
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
      else verificarResposta(-1, null); // -1 indica timeout
    }
  }, 1000);
}

// =======================
// LÓGICA DE RESPOSTA
// =======================
window.verificarResposta = function (index, el) {
  if (respondido) return;
  respondido = true;
  clearInterval(timerInterval);

  // Para a animação da barra
  const idAlvo = window.modoJogo === 'desafio' ? 'seg-unico' : `seg-${window.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (seg) {
      const fill = seg.querySelector('.fill-tempo');
      fill.style.width = window.getComputedStyle(fill).width;
      fill.style.transition = 'none';
  }

  const card = document.querySelector('.card-quiz.ativo');
  const opcoes = card.querySelectorAll('.opcao');
  const botoesExplicacao = card.querySelectorAll('.btn-explicacao');
  
  let acertou = false;

  // Feedback Visual nas Opções
  opcoes.forEach((opt, i) => {
    opt.classList.add('bloqueado');
    const isCorrect = opt.getAttribute('data-is-correct') === 'true';
    
    if (isCorrect) {
      opt.classList.add('correta');
      if (i === index) acertou = true;
    } else if (i === index) {
      opt.classList.add('errada');
    }
  });

  // Liberar botões de explicação (se existirem)
  botoesExplicacao.forEach(btn => {
      btn.style.display = 'block';
      btn.style.animation = 'fadeIn 0.5s ease';
  });

  // Cálculo de Pontuação
  if (acertou) {
    window.acertos++;
    let pts = (window.modoJogo === 'desafio' ? 15 : 10) +
      Math.round((window.modoJogo === 'desafio' ? 15 : 10) * (tempoRestante / tempoTotal));
    window.pontuacaoTotal += pts;
  }

  // Lógica Modo Desafio (Game Over)
  if (window.modoJogo === 'desafio' && !acertou) {
    setTimeout(() => gameOverDesafio('Você errou!'), 1000); // Um pouco mais de tempo para ver a resposta certa
    return;
  }

  // Feedback na Barra (Modo Normal)
  if (window.modoJogo === 'normal' && seg) {
    seg.classList.add(acertou ? 'correto' : 'errado');
  }

  // Mostra botão de próxima
  const btnProx = card.querySelector('#btn-prox');
  btnProx.style.display = 'block';
  
  // Auto-scroll se necessário em telas pequenas
  if (window.innerHeight < 700) {
      setTimeout(() => btnProx.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
  }
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
  if (window.indiceAtual >= window.perguntas.length) {
      mostrarResultadoFinal();
  } else {
      adicionarNovaPergunta(window.perguntas[window.indiceAtual], true);
  }
};

// =======================
// TELAS FINAIS
// =======================
function gameOverDesafio(motivo) {
  if (tituloEl) tituloEl.style.display = 'block';
  quizStage.innerHTML = `
        <div class="card-quiz ativo anime-entrada" style="text-align:center; border: 2px solid var(--error);">
            <h2 style="font-size:3rem;">☠️</h2>
            <h3 style="color:var(--error);">${motivo}</h3>
            <p>Você sobreviveu a ${window.indiceAtual} perguntas.</p>
            <button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer; margin-top:20px;">Tentar Novamente</button>
        </div>`;
  displayTempoEl.style.display = 'none';
  contadorPerguntasEl.style.display = 'none';
}

function mostrarResultadoFinal() {
  if (tituloEl) tituloEl.style.display = 'block';
  const win = window.modoJogo === 'desafio' || window.acertos / window.perguntas.length >= 0.5;
  
  displayTempoEl.style.display = 'none';
  contadorPerguntasEl.style.display = 'none';
  
  quizStage.innerHTML = `
        <div class="card-quiz ativo anime-entrada" style="text-align:center;">
            <h2>${win ? 'Parabéns!' : 'Que pena!'}</h2>
            
            <div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">
                ${window.pontuacaoTotal} <span style="font-size:1.5rem">pts</span>
            </div>
            
            <p style="font-weight:600;">Você acertou ${window.acertos} de ${window.perguntas.length} questões</p>
            
            <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
            
            <h3>Salvar no Ranking</h3>
            <p style="font-size:0.8rem; color:#666;">Apenas letras (acentos permitidos)</p>
            
            <input type="text" id="input-nome-jogador" maxlength="15" placeholder="seu nome" 
                style="text-transform: lowercase;" 
                oninput="this.value = this.value.toLowerCase().replace(/[^a-zà-úç ]/g, '')">
            
            <button id="btn-salvar-final" onclick="enviarPontuacao()" 
                style="background:#2563eb; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; margin-top:10px;">
                💾 Salvar Conquista
            </button>
            
            <button onclick="location.reload()" 
                style="background:transparent; border:1px solid #ccc; padding:10px; width:100%; margin-top:10px; border-radius:12px; cursor:pointer;">
                Voltar ao Menu
            </button>
        </div>`;
  
  if (win) dispararConfete();
}

function dispararConfete() {
  const canvas = document.getElementById('canvas-confete');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 5,
    h: Math.random() * 10 + 5,
    color: ['#ff0', '#0f0', '#00f', '#f0f', '#0ff', '#fff'][Math.floor(Math.random() * 6)],
    s: Math.random() * 3 + 2,
    a: Math.random() * 360,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      p.y += p.s;
      p.a += 0.1;
      if (p.y > canvas.height) p.y = -10;
    });
    if (canvas.width > 0) requestAnimationFrame(draw);
  }
  
  draw();
  setTimeout(() => (canvas.width = 0), 5000);
}

