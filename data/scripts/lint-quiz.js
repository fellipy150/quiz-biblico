const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Caminho para a pasta de quizes (mesmo padrão do gerar_index.js)
const QUIZ_DIR = path.join(__dirname, "../quizes");

// ==========================================
// CONFIGURAÇÕES E REGEX
// ==========================================

// Gera ID aleatório de 10 caracteres hex (5 bytes)
const generateId = () => crypto.randomBytes(5).toString("hex");

const ID_REGEX = /^id:\s*([0-9a-fA-F]{10})$/;
const CATEGORIA_REGEX = /^<!--(.*)-->$/;
const OPTION_REGEX = /^\s*\[([xX ]+)\]/;
const EXPLICACAO_REGEX = /^(\s*-?!?\s*|explicaç[ãa]o\s*:|obs\s*:)\s*/i;
const DICA_REGEX = /^(\s*-?#?\s*|dica\s*:)\s*/i;
const NUM_REGEX = /^\s*(?:N(?:º|o|°)?\.?\s*)?(?:\d{1,4})(?:[.\)\-\ºª]*)\s*/i;

if (!fs.existsSync(QUIZ_DIR)) {
  console.error(`❌ Diretório não encontrado: ${QUIZ_DIR}`);
  process.exit(1);
}

const arquivos = fs.readdirSync(QUIZ_DIR).filter(n => n.endsWith(".md"));

if (arquivos.length === 0) {
  console.log("⚠️ Nenhum ficheiro .md encontrado em:", QUIZ_DIR);
  process.exit(0);
}

console.log(`🧹 Iniciando Linter em ${arquivos.length} ficheiros no caminho: ${QUIZ_DIR}\n`);

arquivos.forEach(nome => {
  const caminho = path.join(QUIZ_DIR, nome);
  const conteudoOriginal = fs.readFileSync(caminho, "utf-8");
  const linhas = conteudoOriginal.replace(/\r\n/g, "\n").split("\n");

  let novoConteudo = [];
  let encontrouTituloInterno = false; // #
  let encontrouTituloPagina = false;  // ##
  let idEmEspera = null; 

  let stats = { idsGerados: 0, titulosAjustados: 0, prefixosFixados: 0 };

  for (let i = 0; i < linhas.length; i++) {
    let linha = linhas[i].trim();

    // 1. Linhas vazias: evita duplicados, mas mantém 1 para legibilidade
    if (linha === "") {
      if (novoConteudo.length > 0 && novoConteudo[novoConteudo.length - 1] !== "") {
        novoConteudo.push("");
      }
      continue;
    }

    // 2. Captura ID existente se houver
    const matchId = linha.match(ID_REGEX);
    if (matchId) {
      idEmEspera = matchId[1].toLowerCase();
      continue; 
    }

    // 3. Categorias (Preserva)
    if (CATEGORIA_REGEX.test(linha)) {
      novoConteudo.push(linha);
      continue;
    }

    // 4. Alternativas [ ] ou [x]
    if (OPTION_REGEX.test(linha)) {
      const isCorrect = linha.match(/\[[xX]\]/);
      let texto = linha.replace(OPTION_REGEX, "").trim();
      novoConteudo.push(`${isCorrect ? "[x]" : "[ ]"} ${texto}`);
      continue;
    }

    // 5. Explicações de alternativas (-!)
    if (linha.startsWith("-!") || linha.toLowerCase().startsWith("explica") || linha.toLowerCase().startsWith("obs:")) {
      let texto = linha.replace(EXPLICACAO_REGEX, "").trim();
      novoConteudo.push(`-! ${texto}`);
      stats.prefixosFixados++;
      continue;
    }

    // 6. Dicas de pergunta (-#)
    if (linha.startsWith("-#") || linha.toLowerCase().startsWith("dica:")) {
      let texto = linha.replace(DICA_REGEX, "").trim();
      novoConteudo.push(`-# ${texto}`);
      stats.prefixosFixados++;
      continue;
    }

    // 7. Títulos e Perguntas
    if (linha.startsWith("#") || linha.match(NUM_REGEX)) {
      let textoLimpo = linha.replace(/^#+/, "").trim();
      textoLimpo = textoLimpo.replace(NUM_REGEX, "").trim();

      if (!encontrouTituloInterno) {
        novoConteudo.push(`# ${textoLimpo}`);
        encontrouTituloInterno = true;
        stats.titulosAjustados++;
      } 
      else if (!encontrouTituloPagina && !textoLimpo.endsWith("?")) {
        novoConteudo.push(`## ${textoLimpo}`);
        encontrouTituloPagina = true;
        stats.titulosAjustados++;
      } 
      else {
        // É uma pergunta (###)
        // Antes da pergunta, insere o ID (ou gera um novo)
        const idFinal = idEmEspera || generateId();
        if (!idEmEspera) stats.idsGerados++;
        
        novoConteudo.push(`id: ${idFinal}`);
        novoConteudo.push(`### ${textoLimpo}`);
        
        idEmEspera = null; // Limpa o buffer
        stats.titulosAjustados++;
      }
      continue;
    }

    // 8. Texto corrido (Provavelmente descrição)
    novoConteudo.push(linha);
  }

  const final = novoConteudo.join("\n").trim() + "\n";

  if (final !== conteudoOriginal) {
    fs.writeFileSync(caminho, final, "utf-8");
    console.log(`✅ ${nome}:
    - IDs: ${stats.idsGerados} gerados
    - Títulos: ${stats.titulosAjustados} normalizados
    - Prefixos: ${stats.prefixosFixados} corrigidos`);
  } else {
    console.log(`✨ ${nome}: já estava formatado.`);
  }
});

console.log("\n🎯 Lint finalizado com sucesso!");

