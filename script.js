// =========================================
//  SCRIPT.JS - Guardiões (Timer + Confete + Shuffle)
// =========================================

const listaEl = document.getElementById("lista-quizes");
const quizContainer = document.getElementById("quiz-container");
const barraProgressoEl = document.getElementById("barra-progresso-container");
const tituloEl = document.getElementById("titulo-quiz");

let perguntas = [];
let indiceAtual = 0;
let acertos = 0;
let respondido = false;

// Variáveis do Timer
let tempoRestante = 20;
let timerInterval;

// =======================
// 1. UTILITÁRIOS (Shuffle)
// =======================
function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// =======================
// 2. CARREGAMENTO
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
        renderizarBarraProgresso(); // Cria a barra vazia
        renderizarPergunta();
      })
      .catch(() => quizContainer.innerHTML = "<p>Erro ao carregar.</p>");
  } else {
    window.location.href = "index.html";
  }
}

// =======================
// 3. PROCESSADOR
// =======================
function processarMarkdown(md) {
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  const tituloRaw = linhas.find(l => l.startsWith("# "));
  if (tituloEl && tituloRaw) tituloEl.innerText = tituloRaw.replace("# ", "").trim();

  const blocos = md.split(/^## /gm).slice(1);
  const perguntasBrutas = blocos.map(bloco => {
    const lines = bloco.trim().split("\n");
    const enunciado = lines[0].trim();
    const opcoes = [];
    let textoCorreto = "";

    lines.slice(1).forEach(l => {
      if (l.trim().startsWith("- ")) {
        let txt = l.replace("- ", "").trim();
        if (txt.endsWith("*")) {
          txt = txt.slice(0, -1).trim();
          textoCorreto = txt; // Guardamos o TEXTO da correta
        }
        opcoes.push(txt);
      }
    });

    return { enunciado, opcoes, textoCorreto };
  });

  // Embaralhar as PERGUNTAS
  perguntas = embaralhar(perguntasBrutas);
}

// =======================
// 4. UI: BARRA DE PROGRESSO
// =======================
function renderizarBarraProgresso() {
  if (!barraProgressoEl) return;
  barraProgressoEl.innerHTML = "";
  // Cria um segmento para cada pergunta
  perguntas.forEach((_, i) => {
    const seg = document.createElement("div");
    seg.classList.add("segmento-barra");
    seg.id = `seg-${i}`;
    barraProgressoEl.appendChild(seg);
  });
}

function atualizarBarra(indice, acertou) {
  const seg = document.getElementById(`seg-${indice}`);
  if (seg) {
    seg.classList.add(acertou ? "correto" : "errado");
  }
}

// =======================
// 5. TIMER
// =======================
function iniciarTimer() {
  tempoRestante = 20;
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
  
  // Trata como erro
  verificarResposta(-1); // -1 indica timeout
  
  // Mensagem visual
  const titulo = document.querySelector(".pergunta");
  if(titulo) titulo.innerHTML += " <br><span style='color:red; font-size:0.9em'>(Tempo Esgotado!)</span>";
}

// =======================
// 6. RENDERIZAÇÃO
// =======================
function renderizarPergunta() {
  if (indiceAtual >= perguntas.length) {
    mostrarResultadoFinal();
    return;
  }

  const p = perguntas[indiceAtual];
  respondido = false;

  // Embaralha as OPÇÕES desta pergunta também (opcional, mas bom)
  // Mas precisamos rastrear qual é a correta de novo
  // Vamos criar um array de objetos para manter a referência
  let opcoesObjs = p.opcoes.map(texto => ({
    texto,
    ehCorreta: texto === p.textoCorreto
  }));
  opcoesObjs = embaralhar(opcoesObjs);

  let htmlOpcoes = "";
  opcoesObjs.forEach((op, i) => {
    // Salvamos se é correta no atributo data-correta
    htmlOpcoes += `
      <div class="opcao" id="op-${i}" data-correta="${op.ehCorreta}" onclick="verificarResposta(${i})">
        ${op.texto}
      </div>
    `;
  });

  quizContainer.innerHTML = `
    <div style="text-align:center">
      <div id="display-tempo" class="timer-box">⏱️ 20s</div>
    </div>
    <div class="card-quiz">
      <div class="pergunta">${p.enunciado}</div>
      <div class="lista-opcoes">${htmlOpcoes}</div>
      <button id="btn-prox" onclick="proximaPergunta()">Próxima Pergunta ➜</button>
    </div>
  `;

  iniciarTimer();
}

window.verificarResposta = function(indiceEscolhido) {
  if (respondido) return;
  respondido = true;
  clearInterval(timerInterval); // Para o relógio

  const opcoesEls = document.querySelectorAll('.opcao');
  let acertou = false;

  // Bloqueia e verifica
  opcoesEls.forEach((el, i) => {
    el.classList.add('bloqueado');
    const ehCorreta = el.getAttribute('data-correta') === "true";

    if (ehCorreta) {
      el.classList.add('correta'); // Sempre mostra a correta
      if (i === indiceEscolhido) acertou = true;
    } else if (i === indiceEscolhido) {
      el.classList.add('errada'); // Marca a errada clicada
    }
  });

  if (acertou) acertos++;
  
  // Atualiza a barra lá em cima
  atualizarBarra(indiceAtual, acertou);

  document.getElementById("btn-prox").style.display = "block";
};

window.proximaPergunta = function() {
  indiceAtual++;
  renderizarPergunta();
};

// =======================
// 7. TELA FINAL & CONFETE
// =======================
function mostrarResultadoFinal() {
  const porcentagem = Math.round((acertos / perguntas.length) * 100);
  const aprovado = porcentagem >= 50;
  
  const corTitulo = aprovado ? "#25A20C" : "#ef4444";
  const mensagem = aprovado ? "Mandou bem, Guardião! 🛡️" : "Que pena, tente novamente! 📖";
  const animacao = aprovado ? "Parabéns!" : "";

  quizContainer.innerHTML = `
    <div class="card-quiz" style="text-align:center;">
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

  if (aprovado) soltarConfete();
}

function soltarConfete() {
  // Cria 50 pedacinhos de confete
  const cores = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
  
  for (let i = 0; i < 50; i++) {
    const confete = document.createElement('div');
    confete.classList.add('confete');
    
    // Posição e cor aleatória
    confete.style.left = Math.random() * 100 + 'vw';
    confete.style.backgroundColor = cores[Math.floor(Math.random() * cores.length)];
    confete.style.animationDuration = (Math.random() * 3 + 2) + 's'; // 2 a 5 segundos
    
    document.body.appendChild(confete);
    
    // Remove do DOM depois de cair
    setTimeout(() => confete.remove(), 5000);
  }
}
