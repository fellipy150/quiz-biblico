const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CONFIG = {
  // Ajuste o caminho se necessário (ex: '../assets/data/quizes' ou '../quizes')
  QUIZ_DIR: path.join(__dirname, "../quizes"), 
  INDEX_FILE: "index.json",
  ID_LENGTH_BYTES: 5
};

// ==========================================
// REGEX RIGOROSAS (CORRIGIDAS)
// ==========================================
const PATTERNS = {
  // Bloco de código (preservar)
  MD_BLOCK: /^```/,
  
  // ID: id: xxxxxxxxxx
  ID_VALID: /^id:\s*([0-9a-fA-F]{10})$/,
  
  // Opção: [ ] ou [x]
  OPTION: /^\s*\[([xX ]+)\]/,
  
  // Explicação: Começa com "-!" OU "Explicação:" (Case insensitive)
  // O erro anterior estava aqui (os '?' deixavam pegar qualquer coisa)
  EXPLANATION: /^(?:-!\s*|explicaç[ãa]o\s*:|obs\s*:)/i,
  
  // Dica: Começa com "-#" OU "Dica:"
  TIP: /^(?:-#\s*|dica\s*:)/i,
  
  // Títulos: #, ## ou ###
  HEADING_HASH: /^#+/,
  
  // Categorias
  CATEGORY: /^<!--.*-->$/,

  // Detecta lixo gerado pelo script anterior (ex: "-! ### Titulo")
  CORRUPTED_PREFIX: /^-!\s*(?=#)/
};

// Gera ID Hex
const generateId = () => crypto.randomBytes(CONFIG.ID_LENGTH_BYTES).toString("hex");

/**
 * Processa um único arquivo
 */
async function processFile(fileName) {
  const filePath = path.join(CONFIG.QUIZ_DIR, fileName);

  try {
    const contentHandle = await fs.readFile(filePath, "utf-8");
    const lines = contentHandle.replace(/\r\n/g, "\n").split("\n");
    
    const newContent = [];
    let titleForIndex = "";
    
    // Estado da Máquina
    let state = {
      inCodeBlock: false,
      foundH1: false, // Título Interno #
      foundH2: false, // Título Menu ##
      pendingId: null,
      lastLineWasEmpty: false
    };

    const stats = { idsGenerated: 0, titlesFixed: 0, prefixesFixed: 0, cleaned: 0 };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // 1. Preservar Blocos de Código (Descrição)
      if (PATTERNS.MD_BLOCK.test(line)) {
        state.inCodeBlock = !state.inCodeBlock;
        newContent.push(line); // Mantém indentação original se possível
        continue;
      }
      if (state.inCodeBlock) {
        newContent.push(lines[i]); // Mantém conteúdo exato dentro do bloco
        continue;
      }

      // 2. Limpeza de Arquivo Corrompido
      // Remove o "-! " se ele estiver na frente de um "#" (erro do script anterior)
      if (PATTERNS.CORRUPTED_PREFIX.test(line)) {
        line = line.replace(PATTERNS.CORRUPTED_PREFIX, "").trim();
        stats.cleaned++;
      }
      // Corrige "-! # Dica" para "-# Dica"
      if (line.startsWith("-! # Dica") || line.startsWith("-! Dica")) {
        line = line.replace(/^-!\s*#?\s*/, "-# ");
        stats.cleaned++;
      }

      // 3. Linhas Vazias
      if (line === "") {
        if (!state.lastLineWasEmpty && newContent.length > 0) {
          newContent.push("");
          state.lastLineWasEmpty = true;
        }
        continue;
      }
      state.lastLineWasEmpty = false;

      // 4. IDs
      if (line.toLowerCase().startsWith("id:")) {
        const match = line.match(PATTERNS.ID_VALID);
        if (match) {
          state.pendingId = match[1].toLowerCase();
        } else {
          state.pendingId = null; // ID inválido, será gerado um novo
        }
        continue; // Espera o cabeçalho da pergunta
      }

      // 5. Categorias
      if (PATTERNS.CATEGORY.test(line)) {
        newContent.push(line);
        continue;
      }

      // 6. Opções [ ] / [x]
      if (PATTERNS.OPTION.test(line)) {
        const isCorrect = line.includes("[x]") || line.includes("[X]");
        const text = line.replace(PATTERNS.OPTION, "").trim();
        newContent.push(`${isCorrect ? "[x]" : "[ ]"} ${text}`);
        continue;
      }

      // 7. Dicas (-#)
      // Checa antes de explicação para evitar conflito se regex for mal feita
      if (line.startsWith("-#") || PATTERNS.TIP.test(line)) {
        // Remove prefixos antigos (dica:, -#, etc)
        const text = line.replace(/^(?:-#\s*|dica\s*:|#\s*dica\s*:)\s*/i, "").trim();
        newContent.push(`-# Dica: ${text.replace(/^Dica:\s*/i, "")}`); // Padroniza "-# Dica: Texto"
        stats.prefixesFixed++;
        continue;
      }

      // 8. Explicações (-!)
      if (line.startsWith("-!") || PATTERNS.EXPLANATION.test(line)) {
        const text = line.replace(PATTERNS.EXPLANATION, "").trim();
        newContent.push(`-! ${text}`);
        stats.prefixesFixed++;
        continue;
      }

      // 9. Títulos e Perguntas (#, ##, ###)
      // Detecta se começa com # ou se é texto puro que deve virar título
      if (line.startsWith("#")) {
        let cleanText = line.replace(PATTERNS.HEADING_HASH, "").trim();

        // Lógica de Hierarquia
        if (!state.foundH1) {
          // # Título Interno
          newContent.push(`# ${cleanText}`);
          state.foundH1 = true;
          if (!titleForIndex) titleForIndex = cleanText;
          stats.titlesFixed++;
        } 
        else if (!state.foundH2 && !cleanText.endsWith("?")) {
          // ## Título Menu
          newContent.push(`## ${cleanText}`);
          state.foundH2 = true;
          titleForIndex = cleanText;
          stats.titlesFixed++;
        } 
        else {
          // ### Pergunta
          const idToUse = state.pendingId || generateId();
          if (!state.pendingId) stats.idsGenerated++;

          newContent.push(`id: ${idToUse}`);
          newContent.push(`### ${cleanText}`);
          state.pendingId = null;
          stats.titlesFixed++;
        }
        continue;
      }

      // 10. Texto Comum (Descrição fora do bloco md, etc)
      newContent.push(line);
    }

    // Grava arquivo
    const finalContent = newContent.join("\n").trim() + "\n";
    if (finalContent !== contentHandle) {
      await fs.writeFile(filePath, finalContent, "utf-8");
      console.log(`✅ ${fileName}: Limpos: ${stats.cleaned} | IDs: ${stats.idsGenerated} | Títulos: ${stats.titlesFixed}`);
    } else {
      console.log(`✨ ${fileName}: Já estava correto.`);
    }

    return {
      fileName: fileName,
      title: titleForIndex || fileName.replace(".md", "")
    };

  } catch (err) {
    console.error(`❌ Erro em ${fileName}:`, err.message);
    return null;
  }
}

