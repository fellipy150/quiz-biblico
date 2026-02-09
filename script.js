// =========================================
//  SCRIPT.JS - Guardiões (V6 - Game Modes)
// =========================================

const listaEl = document.getElementById("lista-quizes");
const quizStage = document.getElementById("quiz-stage");
const barraProgressoEl = document.getElementById("barra-progresso-container");
const tituloEl = document.getElementById("titulo-quiz");
const displayTempoEl = document.getElementById("display-tempo");
const telaSelecaoEl = document.getElementById("tela-selecao");

// Estado
let perguntas = [];
let indiceAtual = 0;
let acertos = 0;
let respondido = false;
let modoJogo = null; // 'normal' | 'desafio'

// Configs
let dicasRestantes = 2;
let tempoTotal = 30; // Será alterado baseado no modo
let tempoRestante = tempoTotal;
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

// =======================
// CARREGAMENTO & MENU
// =======================
if (listaEl) {
  fetch("quizes/index.json")
    .then(res => res.json())
    .then(dados => {
      listaEl.innerHTML = "";
      dados.forEach(quiz => {
        listaEl.innerHTML += `<li><a href="quiz.html?id=${quiz.arquivo}">${quiz.titulo}</a></li>`;
      });
    });
}

if (quizStage) {
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get("id");

  if (idQuiz) {
    fetch(`quizes/${idQuiz}.md`)
      .then(res => res.text())
      .then(text => {
        processarMarkdown(text);
        mostrarSelecaoModo(); // AGORA PARAMOS AQUI!
      })
      .catch((e) => {
        console.error(e);
        quizStage.innerHTML = "<p>Erro ao carregar.</p>";
        quizStage.style.display = 'block';
      });
  } else {
    window.location.href = "index.html";
  }
}

function mostrarSelecaoModo() {
  if (telaSelecaoEl) telaSelecaoEl.style.display = "flex";
  if (quizStage) quizStage.style.display = "none";
  if (barraProgressoEl) barraProgressoEl.style.display = "none";
}

// =======================
// INICIALIZAÇÃO DO JOGO
// =======================
window.iniciarJogo = function(modo) {
  modoJogo = modo;
  indiceAtual = 0;
  acertos = 0;
  dicasRestantes = 2; // Reseta dicas

  // Configurações por modo
  if (modo === 'desafio') {
    tempoTotal = 15;
    document.body.classList.add('modo-desafio'); // Fundo verde escuro
  } else {
    tempoTotal = 30;
    document.body.classList.remove('modo-desafio');
  }

  // Esconde Seleção e Mostra Jogo
  telaSelecaoEl.style.display = "none";
  quizStage.style.display = "grid";
  barraProgressoEl.style.display = "flex";
  if(displayTempoEl) displayTempoEl.style.display = "block";

  renderizarBarraProgresso();
  adicionarNovaPergunta(perguntas[0], false);
}

