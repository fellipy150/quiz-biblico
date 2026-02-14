// =========================================
//  GAME CONTROLLER (Final Production Version)
// =========================================
import { embaralhar, parseMarkdownQuiz, extrairPerguntasMass } from './engine.js';
import { getSRSData, processarSRS, resetarMemoriaSRS } from './srs.js';

// --- Utilitário para caminhos ---
const getAssetPath = (path) => {
  try {
    const base = import.meta.env.BASE_URL || '/';
    return `${base}/${path}`.replace(/\/+/g, '/');
  } catch (e) {
    console.error("Erro ao resolver caminho de asset:", e);
    return path;
  }
};

// --- Cache de Elementos DOM com Erro Descritivo ---
const getEl = (id) => {
  const el = document.getElementById(id);
  if (!el) console.warn(`Elemento crítico não encontrado no DOM: #${id}`);
  return el;
};

const els = {
  lista: getEl('lista-quizes'),
  stage: getEl('quiz-stage'),
  progresso: getEl('barra-progresso-container'),
  titulo: getEl('titulo-quiz'),
  descricao: getEl('descricao-quiz'),
  tempo: getEl('display-tempo'),
  contador: getEl('contador-perguntas'),
  selecao: getEl('tela-selecao'),
  confete: getEl('canvas-confete')
};

// --- Estado Global ---
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
// 1. EXPOSIÇÃO GLOBAL
// ============================================
window.iniciarJogo = (modo) => iniciarJogoInternal(modo);
window.iniciarModoTreino = () => iniciarModoTreinoInternal();
window.verificarResposta = (idx, el) => verificarRespostaInternal(idx, el);
window.mostrarDica = (btn, txt) => mostrarDicaInternal(btn, txt);
window.transicaoProximaPergunta = () => transicaoProximaPerguntaInternal();
window.resetarMemoriaSRS = resetarMemoriaSRS;

// =======================
// 2. INICIALIZAÇÃO
// =======================
export function init() {
  try {
    console.log("🕹️ Inicializando Engine do Jogo...");
    carregarListaQuizes();
    verificarParametrosURL();
  } catch (error) {
    console.error("Falha crítica na inicialização:", error);
  }
}

function carregarListaQuizes() {
  if (!els.lista) return;

  const path = getAssetPath('quizes/index.json');
  fetch(path)
    .then(res => {
      if (!res.ok) throw new Error(`Falha ao carregar index.json (Status: ${res.status})`);
      return res.json();
    })
    .then(dados => {
      els.lista.innerHTML = dados
        .map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
        .join('');
    })
    .catch(err => {
      console.error("Erro na lista de quizes:", err);
      els.lista.innerHTML = `<div class="error-msg">⚠️ Erro ao carregar quizes: ${err.message}</div>`;
    });
}

function verificarParametrosURL() {
  if (!els.stage) return;
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get('id');

  if (idQuiz) {
    const quizPath = getAssetPath(`quizes/${idQuiz}.md`);
    fetch(quizPath)
      .then(res => {
        if (!res.ok) throw new Error(`Arquivo de quiz "${idQuiz}.md" não encontrado em ${quizPath}`);
        return res.text();
      })
      .then(text => {
        const dados = parseMarkdownQuiz(text);
        if (!dados || !dados.perguntas.length) throw new Error("O arquivo Markdown está vazio ou mal formatado.");

        if (els.titulo) els.titulo.innerText = dados.titulo || 'Quiz';
        if (els.descricao && dados.descricao) {
          els.descricao.innerHTML = dados.descricao;
          els.descricao.style.display = 'block';
        }

        state.perguntas = dados.perguntas;
        if(els.selecao) els.selecao.style.display = 'flex';
        if(els.stage) els.stage.style.display = 'none';
      })
      .catch(err => {
        console.error("Erro ao processar quiz da URL:", err);
        mostrarErroNoPalco(`Erro no carregamento: ${err.message}`);
      });
  }
}

// =======================
// 3. LÓGICA DO JOGO
// =======================

