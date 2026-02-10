// =========================================
//  RANKING.JS - Comunicação com Supabase
// =========================================

// 1. CONFIGURAÇÃO
const SUPABASE_URL = 'https://patdjmbjdzjuwdrehfoz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uQJTr6xrNAqfmKnTyNGcMw_S9q1wsXe';

// Inicializa o cliente usando a variável global da biblioteca carregada no HTML
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Envia a pontuação para o banco de dados.
 * A variável window.pontuacaoTotal é acumulada no game.js
 */
async function enviarPontuacao() {
  const inputNome = document.getElementById('input-nome-jogador');
  const btnSalvar = document.getElementById('btn-salvar-final');

  if (!inputNome) return;

  // 1. Lógica de Identidade (Display)
  // Mantém acentos, mas remove números, símbolos e espaços
  let nomeDisplay = inputNome.value.toLowerCase().replace(/[^a-zà-úç]/g, '');

  // 2. Lógica de Busca (ID Único)
  // Remove acentos para garantir que "josé" e "jose" sejam a mesma pessoa
  let nomeBusca = nomeDisplay.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (!nomeDisplay || nomeDisplay.length < 2) {
    alert('O nome deve ter pelo menos 2 letras!');
    return;
  }

  btnSalvar.innerText = 'Salvando...';
  btnSalvar.disabled = true;

  // 3. Chamada ao Supabase via RPC (Stored Procedure)
  const { error } = await supabaseClient.rpc('upsert_ranking', {
    p_nome_display: nomeDisplay,
    p_nome_busca: nomeBusca,
    p_pontuacao: window.pontuacaoTotal,
    p_modo: window.modoJogo,
  });

  if (error) {
    console.error('Erro Supabase:', error);
    alert('Erro ao conectar com o banco de dados. Tente novamente.');
    btnSalvar.innerText = 'Tentar Novamente';
    btnSalvar.disabled = false;
  } else {
    alert('🏆 Registro de Guardião concluído!');
    window.location.href = 'index.html'; // Volta para o menu principal
  }
}

/**
 * Busca e exibe o Top 10 no Modal do Ranking
 */
window.abrirRanking = async function () {
  const modal = document.getElementById('modal-ranking');
  const lista = document.getElementById('lista-ranking-container');
  const loader = document.getElementById('lista-ranking-loader');

  // UI Inicial
  if (modal) modal.style.display = 'flex';
  if (lista) lista.innerHTML = '';
  if (loader) loader.style.display = 'block';

  // Busca os dados ordenados por maior pontuação
  const { data, error } = await supabaseClient
    .from('ranking')
    .select('*')
    .order('pontuacao', { ascending: false })
    .limit(10);

  if (loader) loader.style.display = 'none';

  if (error) {
    console.error('Erro ao buscar ranking:', error);
    lista.innerHTML =
      "<li style='text-align:center; color:red; padding:10px;'>Falha ao carregar ranking 😢</li>";
    return;
  }

  if (data && data.length > 0) {
    lista.innerHTML = data
      .map((jogador, i) => {
        const iconeModo = jogador.modo === 'desafio' ? '🔥' : '🛡️';

        // Medalhas dinâmicas para o Top 3
        let medalha = `<div class="rank-pos">${i + 1}</div>`;
        if (i === 0)
          medalha = `<div class="rank-pos" style="background:#fbbf24; color:#000;">🥇</div>`;
        if (i === 1)
          medalha = `<div class="rank-pos" style="background:#94a3b8; color:#fff;">🥈</div>`;
        if (i === 2)
          medalha = `<div class="rank-pos" style="background:#b45309; color:#fff;">🥉</div>`;

        return `
                <li class="rank-item">
                    <div style="display:flex; align-items:center;">
                        ${medalha}
                        <span style="text-transform: capitalize;">${jogador.nome}</span>
                    </div>
                    <div style="font-weight: 800; color: var(--brand-dark);">
                        ${jogador.pontuacao} pts ${iconeModo}
                    </div>
                </li>
            `;
      })
      .join('');
  } else {
    lista.innerHTML =
      "<li style='text-align:center; color:#666; padding:20px;'>Nenhum Guardião registrado ainda.</li>";
  }
};

/**
 * Fecha o Modal do Ranking
 */
window.fecharRanking = function () {
  const modal = document.getElementById('modal-ranking');
  if (modal) modal.style.display = 'none';
};
