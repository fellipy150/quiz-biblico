const quizDiv = document.getElementById("quiz");
let perguntas = [];

fetch("perguntas.md")
  .then(res => res.text())
  .then(texto => {
    parsePerguntas(texto);
    montarQuiz();
  });

function parsePerguntas(md) {
  const blocos = md.split("## ").slice(1);

  blocos.forEach(bloco => {
    const linhas = bloco.trim().split("\n");
    const pergunta = linhas[0];

    const opcoes = [];
    let correta = 0;

    linhas.slice(1).forEach((linha, index) => {
      if (linha.startsWith("- ")) {
        let textoOpcao = linha.replace("- ", "").trim();
        if (textoOpcao.endsWith("*")) {
          correta = opcoes.length;
          textoOpcao = textoOpcao.replace("*", "").trim();
        }
        opcoes.push(textoOpcao);
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
    const resposta = document.querySelector(`input[name="p${index}"]:checked`);
    if (resposta && Number(resposta.value) === item.correta) {
      pontos++;
    }
  });

  document.getElementById("resultado").innerText =
    `Você acertou ${pontos} de ${perguntas.length} perguntas 🙌`;
}
