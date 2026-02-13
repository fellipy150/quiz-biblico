// =========================================
//  GAME CONTROLLER (DEBUG VERSION)
// =========================================
console.log("🚀 [GAME] 1. Arquivo game.js começou a ser lido.");

try {
    // Tenta importar. Se falhar aqui, o erro será silencioso ou crítico no console do navegador.
    // Não tem como dar try-catch em import estático (ESM), mas saberemos se passou daqui pelo log abaixo.
    var Engine = await import('./engine.js'); // Usando dynamic import para poder pegar erro se quiser, ou mantenha estatico
    // Voltando para estático para manter padrão Vite, mas assumindo que funcionou se o log "Imports OK" aparecer.
} catch (e) {
    console.error("❌ [GAME] CRÍTICO: Falha ao importar dependências ou sintaxe inválida!", e);
}

import { embaralhar, converterMarkdownSimples, parseMarkdownQuiz, extrairPerguntasMass } from './engine.js';
import { getSRSData, processarSRS, resetarMemoriaSRS } from './srs.js';

console.log("✅ [GAME] 2. Imports concluídos com sucesso.");

// --- Utilitário de Caminho ---
const getAssetPath = (path) => {
    try {
        const base = import.meta.env.BASE_URL;
        const fullPath = `${base}/${path}`.replace(/\/+/g, '/');
        // console.log(`🔍 [GAME] Gerando caminho asset: ${fullPath}`); // Descomente se quiser muito detalhe
        return fullPath;
    } catch (e) {
        console.error("❌ [GAME] Erro ao gerar caminho do asset:", e);
        return path;
    }
};

// --- Cache de Elementos DOM com Verificação ---
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`⚠️ [GAME] Elemento DOM não encontrado: #${id}`);
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

// --- Estado ---
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
// 🚨 EXPOSIÇÃO GLOBAL (Onde costuma dar erro)
// ============================================
console.log("🔄 [GAME] 3. Tentando expor funções para o window...");

try {
    // Definindo as funções no window explicitamente
    window.iniciarJogo = function(modo) {
        console.log(`🖱️ [CLICK] iniciarJogo chamado. Modo: ${modo}`);
        iniciarJogoInternal(modo);
    };

    window.iniciarModoTreino = function() {
        console.log("🖱️ [CLICK] iniciarModoTreino chamado.");
        iniciarModoTreinoInternal();
    };

    window.verificarResposta = function(index, el) {
        // console.log("🖱️ [CLICK] verificarResposta chamado.");
        verificarRespostaInternal(index, el);
    };

    window.mostrarDica = function(btn, texto) {
        console.log("🖱️ [CLICK] mostrarDica chamado.");
        mostrarDicaInternal(btn, texto);
    };

    window.transicaoProximaPergunta = function() {
        console.log("🖱️ [CLICK] transicaoProximaPergunta chamado.");
        transicaoProximaPerguntaInternal();
    };

    window.resetarMemoriaSRS = resetarMemoriaSRS;

    console.log("✅ [GAME] 4. Funções globais registradas com sucesso! (window.iniciarJogo existe)");
} catch (e) {
    console.error("❌ [GAME] CRÍTICO: Erro ao expor funções no window:", e);
}

// =======================
// INICIALIZAÇÃO
// =======================

export function init() {
    console.log("🚀 [GAME] 5. Executando init()...");
    try {
        carregarListaQuizes();
        verificarParametrosURL();
    } catch (e) {
        console.error("❌ [GAME] Erro dentro de init():", e);
    }
}

