// =========================================
//  GUARDIÕES DA PALAVRA - CORE SCRIPT V6.1
// =========================================

// 1. CONFIGURAÇÃO SUPABASE (Dados fornecidos)
const SUPABASE_URL = "https://patdjmbjdzjuwdrehfoz.supabase.co";
const SUPABASE_KEY = "sb_publishable_uQJTr6xrNAqfmKnTyNGcMw_S9q1wsXe";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. ELEMENTOS DO DOM
const listaEl = document.getElementById("lista-quizes");
const quizStage = document.getElementById("quiz-stage");
const barraProgressoEl = document.getElementById("barra-progresso-container");
const tituloEl = document.getElementById("titulo-quiz");
const displayTempoEl = document.getElementById("display-tempo");
const telaSelecaoEl = document.getElementById("tela-selecao");

// 3. ESTADO GLOBAL DO JOGO
let perguntas = [];
let indiceAtual = 0;
let acertos = 0;
let respondido = false;
let modoJogo = null; 
let dicasRestantes = 2;
let tempoTotal = 30;
let tempoRestante = tempoTotal;
let timerInterval;

// =========================================
//  LÓGICA DO RANKING (SUPABASE)
// =========================================

function calcularPontosFinais() {
    const multiplicador = modoJogo === 'desafio' ? 1.5 : 1;
    return Math.round(acertos * multiplicador);
}

async function enviarPontuacao() {
    const inputNome = document.getElementById("input-nome-jogador");
    const btnSalvar = document.getElementById("btn-salvar-final");
    const nome = inputNome.value.trim().toUpperCase();
    
    if (!nome || nome.length < 2) {
        alert("Digite um nome ou sigla de pelo menos 2 letras!");
        return;
    }

    btnSalvar.innerText = "Salvando...";
    btnSalvar.disabled = true;

    // Chama a função SQL upsert_ranking que você criou no Supabase
    const { error } = await supabase.rpc('upsert_ranking', {
        p_nome: nome,
        p_pontuacao: calcularPontosFinais(),
        p_modo: modoJogo
    });

    if (error) {
        console.error(error);
        alert("Erro ao salvar. Verifique sua conexão.");
        btnSalvar.innerText = "Tentar Novamente";
        btnSalvar.disabled = false;
    } else {
        alert("🏆 Score salvo com sucesso!");
        window.location.href = "index.html";
    }
}

window.abrirRanking = async function() {
    const modal = document.getElementById("modal-ranking");
    const lista = document.getElementById("lista-ranking-container");
    const loader = document.getElementById("lista-ranking-loader");
    
    if(modal) modal.style.display = "flex";
    if(loader) loader.style.display = "block";
    if(lista) lista.innerHTML = "";

    const { data, error } = await supabase
        .from('ranking')
        .select('*')
        .order('pontuacao', { ascending: false })
        .limit(10);

    if(loader) loader.style.display = "none";

    if (error || !data) {
        lista.innerHTML = "<li>Erro ao carregar ranking.</li>";
    } else {
        lista.innerHTML = data.map((jogador, i) => {
            let medal = `<div class="rank-pos">${i+1}</div>`;
            if (i === 0) medal = "🥇";
            if (i === 1) medal = "🥈";
            if (i === 2) medal = "🥉";
            return `
                <li class="rank-item">
                    <span>${medal} ${jogador.nome}</span>
                    <span>${jogador.pontuacao} pts ${jogador.modo === 'desafio' ? '🔥' : '🛡️'}</span>
                </li>`;
        }).join("");
    }
}

window.fecharRanking = function() {
    document.getElementById("modal-ranking").style.display = "none";
}

// =========================================
//  LÓGICA DO JOGO E QUIZ
// =========================================

function embaralhar(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 1. Carregar lista de quizzes no index.html
if (listaEl) {
    fetch("quizes/index.json")
        .then(res => res.json())
        .then(dados => {
            listaEl.innerHTML = dados.map(q => `<li><a href="quiz.html?id=${q.arquivo}">${q.titulo}</a></li>`).join("");
        });
}

// 2. Inicializar Quiz ao abrir quiz.html
if (quizStage) {
    const params = new URLSearchParams(window.location.search);
    const idQuiz = params.get("id");

    if (idQuiz) {
        fetch(`quizes/${idQuiz}.md`)
            .then(res => res.text())
            .then(text => {
                processarMarkdown(text);
                mostrarSelecaoModo();
            })
            .catch(() => quizStage.innerHTML = "<p>Erro ao carregar arquivo.</p>");
    } else {
        window.location.href = "index.html";
    }
}

function processarMarkdown(md) {
    const linhas = md.replace(/\r\n/g, "\n").split("\n");
    const tituloRaw = linhas.find(l => l.startsWith("# "));
    if (tituloEl && tituloRaw) tituloEl.innerText = tituloRaw.replace("# ", "").trim();

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
                if (l.startsWith("[x]")) opcoes.push({ texto: l.replace("[x]", "").trim(), correta: true });
                else if (l.startsWith("[ ]")) opcoes.push({ texto: l.replace("[ ]", "").trim(), correta: false });
                else if (l.startsWith("-#")) dica = l.replace("-#", "").trim();
            });
            return { enunciado, opcoes, dica };
        });
        todasOrdenadas = todasOrdenadas.concat(embaralhar(perguntasGrupo));
    });
    perguntas = todasOrdenadas;
}

