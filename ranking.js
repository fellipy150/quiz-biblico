// =========================================
//  RANKING & SUPABASE - Guardiões
// =========================================

const SUPABASE_URL = "https://patdjmbjdzjuwdrehfoz.supabase.co";
const SUPABASE_KEY = "sb_publishable_uQJTr6xrNAqfmKnTyNGcMw_S9q1wsXe";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Calcula a pontuação final baseada no modo
function calcularPontosFinais(acertosTotais, modo) {
    const multiplicador = modo === 'desafio' ? 1.5 : 1;
    return Math.round(acertosTotais * multiplicador);
}

// Envia a pontuação para o banco
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

    // A variável "acertos" e "modoJogo" virão do estado global do game.js
    const { error } = await supabaseClient.rpc('upsert_ranking', {
        p_nome: nome,
        p_pontuacao: calcularPontosFinais(window.acertos, window.modoJogo),
        p_modo: window.modoJogo
    });

    if (error) {
        console.error(error);
        alert("Erro ao salvar no banco de dados.");
        btnSalvar.innerText = "Tentar Novamente";
        btnSalvar.disabled = false;
    } else {
        alert("🏆 Ranking atualizado!");
        window.location.href = "index.html";
    }
}

// Busca o Top 10 para o Modal
window.abrirRanking = async function() {
    const modal = document.getElementById("modal-ranking");
    const lista = document.getElementById("lista-ranking-container");
    const loader = document.getElementById("lista-ranking-loader");
    
    if(modal) modal.style.display = "flex";
    if(loader) loader.style.display = "block";
    if(lista) lista.innerHTML = "";

    const { data, error } = await supabaseClient
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
