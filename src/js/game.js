// =========================================
//  GAME CONTROLLER (Vite/Module Version)
// =========================================
import { embaralhar, converterMarkdownSimples, parseMarkdownQuiz, extrairPerguntasMass } from './engine.js';
import { getSRSData, processarSRS, resetarMemoriaSRS } from './srs.js';

// --- NOVO: Utilitário para caminhos dinâmicos ---
const getAssetPath = (path) => {
  const base = import.meta.env.BASE_URL;
  // Garante que o caminho final seja: /base/path
  return `${base}/${path}`.replace(/\/+/g, '/');
};

// DOM Elements
const els = {
  lista: document.getElementById('lista-quizes'),
  stage: document.getElementById('quiz-stage'),
  progresso: document.getElementById('barra-progresso-container'),
  titulo: document.getElementById('titulo-quiz'),
  descricao: document.getElementById('descricao-quiz'),
  tempo: document.getElementById('display-tempo'),
  contador: document.getElementById('contador-perguntas'),
  selecao: document.getElementById('tela-selecao'),
  confete: document.getElementById('canvas-confete')
};

// Estado (State)
const state = {
  perguntas: [],
  indiceAtual: 0,
  acertos: 0,
  pontuacaoTotal: 0,
  modoJogo: null, 
  respondido: false,
  dicasRestantes: 2,
  tempoTotal: 30,
  tempoRestante: 30,
  timerInterval: null,
  srsStartTime: 0
};

// =======================
// INICIALIZAÇÃO (Boot)
// =======================

export function init() {
  carregarListaQuizes();
  verificarParametrosURL();
}

function carregarListaQuizes() {
  if (!els.lista) return;
  
  // AJUSTADO: Usando getAssetPath
  fetch(getAssetPath('quizes/index.json'))
    .then(res => res.json())
    .then(dados => {
      els.lista.innerHTML = dados
        .map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
        .join('');
    })
    .catch(() => {
      els.lista.innerHTML = '<p style="text-align:center;">Erro ao carregar lista.</p>';
    });
}

function verificarParametrosURL() {
  if (!els.stage) return;
  
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get('id');

  if (idQuiz) {
    // AJUSTADO: Usando getAssetPath
    fetch(getAssetPath(`quizes/${idQuiz}.md`))
      .then(res => {
        if (!res.ok) throw new Error("Arquivo não encontrado");
        return res.text();
      })
      .then(text => {
        const dados = parseMarkdownQuiz(text);
        
        if (els.titulo) els.titulo.innerText = dados.titulo || 'Quiz';
        if (els.descricao && dados.descricao) {
          els.descricao.innerHTML = dados.descricao;
          els.descricao.style.display = 'block';
        }

        state.perguntas = dados.perguntas;
        els.selecao.style.display = 'flex';
        els.stage.style.display = 'none';
      })
      .catch(err => {
        console.error(err);
        if (els.titulo) els.titulo.innerText = "Erro ao carregar";
        els.stage.innerHTML = '<p style="text-align:center">Não foi possível carregar os dados.</p>';
        els.stage.style.display = 'block';
      });
  }
}

// =======================
// MODO TREINO
// =======================

async function iniciarModoTreino() {
  if(els.titulo) els.titulo.innerText = "Carregando Memória...";
  if(els.lista) els.lista.style.display = 'none';
  if(els.selecao) els.selecao.style.display = 'none';

  try {
    // AJUSTADO: Usando getAssetPath
    const resIndex = await fetch(getAssetPath('quizes/index.json'));
    const quizList = await resIndex.json();
    
    let todasAsQuestoes = [];
    
    const promises = quizList.map(async (q) => {
      // AJUSTADO: Usando getAssetPath
      const res = await fetch(getAssetPath(`quizes/${q.arquivo}.md?t=${Date.now()}`)); 
      const text = await res.text();
      return extrairPerguntasMass(text, q.arquivo); 
    });

    const resultadosArrays = await Promise.all(promises);
    resultadosArrays.forEach(arr => todasAsQuestoes.push(...arr));

    const srsDb = getSRSData();
    const now = Date.now();
    const DAY_MS = 86400000;

    const questoesDue = todasAsQuestoes.filter(p => {
      const entry = srsDb[p.id];
      if (!entry) return true;
      const dueDate = entry.lastReviewed + (entry.interval * DAY_MS);
      return now >= dueDate;
    });

    if (questoesDue.length === 0) {
      alert("🎉 Tudo em dia! Você revisou todo o conteúdo pendente. Volte amanhã.");
      location.reload();
      return;
    }

    state.perguntas = embaralhar(questoesDue).slice(0, 50);
    if(els.titulo) els.titulo.innerText = `🧠 Treino do Dia (${state.perguntas.length})`;
    iniciarJogo('treino');

  } catch (err) {
    console.error("ERRO TREINO:", err);
    alert("Erro ao iniciar treino.");
    location.reload(); 
  }
}

// ... (Restante das funções iniciarJogo, verificarResposta, etc, permanecem iguais) ...

// ============================================
// EXPOR PARA O HTML
// ============================================
window.iniciarJogo = iniciarJogo;
window.iniciarModoTreino = iniciarModoTreino;
window.verificarResposta = verificarResposta;
window.mostrarDica = mostrarDica;
window.transicaoProximaPergunta = transicaoProximaPergunta;
window.resetarMemoriaSRS = resetarMemoriaSRS;

init();