function carregarListaQuizes() {
    if (!els.lista) {
        console.warn("⚠️ [GAME] Abortando carregarListaQuizes: Elemento lista não existe.");
        return;
    }

    const url = getAssetPath('quizes/index.json');
    console.log(`📡 [GAME] Fetching lista de quizes: ${url}`);

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`Status ${res.status}`);
            return res.json();
        })
        .then(dados => {
            console.log("✅ [GAME] Lista de quizes carregada:", dados);
            els.lista.innerHTML = dados
                .map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`)
                .join('');
        })
        .catch(err => {
            console.error("❌ [GAME] Falha no fetch da lista:", err);
            els.lista.innerHTML = '<p style="text-align:center;">Erro ao carregar lista (ver console).</p>';
        });
}

function verificarParametrosURL() {
    try {
        if (!els.stage) return;
        const params = new URLSearchParams(window.location.search);
        const idQuiz = params.get('id');

        if (idQuiz) {
            console.log(`🔍 [GAME] ID detectado na URL: ${idQuiz}`);
            const urlQuiz = getAssetPath(`quizes/${idQuiz}.md`);
            
            fetch(urlQuiz)
                .then(res => {
                    if (!res.ok) throw new Error(`Quiz 404: ${urlQuiz}`);
                    return res.text();
                })
                .then(text => {
                    console.log("✅ [GAME] Markdown baixado. Iniciando parse...");
                    const dados = parseMarkdownQuiz(text);
                    
                    if (!dados || !dados.perguntas || dados.perguntas.length === 0) {
                        throw new Error("Parser retornou 0 perguntas.");
                    }

                    if (els.titulo) els.titulo.innerText = dados.titulo || 'Quiz';
                    if (els.descricao && dados.descricao) {
                        els.descricao.innerHTML = dados.descricao;
                        els.descricao.style.display = 'block';
                    }

                    state.perguntas = dados.perguntas;
                    console.log(`✅ [GAME] ${state.perguntas.length} perguntas carregadas no State.`);

                    if(els.selecao) els.selecao.style.display = 'flex';
                    if(els.stage) els.stage.style.display = 'none';
                })
                .catch(err => {
                    console.error("❌ [GAME] Erro ao carregar/parsear Quiz:", err);
                    if (els.titulo) els.titulo.innerText = "Erro ao carregar";
                    els.stage.innerHTML = `<p style="text-align:center; color:red">Erro: ${err.message}</p>`;
                    els.stage.style.display = 'block';
                });
        }
    } catch (e) {
        console.error("❌ [GAME] Erro fatal em verificarParametrosURL:", e);
    }
}

// =======================
// LÓGICA INTERNA (Renomeada para evitar conflito)
// =======================

async function iniciarModoTreinoInternal() {
    console.log("🏋️ [GAME] Iniciando lógica Modo Treino...");
    if(els.titulo) els.titulo.innerText = "Carregando Memória...";
    if(els.lista) els.lista.style.display = 'none';
    if(els.selecao) els.selecao.style.display = 'none';

    try {
        const urlIndex = getAssetPath('quizes/index.json');
        const resIndex = await fetch(urlIndex);
        const quizList = await resIndex.json();
        
        let todasAsQuestoes = [];
        
        console.log(`📦 [GAME] Baixando ${quizList.length} arquivos para o treino...`);

        const promises = quizList.map(async (q) => {
            const urlMd = getAssetPath(`quizes/${q.arquivo}.md?t=${Date.now()}`);
            const res = await fetch(urlMd); 
            if(!res.ok) {
                console.warn(`⚠️ [GAME] Falha ao baixar ${q.arquivo} para treino.`);
                return [];
            }
            const text = await res.text();
            return extrairPerguntasMass(text, q.arquivo); 
        });

        const resultadosArrays = await Promise.all(promises);
        resultadosArrays.forEach(arr => todasAsQuestoes.push(...arr));

        console.log(`📚 [GAME] Total de questões parseadas: ${todasAsQuestoes.length}`);

        const srsDb = getSRSData();
        const now = Date.now();
        const DAY_MS = 86400000;

        const questoesDue = todasAsQuestoes.filter(p => {
            const entry = srsDb[p.id];
            if (!entry) return true;
            return now >= entry.lastReviewed + (entry.interval * DAY_MS);
        });

        console.log(`📅 [GAME] Questões pendentes (Due): ${questoesDue.length}`);

        if (questoesDue.length === 0) {
            alert("🎉 Tudo em dia! Volte amanhã.");
            location.reload();
            return;
        }

        state.perguntas = embaralhar(questoesDue).slice(0, 50);
        iniciarJogoInternal('treino');

    } catch (err) {
        console.error("❌ [GAME] ERRO FATAL NO MODO TREINO:", err);
        alert("Erro ao iniciar treino. Veja o console.");
        location.reload(); 
    }
}

function iniciarJogoInternal(modo) {
    try {
        console.log(`🎮 [GAME] Configurando jogo para modo: ${modo}`);
        state.modoJogo = modo;
        state.indiceAtual = 0;
        state.acertos = 0;
        state.pontuacaoTotal = 0;
        
        // Expondo pontuação para o ranking
        window.pontuacaoTotal = 0;
        window.modoJogo = modo;

        if(els.selecao) els.selecao.style.display = 'none';
        if(els.stage) els.stage.style.display = 'grid';
        if(els.titulo) els.titulo.style.display = 'block';

        if (state.perguntas.length === 0) {
            throw new Error("Array de perguntas está vazio ao tentar iniciar jogo.");
        }
        
        adicionarNovaPergunta(state.perguntas[0], false);
    } catch (e) {
        console.error("❌ [GAME] Erro em iniciarJogoInternal:", e);
        alert("Erro ao iniciar a partida.");
    }
}

function adicionarNovaPergunta(p, comAnimacao) {
    try {
        if (!p) throw new Error("Objeto pergunta inválido/undefined");

        state.respondido = false;
        state.srsStartTime = Date.now();
        
        if(els.contador) els.contador.innerText = `${state.indiceAtual + 1} / ${state.perguntas.length}`;

        const opcoesEmb = embaralhar([...p.opcoes]);
        
        // Criação do HTML
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
            <div class="area-dica-container">
                ${p.dica ? `<button class="btn-dica-minimal" onclick="window.mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">💡 Dica</button>` : ''}
                <div class="texto-dica-placeholder"></div>
            </div>
            <button id="btn-prox" style="display:none; margin-top:15px; padding:10px; width:100%;" onclick="window.transicaoProximaPergunta()">Próxima ➜</button>
        `;

        if (!els.stage) throw new Error("Stage element missing");
        els.stage.innerHTML = '';
        els.stage.appendChild(novoCard);
        
        // Timer (Simplificado para debug)
        if(modo !== 'treino') iniciarTimerDebug();

    } catch (e) {
        console.error("❌ [GAME] Erro ao renderizar pergunta:", e);
    }
}

