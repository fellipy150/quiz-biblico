// lint-md.js
// Execute dentro da pasta `quizes/`
// node lint-md.js

const fs = require("fs");
const path = require("path");

const QUIZ_DIR = __dirname;
const arquivos = fs
  .readdirSync(QUIZ_DIR)
  .filter(n => n.endsWith(".md"));

/**
 * Regexes
 */
// removes leading numbering como: "1.", "1)", "1 -", "1ª", "Nº 1", "No 1", "01."
const NUM_REGEX = /^\s*(?:N(?:º|o|°)?\.?\s*)?(?:\d{1,4})(?:[.\)\-\ºª]*)\s*/i;
// detecta variações de dica no início da linha: "- Dica:", "Dica:", "## Dica:" etc
const DICA_REGEX = /^(\s*-?\s*#*\s*)?dica\s*[:\-]?\s*/i;
// detecta alternativa marcada: [ ], [x], [X]
const ALTERNATIVA_REGEX = /^\s*\[[ xX]\]/;
// detecta regra horizontal '---' ou '***' (mantemos como está)
const HR_REGEX = /^(-{3,}|\*{3,})\s*$/;

function removeNumeracaoInicio(text, counters) {
  const m = text.match(NUM_REGEX);
  if (m) {
    counters.numRemoved++;
    return text.replace(NUM_REGEX, "");
  }
  return text;
}

if (arquivos.length === 0) {
  console.log("⚠️ Nenhum arquivo .md encontrado em:", QUIZ_DIR);
  process.exit(0);
}

arquivos.forEach(nome => {
  const caminho = path.join(QUIZ_DIR, nome);
  const original = fs.readFileSync(caminho, "utf-8");
  const linhasOrig = original.split(/\r?\n/);

  const counters = {
    indentRemoved: 0,
    trailingSpacesRemoved: 0,
    numRemoved: 0,
    tipsNormalized: 0,
    titlesFixed: 0,
  };

  let encontrouTituloPrincipal = false;
  const out = [];
  let blankStreak = 0;

  for (let i = 0; i < linhasOrig.length; i++) {
    let linha = linhasOrig[i];

    // 1) Remove indentação (espaços/tabs no início)
    if (/^\s+/.test(linha)) {
      linha = linha.replace(/^\s+/, "");
      counters.indentRemoved++;
    }

    // 2) Remove espaços/tabs no final da linha
    if (/[ \t]+$/.test(linha)) {
      linha = linha.replace(/[ \t]+$/, "");
      counters.trailingSpacesRemoved++;
    }

    // 3) Linha vazia: compacta múltiplas linhas vazias numa só
    if (linha.trim() === "") {
      blankStreak++;
      if (blankStreak <= 1) out.push("");
      continue;
    } else {
      blankStreak = 0;
    }

    // 4) Mantém regras horizontais (--- ou ***)
    if (HR_REGEX.test(linha.trim())) {
      out.push(linha.trim());
      continue;
    }

    // 5) Normaliza dica (independente da forma original)
    if (DICA_REGEX.test(linha)) {
      const resto = linha.replace(DICA_REGEX, "").trim();
      out.push(`-# Dica: ${resto}`);
      counters.tipsNormalized++;
      continue;
    }

    // 6) Títulos (qualquer linha que comece com #)
    if (linha.startsWith("#")) {
      // remove todos os # iniciais e espaços
      let texto = linha.replace(/^#+\s*/, "").trim();
      // remove numeração no início do texto (ex: "1. Blá blá")
      texto = removeNumeracaoInicio(texto, counters).trim();

      if (!encontrouTituloPrincipal) {
        out.push(`# ${texto}`);
        encontrouTituloPrincipal = true;
        counters.titlesFixed++;
      } else {
        out.push(`## ${texto}`);
        counters.titlesFixed++;
      }
      continue;
    }

    // 7) Linhas que são alternativas ( [ ] / [x] ) - mantemos sem alterações
    if (ALTERNATIVA_REGEX.test(linha)) {
      out.push(linha);
      continue;
    }

    // 8) Para qualquer outra linha: remover numeração no início (ex: "1. Texto")
    const semNum = removeNumeracaoInicio(linha, counters).trim();

    // 9) Remover possíveis espaços sobrando e empurrar para saída
    out.push(semNum);
  }

  const final = out.join("\n") + "\n"; // termina com newline

  // Só regrava quando mudou (evita sobrescrever timestamp desnecessariamente)
  if (final !== original) {
    fs.writeFileSync(caminho, final, "utf-8");
    console.log(`🧹 ${nome} — lint aplicado:
  • indent removida: ${counters.indentRemoved}
  • espaços finais removidos: ${counters.trailingSpacesRemoved}
  • numerações removidas: ${counters.numRemoved}
  • dicas normalizadas: ${counters.tipsNormalized}
  • títulos/preguntas normalizados: ${counters.titlesFixed}
`);
  } else {
    console.log(`✅ ${nome} — sem alterações necessárias.`);
  }
});

console.log("🎯 Lint finalizado para todos os arquivos .md");
