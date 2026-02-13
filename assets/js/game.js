// =========================================
//  GAME.JS - Motor de Jogo (Versão 3.0 - SRS)
// =========================================

// Elementos do DOM
const listaEl = document.getElementById('lista-quizes');
const quizStage = document.getElementById('quiz-stage');
const barraProgressoEl = document.getElementById('barra-progresso-container');
const tituloEl = document.getElementById('titulo-quiz');
const descricaoEl = document.getElementById('descricao-quiz');
const displayTempoEl = document.getElementById('display-tempo');
const contadorPerguntasEl = document.getElementById('contador-perguntas');
const telaSelecaoEl = document.getElementById('tela-selecao');

// Estado Global do Jogo
window.perguntas = [];
window.indiceAtual = 0;
window.acertos = 0;
window.pontuacaoTotal = 0;
window.modoJogo = null;

let respondido = false;
let dicasRestantes = 2;
let tempoTotal = 30;
let tempoRestante = 30;
let timerInterval;

// Variáveis Modo Treino (SRS)
let srsStartTime = 0;

// =======================
// UTILITÁRIOS
// =======================

function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function converterMarkdownSimples(texto) {
  if (!texto) return '';
  return texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// =======================
// STORAGE & SRS LOGIC (Novas Funções)
// =======================

function getSRSData() {
  const data = localStorage.getItem('quizSRSData');
  return data ? JSON.parse(data) : {};
}

function saveSRSData(data) {
  localStorage.setItem('quizSRSData', JSON.stringify(data));
}

window.resetarMemoriaSRS = function() {
  if(confirm("Tem certeza? Isso apagará todo o histórico de aprendizado do Modo Treino.")) {
    localStorage.removeItem('quizSRSData');
    alert("Memória limpa! O algoritmo recomeçará do zero.");
    location.reload();
  }
};

/**
 * Algoritmo SM-2 (Spaced Repetition)
 * @param {string} id - ID único da questão
 * @param {boolean} isCorrect - Se acertou
 * @param {number} timeTakenSec - Tempo levado em segundos
 */
function processarSRS(id, isCorrect, timeTakenSec) {
  const db = getSRSData();
  
  // Default: Primeira vez vendo a carta
  let entry = db[id] || { 
    lastReviewed: 0, 
    interval: 0, 
    ef: 2.5, 
    reps: 0 
  };

  // 1. Calcular Qualidade (0-5)
  // 5: Perfeito (<10s), 4: Bom (<20s), 3: Passou (<30s), 2: Difícil (>30s), 0: Errou
  let quality = 0;
  if (isCorrect) {
    if (timeTakenSec < 10) quality = 5;
    else if (timeTakenSec < 20) quality = 4;
    else if (timeTakenSec < 30) quality = 3;
    else quality = 2; 
  } else {
    quality = 0;
  }

  // 2. Atualizar Fator de Facilidade (EF)
  let newEF = entry.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  // 3. Atualizar Intervalo e Repetições
  let newInterval = 1;
  let newReps = entry.reps;

  if (quality < 3) {
    // Falhou ou achou muito difícil: Reseta
    newReps = 0;
    newInterval = 1;
  } else {
    newReps++;
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 6;
    else newInterval = Math.round(entry.interval * newEF);
  }

  // Salvar
  db[id] = {
    lastReviewed: Date.now(),
    interval: newInterval,
    ef: parseFloat(newEF.toFixed(2)),
    reps: newReps
  };

  saveSRSData(db);
}

// =======================
// INICIALIZAÇÃO E CARREGAMENTO
// =======================

if (listaEl) {
  fetch('data/quizes/index.json')
    .then(res => res.json())
    .then(dados => {
      listaEl.innerHTML = dados
        .map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
        .join('');
    })
    .catch(() => {
      listaEl.innerHTML = '<p style="text-align:center;">Erro ao carregar lista de quizes.</p>';
    });
}

if (quizStage) {
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get('id');

  if (idQuiz) {
    fetch(`data/quizes/${idQuiz}.md`)
      .then(res => {
        if (!res.ok) throw new Error("Arquivo não encontrado");
        return res.text();
      })
      .then(text => {
        processarMarkdown(text);
        telaSelecaoEl.style.display = 'flex';
        quizStage.style.display = 'none';
      })
      .catch(err => {
        console.error(err);
        if (tituloEl) tituloEl.innerText = "Erro ao carregar";
        quizStage.innerHTML = '<p style="text-align:center">Não foi possível carregar os dados.</p>';
        quizStage.style.display = 'block';
      });
  }
}


function processarMarkdown(md) {
  const linhas = md.replace(/\r\n/g, '\n').split('\n');
  let descricaoBuffer = '';
  let dentroBlocoDescricao = false;
  let todasPerguntas = [];
  let categoriaAtual = 'Geral';
  let perguntaAtual = null; 
  let ultimaOpcao = null;

  linhas.forEach((linha) => {
    const l = linha.trim();

    if (l.startsWith('```md')) { dentroBlocoDescricao = true; return; }
    if (l.startsWith('```') && dentroBlocoDescricao) { dentroBlocoDescricao = false; return; }
    if (dentroBlocoDescricao) { descricaoBuffer += linha + '\n'; return; }

    if (!l) return;

    if (l.startsWith('# ')) {
      if (tituloEl) tituloEl.innerText = l.replace('# ', '').trim();
      return;
    }

    if (l.startsWith('## ')) return;

    // SAFETY CHECK APPLIED HERE
    const matchCat = l.match(/^/);
    if (matchCat && matchCat[1] !== undefined) { 
      categoriaAtual = matchCat[1].trim(); 
      return; 
    }

    if (l.startsWith('id:')) {
      if (perguntaAtual) salvarPergunta(perguntaAtual, todasPerguntas);
      perguntaAtual = {
        id: l.replace('id:', '').trim(),
        categoria: categoriaAtual,
        enunciado: '',
        opcoes: [],
        dica: null
      };
      return;
    }

    if (l.startsWith('### ')) {
      if (perguntaAtual) perguntaAtual.enunciado = l.replace('### ', '').trim();
      return;
    }

    if (l.startsWith('[ ]') || l.startsWith('[x]')) {
      if (perguntaAtual) {
        const isCorrect = l.startsWith('[x]');
        const text = l.replace(/\[(x| )\]/, '').trim();
        ultimaOpcao = { texto: text, correta: isCorrect, explicacao: null };
        perguntaAtual.opcoes.push(ultimaOpcao);
      }
      return;
    }

    if (l.startsWith('-!') && ultimaOpcao) {
      ultimaOpcao.explicacao = l.replace('-!', '').trim();
      return;
    }

    if (l.startsWith('-#') && perguntaAtual) {
      perguntaAtual.dica = l.replace('-#', '').trim();
      return;
    }
  });

  if (perguntaAtual) salvarPergunta(perguntaAtual, todasPerguntas);
  window.perguntas = todasPerguntas;
  
  if (descricaoEl && descricaoBuffer) {
    descricaoEl.innerHTML = converterMarkdownSimples(descricaoBuffer);
    descricaoEl.style.display = 'block';
  }
}

// Parser Puro (Sem DOM) para carregar múltiplas listas no Modo Treino
function extrairPerguntasDoTexto(md, filePrefix) {
  const linhas = md.replace(/\r\n/g, '\n').split('\n');
  let extracted = [];
  let pAtual = null;
  let catAtual = 'Geral';
  let ultOpcao = null;

  linhas.forEach((linha) => {
    const l = linha.trim();
    if (!l) return;
    
    // SAFETY CHECK APPLIED HERE
    const matchCat = l.match(/^/);
    if (matchCat && matchCat[1] !== undefined) { 
      catAtual = matchCat[1].trim(); 
      return; 
    }

    if (l.startsWith('id:')) {
      if (pAtual) salvarPergunta(pAtual, extracted);
      // Cria ID único prefixando com nome do arquivo
      const rawId = l.replace('id:', '').trim();
      const uniqueId = `${filePrefix.replace('.md','')}-${rawId}`;
      
      pAtual = {
        id: uniqueId, 
        categoria: catAtual,
        enunciado: '',
        opcoes: [],
        dica: null
      };
      return;
    }

    if (l.startsWith('### ') && pAtual) {
      pAtual.enunciado = l.replace('### ', '').trim();
      return;
    }

    if ((l.startsWith('[ ]') || l.startsWith('[x]')) && pAtual) {
      const isCorrect = l.startsWith('[x]');
      const text = l.replace(/\[(x| )\]/, '').trim();
      ultOpcao = { texto: text, correta: isCorrect, explicacao: null };
      pAtual.opcoes.push(ultOpcao);
      return;
    }

    if (l.startsWith('-!') && ultOpcao) {
      ultOpcao.explicacao = l.replace('-!', '').trim();
      return;
    }
    
    if (l.startsWith('-#') && pAtual) {
      pAtual.dica = l.replace('-#', '').trim();
    }
  });

  if (pAtual) salvarPergunta(pAtual, extracted);
  return extracted;
}









// Parser Puro (Sem DOM) para carregar múltiplas listas no Modo Treino
function extrairPerguntasDoTexto(md, filePrefix) {
  const linhas = md.replace(/\r\n/g, '\n').split('\n');
  let extracted = [];
  let pAtual = null;
  let catAtual = 'Geral';
  let ultOpcao = null;

  linhas.forEach((linha) => {
    const l = linha.trim();
    if (!l) return;
    
    const matchCat = l.match(/^/);
    if (matchCat) { catAtual = matchCat[1].trim(); return; }

    if (l.startsWith('id:')) {
      if (pAtual) salvarPergunta(pAtual, extracted);
      // Cria ID único prefixando com nome do arquivo
      const rawId = l.replace('id:', '').trim();
      const uniqueId = `${filePrefix.replace('.md','')}-${rawId}`;
      
      pAtual = {
        id: uniqueId, 
        categoria: catAtual,
        enunciado: '',
        opcoes: [],
        dica: null
      };
      return;
    }

    if (l.startsWith('### ') && pAtual) {
      pAtual.enunciado = l.replace('### ', '').trim();
      return;
    }

    if ((l.startsWith('[ ]') || l.startsWith('[x]')) && pAtual) {
      const isCorrect = l.startsWith('[x]');
      const text = l.replace(/\[(x| )\]/, '').trim();
      ultOpcao = { texto: text, correta: isCorrect, explicacao: null };
      pAtual.opcoes.push(ultOpcao);
      return;
    }

    if (l.startsWith('-!') && ultOpcao) {
      ultOpcao.explicacao = l.replace('-!', '').trim();
      return;
    }
    
    if (l.startsWith('-#') && pAtual) {
      pAtual.dica = l.replace('-#', '').trim();
    }
  });

  if (pAtual) salvarPergunta(pAtual, extracted);
  return extracted;
}

function salvarPergunta(p, lista) {
  const corretas = p.opcoes.filter(opt => opt.correta).length;
  if (corretas === 1) lista.push(p);
}

// =======================
// CARREGAMENTO MODO TREINO
// =======================

window.iniciarModoTreino = async function() {
  if(tituloEl) tituloEl.innerText = "Carregando Memória...";
  if(listaEl) listaEl.style.display = 'none';
  if(telaSelecaoEl) telaSelecaoEl.style.display = 'none';

  try {
    const resIndex = await fetch('data/quizes/index.json');
    const quizList = await resIndex.json();
    
    let todasAsQuestoes = [];
    const promises = quizList.map(async (q) => {
      const res = await fetch(`data/quizes/${q.arquivo}?t=${Date.now()}`); 
      const text = await res.text();
      const questoesDoArquivo = extrairPerguntasDoTexto(text, q.arquivo); 
      todasAsQuestoes = todasAsQuestoes.concat(questoesDoArquivo);
    });

    await Promise.all(promises);

    // Filtrar apenas o que está "vencido" (Due)
    const srsDb = getSRSData();
    const now = Date.now();
    const DAY_MS = 86400000;

    const questoesDue = todasAsQuestoes.filter(p => {
      const entry = srsDb[p.id];
      if (!entry) return true; // Nova pergunta, sempre due
      const dueDate = entry.lastReviewed + (entry.interval * DAY_MS);
      return now >= dueDate;
    });

    if (questoesDue.length === 0) {
      alert("🎉 Tudo em dia! Você revisou todo o conteúdo pendente. Volte amanhã.");
      location.reload();
      return;
    }

    // Limitar sessão a 50 cartas para evitar fadiga
    window.perguntas = embaralhar(questoesDue).slice(0, 50);
    
    if(tituloEl) tituloEl.innerText = `🧠 Treino do Dia (${window.perguntas.length})`;
    
    iniciarJogo('treino');

 } catch (err) {
    console.error("ERRO COMPLETO:", err);
    alert("Erro Técnico: " + err.message); // This will tell us the real problem
    // location.reload(); // Commented out so you can see the console
  }
  
};

// =======================
// CONTROLE DE FLUXO
// =======================

window.iniciarJogo = function (modo) {
  if (window.perguntas.length === 0) return;

  window.modoJogo = modo;
  window.indiceAtual = 0;
  window.acertos = 0;
  window.pontuacaoTotal = 0;
  dicasRestantes = 2;
  tempoTotal = modo === 'desafio' ? 15 : 30;

  // Classes de corpo para CSS específico
  document.body.classList.remove('modo-desafio', 'modo-treino');
  if (modo === 'desafio') document.body.classList.add('modo-desafio');
  if (modo === 'treino') document.body.classList.add('modo-treino');

  // Ajustes de UI
  telaSelecaoEl.style.display = 'none';
  if (descricaoEl) descricaoEl.style.display = 'none';
  if (tituloEl) {
    tituloEl.style.display = 'block';
    tituloEl.style.fontSize = '1.1rem';
    tituloEl.style.opacity = '0.9';
  }
  
  quizStage.style.display = 'grid';
  
  // Exibir timers apenas se NÃO for treino
  if (modo !== 'treino') {
    barraProgressoEl.style.display = 'flex';
    displayTempoEl.style.display = 'block';
    contadorPerguntasEl.style.display = 'block';
    renderizarBarraProgresso();
  } else {
    barraProgressoEl.style.display = 'none';
    displayTempoEl.style.display = 'none';
    contadorPerguntasEl.style.display = 'none';
  }

  // Se não for treino, embaralha de novo (treino já vem embaralhado e filtrado)
  if (modo !== 'treino') {
    window.perguntas = embaralhar([...window.perguntas]);
  }

  adicionarNovaPergunta(window.perguntas[0], false);
};

function renderizarBarraProgresso() {
  barraProgressoEl.innerHTML = '';
  if (window.modoJogo === 'desafio') {
    barraProgressoEl.innerHTML = `<div class="segmento-barra" id="seg-unico" style="flex: 1;"><div class="fill-tempo"></div></div>`;
  } else {
    barraProgressoEl.innerHTML = window.perguntas
      .map((_, i) => `<div class="segmento-barra" id="seg-${i}"><div class="fill-tempo"></div></div>`)
      .join('');
  }
}

function adicionarNovaPergunta(p, comAnimacao = true) {
  respondido = false;
  
  // Timer SRS Start
  srsStartTime = Date.now();

  if(contadorPerguntasEl) {
    contadorPerguntasEl.innerText = `${window.indiceAtual + 1} / ${window.perguntas.length}`;
  }

  const opcoesEmb = embaralhar([...p.opcoes]);
  const novoCard = document.createElement('div');
  novoCard.className = 'card-quiz';

  novoCard.innerHTML = `
        <div style="font-size:0.65rem; text-transform:uppercase; opacity:0.5; margin-bottom:4px; font-weight:800; letter-spacing:1px; text-align:center;">
            ${p.categoria}
        </div>
        <div class="pergunta">${p.enunciado}</div>
        <div class="lista-opcoes">
            ${opcoesEmb.map((op, i) => `
                <div class="opcao-wrapper">
                    <div class="opcao" data-is-correct="${op.correta}" onclick="verificarResposta(${i}, this)">
                        ${op.texto}
                    </div>
                    ${op.explicacao ? `
                        <div class="container-explicacao" style="display:none;">
                            <button class="btn-explicacao" onclick="this.nextElementSibling.style.display='block'; this.style.display='none'">
                                🎓 Por que?
                            </button>
                            <div class="box-explicacao" style="display:none;">
                                ${converterMarkdownSimples(op.explicacao)}
                            </div>
                        </div>
                    ` : ''}
                </div>`).join('')}
        </div>
        <div class="area-dica-container">
            ${p.dica ? `<button class="btn-dica-minimal" ${dicasRestantes <= 0 ? 'disabled' : ''} onclick="mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">💡 Dica <span class="contador-dica">${dicasRestantes}</span></button>` : ''}
            <div class="texto-dica-placeholder"></div>
        </div>
        <button id="btn-prox" onclick="transicaoProximaPergunta()">Próxima Questão ➜</button>
    `;

  if (comAnimacao) {
    novoCard.classList.add('pre-render-direita');
    const cardAntigo = quizStage.querySelector('.card-quiz.ativo');
    quizStage.appendChild(novoCard);
    void novoCard.offsetWidth;
    if (cardAntigo) {
      cardAntigo.classList.replace('ativo', 'saindo-esquerda');
      setTimeout(() => cardAntigo.remove(), 500);
    }
    novoCard.classList.replace('pre-render-direita', 'ativo');
  } else {
    novoCard.classList.add('ativo');
    quizStage.appendChild(novoCard);
  }

  // Timer visual apenas para modos normais
  if(window.modoJogo !== 'treino') {
    iniciarTimer();
    animarBarraAtual();
  }
}

function animarBarraAtual() {
  const idAlvo = window.modoJogo === 'desafio' ? 'seg-unico' : `seg-${window.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (!seg) return;
  seg.classList.remove('correto', 'errado');
  const fill = seg.querySelector('.fill-tempo');
  fill.style.transition = 'none';
  fill.style.width = '0%';
  void fill.offsetWidth;
  fill.style.transition = `width ${tempoTotal}s linear`;
  fill.style.width = '100%';
}

function iniciarTimer() {
  tempoRestante = tempoTotal;
  clearInterval(timerInterval);
  displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
  timerInterval = setInterval(() => {
    tempoRestante--;
    displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
    if (tempoRestante <= 0) {
      clearInterval(timerInterval);
      if (window.modoJogo === 'desafio') gameOverDesafio('Tempo esgotado!');
      else verificarResposta(-1, null);
    }
  }, 1000);
}

window.verificarResposta = function (index, el) {
  if (respondido) return;
  
  // Cálculo SRS
  const durationSec = (Date.now() - srsStartTime) / 1000;
  
  respondido = true;
  clearInterval(timerInterval);

  // Parar animação da barra (Modos normais)
  if (window.modoJogo !== 'treino') {
    const idAlvo = window.modoJogo === 'desafio' ? 'seg-unico' : `seg-${window.indiceAtual}`;
    const seg = document.getElementById(idAlvo);
    if (seg) {
        const fill = seg.querySelector('.fill-tempo');
        fill.style.width = window.getComputedStyle(fill).width;
        fill.style.transition = 'none';
    }
  }

  const card = document.querySelector('.card-quiz.ativo');
  const opcoes = card.querySelectorAll('.opcao');
  const explicacoes = card.querySelectorAll('.container-explicacao');
  let acertou = false;

  opcoes.forEach((opt, i) => {
    opt.classList.add('bloqueado');
    const isCorrect = opt.getAttribute('data-is-correct') === 'true';
    if (isCorrect) {
      opt.classList.add('correta');
      if (opt === el) acertou = true;
    } else if (opt === el) {
      opt.classList.add('errada');
    }
  });

  explicacoes.forEach(exp => {
      exp.style.display = 'block';
      exp.style.animation = 'fadeIn 0.5s ease';
  });

  // == LÓGICA MODO TREINO ==
  if (window.modoJogo === 'treino') {
    const pAtual = window.perguntas[window.indiceAtual];
    processarSRS(pAtual.id, acertou, durationSec);
    card.querySelector('#btn-prox').style.display = 'block';
    // No modo treino, não computamos pontos nem Game Over
    return;
  }

  // == LÓGICA MODOS NORMAL/DESAFIO ==
  if (acertou) {
    window.acertos++;
    let base = window.modoJogo === 'desafio' ? 15 : 10;
    window.pontuacaoTotal += (base + Math.round(base * (tempoRestante / tempoTotal)));
  }

  if (window.modoJogo === 'desafio' && !acertou) {
    setTimeout(() => gameOverDesafio(index === -1 ? 'Tempo Esgotado!' : 'Você Errou!'), 1200);
    return;
  }

  if (window.modoJogo === 'normal') {
    const seg = document.getElementById(`seg-${window.indiceAtual}`);
    if (seg) seg.classList.add(acertou ? 'correto' : 'errado');
  }
  
  card.querySelector('#btn-prox').style.display = 'block';
};

window.mostrarDica = function (btn, texto) {
  if (dicasRestantes <= 0) return;
  dicasRestantes--;
  btn.disabled = true;
  btn.innerHTML = `💡 Dica <span class="contador-dica">${dicasRestantes}</span>`;
  const area = document.querySelector('.card-quiz.ativo .texto-dica-placeholder');
  area.innerHTML = `<div class="box-dica-texto">${texto}</div>`;
};

window.transicaoProximaPergunta = function () {
  window.indiceAtual++;
  if (window.indiceAtual >= window.perguntas.length) {
    // Fim do Jogo
    if (window.modoJogo === 'treino') {
      mostrarFimTreino();
    } else {
      mostrarResultadoFinal();
    }
  } else {
    adicionarNovaPergunta(window.perguntas[window.indiceAtual], true);
  }
};

function gameOverDesafio(motivo) {
  if (tituloEl) tituloEl.style.fontSize = '1.3rem';
  quizStage.innerHTML = `<div class="card-quiz ativo" style="text-align:center; border: 2px solid var(--error);"><h2 style="font-size:3rem;">☠️</h2><h3 style="color:var(--error);">${motivo}</h3><p>Fim de jogo no desafio.</p><button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer; margin-top:20px;">Tentar Novamente</button></div>`;
  displayTempoEl.style.display = 'none';
  contadorPerguntasEl.style.display = 'none';
  barraProgressoEl.style.display = 'none';
}

function mostrarFimTreino() {
  if (tituloEl) tituloEl.style.fontSize = '1.3rem';
  quizStage.innerHTML = `
    <div class="card-quiz ativo" style="text-align:center;">
      <h2 style="color:#4f46e5;">✅ Treino Concluído!</h2>
      <p style="margin:20px 0; line-height:1.5;">Você revisou todas as cartas pendentes por agora. O algoritmo de repetição espaçada calculará quando você deve ver estas questões novamente.</p>
      <button onclick="location.reload()" style="background:#4f46e5; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; margin-top:10px;">Voltar ao Menu</button>
    </div>`;
  document.body.classList.remove('modo-treino');
}

function mostrarResultadoFinal() {
  if (tituloEl) tituloEl.style.fontSize = '1.3rem';
  const porcentagem = (window.acertos / window.perguntas.length);
  const win = porcentagem >= 0.6;
  displayTempoEl.style.display = 'none';
  contadorPerguntasEl.style.display = 'none';
  barraProgressoEl.style.display = 'none';
  
  quizStage.innerHTML = `<div class="card-quiz ativo" style="text-align:center;"><h2>${win ? 'Incrível!' : 'Bom Treino!'}</h2><div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">${window.pontuacaoTotal} <span style="font-size:1.5rem">pts</span></div><p style="font-weight:600;">Você acertou ${window.acertos} de ${window.perguntas.length}</p><hr style="border:0; border-top:1px solid #eee; margin:20px 0;"><h3>Salvar no Ranking</h3><input type="text" id="input-nome-jogador" maxlength="15" placeholder="seu nome" oninput="this.value = this.value.toLowerCase().replace(/[^a-zà-úç ]/g, '')"><button id="btn-salvar-final" onclick="enviarPontuacao()" style="background:#2563eb; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; margin-top:10px;">💾 Salvar Conquista</button><button onclick="location.reload()" style="background:transparent; border:1px solid #ccc; padding:10px; width:100%; margin-top:10px; border-radius:12px; cursor:pointer;">Menu Principal</button></div>`;
  if (win) dispararConfete();
}

function dispararConfete() {
  const canvas = document.getElementById('canvas-confete');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({ length: 120 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height, w: Math.random() * 10 + 5, h: Math.random() * 10 + 5, color: ['#ff0', '#0f0', '#00f', '#f0f', '#0ff', '#fff'][Math.floor(Math.random() * 6)], s: Math.random() * 3 + 2, a: Math.random() * 360, }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.w, p.h); p.y += p.s; p.a += 0.1; if (p.y > canvas.height) p.y = -10; });
    if (canvas.width > 0) requestAnimationFrame(draw);
  }
  draw();
  setTimeout(() => { canvas.width = 0; }, 5000);
}
