const params = new URLSearchParams(window.location.search);
const quizNome = params.get("quiz");

if (!quizNome) {
  document.body.innerHTML = "<p>Quiz não encontrado 😢</p>";
  throw new Error("Quiz não informado");
}

fetch(`quizes/${quizNome}.md`)
  .then(res => {
    if (!res.ok) throw new Error("Arquivo não encontrado");
    return res.text();
  })
  .then(texto => {
    document.getElementById("titulo").innerText =
      `Quiz: ${quizNome.charAt(0).toUpperCase() + quizNome.slice(1)}`;
    parsePerguntas(texto);
    montarQuiz();
  })
  .catch(() => {
    document.body.innerHTML = "<p>Erro ao carregar o quiz 😢</p>";
  });

const quizDiv = document.getElementById("quiz");
let perguntas = [];

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
  perguntas.forEach((item, index) => {
    const div = document.createElement("div");

    div.innerHTML = `
      <p><strong>${item.pergunta}</strong></p>
      ${item.opcoes.map((op, i) => `
        <label>
          <input type="radio" name="p${index}" value="${i}">
          ${op}
        </label><br>
      `).join("")}
    `;

    quizDiv.appendChild(div);
  });
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
