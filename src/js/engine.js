// =========================================
//  ENGINE - Parsers e Utilitários (Vite Version)
// =========================================

export function embaralhar(array) {
  const novoArray = [...array]; 
  for (let i = novoArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [novoArray[i], novoArray[j]] = [novoArray[j], novoArray[i]];
  }
  return novoArray;
}

export function converterMarkdownSimples(texto) {
  if (!texto) return '';
  return texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Helper interno (não precisa de export)
function validarAdicionarPergunta(p, lista) {
  // Adiciona se tiver pelo menos uma opção correta
  const corretas = p.opcoes.filter(opt => opt.correta).length;
  if (corretas >= 1) lista.push(p);
}

/**
 * Lê o Markdown e retorna um objeto de dados (SEM manipular o DOM)
 */
export function parseMarkdownQuiz(md) {
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

  linhas.forEach((linha) => {
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
  });

  // Salvar a última do loop
  if (perguntaAtual) validarAdicionarPergunta(perguntaAtual, resultado.perguntas);
  
  resultado.descricao = converterMarkdownSimples(descricaoBuffer);
  return resultado;
}

/**
 * Parser para extração em massa (usado no Treino)
 */
export function extrairPerguntasMass(md, filePrefix) {
  const result = parseMarkdownQuiz(md);
  // Adiciona prefixo aos IDs para evitar colisão entre arquivos diferentes
  return result.perguntas.map(p => ({
    ...p,
    id: `${filePrefix.replace('.md','')}-${p.id}`
  }));
}

