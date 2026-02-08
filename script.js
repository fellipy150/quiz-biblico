// =========================================
//  SCRIPT.JS - Guardiões da Palavra
// =========================================

// Elementos Globais
const listaEl = document.getElementById("lista-quizes");
const quizContainer = document.getElementById("quiz-container");
const tituloEl = document.getElementById("titulo-quiz");

// Variáveis de Estado
let perguntas = [];
let indiceAtual = 0;
let acertos = 0;
let respondido = false; // Trava para não responder duas vezes

// =======================
// 1. CARREGAR LISTA (Index)
// =======================
if (listaEl) {
  fetch("quizes/index.json")
    .then(res => res.json())
    .then(dados => {
      listaEl.innerHTML = "";
      dados.forEach(quiz => {
        listaEl.innerHTML += `
          <li>
            <a href="quiz.html?id=${quiz.arquivo}">${quiz.titulo}</a>
          </li>`;
      });
    })
    .catch(err => console.error("Erro ao carregar lista", err));
}

// =======================
// 2. CARREGAR QUIZ (Quiz Page)
// =======================
if (quizContainer) {
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get("id");

  if (idQuiz) {
    fetch(`quizes/${idQuiz}.md`)
      .then(res => res.text())
      .then(text => {
        processarMarkdown(text);
        renderizarPergunta();
      })
      .catch(err => {
        quizContainer.innerHTML = "<p>Erro ao carregar quiz.</p>";
      });
  } else {
    window.location.href = "index.html";
  }
}

// =======================
// 3. PROCESSADOR DE MARKDOWN
// =======================
function processarMarkdown(md) {
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  
  // Título
  const tituloRaw = linhas.find(l => l.startsWith("# "));
  if (tituloEl && tituloRaw) tituloEl.innerText = tituloRaw.replace("# ", "").trim();

  // Perguntas
  const blocos = md.split(/^## /gm).slice(1);
  perguntas = blocos.map(bloco => {
    const lines = bloco.trim().split("\n");
    const enunciado = lines[0].trim();
    const opcoes = [];
    let correta = 0;
    
    let count = 0;
    lines.slice(1).forEach(l => {
      if (l.trim().startsWith("- ")) {
        let txt = l.replace("- ", "").trim();
        if (txt.endsWith("*")) {
          correta = count;
          txt = txt.slice(0, -1).trim();
        }
        opcoes.push(txt);
        count++;
      }
    });

    return { enunciado, opcoes, correta };
  });
}

// =======================
// 4. RENDERIZAR PERGUNTA
// =======================
function renderizarPergunta() {
  if (indiceAtual >= perguntas.length) {
    mostrarResultadoFinal();
    return;
  }

  const p = perguntas[indiceAtual];
  respondido = false; // Reseta a trava para a nova pergunta

  let htmlOpcoes = "";
  p.opcoes.forEach((op, i) => {
    // Passamos o índice para a função verificarResposta
    htmlOpcoes += `
      <div class="opcao" id="op-${i}" onclick="verificarResposta(${i})">
        ${op}
      </div>
    `;
  });

  quizContainer.innerHTML = `
    <div class="card-quiz">
      <div class="progresso">Questão ${indiceAtual + 1} de ${perguntas.length}</div>
      <div class="pergunta">${p.enunciado}</div>
      <div class="lista-opcoes">${htmlOpcoes}</div>
      
      <button id="btn-prox" onclick="proximaPergunta()">Próxima Pergunta ➜</button>
    </div>
  `;
}

// =======================
// 5. LÓGICA DE RESPOSTA (Onde a mágica acontece)
// =======================
window.verificarResposta = function(indiceEscolhido) {
  if (respondido) return; // Se já respondeu, não faz nada
  respondido = true;

  const p = perguntas[indiceAtual];
  const elEscolhido = document.getElementById(`op-${indiceEscolhido}`);
  const elCorreto = document.getElementById(`op-${p.correta}`);
  const todasOpcoes = document.querySelectorAll('.opcao');

  // Bloqueia todas as opções (para não clicar em outra)
  todasOpcoes.forEach(el => el.classList.add('bloqueado'));

  if (indiceEscolhido === p.correta) {
    // ACERTOU
    elEscolhido.classList.add('correta');
    acertos++;
  } else {
    // ERROU
    elEscolhido.classList.add('errada'); // Fica vermelho
    elCorreto.classList.add('correta');  // Mostra qual era a verde
  }

  // Mostra o botão de próxima
  const btn = document.getElementById("btn-prox");
  btn.style.display = "block";
};

window.proximaPergunta = function() {
  indiceAtual++;
  renderizarPergunta();
};

// =======================
// 6. TELA FINAL
// =======================
function mostrarResultadoFinal() {
  const porcentagem = Math.round((acertos / perguntas.length) * 100);
  
  quizContainer.innerHTML = `
    <div class="card-quiz" style="text-align:center;">
      <h2>Fim do Treinamento!</h2>
      <div style="font-size: 4rem; color: var(--brand-green); font-weight:800; margin: 20px 0;">
        ${porcentagem}%
      </div>
      <p style="font-size:1.2rem; margin-bottom:20px;">
        Você acertou <strong>${acertos}</strong> de <strong>${perguntas.length}</strong>.
      </p>
      
      <button onclick="location.reload()" style="background:var(--brand-green); color:white; padding:15px 30px; border:none; border-radius:12px; font-size:1.1rem; cursor:pointer;">
        Tentar Novamente
      </button>
      
      <br><br>
      <a href="index.html" style="color:#666; text-decoration:none;">Voltar ao Menu</a>
    </div>
  `;
}
