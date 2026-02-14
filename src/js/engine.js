// =========================================
//  ENGINE - Parsers e Utilitários (Vite Version)
// =========================================

export function embaralhar(array) {
  try {
    if (!Array.isArray(array)) throw new Error("O parâmetro fornecido não é um array.");
    
    const novoArray = [...array]; 
    for (let i = novoArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [novoArray[i], novoArray[j]] = [novoArray[j], novoArray[i]];
    }
    return novoArray;
  } catch (error) {
    console.error("Erro ao embaralhar array:", error);
    return array; // Retorna o original em caso de erro
  }
}

export function converterMarkdownSimples(texto) {
  try {
    if (!texto) return '';
    return texto
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  } catch (error) {
    console.error("Erro ao converter Markdown Simples:", error);
    return texto || '';
  }
}

// Helper interno (não precisa de export)
function validarAdicionarPergunta(p, lista) {
  try {
    // Adiciona se tiver pelo menos uma opção correta
    const corretas = p.opcoes.filter(opt => opt.correta).length;
    if (corretas >= 1) {
      lista.push(p);
    } else {
      console.warn(`Pergunta ID: ${p.id} descartada: Nenhuma opção correta definida.`);
    }
  } catch (error) {
    console.error("Erro na validação da pergunta:", error, p);
  }
}

/**
 * Lê o Markdown e retorna um objeto de dados (SEM manipular o DOM)
 */
export function parseMarkdownQuiz(md) {
  try {
    if (typeof md !== 'string') throw new Error("A entrada do quiz deve ser uma string Markdown.");

    const linhas = md.replace(/\r\n/g, '\n').split('\n');
    
    let resultado = {
      titulo: '',
      descricao: '',
      perguntas: []
    };

    let descricaoBuffer = '';
    let dentroBlocoDescricao = false;
    let categoriaAtual = 'Geral';
    let perguntaAtual = null; 
    let ultimaOpcao = null;

    linhas.forEach((linha, index) => {
      try {
        const l = linha.trim();

        // Bloco de Descrição
        if (l.startsWith('```md')) { dentroBlocoDescricao = true; return; }
        if (l.startsWith('```') && dentroBlocoDescricao) { dentroBlocoDescricao = false; return; }
        if (dentroBlocoDescricao) { descricaoBuffer += linha + '\n'; return; }

        if (!l) return;

        // Título H1
        if (l.startsWith('# ')) {
          resultado.titulo = l.replace('# ', '').trim();
          return;
        }
        
        // Ignorar H2
        if (l.startsWith('## ')) return;

        // Categorias (__CAT__)
        const matchCat = l.match(/^__(.*?)__$/);
        if (matchCat && matchCat[1] !== undefined) { 
          categoriaAtual = matchCat[1].trim(); 
          return; 
        }

        // ID da Pergunta (Início de nova questão)
        if (l.startsWith('id:')) {
          if (perguntaAtual) validarAdicionarPergunta(perguntaAtual, resultado.perguntas);
          perguntaAtual = {
            id: l.replace('id:', '').trim(),
            categoria: categoriaAtual,
            enunciado: '',
            opcoes: [],
            dica: null
          };
          return;
        }

        // Enunciado
        if (l.startsWith('### ')) {
          if (perguntaAtual) perguntaAtual.enunciado = l.replace('### ', '').trim();
          return;
        }

        // Opções [ ] ou [x]
        if (l.startsWith('[ ]') || l.startsWith('[x]')) {
          if (perguntaAtual) {
            const isCorrect = l.startsWith('[x]');
            const text = l.replace(/\[(x| )\]/, '').trim();
            ultimaOpcao = { texto: text, correta: isCorrect, explicacao: null };
            perguntaAtual.opcoes.push(ultimaOpcao);
          }
          return;
        }

        // Explicação (-! ou -[])
        if ((l.startsWith('-!') || l.startsWith('-[')) && ultimaOpcao) {
          ultimaOpcao.explicacao = l.replace(/^(-!|-\[|\])/g, '').trim();
          return;
        }

        // Dica (-#)
        if (l.startsWith('-#') && perguntaAtual) {
          perguntaAtual.dica = l.replace('-#', '').trim();
          return;
        }
      } catch (lineError) {
        console.error(`Erro ao processar a linha ${index + 1}: "${linha}"`, lineError);
      }
    });

    // Salvar a última do loop
    if (perguntaAtual) validarAdicionarPergunta(perguntaAtual, resultado.perguntas);
    
    resultado.descricao = converterMarkdownSimples(descricaoBuffer);
    return resultado;

  } catch (error) {
    console.error("Falha crítica no parseMarkdownQuiz:", error);
    return { titulo: 'Erro no carregamento', descricao: '', perguntas: [] };
  }
}

/**
 * Parser para extração em massa (usado no Treino)
 */
export function extrairPerguntasMass(md, filePrefix) {
  try {
    const result = parseMarkdownQuiz(md);
    if (!result || !result.perguntas) return [];

    // Adiciona prefixo aos IDs para evitar colisão entre arquivos diferentes
    return result.perguntas.map(p => ({
      ...p,
      id: `${filePrefix.replace('.md','')}-${p.id}`
    }));
  } catch (error) {
    console.error(`Erro em extrairPerguntasMass (Arquivo: ${filePrefix}):`, error);
    return [];
  }
}
