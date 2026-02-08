let perguntas = [];
let perguntaAtual = 0;
let respostas = [];

// Detecta em qual página estamos
const isIndex = document.getElementById("lista-quizes");
const isQuiz = document.getElementById("quiz");

// =======================
// INDEX.HTML (menu)
// =======================
if (isIndex) {
  fetch("quizes/index.json")
    .then(res => res.json())
    .then(quizes => {
      quizes.forEach(q => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="quiz.html?quiz=${q.arquivo}">${q.titulo}</a>`;
        isIndex.appendChild(li);
      });
    })
    .catch(() => {
      isIndex.innerHTML = "<li>Erro ao carregar quizzes 😢</li>";
    });
}

// =======================
// QUIZ.HTML (quiz)
// =======================
if (isQuiz) {
  const params = new URLSearchParams(window.location.search);
  const quizNome = params.get("quiz");

  if (!quizNome) {
    document.body.innerHTML = "<p>Quiz não informado 😢</p>";
    throw new Error("Quiz não informado");
  }

  fetch(`quizes/${quizNome}.md`)
    .then(res => {
      if (!res.ok) throw new Error("Arquivo não encontrado");
      return res.text();
    })
    .then(texto => iniciarQuiz(texto))
    .catch(() => {
      document.body.innerHTML = "<p>Erro ao carregar o quiz 😢</p>";
    });
}

let perguntas = [];

function iniciarQuiz(md) {
  const linhas = md.split("\n");

  // Título do quiz (# ...)
  if (linhas[0].startsWith("# ")) {
    document.getElementById("titulo").innerText =
      linhas[0].replace("# ", "").trim();
  }

  parsePerguntas(md);
  montarQuiz();
}

function parsePerguntas(md) {
  const blocos = md.split("## ").slice(1);

  blocos.forEach(bloco => {
    const linhas = bloco.trim().split("\n");
    const pergunta = linhas[0];

    const opcoes = [];
    let correta = 0;

    linhas.slice(1).forEach(linha => {
      if (linha.startsWith("- ")) {
        let texto = linha.replace("- ", "").trim();
        if (texto.endsWith("*")) {
          correta = opcoes.length;
          texto = texto.replace("*", "").trim();
        }
        opcoes.push(texto);
      }
    });

    perguntas.push({ pergunta, opcoes, correta });
  });
}

function montarQuiz() {
  mostrarPergunta();
}

function verResultado() {
  let pontos = 0;

  perguntas.forEach((item, index) => {
    const r = document.querySelector(`input[name="p${index}"]:checked`);
    if (r && Number(r.value) === item.correta) pontos++;
  });

  document.getElementById("resultado").innerText =
    `Você acertou ${pontos} de ${perguntas.length} 🙌`;
}

function mostrarPergunta() {
  const quizDiv = document.getElementById("quiz");
  quizDiv.innerHTML = "";

  const p = perguntas[perguntaAtual];

  const div = document.createElement("div");

  div.innerHTML = `
    <p class="pergunta"><strong>${p.pergunta}</strong></p>

    ${p.opcoes.map((op, i) => `
      <label class="opcao">
        <input type="radio" name="resposta" value="${i}">
        ${op}
      </label>
    `).join("")}

    <button onclick="proximaPergunta()">Próxima</button>
  `;

  quizDiv.appendChild(div);
}
function proximaPergunta() {
  const selecionada = document.querySelector('input[name="resposta"]:checked');

  if (!selecionada) {
    alert("Escolha uma opção 🙂");
    return;
  }

  respostas[perguntaAtual] = Number(selecionada.value);
  perguntaAtual++;

  if (perguntaAtual < perguntas.length) {
    mostrarPergunta();
  } else {
    mostrarResultado();
  }
}

function mostrarResultado() {
  let pontos = 0;

  perguntas.forEach((p, i) => {
    if (respostas[i] === p.correta) pontos++;
  });

  document.getElementById("quiz").innerHTML = `
    <h2>Resultado 🙌</h2>
    <p>Você acertou ${pontos} de ${perguntas.length}</p>
    <button onclick="location.reload()">Refazer quiz</button>
  `;
}