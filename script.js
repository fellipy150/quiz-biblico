// =========================================
//  SCRIPT.JS - Lógica do Quiz Mobile First
// =========================================

// Estado global
let perguntas = [];
let indiceAtual = 0;
let respostasUsuario = [];

// Elementos do DOM
const containerLista = document.getElementById("lista-quizes");
const containerQuiz = document.getElementById("quiz");
const elTitulo = document.getElementById("titulo");
const elResultado = document.getElementById("resultado");

// =======================
// 1. TELA INICIAL (Lista)
// =======================
if (containerLista) {
  fetch("quizes/index.json")
    .then(res => res.json())
    .then(lista => {
      // Limpa lista (loading...)
      containerLista.innerHTML = "";
      
      lista.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `
          <a href="quiz.html?id=${item.arquivo}">
            ${item.titulo}
          </a>`;
        containerLista.appendChild(li);
      });
    })
    .catch(err => {
      console.error(err);
      containerLista.innerHTML = "<li style='text-align:center; color:red'>Erro ao carregar lista.</li>";
    });
}

// =======================
// 2. TELA DO QUIZ
// =======================
if (containerQuiz) {
  const params = new URLSearchParams(window.location.search);
  const quizArquivo = params.get("id"); // mudei de 'quiz' para 'id' pra ficar padrao url

  if (!quizArquivo) {
    alert("Quiz não especificado!");
    window.location.href = "index.html";
  } else {
    carregarQuiz(quizArquivo);
  }
}

async function carregarQuiz(arquivo) {
  try {
    const res = await fetch(`quizes/${arquivo}.md`);
    if (!res.ok) throw new Error("Falha ao abrir arquivo .md");
    
    const texto = await res.text();
    processarMarkdown(texto);
    
    // Inicia o jogo
    renderizarPergunta();
    
  } catch (erro) {
    containerQuiz.innerHTML = `<p style="text-align:center">Erro: ${erro.message}</p>`;
  }
}

// =======================
// 3. PARSER (Lê o Markdown)
// =======================
function processarMarkdown(md) {
  // Normaliza quebras de linha
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  
  // Pega o título (primeira linha com #)
  const tituloRaw = linhas.find(l => l.startsWith("# "));
  if (tituloRaw && elTitulo) {
    elTitulo.innerText = tituloRaw.replace("# ", "").trim();
  }

  // Quebra por blocos de pergunta (##)
  // O slice(1) remove o conteúdo antes da primeira pergunta
  const blocos = md.split(/^## /gm).slice(1);

  perguntas = blocos.map(bloco => {
    const lines = bloco.trim().split("\n");
    const enunciado = lines[0].trim();
    
    const opcoes = [];
    let indiceCorreto = 0;
    
    // Filtra apenas linhas que começam com - (opções)
    let contadorOpcoes = 0;
    lines.slice(1).forEach(linha => {
      if (linha.trim().startsWith("- ")) {
        let texto = linha.replace("- ", "").trim();
        
        // Verifica se é a correta (tem * no final)
        if (texto.endsWith("*")) {
          indiceCorreto = contadorOpcoes;
          texto = texto.slice(0, -1).trim(); // Remove o asterisco
        }
        
        opcoes.push(texto);
        contadorOpcoes++;
      }
    });

    return { enunciado, opcoes, correta: indiceCorreto };
  });
}

// =======================
// 4. RENDERIZAÇÃO (UI)
// =======================
function renderizarPergunta() {
  // Se acabou as perguntas, mostra resultado
  if (indiceAtual >= perguntas.length) {
    finalizarQuiz();
    return;
  }

  const p = perguntas[indiceAtual];
  
  // Barra de progresso simples (texto)
  const progresso = `<p style="color:#666; font-size:0.9rem; margin-bottom:10px;">
    Pergunta ${indiceAtual + 1} de ${perguntas.length}
  </p>`;

  let htmlOpcoes = "";
  p.opcoes.forEach((op, index) => {
    // Note o onclick="selecionar(this)" para dar feedback visual
    htmlOpcoes += `
      <label class="opcao" id="op-${index}" onclick="marcarOpcao(${index})">
        <input type="radio" name="resposta" value="${index}">
        <span>${op}</span>
      </label>
    `;
  });

  containerQuiz.innerHTML = `
    ${progresso}
    <div class="pergunta">${p.enunciado}</div>
    <div class="lista-opcoes">${htmlOpcoes}</div>
    
    <button id="btn-prox" onclick="proxima()" disabled style="opacity: 0.5; cursor: not-allowed;">
      Próxima Pergunta
    </button>
  `;
}

// =======================
// 5. INTERAÇÃO
// =======================
let respostaTemporaria = null;

// Chamada quando clica no label da opção
window.marcarOpcao = function(index) {
  // Remove classe visual de todos
  document.querySelectorAll('.opcao').forEach(el => {
    el.classList.remove('selecionada');
    el.style.borderColor = "transparent";
    el.style.background = "#ffffff";
  });

  // Adiciona na atual
  const selecionado = document.getElementById(`op-${index}`);
  if (selecionado) {
    selecionado.classList.add('selecionada');
    // Força estilo via JS para garantir compatibilidade
    selecionado.style.borderColor = "#10b981"; 
    selecionado.style.background = "#ecfdf5";
  }

  // Habilita botão
  const btn = document.getElementById("btn-prox");
  btn.disabled = false;
  btn.style.opacity = "1";
  btn.style.cursor = "pointer";

  respostaTemporaria = index;
}

window.proxima = function() {
  if (respostaTemporaria === null) return;
  
  respostasUsuario.push(respostaTemporaria);
  respostaTemporaria = null; // Reset
  indiceAtual++;
  renderizarPergunta();
}

// =======================
// 6. RESULTADO FINAL
// =======================
function finalizarQuiz() {
  let acertos = 0;
  perguntas.forEach((p, i) => {
    if (p.correta === respostasUsuario[i]) {
      acertos++;
    }
  });

  const porcentagem = Math.round((acertos / perguntas.length) * 100);
  
  let mensagem = "";
  let cor = "";
  
  if (porcentagem === 100) {
    mensagem = "Perfeito! Você é um mestre bíblico! 🏆";
    cor = "#10b981";
  } else if (porcentagem >= 70) {
    mensagem = "Muito bom! Você conhece bem a Bíblia. 👏";
    cor = "#34d399";
  } else {
    mensagem = "Continue estudando, você chega lá! 📖";
    cor = "#f59e0b";
  }

  // Esconde o container do quiz
  containerQuiz.style.display = "none";

  // Mostra o resultado
  elResultado.style.display = "block";
  elResultado.innerHTML = `
    <h2 style="color:${cor}; font-size: 3rem; margin:0;">${porcentagem}%</h2>
    <p style="font-size: 1.2rem; margin-top:5px; color:#4b5563">Acertou ${acertos} de ${perguntas.length}</p>
    <hr style="border:0; border-top:1px solid #eee; margin: 20px 0;">
    <p style="font-weight:600; font-size:1.1rem; color:${cor}">${mensagem}</p>
    
    <button onclick="location.reload()" style="margin-top:20px;">Tentar Novamente</button>
    <a href="index.html" style="display:block; margin-top:15px; text-decoration:none; color:#6b7280">Voltar ao Início</a>
  `;
}
