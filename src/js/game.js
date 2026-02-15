// =========================================
//  GAME CONTROLLER (Versão Blindada com Try/Catch)
// =========================================
import { embaralhar, parseMarkdownQuiz, extrairPerguntasMass } from './engine.js';
import { getSRSData, processarSRS, resetarMemoriaSRS } from './srs.js';

// --- Utilitário para caminhos ---
const getAssetPath = (path) => {
  try {
    const base = import.meta.env.BASE_URL || '/';
    return `${base}/${path}`.replace(/\/+/g, '/');
  } catch (e) {
    console.error("Erro ao resolver caminho de assets:", e);
    return path;
  }
};

// --- Cache de Elementos DOM ---
const getEl = (id) => {
  try {
    return document.getElementById(id);
  } catch (e) {
    console.error(`Erro ao buscar elemento DOM #${id}:`, e);
    return null;
  }
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
  srsStartTime: 0,
  animandoTroca: false
};

// ============================================
// 1. EXPOSIÇÃO GLOBAL (Protegida)
// ============================================
// Envolvemos as chamadas globais para capturar erros vindos do HTML (onclick)
const safeGlobal = (fn, name) => (...args) => {
  try {
    return fn(...args);
  } catch (e) {
    console.error(`Erro fatal na função global ${name}:`, e);
  }
};

window.iniciarJogo = safeGlobal((modo) => iniciarJogoInternal(modo), 'iniciarJogo');
window.iniciarModoTreino = safeGlobal(() => iniciarModoTreinoInternal(), 'iniciarModoTreino');
window.verificarResposta = safeGlobal((idx, el) => verificarRespostaInternal(idx, el), 'verificarResposta');
window.mostrarDica = safeGlobal((btn, txt) => mostrarDicaInternal(btn, txt), 'mostrarDica');
window.transicaoProximaPergunta = safeGlobal(() => transicaoProximaPerguntaInternal(), 'transicaoProximaPergunta');
window.resetarMemoriaSRS = safeGlobal(resetarMemoriaSRS, 'resetarMemoriaSRS');
window.enviarPontuacao = safeGlobal(enviarPontuacaoInternal, 'enviarPontuacao');

// =======================
// 2. INICIALIZAÇÃO
// =======================
export function init() {
  try {
    carregarListaQuizes();
    verificarParametrosURL();
  } catch (e) {
    console.error("Erro na inicialização (init):", e);
  }
}

function carregarListaQuizes() {
  try {
    if (!els.lista) return;

    fetch(getAssetPath('quizes/index.json'))
      .then(res => res.ok ? res.json() : [])
      .then(dados => {
        try {
          if(dados.length) {
            els.lista.innerHTML = dados
              .map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
              .join('');
          }
        } catch (renderErr) {
          console.error("Erro ao renderizar lista de quizes:", renderErr);
        }
      })
      .catch(fetchErr => console.error("Erro no fetch da lista de quizes:", fetchErr));
  } catch (e) {
    console.error("Erro crítico em carregarListaQuizes:", e);
  }
}

function verificarParametrosURL() {
  try {
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
          try {
            const dados = parseMarkdownQuiz(text);
            
            if (els.titulo) els.titulo.innerText = dados.titulo || 'Quiz';
            if (els.descricao && dados.descricao) {
              els.descricao.innerHTML = dados.descricao;
              els.descricao.style.display = 'block';
            }

            state.perguntas = dados.perguntas;
            
            if(els.selecao) els.selecao.style.display = 'flex';
            if(els.stage) els.stage.style.display = 'none';
          } catch (parseErr) {
            console.error("Erro ao processar dados do quiz:", parseErr);
          }
        })
        .catch(err => {
          console.error("Erro ao carregar arquivo do quiz:", err);
          if (els.titulo) els.titulo.innerText = "Erro ao carregar";
          els.stage.innerHTML = '<div class="card-quiz error">Erro ao carregar quiz. Verifique a URL e o formato do arquivo.</div>';
          els.stage.style.display = 'block';
        });
    }
  } catch (e) {
    console.error("Erro geral em verificarParametrosURL:", e);
  }
}