function iniciarTimerDebug() {
    // Implementação simples para evitar erros de timer agora
    // console.log("Timer iniciado (mock)");
}

function verificarRespostaInternal(index, el) {
    try {
        if (state.respondido) return;
        state.respondido = true;
        
        const acertou = el && el.getAttribute('data-is-correct') === 'true';
        console.log(`📝 [GAME] Resposta: ${acertou ? 'ACERTOU' : 'ERROU'}`);

        if (acertou) {
            el.classList.add('correta');
            state.acertos++;
            state.pontuacaoTotal += 10;
            window.pontuacaoTotal = state.pontuacaoTotal;
        } else if (el) {
            el.classList.add('errada');
        }

        // Mostra botão próxima
        const btn = document.getElementById('btn-prox');
        if(btn) btn.style.display = 'block';

        // SRS Logic se for treino
        if (state.modoJogo === 'treino') {
             const duration = (Date.now() - state.srsStartTime) / 1000;
             const pAtual = state.perguntas[state.indiceAtual];
             processarSRS(pAtual.id, acertou, duration);
        }

    } catch (e) {
        console.error("❌ [GAME] Erro em verificarResposta:", e);
    }
}

function mostrarDicaInternal(btn, texto) {
    try {
        btn.disabled = true;
        const area = document.querySelector('.card-quiz.ativo .texto-dica-placeholder');
        if(area) area.innerHTML = `<div class="box-dica-texto">${texto}</div>`;
    } catch(e) {
        console.error("Erro na dica:", e);
    }
}

function transicaoProximaPerguntaInternal() {
    try {
        state.indiceAtual++;
        if (state.indiceAtual >= state.perguntas.length) {
            console.log("🏁 [GAME] Fim do Quiz.");
            els.stage.innerHTML = `
                <div class="card-quiz ativo" style="text-align:center;">
                    <h2>Fim!</h2>
                    <h1>${state.pontuacaoTotal} pts</h1>
                    <button onclick="location.reload()">Menu</button>
                </div>
            `;
        } else {
            adicionarNovaPergunta(state.perguntas[state.indiceAtual], true);
        }
    } catch (e) {
        console.error("❌ [GAME] Erro na transição:", e);
    }
}

// Inicia
init();
