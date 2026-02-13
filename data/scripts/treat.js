const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
  QUIZ_DIR: path.join(__dirname, "../quizes"),
  INDEX_FILE: "index.json",
  ID_LENGTH_BYTES: 5
};

// Pre-compiled Regex Patterns for Performance
const PATTERNS = {
  ID_VALID: /^id:\s*([0-9a-fA-F]{10})$/,
  ID_ANY: /^id:\s*(.*)$/i,
  CATEGORY: /^$/,
  OPTION: /^\s*\[([xX ]+)\]/,
  EXPLANATION: /^(\s*-?!?\s*|explicaç[ãa]o\s*:|obs\s*:)\s*/i,
  TIP: /^(\s*-?#?\s*|dica\s*:)\s*/i,
  // Matches "1.", "Nº 1", "Question 1", or just "#"
  HEADING_START: /^\s*(?:N(?:º|o|°)?\.?\s*)?(?:\d{1,4})(?:[.\)\-\ºª]*)\s*/i,
  MD_BLOCK: /^```/,
  HEADING_HASH: /^#+/
};

// Helper: Generate Hex ID
const generateId = () => crypto.randomBytes(CONFIG.ID_LENGTH_BYTES).toString("hex");

/**
 * Processes a single Markdown file: lints content and extracts metadata.
 * @param {string} fileName 
 * @returns {Promise<{ fileName: string, title: string, stats: object } | null>}
 */
async function processFile(fileName) {
  const filePath = path.join(CONFIG.QUIZ_DIR, fileName);

  try {
    const contentHandle = await fs.readFile(filePath, "utf-8");
    
    // Normalize line endings immediately
    const lines = contentHandle.replace(/\r\n/g, "\n").split("\n");
    
    const newContent = [];
    let titleForIndex = "";
    
    // State Machine
    let state = {
      inCodeBlock: false,
      foundH1: false, // Internal #
      foundH2: false, // Page ##
      pendingId: null,
      lastLineWasEmpty: false
    };

    const stats = { idsGenerated: 0, titlesFixed: 0, prefixesFixed: 0 };

    for (let line of lines) {
      const trimmed = line.trim();

      // 1. Code Blocks (Preserve strictly)
      if (PATTERNS.MD_BLOCK.test(line)) {
        state.inCodeBlock = !state.inCodeBlock;
        newContent.push(line);
        state.lastLineWasEmpty = false;
        continue;
      }

      if (state.inCodeBlock) {
        newContent.push(line);
        continue;
      }

      // 2. Empty Lines (Collapse multiple empty lines)
      if (trimmed === "") {
        if (!state.lastLineWasEmpty && newContent.length > 0) {
          newContent.push("");
          state.lastLineWasEmpty = true;
        }
        continue;
      }
      state.lastLineWasEmpty = false;

      // 3. ID Handling (Buffer logic)
      if (trimmed.toLowerCase().startsWith("id:")) {
        const match = trimmed.match(PATTERNS.ID_VALID);
        if (match) {
          state.pendingId = match[1].toLowerCase();
        } else {
          // Invalid ID found, discard it so we generate a fresh one at the next question
          state.pendingId = null; 
        }
        continue; // Don't push yet, wait for the question header
      }

      // 4. Categories (Preserve)
      if (PATTERNS.CATEGORY.test(trimmed)) {
        newContent.push(trimmed);
        continue;
      }

      // 5. Options [ ] / [x]
      if (PATTERNS.OPTION.test(trimmed)) {
        const isCorrect = trimmed.includes("[x]") || trimmed.includes("[X]");
        const text = trimmed.replace(PATTERNS.OPTION, "").trim();
        newContent.push(`${isCorrect ? "[x]" : "[ ]"} ${text}`);
        continue;
      }

      // 6. Explanations (-!)
      if (trimmed.startsWith("-!") || PATTERNS.EXPLANATION.test(trimmed)) {
        if (!trimmed.startsWith("-!")) stats.prefixesFixed++;
        const text = trimmed.replace(PATTERNS.EXPLANATION, "").trim();
        newContent.push(`-! ${text}`);
        continue;
      }

      // 7. Tips (-#)
      if (trimmed.startsWith("-#") || PATTERNS.TIP.test(trimmed)) {
        if (!trimmed.startsWith("-#")) stats.prefixesFixed++;
        const text = trimmed.replace(PATTERNS.TIP, "").trim();
        newContent.push(`-# ${text}`);
        continue;
      }

      // 8. Headings Logic (#, ##, ###)
      const isHeaderStart = trimmed.startsWith("#") || (PATTERNS.HEADING_START.test(trimmed) && !trimmed.startsWith("-"));
      
      if (isHeaderStart) {
        let cleanText = trimmed.replace(PATTERNS.HEADING_HASH, "").trim(); // Remove #
        cleanText = cleanText.replace(PATTERNS.HEADING_START, "").trim(); // Remove "1." or "Nº"

        // Determine Header Level based on file history
        if (!state.foundH1) {
          // Internal Quiz Title
          newContent.push(`# ${cleanText}`);
          state.foundH1 = true;
          // Use this as fallback title if needed
          if (!titleForIndex) titleForIndex = cleanText;
          stats.titlesFixed++;
        } 
        else if (!state.foundH2 && !cleanText.endsWith("?")) {
          // Page Title
          newContent.push(`## ${cleanText}`);
          state.foundH2 = true;
          // This is the preferred title for the index
          titleForIndex = cleanText;
          stats.titlesFixed++;
        } 
        else {
          // Question (###)
          const idToUse = state.pendingId || generateId();
          if (!state.pendingId) stats.idsGenerated++;

          newContent.push(`id: ${idToUse}`);
          newContent.push(`### ${cleanText}`);
          
          state.pendingId = null; // Reset buffer
          stats.titlesFixed++;
        }
        continue;
      }

      // 9. Standard Text
      newContent.push(line);
    }

    // Finalize content
    const finalContent = newContent.join("\n").trim() + "\n";
    
    // Write only if changed (Idempotency)
    if (finalContent !== contentHandle) {
      await fs.writeFile(filePath, finalContent, "utf-8");
      console.log(`✅ Fixed: ${fileName} (IDs: ${stats.idsGenerated}, Titles: ${stats.titlesFixed})`);
    }

    // Return Metadata for Index
    return {
      fileName: fileName,
      // Fallback: if no H1/H2 found, use filename
      title: titleForIndex || fileName.replace(".md", ""),
      stats
    };

  } catch (err) {
    console.error(`❌ Error processing ${fileName}:`, err.message);
    return null;
  }
}