// =======================
// 3. LÓGICA DO JOGO
// =======================

async function iniciarModoTreinoInternal() {
  try {
    // Configuração visual inicial
    if(els.titulo) els.titulo.innerText = "Carregando Memória...";
    if(els.lista) els.lista.style.display = 'none';
    if(els.selecao) els.selecao.style.display = 'none';

    const resIndex = await fetch(getAssetPath('quizes/index.json'));
    const quizList = await resIndex.json();
    let todasAsQuestoes = [];
    
    // Carrega todos os quizes
    const promises = quizList.map(async (q) => {
      try {
        const res = await fetch(getAssetPath(`quizes/${q.arquivo}.md?t=${Date.now()}`)); 
        if(!res.ok) return [];
        const text = await res.text();
        return extrairPerguntasMass(text, q.arquivo);
      } catch (e) { 
        console.error(`Erro ao carregar quiz ${q.arquivo}:`, e);
        return []; 
      }
    });

    const resultadosArrays = await Promise.all(promises);
    resultadosArrays.forEach(arr => todasAsQuestoes.push(...arr));

    // Lógica SRS
    const srsDb = getSRSData();
    const now = Date.now();
    const DAY_MS = 86400000;

    const questoesDue = todasAsQuestoes.filter(p => {
      try {
        const entry = srsDb[p.id];
        if (!entry) return true; 
        return now >= entry.lastReviewed + (entry.interval * DAY_MS);
      } catch (filterErr) {
        console.error("Erro ao filtrar questão SRS:", filterErr);
        return false;
      }
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
    console.error("Erro fatal ao iniciar treino:", err);
    alert("Erro ao iniciar treino.");
    location.reload();
  }
}

function iniciarJogoInternal(modo) {
  try {
    state.modoJogo = modo;
    state.indiceAtual = 0;
    state.acertos = 0;
    state.pontuacaoTotal = 0;
    state.dicasRestantes = 2;
    state.tempoTotal = modo === 'desafio' ? 15 : 30;
    state.animandoTroca = false;

    window.pontuacaoTotal = 0;
    window.modoJogo = modo;

    // [RESTAURADO] Estilização Global
    if (document.body) {
      if (modo === 'desafio') {
        document.body.classList.add('modo-desafio');
      } else {
        document.body.classList.remove('modo-desafio');
      }
    }

    // Reset UI
    if(els.selecao) els.selecao.style.display = 'none';
    if(els.descricao) els.descricao.style.display = 'none';
    if(els.titulo) els.titulo.style.display = 'block';
    if(els.stage) els.stage.style.display = 'grid';

    if (modo !== 'treino') {
      if(els.progresso) els.progresso.style.display = 'flex';
      if(els.tempo) els.tempo.style.display = 'block';
      if(els.contador) els.contador.style.display = 'block';
      renderizarBarraProgresso();
    } else {
      if(els.progresso) els.progresso.style.display = 'none';
      if(els.tempo) els.tempo.style.display = 'none';
      if(els.contador) els.contador.style.display = 'none';
    }

    // [EMBARALHAMENTO GLOBAL] Adicionado aqui para garantir aleatoriedade em todos os modos
    try {
      if (state.perguntas && state.perguntas.length > 0) {
        state.perguntas = embaralhar([...state.perguntas]);
        adicionarNovaPergunta(state.perguntas[0], false);
      } else {
        alert("Nenhuma pergunta encontrada.");
      }
    } catch (shuffleErr) {
      console.error("Erro ao embaralhar ou iniciar perguntas:", shuffleErr);
    }
  } catch (e) {
    console.error("Erro fatal em iniciarJogoInternal:", e);
  }
}

function renderizarBarraProgresso() {
  try {
    if (!els.progresso) return;
    els.progresso.innerHTML = '';
    
    if (state.modoJogo === 'desafio') {
      els.progresso.innerHTML = `<div class="segmento-barra" id="seg-unico" style="flex: 1;"><div class="fill-tempo"></div></div>`;
    } else {
      els.progresso.innerHTML = state.perguntas
        .map((_, i) => `<div class="segmento-barra" id="seg-${i}"><div class="fill-tempo"></div></div>`)
        .join('');
    }
  } catch (e) {
    console.error("Erro ao renderizar barra de progresso:", e);
  }
}

function adicionarNovaPergunta(p, comAnimacao = true) {
  try {
    if (!p) throw new Error("Objeto de pergunta inválido/nulo");

    state.respondido = false;
    state.srsStartTime = Date.now();
    state.animandoTroca = false;

    if(els.contador) els.contador.innerText = `${state.indiceAtual + 1} / ${state.perguntas.length}`;

    const opcoesEmb = embaralhar([...p.opcoes]);
    const novoCard = document.createElement('div');
    novoCard.className = 'card-quiz'; 

    novoCard.innerHTML = `
      <div style="font-size:0.65rem; text-transform:uppercase; opacity:0.5; margin-bottom:4px; font-weight:800; letter-spacing:1px; text-align:center;">
          ${p.categoria || 'Geral'}
      </div>
      <div class="pergunta">${p.enunciado || 'Enunciado indisponível'}</div>
      <div class="lista-opcoes">
          ${opcoesEmb.map((op, i) => `
              <div class="opcao-wrapper">
                  <div class="opcao" data-is-correct="${op.correta}" onclick="window.verificarResposta(${i}, this)">
                      ${op.texto}
                  </div>
              </div>`).join('')}
      </div>
      <div class="area-dica-container">
          ${p.dica ? `<button class="btn-dica-minimal" onclick="window.mostrarDica(this, '${(p.dica || '').replace(/'/g, "\\'")}')">💡 Dica</button>` : ''}
          <div class="texto-dica-placeholder"></div>
      </div>
      <button id="btn-prox" style="display:none; margin-top:15px; width:100%; padding:12px;" onclick="window.transicaoProximaPergunta()">Próxima Questão ➜</button>
    `;

    // [ANIMAÇÃO]
    if (comAnimacao && els.stage) {
      novoCard.classList.add('pre-render-direita');
      const cardAntigo = els.stage.querySelector('.card-quiz.ativo');
      
      els.stage.appendChild(novoCard);
      // void novoCard.offsetWidth; // Força Reflow (pode lançar erro se elemento não renderizado, try catch protege)
      
      if (cardAntigo) {
        cardAntigo.classList.replace('ativo', 'saindo-esquerda');
        setTimeout(() => {
          try { if (cardAntigo) cardAntigo.remove(); } 
          catch(e) { console.error("Erro ao remover card antigo:", e); }
        }, 500);
      }
      
      requestAnimationFrame(() => {
          novoCard.classList.replace('pre-render-direita', 'ativo');
      });
    } else {
      novoCard.classList.add('ativo');
      if (els.stage) {
          els.stage.innerHTML = '';
          els.stage.appendChild(novoCard);
      }
    }

    if (state.modoJogo !== 'treino') {
      iniciarTimer();
      animarBarraAtual();
    }
  } catch (e) {
    console.error("Erro ao adicionar nova pergunta:", e, p);
  }
}

function animarBarraAtual() {
  try {
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
  } catch (e) {
    console.error("Erro na animação da barra:", e);
  }
}

function iniciarTimer() {
  try {
    if (!els.tempo) return;
    
    state.tempoRestante = state.tempoTotal;
    clearInterval(state.timerInterval);
    els.tempo.innerText = `⏱️ ${state.tempoRestante}s`;
    
    state.timerInterval = setInterval(() => {
      try {
        state.tempoRestante--;
        if (els.tempo) els.tempo.innerText = `⏱️ ${state.tempoRestante}s`;
        
        if (state.tempoRestante <= 0) {
          clearInterval(state.timerInterval);
          if (state.modoJogo === 'desafio') {
            gameOverDesafio('Tempo Esgotado!');
          } else {
            verificarRespostaInternal(-1, null);
          }
        }
      } catch (timerErr) {
        console.error("Erro dentro do intervalo do timer:", timerErr);
        clearInterval(state.timerInterval);
      }
    }, 1000);
  } catch (e) {
    console.error("Erro ao iniciar timer:", e);
  }
}

// =======================
// 4. AÇÕES
// =======================

function verificarRespostaInternal(index, el) {
  try {
    if (state.respondido) return;
    
    const durationSec = (Date.now() - state.srsStartTime) / 1000;
    state.respondido = true;
    clearInterval(state.timerInterval);

    // Congela a barra de tempo
    if (state.modoJogo !== 'treino') {
      try {
        const idAlvo = state.modoJogo === 'desafio' ? 'seg-unico' : `seg-${state.indiceAtual}`;
        const seg = document.getElementById(idAlvo);
        if (seg) {
            const fill = seg.querySelector('.fill-tempo');
            if(fill) {
                fill.style.width = window.getComputedStyle(fill).width;
                fill.style.transition = 'none';
            }
        }
      } catch (styleErr) {
        console.error("Erro ao congelar barra de tempo:", styleErr);
      }
    }

    const card = document.querySelector('.card-quiz.ativo');
    if(!card) return;
    
    const opcoes = card.querySelectorAll('.opcao');
    let acertou = false;

    opcoes.forEach((opt) => {
      try {
        opt.classList.add('bloqueado');
        const isCorrect = opt.getAttribute('data-is-correct') === 'true';
        if (isCorrect) {
          opt.classList.add('correta');
          if (opt === el) acertou = true;
        } else if (opt === el) {
          opt.classList.add('errada');
        }
      } catch (optErr) {
        console.error("Erro ao processar estilo das opções:", optErr);
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

  } catch (e) {
    console.error("Erro ao verificar resposta:", e);
  }
}

function mostrarDicaInternal(btn, texto) {
  try {
    if (state.dicasRestantes <= 0) return;
    state.dicasRestantes--;
    btn.disabled = true;
    btn.innerHTML = `💡 Dica (${state.dicasRestantes})`;
    
    const area = document.querySelector('.card-quiz.ativo .texto-dica-placeholder');
    if(area) area.innerHTML = `<div class="box-dica-texto">${texto}</div>`;
  } catch (e) {
    console.error("Erro ao mostrar dica:", e);
  }
}

function transicaoProximaPerguntaInternal() {
  try {
    if (state.animandoTroca) return;
    state.animandoTroca = true;

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
  } catch (e) {
    console.error("Erro na transição de pergunta:", e);
  }
}

// =======================
// 5. TELAS FINAIS & SISTEMA DE SALVAMENTO
// =======================

function enviarPontuacaoInternal() {
  try {
    const input = document.getElementById('input-nome-jogador');
    if (!input) return;
    
    const nome = input.value.trim();
    if (nome.length < 3) {
        alert("Por favor, digite um nome com pelo menos 3 letras.");
        return;
    }

    console.log(`Salvando pontuação: ${nome} - ${state.pontuacaoTotal}pts`);
    
    const btn = document.getElementById('btn-salvar-final');
    if(btn) {
        btn.innerHTML = "✅ Salvo!";
        btn.disabled = true;
        input.disabled = true;
    }
    
    alert(`Pontuação de ${nome} salva com sucesso!`);
  } catch (e) {
    console.error("Erro ao enviar pontuação:", e);
    alert("Erro ao salvar pontuação. Veja o console.");
  }
}

function gameOverDesafio(motivo) {
  try {
    if (els.stage) {
        els.stage.innerHTML = `
          <div class="card-quiz ativo anime-entrada" style="text-align:center; border: 2px solid var(--error);">
              <h2 style="font-size:3rem;">☠️</h2>
              <h3 style="color:var(--error);">${motivo}</h3>
              <p>Fim de jogo.</p>
              <p>Pontuação Final: <strong>${state.pontuacaoTotal}</strong></p>
              <button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer; margin-top:20px;">Tentar Novamente</button>
              <br><br>
              <a href="index.html" style="color:#666; text-decoration:none;">Voltar ao Menu</a>
          </div>`;
    }
    ocultarHUD();
  } catch (e) {
    console.error("Erro ao exibir Game Over:", e);
  }
}

function mostrarFimTreino() {
  try {
    if (els.stage) {
        els.stage.innerHTML = `
          <div class="card-quiz ativo anime-entrada" style="text-align:center;">
            <h2 style="color:#4f46e5;">✅ Treino Concluído!</h2>
            <p style="margin:20px 0;">Você revisou todas as cartas pendentes.</p>
            <a href="index.html"><button style="background:#4f46e5; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">Voltar ao Menu</button></a>
          </div>`;
    }
    ocultarHUD();
  } catch (e) {
    console.error("Erro ao mostrar fim de treino:", e);
  }
}

function mostrarResultadoFinal() {
  try {
    const porcentagem = (state.acertos / state.perguntas.length);
    const win = porcentagem >= 0.5; // [CRITÉRIO DE 50%]
    
    ocultarHUD();
    
    if (els.stage) {
        els.stage.innerHTML = `
          <div class="card-quiz ativo anime-entrada" style="text-align:center;">
              <h2>${win ? 'Parabéns!' : 'Que pena!'}</h2>
              <div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">
                  ${state.pontuacaoTotal} <span style="font-size:1.5rem">pts</span>
              </div>
              <p style="font-weight:600;">Você acertou ${state.acertos} de ${state.perguntas.length} questões</p>
              
              <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
              
              <h3>Salvar no Ranking</h3>
              <p style="font-size:0.8rem; color:#666;">Apenas letras (acentos permitidos)</p>
              
              <input type="text" id="input-nome-jogador" maxlength="10" placeholder="seu nome" 
                    style="width: 80%; padding: 10px; border-radius: 8px; border: 1px solid #ccc; margin-bottom: 10px; text-transform: lowercase; text-align: center;" 
                    oninput="this.value = this.value.toLowerCase().replace(/[^a-zà-úç]/g, '')">
              
              <button id="btn-salvar-final" onclick="window.enviarPontuacao()" 
                      style="background:#2563eb; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; margin-top:10px;">
                      💾 Salvar Conquista
              </button>
              
              <button onclick="location.reload()" style="background:transparent; border:1px solid #ccc; padding:10px; width:100%; margin-top:10px; border-radius:12px; cursor:pointer;">
                  Voltar ao Menu
              </button>
          </div>`;
    }
    if (win) dispararConfete();
  } catch (e) {
    console.error("Erro ao mostrar resultado final:", e);
  }
}

function ocultarHUD() {
  try {
    if(els.tempo) els.tempo.style.display = 'none';
    if(els.contador) els.contador.style.display = 'none';
    if(els.progresso) els.progresso.style.display = 'none';
  } catch (e) {
    console.error("Erro ao ocultar HUD:", e);
  }
}

function dispararConfete() {
  try {
    if(!els.confete) return;
    const ctx = els.confete.getContext('2d');
    els.confete.width = window.innerWidth;
    els.confete.height = window.innerHeight;
    const p = Array.from({length:120}, () => ({x:Math.random()*els.confete.width, y:-20, c:['#ff0', '#0f0', '#00f', '#f0f', '#0ff', '#fff'][Math.floor(Math.random() * 6)], s:2+Math.random()*3}));
    
    function draw(){
      try {
        ctx.clearRect(0,0,els.confete.width,els.confete.height);
        p.forEach(k => {
          ctx.fillStyle=k.c; 
          ctx.fillRect(k.x,k.y+=k.s,5,5); 
          if(k.y>els.confete.height)k.y=-20;
        });
        if(els.confete.width > 0) requestAnimationFrame(draw);
      } catch (drawErr) {
        console.error("Erro no loop de animação de confete:", drawErr);
      }
    }
    draw();
    setTimeout(() => { els.confete.width = 0; }, 5000);
  } catch (e) {
    console.error("Erro ao iniciar confetes:", e);
  }
}

// Inicia
init();
