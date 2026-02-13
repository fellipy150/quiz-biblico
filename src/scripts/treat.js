const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CONFIG = {
  QUIZ_DIR: path.join(__dirname, "../quizes"),
  INDEX_FILE: "index.json",
  ID_LENGTH: 5 // bytes -> 10 hex chars
};

// Regex de Validação Semântica
const PATTERNS = {
  // Captura blocos de código markdown (descrição)
  MD_BLOCK: /^```/,
  // Captura [x] ou [ ]
  OPTION: /^\s*\[([xX ])\]\s*(.*)/, 
  // Captura Dicas (Dica:, Tip:, -#)
  TIP: /^(?:-#|dica\s*:|tip\s*:|#\s*dica)\s*(.*)/i, 
  // Captura Explicações (-!, Explicação:)
  EXPLANATION: /^(?:-!|explicaç[ãa]o\s*:|obs\s*:)\s*(.*)/i,
  // Captura Comentários/Categorias
  CATEGORY: /^<!--(.*)-->$/, 
  // Captura IDs válidos
  ID_VALID: /^id:\s*([0-9a-fA-F]{10})$/i
};

// ==========================================
// MOTOR SEMÂNTICO (CLASSES)
// ==========================================

class QuizParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.rawContent = fs.readFileSync(filePath, "utf-8");
    
    // Estrutura do Arquivo
    this.header = {
      internalTitle: null, // #
      menuTitle: null,     // ##
      description: [],     // Linhas dentro do ```md
      rawDescription: []   // Linhas soltas antes das perguntas
    };
    this.questions = [];
  }

  parse() {
    const lines = this.rawContent.replace(/\r\n/g, "\n").split("\n");
    let currentQuestion = null;
    let inMdBlock = false;
    let isHeaderSection = true;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // 1. Bloco de Descrição (Prioridade Máxima)
      if (line.startsWith("```")) {
        inMdBlock = !inMdBlock;
        if (inMdBlock) {
           // Início do bloco
           this.header.description.push("```md");
        } else {
           // Fim do bloco
           this.header.description.push("```");
        }
        continue;
      }
      if (inMdBlock) {
        this.header.description.push(lines[i]); // Mantém indentação original
        continue;
      }

      // Ignora linhas vazias, exceto se servirem para fechar uma pergunta anterior
      if (line === "") continue;

      // 2. Títulos Principais (# e ##)
      if (line.startsWith("# ") && !this.header.internalTitle) {
        this.header.internalTitle = line.replace("# ", "").trim();
        continue;
      }
      if (line.startsWith("## ") && !this.header.menuTitle) {
        this.header.menuTitle = line.replace("## ", "").trim();
        continue;
      }

      // 3. Categorias (<!-- -->)
      if (PATTERNS.CATEGORY.test(line)) {
        // Se já estávamos lendo uma pergunta, salva ela antes de mudar de categoria
        if (currentQuestion) {
          this.questions.push(currentQuestion);
          currentQuestion = null;
        }
        // Inicia "contexto" de nova pergunta já com a categoria definida
        currentQuestion = this.createEmptyQuestion();
        currentQuestion.category = line; // Guarda a linha inteira <!-- ... -->
        isHeaderSection = false;
        continue;
      }

      // 4. Detecção de Componentes da Pergunta
      
      // A) É um ID?
      if (line.toLowerCase().startsWith("id:")) {
        const match = line.match(PATTERNS.ID_VALID);
        // Se não temos uma pergunta ativa, cria uma
        if (!currentQuestion) {
            currentQuestion = this.createEmptyQuestion();
            isHeaderSection = false;
        }
        // Se já temos uma pergunta COM enunciado, esse ID é o início da PRÓXIMA
        else if (currentQuestion.enunciation) {
             this.questions.push(currentQuestion);
             currentQuestion = this.createEmptyQuestion();
        }
        
        if (match) currentQuestion.id = match[1];
        continue;
      }

      // B) É uma Alternativa? [ ]
      const matchOpt = line.match(PATTERNS.OPTION);
      if (matchOpt) {
        if (!currentQuestion) currentQuestion = this.createEmptyQuestion();
        isHeaderSection = false;
        
        currentQuestion.options.push({
          correct: matchOpt[1].toLowerCase() === "x",
          text: matchOpt[2].trim(),
          explanation: null
        });
        continue;
      }

      // C) É uma Explicação? -!
      const matchExpl = line.match(PATTERNS.EXPLANATION);
      if (matchExpl) {
        if (currentQuestion && currentQuestion.options.length > 0) {
          // Anexa à última opção
          const lastOpt = currentQuestion.options[currentQuestion.options.length - 1];
          lastOpt.explanation = matchExpl[1].trim();
        }
        continue;
      }

      // D) É uma Dica? -#
      // AQUI ESTÁ A CORREÇÃO DA ANOMALIA:
      // O script verifica explicitamente se é uma dica, mesmo que comece com ### errado
      const matchTip = line.match(PATTERNS.TIP);
      // Verifica também o caso anômalo "### Dica:" ou "-! # Dica"
      const isAnomalyTip = /^(?:###|-!)\s*(?:dica|#\s*dica)/i.test(line);

      if (matchTip || isAnomalyTip) {
        let tipText = "";
        if (matchTip) tipText = matchTip[1];
        else tipText = line.replace(/^(?:###|-!)\s*(?:dica:?|#\s*dica:?)\s*/i, "");

        if (currentQuestion) {
          currentQuestion.tip = tipText.trim();
        }
        continue;
      }

      // E) Se não é nada acima, assume-se que é o ENUNCIADO ou TÍTULO
      // Limpa marcadores antigos (###, 1., etc)
      let cleanText = line.replace(/^#+\s*/, "").replace(/^\d+[\.)]\s*/, "").trim();
      
      // ANOMALIA: Se o texto for "Dica: ...", trata como dica da pergunta anterior
      if (cleanText.toLowerCase().startsWith("dica:")) {
          if (currentQuestion) currentQuestion.tip = cleanText.replace(/^dica:\s*/i, "").trim();
          continue;
      }

      // Se ainda estamos na seção de cabeçalho e não parece pergunta, é descrição extra
      if (isHeaderSection && !PATTERNS.OPTION.test(lines[i+1] || "")) {
          // É apenas texto solto no começo do arquivo
          this.header.rawDescription.push(line);
      } else {
          // É o Enunciado da Pergunta
          if (currentQuestion && currentQuestion.enunciation) {
              // Se já tinha enunciado, assume que é uma NOVA pergunta (ou quebra de linha do enunciado)
              // Aqui simplificamos: assume nova pergunta se a anterior já tiver opções
              if (currentQuestion.options.length > 0) {
                  this.questions.push(currentQuestion);
                  currentQuestion = this.createEmptyQuestion();
              } else {
                  // Concatena texto ao enunciado existente
                  currentQuestion.enunciation += " " + cleanText; 
                  continue;
              }
          }
          
          if (!currentQuestion) currentQuestion = this.createEmptyQuestion();
          currentQuestion.enunciation = cleanText;
          isHeaderSection = false;
      }
    }

    // Push na última
    if (currentQuestion) this.questions.push(currentQuestion);
  }

  createEmptyQuestion() {
    return {
      id: null,
      category: null,
      enunciation: null,
      options: [],
      tip: null
    };
  }

  reconstruct() {
    let output = [];
    let stats = { ids: 0, fixed: 0 };

    // 1. Cabeçalho
    if (this.header.internalTitle) output.push(`# ${this.header.internalTitle}`);
    else output.push(`# ${this.fileName.replace(".md", "")}`);

    if (this.header.menuTitle) output.push(`## ${this.header.menuTitle}`);
    else if (this.header.internalTitle) output.push(`## ${this.header.internalTitle}`);
    
    output.push("");

    // 2. Descrição (Prioriza bloco MD)
    if (this.header.description.length > 0) {
        output.push(...this.header.description);
        output.push("");
    } else if (this.header.rawDescription.length > 0) {
        // Converte descrição solta para bloco MD
        output.push("```md");
        output.push(...this.header.rawDescription);
        output.push("```");
        output.push("");
    }

    // 3. Perguntas
    this.questions.forEach(q => {
      // Filtra perguntas lixo (sem enunciado ou sem opções)
      if (!q.enunciation || q.options.length === 0) return;

      if (q.category) output.push(q.category);
      
      // Garante ID
      if (!q.id) {
          q.id = crypto.randomBytes(5).toString("hex");
          stats.ids++;
      }
      output.push(`id: ${q.id}`);

      output.push(`### ${q.enunciation}`);

      q.options.forEach(opt => {
        output.push(`${opt.correct ? "[x]" : "[ ]"} ${opt.text}`);
        if (opt.explanation) {
          output.push(`-! ${opt.explanation}`);
        }
      });

      if (q.tip) {
        output.push(`-# Dica: ${q.tip.replace(/^Dica:\s*/i, "")}`);
      }

      output.push(""); // Linha em branco obrigatória
    });

    return { content: output.join("\n"), stats };
  }
}

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

function main() {
  if (!fs.existsSync(CONFIG.QUIZ_DIR)) {
    console.error(`❌ Pasta não encontrada: ${CONFIG.QUIZ_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONFIG.QUIZ_DIR).filter(n => n.endsWith(".md"));
  const indexList = [];

  console.log(`🚀 Iniciando Lint Semântico em ${files.length} arquivos...\n`);

  files.forEach(file => {
    const filePath = path.join(CONFIG.QUIZ_DIR, file);
    
    // 1. Parseia
    const parser = new QuizParser(filePath);
    parser.parse();
    
    // 2. Reconstrói Limpo
    const { content, stats } = parser.reconstruct();
    
    // 3. Salva
    fs.writeFileSync(filePath, content, "utf-8");
    
    // 4. Prepara Index
    indexList.push({
      arquivo: file.replace(".md", ""),
      titulo: parser.header.menuTitle || parser.header.internalTitle || file.replace(".md", "")
    });

    console.log(`✅ ${file}: ${parser.questions.length} perguntas válidas (IDs novos: ${stats.ids})`);
  });

  // Salva Index
  indexList.sort((a, b) => a.titulo.localeCompare(b.titulo));
  fs.writeFileSync(path.join(CONFIG.QUIZ_DIR, CONFIG.INDEX_FILE), JSON.stringify(indexList, null, 2));

  console.log(`\n🏁 Index.json atualizado com ${indexList.length} itens.`);
}

main();

