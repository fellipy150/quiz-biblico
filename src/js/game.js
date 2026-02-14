// =========================================
//  GAME CONTROLLER (Versão Final Corrigida)
// =========================================
import { embaralhar, parseMarkdownQuiz, extrairPerguntasMass } from './engine.js';
import { getSRSData, processarSRS, resetarMemoriaSRS } from './srs.js';

// --- Utilitário para caminhos ---
const getAssetPath = (path) => {
  try {
    const base = import.meta.env.BASE_URL || '/';
    return `${base}/${path}`.replace(/\/+/g, '/');
  } catch (e) {
    return path;
  }
};

// --- Cache de Elementos DOM (Silencioso para não poluir console) ---
const getEl = (id) => document.getElementById(id);

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
  carregarListaQuizes();
  verificarParametrosURL();
}

function carregarListaQuizes() {
  // Se não tem lista na página (ex: quiz.html), apenas sai sem erro.
  if (!els.lista) return;

  fetch(getAssetPath('quizes/index.json'))
    .then(res => res.ok ? res.json() : [])
    .then(dados => {
      if(dados.length) {
        els.lista.innerHTML = dados
          .map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
          .join('');
      }
    })
    .catch(console.error);
}

function verificarParametrosURL() {
  if (!els.stage) return;
  const params = new URLSearchParams(window.location.search);
  const idQuiz = params.get('id');

  if (idQuiz) {
    fetch(getAssetPath(`quizes/${idQuiz}.md`))
      .then(res => {
        if (!res.ok) throw new Error("Quiz não encontrado");
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
        
        if(els.selecao) els.selecao.style.display = 'flex';
        if(els.stage) els.stage.style.display = 'none';
      })
      .catch(err => {
        console.error(err);
        if (els.titulo) els.titulo.innerText = "Erro ao carregar";
        els.stage.innerHTML = '<div class="card-quiz error">Erro ao carregar quiz. Verifique a URL.</div>';
        els.stage.style.display = 'block';
      });
  }
}

// =======================
// 3. LÓGICA DO JOGO
// =======================

