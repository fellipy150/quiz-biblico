// =========================================
//  SCRIPT.JS - Guardiões (Shuffle Total + Dicas)
// =========================================

const listaEl = document.getElementById("lista-quizes");
const quizContainer = document.getElementById("quiz-container");
const barraProgressoEl = document.getElementById("barra-progresso-container");
const tituloEl = document.getElementById("titulo-quiz");

// Estado do Jogo
let perguntas = [];
let indiceAtual = 0;
let acertos = 0;
let respondido = false;
let dicaUsadaGlobal = false; // Só pode usar 1 vez por jogo

// Timer
let tempoRestante = 20;
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
        quizContainer.innerHTML = "<p>Erro ao carregar (verifique o formato do MD).</p>";
      });
  } else {
    window.location.href = "index.html";
  }
}

// =======================
// PARSER (Grupos + Checkbox + Dicas)
// =======================
function processarMarkdown(md) {
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  
  // 1. Pega Título
  const tituloRaw = linhas.find(l => l.startsWith("# "));
  if (tituloEl && tituloRaw) tituloEl.innerText = tituloRaw.replace("# ", "").trim();

  // 2. Separa por Grupos (---)
  // O regex ^---$ pega linhas que só tem traços
  const gruposRaw = md.split(/^---$/gm);
  
  let todasPerguntasOrdenadas = [];

  gruposRaw.forEach(grupoTexto => {
    // Para cada grupo, extraímos as perguntas
    const blocos = grupoTexto.split(/^## /gm).slice(1); // slice(1) remove lixo antes do primeiro ##
    
    let perguntasDoGrupo = blocos.map(bloco => {
      const lines = bloco.trim().split("\n");
      const enunciado = lines[0].trim();
      const opcoes = [];
      let dica = null;

      lines.slice(1).forEach(linha => {
        const l = linha.trim();
        
        // Checkbox Correta [x]
        if (l.startsWith("[x]")) {
          opcoes.push({ texto: l.replace("[x]", "").trim(), correta: true });
        }
        // Checkbox Errada [ ]
        else if (l.startsWith("[ ]")) {
          opcoes.push({ texto: l.replace("[ ]", "").trim(), correta: false });
        }
        // Dica -#
        else if (l.startsWith("-#")) {
          dica = l.replace("-#", "").trim();
        }
      });

      return { enunciado, opcoes, dica };
    });

    // 3. Embaralha SÓ as perguntas DENTRO deste grupo
    perguntasDoGrupo = embaralhar(perguntasDoGrupo);

    // Adiciona ao array principal mantendo a ordem dos grupos
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
    barraProgressoEl.appendChild(seg);
  });
}

function atualizarBarra(indice, acertou) {
  const seg = document.getElementById(`seg-${indice}`);
  if (seg) seg.classList.add(acertou ? "correto" : "errado");
}

function renderizarPergunta() {
  if (indiceAtual >= perguntas.length) {
    mostrarResultadoFinal();
    return;
  }

  const p = perguntas[indiceAtual];
  respondido = false;

  // 4. Embaralhar as ALTERNATIVAS (Opções)
  // Como já são objetos {texto, correta}, podemos embaralhar sem medo
  const opcoesEmbaralhadas = embaralhar([...p.opcoes]); 

  let htmlOpcoes = "";
  opcoesEmbaralhadas.forEach((op, index) => {
    // Usamos o índice do array embaralhado para o ID
    htmlOpcoes += `
      <div class="opcao" id="op-${index}" 
           data-is-correct="${op.correta}" 
           onclick="verificarResposta(${index})">
        ${op.texto}
      </div>
    `;
  });

  // Botão de Dica (Se existir dica E não tiver usado a global)
  let htmlDica = "";
  if (p.dica) {
    if (!dicaUsadaGlobal) {
      htmlDica = `<button class="btn-dica" onclick="mostrarDica(this, '${p.dica.replace(/'/g, "&#39;")}')">💡 Usar Dica (Apenas 1 por jogo)</button>`;
    } else {
      htmlDica = `<button class="btn-dica" disabled>💡 Dica indisponível (já usada)</button>`;
    }
  }

  quizContainer.innerHTML = `
    <div style="text-align:center">
      <div id="display-tempo" class="timer-box">⏱️ 20s</div>
    </div>
    <div class="card-quiz">
      <div class="pergunta">${p.enunciado}</div>
      
      <div id="area-dica">${htmlDica}</div>

      <div class="lista-opcoes">${htmlOpcoes}</div>
      <button id="btn-prox" onclick="proximaPergunta()">Próxima Pergunta ➜</button>
    </div>
  `;

  iniciarTimer();
}

// =======================
// LÓGICA DO JOGO
// =======================
function mostrarDica(btn, textoDica) {
  if(dicaUsadaGlobal) return;
  dicaUsadaGlobal = true;
  
  const area = document.getElementById("area-dica");
  area.innerHTML = `<div class="box-dica-texto">💡 <strong>Dica:</strong> ${textoDica}</div>`;
}

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
  verificarResposta(-1); // -1 = Timeout
  const titulo = document.querySelector(".pergunta");
  if(titulo) titulo.innerHTML += " <br><span style='color:red; font-size:0.9em'>(Tempo Esgotado!)</span>";
}

window.verificarResposta = function(index) {
  if (respondido) return;
  respondido = true;
  clearInterval(timerInterval);

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
  atualizarBarra(indiceAtual, acertou);
  document.getElementById("btn-prox").style.display = "block";
  
  // Se tiver botão de dica, some ou desabilita pra não clicar depois de responder
  const btnDica = document.querySelector(".btn-dica");
  if(btnDica) btnDica.disabled = true;
};

window.proximaPergunta = function() {
  indiceAtual++;
  renderizarPergunta();
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
  const cores = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
  for (let i = 0; i < 50; i++) {
    const confete = document.createElement('div');
    confete.classList.add('confete');
    confete.style.left = Math.random() * 100 + 'vw';
    confete.style.backgroundColor = cores[Math.floor(Math.random() * cores.length)];
    confete.style.animationDuration = (Math.random() * 3 + 2) + 's';
    document.body.appendChild(confete);
    setTimeout(() => confete.remove(), 5000);
  }
}