/**
 * Função Principal
 */
async function main() {
  const indexJsonPath = path.join(CONFIG.QUIZ_DIR, CONFIG.INDEX_FILE);

  try {
    // Valida diretório
    await fs.access(CONFIG.QUIZ_DIR);
    
    // Lê arquivos
    const allFiles = await fs.readdir(CONFIG.QUIZ_DIR);
    const quizFiles = allFiles.filter(n => n.endsWith(".md"));

    if (quizFiles.length === 0) {
      console.log("⚠️ Nenhum arquivo .md encontrado.");
      return;
    }

    console.log(`\n🚀 Processando ${quizFiles.length} arquivos...`);

    // Processa todos
    const results = await Promise.all(quizFiles.map(processFile));
    const validResults = results.filter(r => r !== null);

    // Gera Index
    console.log(`\n🔄 Atualizando ${CONFIG.INDEX_FILE}...`);
    const indexData = validResults.map(r => ({
      arquivo: r.fileName.replace(".md", ""),
      titulo: r.title
    })).sort((a, b) => a.titulo.localeCompare(b.titulo));

    await fs.writeFile(indexJsonPath, JSON.stringify(indexData, null, 2), "utf-8");

    console.log(`🎉 Sucesso! Index gerado com ${validResults.length} quizes.`);

  } catch (err) {
    console.error("❌ Erro fatal:", err);
  }
}

main();


