// =========================================
//  GAME CONTROLLER (Vite/Module Version)
// =========================================
import { embaralhar, converterMarkdownSimples, parseMarkdownQuiz, extrairPerguntasMass } from './engine.js';
import { getSRSData, processarSRS, resetarMemoriaSRS } from './srs.js';

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
  modoJogo: null, // 'normal', 'desafio', 'treino'
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
  
  fetch('../quizes/index.json')
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
    fetch(`../quizes/${idQuiz}.md`)
      .then(res => {
        if (!res.ok) throw new Error("Arquivo não encontrado");
        return res.text();
      })
      .then(text => {
        const dados = parseMarkdownQuiz(text);
        
        // Atualiza UI Inicial
        if (els.titulo) els.titulo.innerText = dados.titulo || 'Quiz';
        if (els.descricao && dados.descricao) {
          els.descricao.innerHTML = dados.descricao;
          els.descricao.style.display = 'block';
        }

        // Salva no State
        state.perguntas = dados.perguntas;
        
        // UI Transition
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
// MODO TREINO (Lógica de Carga)
// =======================

async function iniciarModoTreino() {
  if(els.titulo) els.titulo.innerText = "Carregando Memória...";
  if(els.lista) els.lista.style.display = 'none';
  if(els.selecao) els.selecao.style.display = 'none';

  try {
    const resIndex = await fetch('../quizes/index.json');
    const quizList = await resIndex.json();
    
    let todasAsQuestoes = [];
    
    // Carrega tudo em paralelo
    const promises = quizList.map(async (q) => {
      const res = await fetch(`../quizes/${q.arquivo}?t=${Date.now()}`); 
      const text = await res.text();
      return extrairPerguntasMass(text, q.arquivo); 
    });

    const resultadosArrays = await Promise.all(promises);
    resultadosArrays.forEach(arr => todasAsQuestoes.push(...arr));

    // Filtra pelo algoritmo SRS
    const srsDb = getSRSData();
    const now = Date.now();
    const DAY_MS = 86400000;

    const questoesDue = todasAsQuestoes.filter(p => {
      const entry = srsDb[p.id];
      if (!entry) return true; // Nunca viu? É due.
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

// =======================
// CORE GAME LOOP
// =======================

function iniciarJogo(modo) {
  if (state.perguntas.length === 0) return;

  state.modoJogo = modo;
  state.indiceAtual = 0;
  state.acertos = 0;
  state.pontuacaoTotal = 0;
  state.dicasRestantes = 2;
  state.tempoTotal = modo === 'desafio' ? 15 : 30;

  // Classes CSS no Body
  document.body.classList.remove('modo-desafio', 'modo-treino');
  if (modo === 'desafio') document.body.classList.add('modo-desafio');
  if (modo === 'treino') document.body.classList.add('modo-treino');

  // Ajustes UI
  els.selecao.style.display = 'none';
  if (els.descricao) els.descricao.style.display = 'none';
  if (els.titulo) {
    els.titulo.style.display = 'block';
    els.titulo.style.fontSize = '1.1rem';
  }
  
  els.stage.style.display = 'grid';
  
  // UI Específica por modo
  if (modo !== 'treino') {
    els.progresso.style.display = 'flex';
    els.tempo.style.display = 'block';
    els.contador.style.display = 'block';
    renderizarBarraProgresso();
    state.perguntas = embaralhar([...state.perguntas]);
  } else {
    els.progresso.style.display = 'none';
    els.tempo.style.display = 'none';
    els.contador.style.display = 'none';
  }

  adicionarNovaPergunta(state.perguntas[0], false);
}

function renderizarBarraProgresso() {
  els.progresso.innerHTML = '';
  if (state.modoJogo === 'desafio') {
    els.progresso.innerHTML = `<div class="segmento-barra" id="seg-unico" style="flex: 1;"><div class="fill-tempo"></div></div>`;
  } else {
    els.progresso.innerHTML = state.perguntas
      .map((_, i) => `<div class="segmento-barra" id="seg-${i}"><div class="fill-tempo"></div></div>`)
      .join('');
  }
}

function adicionarNovaPergunta(p, comAnimacao = true) {
  state.respondido = false;
  state.srsStartTime = Date.now();

  if(els.contador) {
    els.contador.innerText = `${state.indiceAtual + 1} / ${state.perguntas.length}`;
  }

  const opcoesEmb = embaralhar([...p.opcoes]);
  const novoCard = document.createElement('div');
  novoCard.className = 'card-quiz';

  // Nota: Estou usando window.verificarResposta no HTML string, 
  // que será mapeado no final do arquivo.
  novoCard.innerHTML = `
        <div style="font-size:0.65rem; text-transform:uppercase; opacity:0.5; margin-bottom:4px; font-weight:800; letter-spacing:1px; text-align:center;">
            ${p.categoria}
        </div>
        <div class="pergunta">${p.enunciado}</div>
        <div class="lista-opcoes">
            ${opcoesEmb.map((op, i) => `
                <div class="opcao-wrapper">
                    <div class="opcao" data-is-correct="${op.correta}" onclick="window.verificarResposta(${i}, this)">
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
            ${p.dica ? `<button class="btn-dica-minimal" ${state.dicasRestantes <= 0 ? 'disabled' : ''} onclick="window.mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">💡 Dica <span class="contador-dica">${state.dicasRestantes}</span></button>` : ''}
            <div class="texto-dica-placeholder"></div>
        </div>
        <button id="btn-prox" onclick="window.transicaoProximaPergunta()">Próxima Questão ➜</button>
    `;

  if (comAnimacao) {
    novoCard.classList.add('pre-render-direita');
    const cardAntigo = els.stage.querySelector('.card-quiz.ativo');
    els.stage.appendChild(novoCard);
    void novoCard.offsetWidth; // Force Reflow
    if (cardAntigo) {
      cardAntigo.classList.replace('ativo', 'saindo-esquerda');
      setTimeout(() => cardAntigo.remove(), 500);
    }
    novoCard.classList.replace('pre-render-direita', 'ativo');
  } else {
    novoCard.classList.add('ativo');
    els.stage.appendChild(novoCard);
  }

  if(state.modoJogo !== 'treino') {
    iniciarTimer();
    animarBarraAtual();
  }
}

function animarBarraAtual() {
  const idAlvo = state.modoJogo === 'desafio' ? 'seg-unico' : `seg-${state.indiceAtual}`;
  const seg = document.getElementById(idAlvo);
  if (!seg) return;
  
  seg.classList.remove('correto', 'errado');
  const fill = seg.querySelector('.fill-tempo');
  
  // Reset animation
  fill.style.transition = 'none';
  fill.style.width = '0%';
  void fill.offsetWidth;
  
  fill.style.transition = `width ${state.tempoTotal}s linear`;
  fill.style.width = '100%';
}

function iniciarTimer() {
  state.tempoRestante = state.tempoTotal;
  clearInterval(state.timerInterval);
  els.tempo.innerText = `⏱️ ${state.tempoRestante}s`;
  
  state.timerInterval = setInterval(() => {
    state.tempoRestante--;
    els.tempo.innerText = `⏱️ ${state.tempoRestante}s`;
    if (state.tempoRestante <= 0) {
      clearInterval(state.timerInterval);
      if (state.modoJogo === 'desafio') gameOverDesafio('Tempo esgotado!');
      else verificarResposta(-1, null);
    }
  }, 1000);
}

// =======================
// INTERAÇÃO (Actions)
// =======================

function verificarResposta(index, el) {
  if (state.respondido) return;
  
  const durationSec = (Date.now() - state.srsStartTime) / 1000;
  state.respondido = true;
  clearInterval(state.timerInterval);

  // Parar animação da barra
  if (state.modoJogo !== 'treino') {
    const idAlvo = state.modoJogo === 'desafio' ? 'seg-unico' : `seg-${state.indiceAtual}`;
    const seg = document.getElementById(idAlvo);
    if (seg) {
        const fill = seg.querySelector('.fill-tempo');
        fill.style.width = window.getComputedStyle(fill).width;
        fill.style.transition = 'none';
    }
  }

  // Identificar elementos
  const card = document.querySelector('.card-quiz.ativo');
  const opcoes = card.querySelectorAll('.opcao');
  const explicacoes = card.querySelectorAll('.container-explicacao');
  let acertou = false;

  // Lógica Visual
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

  // Lógica de Negócio
  if (state.modoJogo === 'treino') {
    const pAtual = state.perguntas[state.indiceAtual];
    processarSRS(pAtual.id, acertou, durationSec);
    card.querySelector('#btn-prox').style.display = 'block';
    return;
  }

  if (acertou) {
    state.acertos++;
    let base = state.modoJogo === 'desafio' ? 15 : 10;
    state.pontuacaoTotal += (base + Math.round(base * (state.tempoRestante / state.tempoTotal)));
  }

  if (state.modoJogo === 'desafio' && !acertou) {
    setTimeout(() => gameOverDesafio(index === -1 ? 'Tempo Esgotado!' : 'Você Errou!'), 1200);
    return;
  }

  if (state.modoJogo === 'normal') {
    const seg = document.getElementById(`seg-${state.indiceAtual}`);
    if (seg) seg.classList.add(acertou ? 'correto' : 'errado');
  }
  
  card.querySelector('#btn-prox').style.display = 'block';
}

function mostrarDica(btn, texto) {
  if (state.dicasRestantes <= 0) return;
  state.dicasRestantes--;
  btn.disabled = true;
  btn.innerHTML = `💡 Dica <span class="contador-dica">${state.dicasRestantes}</span>`;
  const area = document.querySelector('.card-quiz.ativo .texto-dica-placeholder');
  area.innerHTML = `<div class="box-dica-texto">${texto}</div>`;
}

function transicaoProximaPergunta() {
  state.indiceAtual++;
  if (state.indiceAtual >= state.perguntas.length) {
    if (state.modoJogo === 'treino') {
      mostrarFimTreino();
    } else {
      mostrarResultadoFinal();
    }
  } else {
    adicionarNovaPergunta(state.perguntas[state.indiceAtual], true);
  }
}

// =======================
// TELAS FINAIS
// =======================

function gameOverDesafio(motivo) {
  if (els.titulo) els.titulo.style.fontSize = '1.3rem';
  els.stage.innerHTML = `<div class="card-quiz ativo" style="text-align:center; border: 2px solid var(--error);"><h2 style="font-size:3rem;">☠️</h2><h3 style="color:var(--error);">${motivo}</h3><p>Fim de jogo no desafio.</p><button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer; margin-top:20px;">Tentar Novamente</button></div>`;
  els.tempo.style.display = 'none';
  els.contador.style.display = 'none';
  els.progresso.style.display = 'none';
}

function mostrarFimTreino() {
  if (els.titulo) els.titulo.style.fontSize = '1.3rem';
  els.stage.innerHTML = `
    <div class="card-quiz ativo" style="text-align:center;">
      <h2 style="color:#4f46e5;">✅ Treino Concluído!</h2>
      <p style="margin:20px 0; line-height:1.5;">Você revisou todas as cartas pendentes por agora.</p>
      <button onclick="location.reload()" style="background:#4f46e5; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; margin-top:10px;">Voltar ao Menu</button>
    </div>`;
  document.body.classList.remove('modo-treino');
}

function mostrarResultadoFinal() {
  if (els.titulo) els.titulo.style.fontSize = '1.3rem';
  const porcentagem = (state.acertos / state.perguntas.length);
  const win = porcentagem >= 0.6;
  
  els.tempo.style.display = 'none';
  els.contador.style.display = 'none';
  els.progresso.style.display = 'none';
  
  els.stage.innerHTML = `
    <div class="card-quiz ativo" style="text-align:center;">
        <h2>${win ? 'Incrível!' : 'Bom Treino!'}</h2>
        <div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">
            ${state.pontuacaoTotal} <span style="font-size:1.5rem">pts</span>
        </div>
        <p style="font-weight:600;">Você acertou ${state.acertos} de ${state.perguntas.length}</p>
        <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
        <button onclick="location.reload()" style="background:transparent; border:1px solid #ccc; padding:10px; width:100%; margin-top:10px; border-radius:12px; cursor:pointer;">Menu Principal</button>
    </div>`;
  if (win) dispararConfete();
}

function dispararConfete() {
  if (!els.confete) return;
  const ctx = els.confete.getContext('2d');
  els.confete.width = window.innerWidth;
  els.confete.height = window.innerHeight;
  const particles = Array.from({ length: 120 }, () => ({ x: Math.random() * els.confete.width, y: Math.random() * els.confete.height - els.confete.height, w: Math.random() * 10 + 5, h: Math.random() * 10 + 5, color: ['#ff0', '#0f0', '#00f', '#f0f', '#0ff', '#fff'][Math.floor(Math.random() * 6)], s: Math.random() * 3 + 2, a: Math.random() * 360, }));
  function draw() {
    ctx.clearRect(0, 0, els.confete.width, els.confete.height);
    particles.forEach((p) => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.w, p.h); p.y += p.s; p.a += 0.1; if (p.y > els.confete.height) p.y = -10; });
    if (els.confete.width > 0) requestAnimationFrame(draw);
  }
  draw();
  setTimeout(() => { els.confete.width = 0; }, 5000);
}

// ============================================
// EXPOR PARA O HTML (Importante para Vite)
// ============================================
// Como o HTML usa onclick="iniciarJogo()", e módulos
// não são globais, precisamos atrelar manualmente ao window.
window.iniciarJogo = iniciarJogo;
window.iniciarModoTreino = iniciarModoTreino;
window.verificarResposta = verificarResposta;
window.mostrarDica = mostrarDica;
window.transicaoProximaPergunta = transicaoProximaPergunta;
window.resetarMemoriaSRS = resetarMemoriaSRS;
window.enviarPontuacao = () => alert("Implementar envio no novo módulo.");

// Auto-init ao importar
init();