async function iniciarModoTreinoInternal() {
  if(els.titulo) els.titulo.innerText = "Carregando Memória...";
  if(els.lista) els.lista.style.display = 'none';
  if(els.selecao) els.selecao.style.display = 'none';

  try {
    const resIndex = await fetch(getAssetPath('quizes/index.json'));
    const quizList = await resIndex.json();
    let todasAsQuestoes = [];
    
    const promises = quizList.map(async (q) => {
      try {
        const res = await fetch(getAssetPath(`quizes/${q.arquivo}.md?t=${Date.now()}`)); 
        if(!res.ok) return [];
        const text = await res.text();
        return extrairPerguntasMass(text, q.arquivo);
      } catch { return []; }
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
    if(els.titulo) els.titulo.innerText = `🧠 Treino do Dia (${state.perguntas.length})`;
    
    iniciarJogoInternal('treino');

  } catch (err) {
    console.error(err);
    alert("Erro ao iniciar treino.");
    location.reload();
  }
}

function iniciarJogoInternal(modo) {
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
  if(els.titulo) els.titulo.style.display = 'block';
  if(els.stage) els.stage.style.display = 'grid';

  if (modo !== 'treino') {
    if(els.progresso) els.progresso.style.display = 'flex';
    if(els.tempo) els.tempo.style.display = 'block';
    if(els.contador) els.contador.style.display = 'block';
    // ✅ FUNÇÃO RECUPERADA
    renderizarBarraProgresso();
  } else {
    if(els.progresso) els.progresso.style.display = 'none';
    if(els.tempo) els.tempo.style.display = 'none';
    if(els.contador) els.contador.style.display = 'none';
  }

  if(state.perguntas.length > 0) {
    adicionarNovaPergunta(state.perguntas[0]);
  } else {
    alert("Nenhuma pergunta encontrada.");
  }
}

// ✅ FUNÇÃO RECUPERADA
function renderizarBarraProgresso() {
  if (!els.progresso) return;
  els.progresso.innerHTML = '';
  if (state.modoJogo === 'desafio') {
    els.progresso.innerHTML = `<div class="segmento-barra" id="seg-unico" style="flex: 1;"><div class="fill-tempo"></div></div>`;
  } else {
    els.progresso.innerHTML = state.perguntas
      .map((_, i) => `<div class="segmento-barra" id="seg-${i}"><div class="fill-tempo"></div></div>`)
      .join('');
  }
}

function adicionarNovaPergunta(p) {
  state.respondido = false;
  state.srsStartTime = Date.now();

  if(els.contador) els.contador.innerText = `${state.indiceAtual + 1} / ${state.perguntas.length}`;

  const opcoesEmb = embaralhar([...p.opcoes]);
  const novoCard = document.createElement('div');
  novoCard.className = 'card-quiz ativo'; // Adicionado 'ativo' direto para evitar delay visual

  novoCard.innerHTML = `
    <div style="font-size:0.65rem; text-transform:uppercase; opacity:0.5; margin-bottom:4px; font-weight:800; letter-spacing:1px; text-align:center;">
        ${p.categoria || 'Geral'}
    </div>
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
    <button id="btn-prox" style="display:none; margin-top:15px; width:100%; padding:12px;" onclick="window.transicaoProximaPergunta()">Próxima Questão ➜</button>
  `;

  if (els.stage) {
    els.stage.innerHTML = '';
    els.stage.appendChild(novoCard);
  }

  if (state.modoJogo !== 'treino') {
    iniciarTimer();
    // ✅ FUNÇÃO RECUPERADA
    animarBarraAtual();
  }
}

// ✅ FUNÇÃO RECUPERADA
function animarBarraAtual() {
  const idAlvo = state.modoJogo === 'desafio' ? 'seg-unico' : `seg-${state.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (!seg) return;
  
  seg.classList.remove('correto', 'errado');
  const fill = seg.querySelector('.fill-tempo');
  if(!fill) return;

  fill.style.transition = 'none';
  fill.style.width = '0%';
  void fill.offsetWidth; // Force Reflow
  
  fill.style.transition = `width ${state.tempoTotal}s linear`;
  fill.style.width = '100%';
}

function iniciarTimer() {
  if (!els.tempo) return;
  
  state.tempoRestante = state.tempoTotal;
  clearInterval(state.timerInterval);
  els.tempo.innerText = `⏱️ ${state.tempoRestante}s`;
  
  state.timerInterval = setInterval(() => {
    state.tempoRestante--;
    els.tempo.innerText = `⏱️ ${state.tempoRestante}s`;
    
    if (state.tempoRestante <= 0) {
      clearInterval(state.timerInterval);
      if (state.modoJogo === 'desafio') {
        gameOverDesafio('Tempo Esgotado!');
      } else {
        verificarRespostaInternal(-1, null);
      }
    }
  }, 1000);
}

// =======================
// 4. AÇÕES
// =======================

function verificarRespostaInternal(index, el) {
  if (state.respondido) return;
  
  const durationSec = (Date.now() - state.srsStartTime) / 1000;
  state.respondido = true;
  clearInterval(state.timerInterval);

  // Trava a animação da barra
  if (state.modoJogo !== 'treino') {
    const idAlvo = state.modoJogo === 'desafio' ? 'seg-unico' : `seg-${state.indiceAtual}`;
    const seg = document.getElementById(idAlvo);
    if (seg) {
        const fill = seg.querySelector('.fill-tempo');
        if(fill) {
            fill.style.width = window.getComputedStyle(fill).width;
            fill.style.transition = 'none';
        }
    }
  }

  const card = document.querySelector('.card-quiz.ativo');
  if(!card) return;
  
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
    const pAtual = state.perguntas[state.indiceAtual];
    processarSRS(pAtual.id, acertou, durationSec);
  } else {
    if (acertou) {
      state.acertos++;
      let base = state.modoJogo === 'desafio' ? 15 : 10;
      state.pontuacaoTotal += (base + Math.round(base * (state.tempoRestante / state.tempoTotal)));
    }
    window.pontuacaoTotal = state.pontuacaoTotal;

    if (state.modoJogo === 'normal') {
      const seg = document.getElementById(`seg-${state.indiceAtual}`);
      if (seg) seg.classList.add(acertou ? 'correto' : 'errado');
    }
    
    if (state.modoJogo === 'desafio' && !acertou) {
      setTimeout(() => gameOverDesafio('Você Errou!'), 1000);
      return;
    }
  }

  const btnProx = card.querySelector('#btn-prox');
  if(btnProx) btnProx.style.display = 'block';
}

function mostrarDicaInternal(btn, texto) {
  if (state.dicasRestantes <= 0) return;
  state.dicasRestantes--;
  btn.disabled = true;
  btn.innerHTML = `💡 Dica (${state.dicasRestantes})`;
  
  const area = document.querySelector('.card-quiz.ativo .texto-dica-placeholder');
  if(area) area.innerHTML = `<div class="box-dica-texto">${texto}</div>`;
}

function transicaoProximaPerguntaInternal() {
  state.indiceAtual++;
  if (state.indiceAtual >= state.perguntas.length) {
    if (state.modoJogo === 'treino') {
      mostrarFimTreino();
    } else {
      mostrarResultadoFinal();
    }
  } else {
    adicionarNovaPergunta(state.perguntas[state.indiceAtual]);
  }
}

// =======================
// 5. TELAS FINAIS (Recuperadas)
// =======================

function gameOverDesafio(motivo) {
  if (els.stage) {
      els.stage.innerHTML = `
        <div class="card-quiz ativo" style="text-align:center; border: 2px solid var(--error);">
            <h2 style="font-size:3rem;">☠️</h2>
            <h3 style="color:var(--error);">${motivo}</h3>
            <p>Fim de jogo.</p>
            <p>Pontuação Final: <strong>${state.pontuacaoTotal}</strong></p>
            <button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer; margin-top:20px;">Tentar Novamente</button>
            <br><br>
            <a href="index.html" style="color:#666; text-decoration:none;">Voltar ao Menu</a>
        </div>`;
  }
  if(els.tempo) els.tempo.style.display = 'none';
  if(els.contador) els.contador.style.display = 'none';
  if(els.progresso) els.progresso.style.display = 'none';
}

function mostrarFimTreino() {
  if (els.stage) {
      els.stage.innerHTML = `
        <div class="card-quiz ativo" style="text-align:center;">
          <h2 style="color:#4f46e5;">✅ Treino Concluído!</h2>
          <p style="margin:20px 0;">Você revisou todas as cartas pendentes.</p>
          <a href="index.html"><button style="background:#4f46e5; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">Voltar ao Menu</button></a>
        </div>`;
  }
}

function mostrarResultadoFinal() {
  const porcentagem = (state.acertos / state.perguntas.length);
  const win = porcentagem >= 0.6;
  
  if(els.tempo) els.tempo.style.display = 'none';
  if(els.contador) els.contador.style.display = 'none';
  if(els.progresso) els.progresso.style.display = 'none';
  
  if (els.stage) {
      els.stage.innerHTML = `
        <div class="card-quiz ativo" style="text-align:center;">
            <h2>${win ? 'Muito Bem!' : 'Bom Treino!'}</h2>
            <div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">
                ${state.pontuacaoTotal} <span style="font-size:1.5rem">pts</span>
            </div>
            <p style="font-weight:600;">Acertos: ${state.acertos} / ${state.perguntas.length}</p>
            <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
            <button onclick="location.reload()" style="background:var(--brand-green); color:white; padding:12px; width:100%; border:none; border-radius:8px; margin-bottom:10px; cursor:pointer;">Jogar Novamente</button>
            <a href="index.html"><button style="background:transparent; border:1px solid #ccc; padding:12px; width:100%; border-radius:8px; cursor:pointer;">Menu Principal</button></a>
        </div>`;
  }
  if (win) dispararConfete();
}

function dispararConfete() {
  if(!els.confete) return;
  const ctx = els.confete.getContext('2d');
  els.confete.width = window.innerWidth;
  els.confete.height = window.innerHeight;
  const p = Array.from({length:100}, () => ({x:Math.random()*els.confete.width, y:-20, c:'#'+Math.floor(Math.random()*16777215).toString(16), s:2+Math.random()*3}));
  function draw(){
      ctx.clearRect(0,0,els.confete.width,els.confete.height);
      p.forEach(k => {ctx.fillStyle=k.c; ctx.fillRect(k.x,k.y+=k.s,5,5); if(k.y>els.confete.height)k.y=-20;});
      if(els.confete.width > 0) requestAnimationFrame(draw);
  }
  draw();
  setTimeout(() => { els.confete.width = 0; }, 5000);
}

// Inicia
init();