async function iniciarModoTreinoInternal() {
  try {
    if(els.titulo) els.titulo.innerText = "Carregando Memória...";
    if(els.selecao) els.selecao.style.display = 'none';

    const resIndex = await fetch(getAssetPath('quizes/index.json'));
    if(!resIndex.ok) throw new Error("Não foi possível acessar a lista de quizes para o treino.");
    
    const quizList = await resIndex.json();
    let todasAsQuestoes = [];
    
    const promises = quizList.map(async (q) => {
      try {
        const res = await fetch(getAssetPath(`quizes/${q.arquivo}.md?t=${Date.now()}`)); 
        if(!res.ok) throw new Error(`Arquivo ${q.arquivo}.md falhou.`);
        const text = await res.text();
        return extrairPerguntasMass(text, q.arquivo); 
      } catch (e) {
        console.warn(`Pulando arquivo ${q.arquivo} devido a erro:`, e);
        return [];
      }
    });

    const resultadosArrays = await Promise.all(promises);
    resultadosArrays.forEach(arr => todasAsQuestoes.push(...arr));

    const srsDb = getSRSData();
    const now = Date.now();
    const DAY_MS = 86400000;

    const questoesDue = todasAsQuestoes.filter(p => {
      const entry = srsDb[p.id];
      if (!entry) return true; 
      return now >= entry.lastReviewed + (entry.interval * DAY_MS);
    });

    if (questoesDue.length === 0) {
      alert("🎉 Tudo em dia! Você revisou todo o conteúdo pendente.");
      window.location.href = 'index.html';
      return;
    }

    state.perguntas = embaralhar(questoesDue).slice(0, 50);
    iniciarJogoInternal('treino');

  } catch (err) {
    console.error("ERRO CRÍTICO NO MODO TREINO:", err);
    alert(`Erro ao iniciar treino: ${err.message}`);
    location.reload();
  }
}

function iniciarJogoInternal(modo) {
  try {
    if (!state.perguntas.length) throw new Error("Nenhuma pergunta carregada no estado.");

    state.modoJogo = modo;
    state.indiceAtual = 0;
    state.acertos = 0;
    state.pontuacaoTotal = 0;
    state.dicasRestantes = 2;
    state.tempoTotal = modo === 'desafio' ? 15 : 30;

    window.pontuacaoTotal = 0;
    window.modoJogo = modo;

    if(els.selecao) els.selecao.style.display = 'none';
    if(els.descricao) els.descricao.style.display = 'none';
    if(els.stage) els.stage.style.display = 'grid';

    if (modo !== 'treino') {
      if(els.progresso) els.progresso.style.display = 'flex';
      if(els.tempo) els.tempo.style.display = 'block';
      if(els.contador) els.contador.style.display = 'block';
      renderizarBarraProgresso();
    }

    adicionarNovaPergunta(state.perguntas[0]);
  } catch (error) {
    console.error("Erro ao iniciar partida:", error);
    mostrarErroNoPalco(`Não foi possível iniciar o jogo: ${error.message}`);
  }
}

function adicionarNovaPergunta(p) {
  try {
    if (!p) throw new Error("Pergunta inválida ou inexistente.");
    
    state.respondido = false;
    state.srsStartTime = Date.now();

    if(els.contador) els.contador.innerText = `${state.indiceAtual + 1} / ${state.perguntas.length}`;
    if(els.titulo && state.modoJogo === 'treino') els.titulo.innerText = `🧠 Treino (${state.indiceAtual + 1}/${state.perguntas.length})`;

    const opcoesEmb = embaralhar([...p.opcoes]);
    const novoCard = document.createElement('div');
    novoCard.className = 'card-quiz ativo';

    novoCard.innerHTML = `
      <div class="categoria-label">${p.categoria || 'Geral'}</div>
      <div class="pergunta">${p.enunciado}</div>
      <div class="lista-opcoes">
          ${opcoesEmb.map((op, i) => `
              <div class="opcao-wrapper">
                  <div class="opcao" data-is-correct="${op.correta}" onclick="window.verificarResposta(${i}, this)">
                      ${op.texto}
                  </div>
              </div>`).join('')}
      </div>
      <div class="area-dica-container">
          ${p.dica ? `<button class="btn-dica-minimal" onclick="window.mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">💡 Dica</button>` : ''}
          <div class="texto-dica-placeholder"></div>
      </div>
      <button id="btn-prox" style="display:none;" onclick="window.transicaoProximaPergunta()">Próxima Questão ➜</button>
    `;

    if (els.stage) {
      els.stage.innerHTML = '';
      els.stage.appendChild(novoCard);
    }

    if (state.modoJogo !== 'treino') {
      iniciarTimer();
      animarBarraAtual();
    }
  } catch (err) {
    console.error("Erro ao renderizar pergunta:", err);
    mostrarErroNoPalco(`Erro visual: ${err.message}`);
  }
}

