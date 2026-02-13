const fs = require("fs");
const path = require("path");

// Ajuste do caminho conforme solicitado: ../quizes/
const QUIZ_DIR = path.join(__dirname, "../quizes");
const INDEX_PATH = path.join(QUIZ_DIR, "index.json");

// Verifica se o diretório existe para evitar erros
if (!fs.existsSync(QUIZ_DIR)) {
  console.error(`❌ Diretório não encontrado: ${QUIZ_DIR}`);
  process.exit(1);
}

const arquivos = fs.readdirSync(QUIZ_DIR);

const quizes = arquivos
  .filter(nome => nome.endsWith(".md"))
  .map(nome => {
    const conteudo = fs.readFileSync(path.join(QUIZ_DIR, nome), "utf-8");
    const linhas = conteudo.split(/\r?\n/); // Divide por quebra de linha (Windows/Linux)

    // Padrão: Nome do arquivo sem extensão
    let titulo = nome.replace(".md", "");

    // Procura pela linha que começa com "## " (Título da Página Principal)
    const linhaTituloPrincipal = linhas.find(l => l.startsWith("## "));

    if (linhaTituloPrincipal) {
      titulo = linhaTituloPrincipal.replace("## ", "").trim();
    } else {
      // Fallback: Tenta achar o título interno (# ) se não houver (## )
      const linhaTituloInterno = linhas.find(l => l.startsWith("# "));
      if (linhaTituloInterno) {
        titulo = linhaTituloInterno.replace("# ", "").trim();
      }
    }

    return {
      arquivo: nome.replace(".md", ""),
      titulo: titulo
    };
  });

// Ordena alfabeticamente pelo título (opcional, mas bom para UX)
quizes.sort((a, b) => a.titulo.localeCompare(b.titulo));

fs.writeFileSync(
  INDEX_PATH,
  JSON.stringify(quizes, null, 2),
  "utf-8"
);

console.log(`✅ index.json sincronizado com sucesso! Encontrados: ${quizes.length} quizes.`);
console.log(`📂 Diretório processado: ${QUIZ_DIR}`);

