const fs = require("fs");
const path = require("path");

const QUIZ_DIR = path.join(__dirname, "quizes");
const INDEX_PATH = path.join(QUIZ_DIR, "index.json");

const arquivos = fs.readdirSync(QUIZ_DIR);

const quizes = arquivos
  .filter(nome => nome.endsWith(".md"))
  .map(nome => {
    const conteudo = fs.readFileSync(path.join(QUIZ_DIR, nome), "utf-8");
    const primeiraLinha = conteudo.split("\n")[0];

    let titulo = nome.replace(".md", "");

    if (primeiraLinha.startsWith("# ")) {
      titulo = primeiraLinha.replace("# ", "").trim();
    }

    return {
      arquivo: nome.replace(".md", ""),
      titulo
    };
  });

fs.writeFileSync(
  INDEX_PATH,
  JSON.stringify(quizes, null, 2),
  "utf-8"
);

console.log("✅ index.json sincronizado com sucesso!");