// =======================
// 4. AUXILIARES E UI
// =======================

function mostrarErroNoPalco(msg) {
  if (els.stage) {
    els.stage.innerHTML = `
      <div class="card-quiz ativo error-border">
        <h3>❌ Algo deu errado</h3>
        <p>${msg}</p>
        <button onclick="location.href='index.html'">Voltar ao Início</button>
      </div>`;
    els.stage.style.display = 'block';
  }
}

function verificarRespostaInternal(index, el) {
  try {
    if (state.respondido) return;
    state.respondido = true;
    clearInterval(state.timerInterval);

    const durationSec = (Date.now() - state.srsStartTime) / 1000;
    const card = document.querySelector('.card-quiz.ativo');
    if(!card) throw new Error("Card ativo não encontrado para validar resposta.");
    
    const opcoes = card.querySelectorAll('.opcao');
    let acertou = false;

    opcoes.forEach((opt) => {
      opt.classList.add('bloqueado');
      const isCorrect = opt.getAttribute('data-is-correct') === 'true';
      if (isCorrect) {
        opt.classList.add('correta');
        if (opt === el) acertou = true;
      } else if (opt === el) {
        opt.classList.add('errada');
      }
    });

    if (state.modoJogo === 'treino') {
      processarSRS(state.perguntas[state.indiceAtual].id, acertou, durationSec);
    } else {
      if (acertou) {
        state.acertos++;
        let base = state.modoJogo === 'desafio' ? 15 : 10;
        state.pontuacaoTotal += (base + Math.round(base * (state.tempoRestante / state.tempoTotal)));
      }
      if (state.modoJogo === 'normal') {
        const seg = document.getElementById(`seg-${state.indiceAtual}`);
        if (seg) seg.classList.add(acertou ? 'correto' : 'errado');
      }
      if (state.modoJogo === 'desafio' && !acertou) {
        setTimeout(() => gameOverDesafio('Você Errou!'), 600);
        return;
      }
    }

    const btnProx = card.querySelector('#btn-prox');
    if(btnProx) btnProx.style.display = 'block';
  } catch (err) {
    console.error("Erro na verificação de resposta:", err);
  }
}

function iniciarTimer() {
  try {
    clearInterval(state.timerInterval);
    if (!els.tempo) return;
    
    state.tempoRestante = state.tempoTotal;
    els.tempo.innerText = `⏱️ ${state.tempoRestante}s`;
    
    state.timerInterval = setInterval(() => {
      state.tempoRestante--;
      if (els.tempo) els.tempo.innerText = `⏱️ ${state.tempoRestante}s`;
      
      if (state.tempoRestante <= 0) {
        clearInterval(state.timerInterval);
        state.modoJogo === 'desafio' ? gameOverDesafio('Tempo Esgotado!') : verificarRespostaInternal(-1, null);
      }
    }, 1000);
  } catch (err) {
    console.error("Erro no Timer:", err);
  }
}

// --- Funções de Transição e Confete (Simplificadas) ---
function transicaoProximaPerguntaInternal() {
  try {
    state.indiceAtual++;
    if (state.indiceAtual >= state.perguntas.length) {
      state.modoJogo === 'treino' ? mostrarFimTreino() : mostrarResultadoFinal();
    } else {
      adicionarNovaPergunta(state.perguntas[state.indiceAtual]);
    }
  } catch (err) {
    console.error("Erro na transição:", err);
  }
}

// Inicia automaticamente
init();