// =======================
// PARSER
// =======================
function processarMarkdown(md) {
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  const tituloRaw = linhas.find(l => l.startsWith("# "));
  if (tituloEl && tituloRaw) tituloEl.innerText = tituloRaw.replace("# ", "").trim();

  const gruposRaw = md.split(/^---$/gm);
  let todasPerguntasOrdenadas = [];

  gruposRaw.forEach(grupoTexto => {
    const blocos = grupoTexto.split(/^## /gm).slice(1);
    let perguntasDoGrupo = blocos.map(bloco => {
      const lines = bloco.trim().split("\n");
      const enunciado = lines[0].trim();
      const opcoes = [];
      let dica = null;

      lines.slice(1).forEach(linha => {
        const l = linha.trim();
        if (l.startsWith("[x]")) opcoes.push({ texto: l.replace("[x]", "").trim(), correta: true });
        else if (l.startsWith("[ ]")) opcoes.push({ texto: l.replace("[ ]", "").trim(), correta: false });
        else if (l.startsWith("-#")) dica = l.replace("-#", "").trim();
      });
      return { enunciado, opcoes, dica };
    });
    perguntasDoGrupo = embaralhar(perguntasDoGrupo);
    todasPerguntasOrdenadas = todasPerguntasOrdenadas.concat(perguntasDoGrupo);
  });
  perguntas = todasPerguntasOrdenadas;
}

// =======================
// RENDERIZAÇÃO
// =======================
function renderizarBarraProgresso() {
  if (!barraProgressoEl) return;
  barraProgressoEl.innerHTML = "";
  perguntas.forEach((_, i) => {
    const seg = document.createElement("div");
    seg.classList.add("segmento-barra");
    seg.id = `seg-${i}`;
    const fill = document.createElement("div");
    fill.classList.add("fill-tempo");
    seg.appendChild(fill);
    barraProgressoEl.appendChild(seg);
  });
}

function atualizarBarra(indice, acertou) {
  const seg = document.getElementById(`seg-${indice}`);
  if (seg) seg.classList.add(acertou ? "correto" : "errado");
}

function animarBarra(indice) {
  const seg = document.getElementById(`seg-${indice}`);
  if (!seg) return;
  const fill = seg.querySelector(".fill-tempo");
  if (!fill) return;

  fill.style.transition = "none";
  fill.style.width = "0%";
  void fill.offsetWidth; 
  fill.style.transition = `width ${tempoTotal}s linear`;
  fill.style.width = "100%";
}

function adicionarNovaPergunta(p, comAnimacao = true) {
  respondido = false;
  if(displayTempoEl) {
    displayTempoEl.style.display = "block";
    displayTempoEl.classList.remove("danger"); // Remove alerta vermelho se tiver
  }

  const opcoesEmbaralhadas = embaralhar([...p.opcoes]);
  let htmlOpcoes = "";
  opcoesEmbaralhadas.forEach((op, index) => {
    htmlOpcoes += `
      <div class="opcao" id="op-${index}" 
           data-is-correct="${op.correta}" 
           onclick="verificarResposta(${index}, this)">
        ${op.texto}
      </div>`;
  });

  let htmlDica = "";
  if (p.dica) {
    const desabilitado = dicasRestantes <= 0 ? "disabled" : "";
    const textoBotao = dicasRestantes > 0 ? "Ver Dica" : "Sem dicas";
    htmlDica = `
      <div class="area-dica-container">
        <button class="btn-dica-minimal" ${desabilitado} onclick="mostrarDica(this, '${p.dica.replace(/'/g, "&#39;")}')">
          💡 ${textoBotao} <span class="contador-dica">${dicasRestantes}</span>
        </button>
        <div class="texto-dica-placeholder"></div>
      </div>`;
  }

  const novoCard = document.createElement('div');
  novoCard.className = 'card-quiz';
  novoCard.innerHTML = `
    <div class="pergunta">${p.enunciado}</div>
    <div class="lista-opcoes">${htmlOpcoes}</div>
    ${htmlDica}
    <button id="btn-prox" onclick="transicaoProximaPergunta()">Próxima Pergunta ➜</button>
  `;

  if (comAnimacao) {
    novoCard.classList.add('pre-render-direita');
  } else {
    novoCard.classList.add('ativo');
  }

  quizStage.appendChild(novoCard);

  if (comAnimacao) {
    const cardAntigo = quizStage.querySelector('.card-quiz.ativo');
    void novoCard.offsetWidth; 
    
    if (cardAntigo) {
      cardAntigo.classList.remove('ativo');
      cardAntigo.classList.add('saindo-esquerda');
      setTimeout(() => cardAntigo.remove(), 500);
    }
    
    novoCard.classList.remove('pre-render-direita');
    novoCard.classList.add('ativo');
  }

  animarBarra(indiceAtual);
  iniciarTimer();
}

// =======================
// LÓGICA DO JOGO
// =======================
function mostrarDica(btn, textoDica) {
  if(dicasRestantes <= 0) return;
  dicasRestantes--;
  const contador = btn.querySelector(".contador-dica");
  if(contador) contador.innerText = dicasRestantes;
  if (dicasRestantes === 0) {
    btn.innerHTML = `💡 Sem dicas <span class="contador-dica">0</span>`;
    btn.disabled = true;
  }
  const currentCard = document.querySelector('.card-quiz.ativo');
  const areaTexto = currentCard.querySelector(".texto-dica-placeholder");
  if(areaTexto) areaTexto.innerHTML = `<div class="box-dica-texto">${textoDica}</div>`;
  btn.disabled = true; 
}

function iniciarTimer() {
  tempoRestante = tempoTotal;
  clearInterval(timerInterval);
  if(displayTempoEl) displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;

  timerInterval = setInterval(() => {
    tempoRestante--;
    if(displayTempoEl) displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
    
    if (tempoRestante <= 0) {
      clearInterval(timerInterval);
      tempoEsgotado();
    }
  }, 1000);
}

function tempoEsgotado() {
  if (respondido) return;
  
  // No Modo Desafio, Tempo esgotado = Game Over direto
  if (modoJogo === 'desafio') {
    gameOverDesafio("O tempo acabou!");
    return;
  }

  // Modo Normal segue vida
  verificarResposta(-1, null); 
  const currentCard = document.querySelector('.card-quiz.ativo');
  const titulo = currentCard.querySelector(".pergunta");
  if(titulo) titulo.innerHTML += " <br><span style='color:red; font-size:0.9em'>(Tempo Esgotado!)</span>";
}

window.verificarResposta = function(index, elementoClicado) {
  if (respondido) return;
  
  clearInterval(timerInterval);

  // Para animação da barra
  const seg = document.getElementById(`seg-${indiceAtual}`);
  const fill = seg.querySelector(".fill-tempo");
  if(fill) {
    const computedWidth = window.getComputedStyle(fill).width;
    fill.style.transition = "none";
    fill.style.width = computedWidth;
  }

  const currentCard = document.querySelector('.card-quiz.ativo');
  const opcoesEls = currentCard.querySelectorAll('.opcao');
  let acertou = false;

  // Lógica de verificação
  opcoesEls.forEach((el, i) => {
    el.classList.add('bloqueado');
    const isCorrect = el.getAttribute('data-is-correct') === "true";
    if (isCorrect) {
      el.classList.add('correta');
      if (i === index) acertou = true;
    } else if (i === index) {
      el.classList.add('errada');
    }
  });

  // --- LÓGICA MODO DESAFIO (SUDDEN DEATH) ---
  if (modoJogo === 'desafio' && !acertou) {
    // Delay pequeno para ver que errou, depois GAME OVER
    setTimeout(() => {
      gameOverDesafio("Você errou!");
    }, 1000);
    return;
  }

  if (acertou) acertos++;
  
  setTimeout(() => {
    atualizarBarra(indiceAtual, acertou);
  }, 200);

  const btnProx = currentCard.querySelector("#btn-prox");
  if(btnProx) btnProx.style.display = "block";
  
  const btnDica = currentCard.querySelector(".btn-dica-minimal");
  if(btnDica) btnDica.disabled = true;
};

// --- GAME OVER TELA (Desafio) ---
function gameOverDesafio(motivo) {
  quizStage.innerHTML = "";
  if(displayTempoEl) displayTempoEl.style.display = "none";
  if(barraProgressoEl) barraProgressoEl.style.display = "none";

  const cardErro = document.createElement('div');
  cardErro.className = 'card-quiz anime-entrada';
  cardErro.style.textAlign = 'center';
  cardErro.style.border = "2px solid #ef4444";
  
  cardErro.innerHTML = `
    <h2 style="font-size:3rem; margin:0;">☠️</h2>
    <h3 style="color:#ef4444; margin-top:10px;">Fim de Jogo!</h3>
    <p style="font-size:1.2rem;">${motivo}</p>
    <p>No Modo Desafio não são permitidos erros.</p>
    
    <button onclick="location.reload()" style="background:#ef4444; color:white; padding:15px 30px; border:none; border-radius:12px; font-size:1.1rem; cursor:pointer; margin-top:20px;">
      Tentar Novamente
    </button>
  `;
  quizStage.appendChild(cardErro);
}

window.transicaoProximaPergunta = function() {
  indiceAtual++;
  if (indiceAtual >= perguntas.length) {
    mostrarResultadoFinal();
  } else {
    adicionarNovaPergunta(perguntas[indiceAtual], true);
  }
};

// =======================
// RESULTADO FINAL
// =======================
function mostrarResultadoFinal() {
  const porcentagem = Math.round((acertos / perguntas.length) * 100);
  
  // Customização para Vitória no Desafio
  let titulo, mensagem, cor, animacao;

  if (modoJogo === 'desafio') {
    // Se chegou aqui no modo desafio, é pq ACERTOU TUDO
    titulo = "DESAFIO VENCIDO!";
    mensagem = "Você provou ser um Guardião de Elite! 🏆🔥";
    cor = "#10b981"; // Verde vitoria
    animacao = "LENDÁRIO!";
  } else {
    // Modo Normal
    const aprovado = porcentagem >= 50;
    cor = aprovado ? "#25A20C" : "#ef4444";
    mensagem = aprovado ? "Mandou bem, Guardião! 🛡️" : "Que pena, continue treinando! 📖";
    animacao = aprovado ? "Parabéns!" : "";
  }

  if(displayTempoEl) displayTempoEl.style.display = "none";

  quizStage.innerHTML = "";
  
  const cardResultado = document.createElement('div');
  cardResultado.className = 'card-quiz anime-entrada';
  cardResultado.style.textAlign = 'center';
  
  // Se for desafio vencido, adiciona borda dourada
  if(modoJogo === 'desafio') {
    cardResultado.style.border = "3px solid #fbbf24";
    cardResultado.style.boxShadow = "0 0 20px rgba(251, 191, 36, 0.4)";
  }

  cardResultado.innerHTML = `
      <h2>${animacao}</h2>
      <div style="font-size: 4rem; color: ${cor}; font-weight:800; margin: 20px 0;">
        ${modoJogo === 'desafio' ? '100%' : porcentagem + '%'}
      </div>
      <p style="font-size:1.2rem; margin-bottom:20px; font-weight:600;">
        ${mensagem}
      </p>
      <p>Você acertou ${acertos} de ${perguntas.length}</p>
      
      <button onclick="location.reload()" style="background:var(--brand-green); color:white; padding:15px 30px; border:none; border-radius:12px; font-size:1.1rem; cursor:pointer; margin-top:20px;">
        Voltar ao Menu
      </button>
  `;
  
  quizStage.appendChild(cardResultado);

  // Confete se aprovado no normal ou venceu desafio
  if ((modoJogo === 'normal' && porcentagem >= 50) || modoJogo === 'desafio') {
    dispararConfete();
  }
}

// =======================
// CONFETE
// =======================
function dispararConfete() {
  const canvas = document.getElementById("canvas-confete");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confetes = [];
  const cores = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

  for (let i = 0; i < 150; i++) { // Mais confete para a vitória!
    confetes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 10 + 5,
      color: cores[Math.floor(Math.random() * cores.length)],
      speed: Math.random() * 3 + 2,
      angle: Math.random() * 360
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confetes.forEach((c) => {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.rect(c.x, c.y, c.w, c.h);
      ctx.fill();
      c.y += c.speed;
      c.x += Math.sin(c.angle) * 0.5;
      c.angle += 0.1;
      if (c.y > canvas.height) c.y = -10;
    });
    requestAnimationFrame(draw);
  }
  draw();
  setTimeout(() => { canvas.width = 0; }, 6000);
}
