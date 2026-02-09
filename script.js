// =========================================
//  SCRIPT.JS - Guardiões (V4 - Animations)
// =========================================

const listaEl = document.getElementById("lista-quizes");
const quizContainer = document.getElementById("quiz-container");
const barraProgressoEl = document.getElementById("barra-progresso-container");
const tituloEl = document.getElementById("titulo-quiz");

// Estado
let perguntas = [];
let indiceAtual = 0;
let acertos = 0;
let respondido = false;

// Configs
let dicasRestantes = 2;
let tempoTotal = 30;
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
// CARREGAMENTO
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

if (quizContainer) {
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get("id");

  if (idQuiz) {
    fetch(`quizes/${idQuiz}.md`)
      .then(res => res.text())
      .then(text => {
        processarMarkdown(text);
        renderizarBarraProgresso();
        renderizarPergunta();
      })
      .catch((e) => {
        console.error(e);
        quizContainer.innerHTML = "<p>Erro ao carregar.</p>";
      });
  } else {
    window.location.href = "index.html";
  }
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
    
    // Adiciona o elemento de preenchimento interno
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

// Função para iniciar a animação da barra "Stories"
function animarBarra(indice) {
  const seg = document.getElementById(`seg-${indice}`);
  if (!seg) return;
  const fill = seg.querySelector(".fill-tempo");
  if (!fill) return;

  // Reseta primeiro
  fill.style.transition = "none";
  fill.style.width = "0%";
  
  // Força um reflow para o navegador entender que zerou
  void fill.offsetWidth;

  // Inicia a animação sincronizada com o tempoTotal
  fill.style.transition = `width ${tempoTotal}s linear`;
  fill.style.width = "100%";
}

function renderizarPergunta() {
  if (indiceAtual >= perguntas.length) {
    mostrarResultadoFinal();
    return;
  }

  const p = perguntas[indiceAtual];
  respondido = false;

  const opcoesEmbaralhadas = embaralhar([...p.opcoes]); 

  let htmlOpcoes = "";
  opcoesEmbaralhadas.forEach((op, index) => {
    htmlOpcoes += `
      <div class="opcao" id="op-${index}" 
           data-is-correct="${op.correta}" 
           onclick="verificarResposta(${index})">
        ${op.texto}
      </div>
    `;
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
        <div id="texto-dica-visivel"></div>
      </div>
    `;
  }

  // Renderiza com a classe de animação de entrada
  quizContainer.innerHTML = `
    <div style="text-align:center">
      <div id="display-tempo" class="timer-box">⏱️ ${tempoTotal}s</div>
    </div>
    <div class="card-quiz anime-entrada" id="card-ativo">
      <div class="pergunta">${p.enunciado}</div>
      <div class="lista-opcoes">${htmlOpcoes}</div>
      ${htmlDica}
      <button id="btn-prox" onclick="transicaoProximaPergunta()">Próxima Pergunta ➜</button>
    </div>
  `;

  // Inicia barra e timer
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
  const areaTexto = document.getElementById("texto-dica-visivel");
  areaTexto.innerHTML = `<div class="box-dica-texto">${textoDica}</div>`;
  btn.disabled = true; 
}

function iniciarTimer() {
  tempoRestante = tempoTotal;
  clearInterval(timerInterval);
  const displayTimer = document.getElementById("display-tempo");
  if(displayTimer) displayTimer.innerText = `⏱️ ${tempoRestante}s`;

  timerInterval = setInterval(() => {
    tempoRestante--;
    if(displayTimer) displayTimer.innerText = `⏱️ ${tempoRestante}s`;
    if (tempoRestante <= 0) {
      clearInterval(timerInterval);
      tempoEsgotado();
    }
  }, 1000);
}

function tempoEsgotado() {
  if (respondido) return;
  verificarResposta(-1);
  const titulo = document.querySelector(".pergunta");
  if(titulo) titulo.innerHTML += " <br><span style='color:red; font-size:0.9em'>(Tempo Esgotado!)</span>";
}

window.verificarResposta = function(index) {
  if (respondido) return;
  respondido = true;
  clearInterval(timerInterval);

  // Para a animação da barra na posição atual
  const seg = document.getElementById(`seg-${indiceAtual}`);
  const fill = seg.querySelector(".fill-tempo");
  if(fill) {
    const computedWidth = window.getComputedStyle(fill).width;
    fill.style.transition = "none";
    fill.style.width = computedWidth;
  }

  const opcoesEls = document.querySelectorAll('.opcao');
  let acertou = false;

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

  if (acertou) acertos++;
  
  // Atualiza a barra para a cor final (verde/vermelho)
  // Pequeno delay para usuário ver a barra parando antes de ficar verde
  setTimeout(() => {
    atualizarBarra(indiceAtual, acertou);
  }, 200);

  document.getElementById("btn-prox").style.display = "block";
  const btnDica = document.querySelector(".btn-dica-minimal");
  if(btnDica) btnDica.disabled = true;
};

// NOVA FUNÇÃO: Transição Animada
window.transicaoProximaPergunta = function() {
  const card = document.getElementById("card-ativo");
  if(card) {
    // Adiciona a classe que joga para a esquerda
    card.classList.remove("anime-entrada");
    card.classList.add("slide-out-left");
  }

  // Espera a animação (300ms) terminar antes de renderizar a próxima
  setTimeout(() => {
    indiceAtual++;
    renderizarPergunta();
  }, 300);
};

// =======================
// RESULTADO
// =======================
function mostrarResultadoFinal() {
  const porcentagem = Math.round((acertos / perguntas.length) * 100);
  const aprovado = porcentagem >= 50;
  const corTitulo = aprovado ? "#25A20C" : "#ef4444";
  const mensagem = aprovado ? "Mandou bem, Guardião! 🛡️" : "Que pena, continue treinando! 📖";
  const animacao = aprovado ? "Parabéns!" : "";

  quizContainer.innerHTML = `
    <div class="card-quiz anime-entrada" style="text-align:center;">
      <h2>${animacao}</h2>
      <div style="font-size: 4rem; color: ${corTitulo}; font-weight:800; margin: 20px 0;">
        ${porcentagem}%
      </div>
      <p style="font-size:1.2rem; margin-bottom:20px; font-weight:600;">
        ${mensagem}
      </p>
      <p>Você acertou ${acertos} de ${perguntas.length}</p>
      
      <button onclick="location.reload()" style="background:var(--brand-green); color:white; padding:15px 30px; border:none; border-radius:12px; font-size:1.1rem; cursor:pointer; margin-top:20px;">
        Refazer Treinamento
      </button>
      <br><br>
      <a href="index.html" style="color:#666; text-decoration:none;">Voltar ao Menu</a>
    </div>
  `;

  if (aprovado) dispararConfete();
}

// =======================
// SISTEMA DE CONFETE (CANVAS)
// =======================
function dispararConfete() {
  const canvas = document.getElementById("canvas-confete");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confetes = [];
  const cores = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

  for (let i = 0; i < 100; i++) {
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
      c.x += Math.sin(c.angle) * 0.5; // leve balanço
      c.angle += 0.1;
      
      // Se passar da tela, volta pro topo
      if (c.y > canvas.height) c.y = -10;
    });
    requestAnimationFrame(draw);
  }
  
  draw();
  
  // Para depois de 5 segundos
  setTimeout(() => {
    canvas.width = 0; // Limpa o canvas
  }, 5000);
}