/**
 * Main Orchestrator
 */
async function main() {
  const indexJsonPath = path.join(CONFIG.QUIZ_DIR, CONFIG.INDEX_FILE);

  // 1. Validate Directory
  try {
    await fs.access(CONFIG.QUIZ_DIR);
  } catch {
    console.error(`❌ Directory not found: ${CONFIG.QUIZ_DIR}`);
    process.exit(1);
  }

  // 2. Get Files
  const allFiles = await fs.readdir(CONFIG.QUIZ_DIR);
  const quizFiles = allFiles.filter(n => n.endsWith(".md"));

  if (quizFiles.length === 0) {
    console.log("⚠️ No .md files found.");
    process.exit(0);
  }

  console.log(`\n🚀 Starting optimization on ${quizFiles.length} files...`);

  // 3. Process Files in Parallel
  const results = await Promise.all(quizFiles.map(processFile));
  
  // Filter out nulls (errors)
  const validResults = results.filter(r => r !== null);

  // 4. Generate Index
  console.log(`\n🔄 Generating ${CONFIG.INDEX_FILE}...`);
  
  const indexData = validResults.map(r => ({
    arquivo: r.fileName.replace(".md", ""),
    titulo: r.title
  })).sort((a, b) => a.titulo.localeCompare(b.titulo));

  await fs.writeFile(
    indexJsonPath, 
    JSON.stringify(indexData, null, 2), 
    "utf-8"
  );

  console.log(`✨ Success! Processed ${validResults.length} files.`);
  console.log(`📂 Index saved at: ${indexJsonPath}`);
}

// Execute
main();
