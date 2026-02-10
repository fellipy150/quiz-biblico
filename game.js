// =========================================
//  GAME.JS - Lógica de Jogo e Interface
// =========================================

// Elementos da Interface
const listaEl = document.getElementById("lista-quizes");
const quizStage = document.getElementById("quiz-stage");
const barraProgressoEl = document.getElementById("barra-progresso-container");
const tituloEl = document.getElementById("titulo-quiz");
const displayTempoEl = document.getElementById("display-tempo");
const telaSelecaoEl = document.getElementById("tela-selecao");

// Estado Global (Compartilhado com ranking.js via objeto window)
window.perguntas = [];
window.indiceAtual = 0;
window.acertos = 0;
window.modoJogo = null;

let respondido = false;
let dicasRestantes = 2;
let tempoTotal = 30;
let tempoRestante = tempoTotal;
let timerInterval;

// =======================
// UTILS
// =======================
function embaralhar(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// =======================
// INICIALIZAÇÃO
// =======================

// Carrega a lista de quizzes na index.html
if (listaEl) {
    fetch("quizes/index.json")
        .then(res => res.json())
        .then(dados => {
            listaEl.innerHTML = dados.map(q => `
                <li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>
            `).join("");
        })
        .catch(err => console.error("Erro ao carregar lista:", err));
}

// Inicializa o conteúdo do quiz se estiver na página de quiz
if (quizStage) {
    const params = new URLSearchParams(window.location.search);
    const idQuiz = params.get("id");

    if (idQuiz) {
        fetch(`quizes/${idQuiz}.md`)
            .then(res => res.text())
            .then(text => {
                processarMarkdown(text);
                // Exibe a tela de seleção de modo e oculta o resto
                if (telaSelecaoEl) telaSelecaoEl.style.display = "flex";
                if (quizStage) quizStage.style.display = "none";
            })
            .catch(err => {
                console.error(err);
                quizStage.innerHTML = "<p>Erro ao carregar o treinamento.</p>";
                quizStage.style.display = "block";
            });
    } else {
        window.location.href = "index.html";
    }
}

// =======================
// PARSER DE MARKDOWN
// =======================
function processarMarkdown(md) {
    const linhas = md.replace(/\r\n/g, "\n").split("\n");
    
    // Título do Quiz
    const tituloRaw = linhas.find(l => l.startsWith("# "));
    if (tituloEl && tituloRaw) tituloEl.innerText = tituloRaw.replace("# ", "").trim();

    // Divisão por Grupos (---)
    const gruposRaw = md.split(/^---$/gm);
    let todasOrdenadas = [];

    gruposRaw.forEach(grupoTexto => {
        const blocos = grupoTexto.split(/^## /gm).slice(1);
        let perguntasGrupo = blocos.map(bloco => {
            const lines = bloco.trim().split("\n");
            const enunciado = lines[0].trim();
            const opcoes = [];
            let dica = null;

            lines.slice(1).forEach(linha => {
                const l = linha.trim();
                if (l.startsWith("[x]")) {
                    opcoes.push({ texto: l.replace("[x]", "").trim(), correta: true });
                } else if (l.startsWith("[ ]")) {
                    opcoes.push({ texto: l.replace("[ ]", "").trim(), correta: false });
                } else if (l.startsWith("-#")) {
                    dica = l.replace("-#", "").trim();
                }
            });
            return { enunciado, opcoes, dica };
        });
        // Embaralha as perguntas dentro de cada grupo antes de adicionar à lista principal
        todasOrdenadas = todasOrdenadas.concat(embaralhar(perguntasGrupo));
    });
    window.perguntas = todasOrdenadas;
}

// =======================
// CONTROLE DO JOGO
// =======================
window.iniciarJogo = function(modo) {
    window.modoJogo = modo;
    window.indiceAtual = 0;
    window.acertos = 0;
    dicasRestantes = 2;
    tempoTotal = modo === 'desafio' ? 15 : 30;
    
    if(modo === 'desafio') document.body.classList.add('modo-desafio');
    
    telaSelecaoEl.style.display = "none";
    quizStage.style.display = "grid";
    barraProgressoEl.style.display = "flex";
    
    renderizarBarraProgresso();
    adicionarNovaPergunta(window.perguntas[0], false);
}

function renderizarBarraProgresso() {
    barraProgressoEl.innerHTML = window.perguntas.map((_, i) => `
        <div class="segmento-barra" id="seg-${i}">
            <div class="fill-tempo"></div>
        </div>`).join("");
}

function adicionarNovaPergunta(p, comAnimacao = true) {
    respondido = false;
    displayTempoEl.style.display = "block";

    const opcoesEmb = embaralhar([...p.opcoes]);
    const novoCard = document.createElement('div');
    novoCard.className = 'card-quiz';
    
    novoCard.innerHTML = `
        <div class="pergunta">${p.enunciado}</div>
        <div class="lista-opcoes">
            ${opcoesEmb.map((op, i) => `
                <div class="opcao" data-is-correct="${op.correta}" onclick="verificarResposta(${i}, this)">
                    ${op.texto}
                </div>`).join("")}
        </div>
        <div class="area-dica-container">
            ${p.dica ? `
                <button class="btn-dica-minimal" ${dicasRestantes <= 0 ? 'disabled' : ''} 
                        onclick="mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">
                    💡 Ver Dica <span class="contador-dica">${dicasRestantes}</span>
                </button>` : ''}
            <div class="texto-dica-placeholder"></div>
        </div>
        <button id="btn-prox" onclick="transicaoProximaPergunta()">Próxima Pergunta ➜</button>
    `;

    if (comAnimacao) {
        novoCard.classList.add('pre-render-direita');
        const cardAntigo = quizStage.querySelector('.card-quiz.ativo');
        quizStage.appendChild(novoCard);
        
        void novoCard.offsetWidth; // Force Reflow
        
        if (cardAntigo) {
            cardAntigo.classList.replace('ativo', 'saindo-esquerda');
            setTimeout(() => cardAntigo.remove(), 500);
        }
        novoCard.classList.replace('pre-render-direita', 'ativo');
    } else {
        novoCard.classList.add('ativo');
        quizStage.appendChild(novoCard);
    }

    iniciarTimer();
    const fill = document.getElementById(`seg-${window.indiceAtual}`).querySelector(".fill-tempo");
    fill.style.transition = `width ${tempoTotal}s linear`;
    void fill.offsetWidth;
    fill.style.width = "100%";
}

// =======================
// TIMER E RESPOSTAS
// =======================
function iniciarTimer() {
    tempoRestante = tempoTotal;
    clearInterval(timerInterval);
    displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
    
    timerInterval = setInterval(() => {
        tempoRestante--;
        displayTempoEl.innerText = `⏱️ ${tempoRestante}s`;
        if (tempoRestante <= 0) {
            clearInterval(timerInterval);
            if (window.modoJogo === 'desafio') gameOverDesafio("Tempo esgotado!");
            else verificarResposta(-1, null);
        }
    }, 1000);
}

window.verificarResposta = function(index, el) {
    if (respondido) return;
    respondido = true;
    clearInterval(timerInterval);

    // Congelar a barra de progresso
    const seg = document.getElementById(`seg-${window.indiceAtual}`);
    const fill = seg.querySelector(".fill-tempo");
    fill.style.width = window.getComputedStyle(fill).width;
    fill.style.transition = "none";

    const card = document.querySelector('.card-quiz.ativo');
    const opcoes = card.querySelectorAll('.opcao');
    let acertou = false;

    opcoes.forEach((opt, i) => {
        opt.classList.add('bloqueado');
        const isCorrect = opt.getAttribute('data-is-correct') === "true";
        if (isCorrect) {
            opt.classList.add('correta');
            if (i === index) acertou = true;
        } else if (i === index) opt.classList.add('errada');
    });

    if (window.modoJogo === 'desafio' && !acertou) {
        setTimeout(() => gameOverDesafio("Você errou!"), 800);
        return;
    }

    if (acertou) window.acertos++;
    seg.classList.add(acertou ? 'correto' : 'errado');
    card.querySelector("#btn-prox").style.display = "block";
};

window.mostrarDica = function(btn, texto) {
    if (dicasRestantes <= 0) return;
    dicasRestantes--;
    btn.disabled = true;
    btn.innerHTML = `💡 Dica <span class="contador-dica">${dicasRestantes}</span>`;
    const area = document.querySelector('.card-quiz.ativo .texto-dica-placeholder');
    area.innerHTML = `<div class="box-dica-texto">${texto}</div>`;
}

window.transicaoProximaPergunta = function() {
    window.indiceAtual++;
    if (window.indiceAtual >= window.perguntas.length) mostrarResultadoFinal();
    else adicionarNovaPergunta(window.perguntas[window.indiceAtual], true);
};

// =======================
// FIM DE JOGO
// =======================
function gameOverDesafio(motivo) {
    clearInterval(timerInterval);
    quizStage.innerHTML = `
        <div class="card-quiz ativo anime-entrada" style="text-align:center; border: 2px solid var(--error);">
            <h2 style="font-size:3rem;">☠️</h2>
            <h3 style="color:var(--error);">${motivo}</h3>
            <p>No Modo Desafio, erros não são permitidos.</p>
            <button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer; margin-top:20px;">Tentar Novamente</button>
        </div>`;
    displayTempoEl.style.display = "none";
}

function mostrarResultadoFinal() {
    const pontos = window.calcularPontosFinais(window.acertos, window.modoJogo);
    const pct = Math.round((window.acertos / window.perguntas.length) * 100);
    const win = window.modoJogo === 'desafio' || pct >= 50;
    
    quizStage.innerHTML = `
        <div class="card-quiz ativo anime-entrada" style="text-align:center;">
            <h2>${win ? 'Parabéns!' : 'Que pena!'}</h2>
            <div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">
                ${window.modoJogo === 'desafio' ? '100%' : pct + '%'}
            </div>
            <p style="font-weight:600;">${window.acertos} de ${window.perguntas.length} acertos</p>
            
            <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
            
            <h3>Salvar no Ranking</h3>
            <p style="font-size:0.8rem; color:#666;">Máximo 10 caracteres</p>
            <input type="text" id="input-nome-jogador" maxlength="10" placeholder="SEU NOME" oninput="this.value = this.value.toUpperCase()">
            
            <button id="btn-salvar-final" onclick="enviarPontuacao()" style="background:#2563eb; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; margin-top:10px;">
                💾 Salvar Score (${pontos} pts)
            </button>
            
            <button onclick="location.reload()" style="background:transparent; border:1px solid #ccc; padding:10px; width:100%; margin-top:10px; border-radius:12px; cursor:pointer;">Voltar ao Menu</button>
        </div>`;
    
    displayTempoEl.style.display = "none";
    if (win) dispararConfete();
}

// =======================
// SISTEMA DE CONFETE
// =======================
function dispararConfete() {
    const canvas = document.getElementById("canvas-confete");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 10 + 5,
        h: Math.random() * 10 + 5,
        color: ['#ff0', '#0f0', '#00f', '#f0f', '#0ff', '#fff'][Math.floor(Math.random() * 6)],
        s: Math.random() * 3 + 2,
        a: Math.random() * 360
    }));

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            p.y += p.s;
            p.a += 0.1;
            if (p.y > canvas.height) p.y = -10;
        });
        if(canvas.width > 0) requestAnimationFrame(draw);
    }
    draw();
    setTimeout(() => canvas.width = 0, 5000);
}
