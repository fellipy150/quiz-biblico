// =========================================
//  GAME CONTROLLER (Vite/Module Version)
// =========================================
import { embaralhar, converterMarkdownSimples, parseMarkdownQuiz, extrairPerguntasMass } from './engine.js';
import { getSRSData, processarSRS, resetarMemoriaSRS } from './srs.js';

// Utilitário para caminhos dinâmicos
const getAssetPath = (path) => {
  const base = import.meta.env.BASE_URL;
  return `${base}/${path}`.replace(/\/+/g, '/');
};

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

// ============================================
// EXPOSIÇÃO GLOBAL (Resolver ReferenceError)
// ============================================
// Movido para o topo para garantir que as funções existam antes de qualquer execução
window.iniciarJogo = iniciarJogo;
window.iniciarModoTreino = iniciarModoTreino;
window.verificarResposta = verificarResposta;
window.mostrarDica = mostrarDica;
window.transicaoProximaPergunta = transicaoProximaPergunta;
window.resetarMemoriaSRS = resetarMemoriaSRS;

// =======================
// INICIALIZAÇÃO
// =======================

export function init() {
  carregarListaQuizes();
  verificarParametrosURL();
}

function carregarListaQuizes() {
  if (!els.lista) return;
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
        els.stage.style.display = 'block';
      });
  }
}

// =======================
// LÓGICA DO JOGO
// =======================

async function iniciarModoTreino() {
  try {
    const resIndex = await fetch(getAssetPath('quizes/index.json'));
    const quizList = await resIndex.json();
    let todasAsQuestoes = [];
    
    const promises = quizList.map(async (q) => {
      const res = await fetch(getAssetPath(`quizes/${q.arquivo}.md?t=${Date.now()}`)); 
      const text = await res.text();
      return extrairPerguntasMass(text, q.arquivo); 
    });

    const resultadosArrays = await Promise.all(promises);
    resultadosArrays.forEach(arr => todasAsQuestoes.push(...arr));

    const srsDb = getSRSData();
    const now = Date.now();
    const questoesDue = todasAsQuestoes.filter(p => {
      const entry = srsDb[p.id];
      if (!entry) return true;
      return now >= entry.lastReviewed + (entry.interval * 86400000);
    });

    if (questoesDue.length === 0) {
      alert("🎉 Tudo em dia!");
      return;
    }

    state.perguntas = embaralhar(questoesDue).slice(0, 50);
    iniciarJogo('treino');
  } catch (err) {
    console.error(err);
  }
}

function iniciarJogo(modo) {
  state.modoJogo = modo;
  state.indiceAtual = 0;
  state.acertos = 0;
  state.pontuacaoTotal = 0;
  
  // Sincroniza com o window para o ranking.js ler
  window.pontuacaoTotal = state.pontuacaoTotal;
  window.modoJogo = state.modoJogo;

  els.selecao.style.display = 'none';
  els.stage.style.display = 'grid';
  
  adicionarNovaPergunta(state.perguntas[0], false);
}

// Use "function Nome()" (hoisted) em vez de "const Nome = () =>"
function adicionarNovaPergunta(p, comAnimacao) {
  state.respondido = false;
  state.srsStartTime = Date.now();
  
  if(els.contador) els.contador.innerText = `${state.indiceAtual + 1} / ${state.perguntas.length}`;

  const opcoesEmb = embaralhar([...p.opcoes]);
  const novoCard = document.createElement('div');
  novoCard.className = 'card-quiz ativo';
  novoCard.innerHTML = `
    <div class="pergunta">${p.enunciado}</div>
    <div class="lista-opcoes">
      ${opcoesEmb.map((op, i) => `
        <div class="opcao" data-is-correct="${op.correta}" onclick="window.verificarResposta(${i}, this)">
          ${op.texto}
        </div>
      `).join('')}
    </div>
    <button id="btn-prox" style="display:none" onclick="window.transicaoProximaPergunta()">Próxima ➜</button>
  `;
  els.stage.innerHTML = '';
  els.stage.appendChild(novoCard);
}

function verificarResposta(index, el) {
  if (state.respondido) return;
  state.respondido = true;
  
  const acertou = el && el.getAttribute('data-is-correct') === 'true';
  if (acertou) {
    el.classList.add('correta');
    state.acertos++;
    state.pontuacaoTotal += 10;
    window.pontuacaoTotal = state.pontuacaoTotal; // Atualiza global
  } else if (el) {
    el.classList.add('errada');
  }

  document.getElementById('btn-prox').style.display = 'block';
}

function transicaoProximaPergunta() {
  state.indiceAtual++;
  if (state.indiceAtual >= state.perguntas.length) {
    els.stage.innerHTML = `<h2>Fim! Pontos: ${state.pontuacaoTotal}</h2><button onclick="location.reload()">Sair</button>`;
  } else {
    adicionarNovaPergunta(state.perguntas[state.indiceAtual], true);
  }
}

// Inicializa
init();