function mostrarSelecaoModo() {
    telaSelecaoEl.style.display = "flex";
    quizStage.style.display = "none";
}

window.iniciarJogo = function(modo) {
    modoJogo = modo;
    indiceAtual = 0; acertos = 0; dicasRestantes = 2;
    tempoTotal = modo === 'desafio' ? 15 : 30;
    
    if(modo === 'desafio') document.body.classList.add('modo-desafio');
    
    telaSelecaoEl.style.display = "none";
    quizStage.style.display = "grid";
    barraProgressoEl.style.display = "flex";
    
    renderizarBarraProgresso();
    adicionarNovaPergunta(perguntas[0], false);
}

function renderizarBarraProgresso() {
    barraProgressoEl.innerHTML = perguntas.map((_, i) => `
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
            ${p.dica ? `<button class="btn-dica-minimal" ${dicasRestantes <= 0 ? 'disabled' : ''} onclick="mostrarDica(this, '${p.dica.replace(/'/g, "\\'")}')">💡 Ver Dica <span class="contador-dica">${dicasRestantes}</span></button>` : ''}
            <div class="texto-dica-placeholder"></div>
        </div>
        <button id="btn-prox" onclick="transicaoProximaPergunta()">Próxima Pergunta ➜</button>
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

    iniciarTimer();
    const fill = document.getElementById(`seg-${indiceAtual}`).querySelector(".fill-tempo");
    fill.style.transition = `width ${tempoTotal}s linear`;
    void fill.offsetWidth;
    fill.style.width = "100%";
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
            if (modoJogo === 'desafio') gameOverDesafio("Tempo esgotado!");
            else verificarResposta(-1, null);
        }
    }, 1000);
}

window.verificarResposta = function(index, el) {
    if (respondido) return;
    respondido = true;
    clearInterval(timerInterval);

    const seg = document.getElementById(`seg-${indiceAtual}`);
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

    if (modoJogo === 'desafio' && !acertou) {
        setTimeout(() => gameOverDesafio("Você errou!"), 800);
        return;
    }

    if (acertou) acertos++;
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
    indiceAtual++;
    if (indiceAtual >= perguntas.length) mostrarResultadoFinal();
    else adicionarNovaPergunta(perguntas[indiceAtual], true);
};

function gameOverDesafio(motivo) {
    clearInterval(timerInterval);
    quizStage.innerHTML = `
        <div class="card-quiz ativo anime-entrada" style="text-align:center; border: 2px solid var(--error);">
            <h2 style="font-size:3rem;">☠️</h2>
            <h3 style="color:var(--error);">${motivo}</h3>
            <p>No Modo Desafio, erros não são permitidos.</p>
            <button onclick="location.reload()" style="background:var(--error); color:white; padding:15px; border-radius:12px; border:none; width:100%; font-weight:bold; cursor:pointer;">Tentar Novamente</button>
        </div>`;
    displayTempoEl.style.display = "none";
}

function mostrarResultadoFinal() {
    const pontos = calcularPontosFinais();
    const pct = Math.round((acertos / perguntas.length) * 100);
    const win = modoJogo === 'desafio' || pct >= 50;
    
    quizStage.innerHTML = `
        <div class="card-quiz ativo anime-entrada" style="text-align:center;">
            <h2>${win ? 'Parabéns!' : 'Que pena!'}</h2>
            <div style="font-size: 3.5rem; color: ${win ? 'var(--brand-green)' : 'var(--error)'}; font-weight:800; margin: 15px 0;">${modoJogo === 'desafio' ? '100%' : pct + '%'}</div>
            <p style="font-weight:600;">${acertos} de ${perguntas.length} acertos</p>
            <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
            <h3>Salvar no Ranking</h3>
            <input type="text" id="input-nome-jogador" maxlength="10" placeholder="SEU NOME" oninput="this.value = this.value.toUpperCase()">
            <button id="btn-salvar-final" onclick="enviarPontuacao()" style="background:#2563eb; color:white; padding:15px; width:100%; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem;">💾 Salvar Score (${pontos} pts)</button>
            <button onclick="location.reload()" style="background:transparent; border:1px solid #ccc; padding:10px; width:100%; margin-top:10px; border-radius:12px; cursor:pointer;">Voltar ao Menu</button>
        </div>`;
    
    displayTempoEl.style.display = "none";
    if (win) dispararConfete();
}

// =========================================
//  SISTEMA DE CONFETE (CANVAS)
// =========================================
function dispararConfete() {
    const canvas = document.getElementById("canvas-confete");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 100 }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 10 + 5, h: Math.random() * 10 + 5,
        color: ['#ff0', '#0f0', '#00f', '#f0f', '#0ff'][Math.floor(Math.random() * 5)],
        s: Math.random() * 3 + 2, a: Math.random() * 360
    }));
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.w, p.h);
            p.y += p.s; p.a += 0.1;
            if (p.y > canvas.height) p.y = -10;
        });
        if(canvas.width > 0) requestAnimationFrame(draw);
    }
    draw();
    setTimeout(() => canvas.width = 0, 5000);
}
