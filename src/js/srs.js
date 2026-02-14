// =========================================
//  SRS (Spaced Repetition System)
//  Gerencia o algoritmo SM-2 e LocalStorage
// =========================================

const STORAGE_KEY = 'quizSRSData';

/**
 * Recupera os dados do LocalStorage com segurança
 */
export function getSRSData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return {};
    
    return JSON.parse(data);
  } catch (error) {
    console.error("Erro ao ler SRS do LocalStorage (Dados corrompidos?):", error);
    // Em caso de erro (JSON inválido, etc), retorna objeto vazio para não quebrar o app
    return {};
  }
}

/**
 * Salva os dados no LocalStorage tratando erros de cota cheia
 */
export function saveSRSData(data) {
  try {
    const stringifiedData = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, stringifiedData);
  } catch (error) {
    console.error("Erro ao salvar SRS no LocalStorage:", error);
    
    // Alerta específico para falta de espaço
    if (error.name === 'QuotaExceededError') {
      console.warn("Aviso: LocalStorage está cheio. O progresso pode não ser salvo.");
    }
  }
}

/**
 * Limpa o histórico com confirmação e tratamento de erro
 */
export function resetarMemoriaSRS() {
  try {
    if (confirm("Tem certeza? Isso apagará todo o histórico de aprendizado do Modo Treino.")) {
      localStorage.removeItem(STORAGE_KEY);
      alert("Memória limpa! O algoritmo recomeçará do zero.");
      location.reload();
    }
  } catch (error) {
    console.error("Erro ao resetar memória SRS:", error);
    alert("Não foi possível limpar os dados. Tente limpar o cache do navegador.");
  }
}

/**
 * Algoritmo SM-2
 * @param {string} id - ID único da questão
 * @param {boolean} isCorrect - Se acertou
 * @param {number} timeTakenSec - Tempo levado em segundos
 */
export function processarSRS(id, isCorrect, timeTakenSec) {
  try {
    // Validação básica de entrada
    if (!id) throw new Error("ID da questão não fornecido.");

    const db = getSRSData();
    
    let entry = db[id] || { 
      lastReviewed: 0, 
      interval: 0, 
      ef: 2.5, 
      reps: 0 
    };

    // 1. Calcular Qualidade (0-5)
    let quality = 0;
    if (isCorrect) {
      if (timeTakenSec < 10) quality = 5;
      else if (timeTakenSec < 20) quality = 4;
      else if (timeTakenSec < 30) quality = 3;
      else quality = 2; 
    } else {
      quality = 0;
    }

    // 2. Atualizar Fator de Facilidade (EF)
    // Fórmula original do SM-2
    let newEF = entry.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEF < 1.3) newEF = 1.3;

    // 3. Atualizar Intervalo e Repetições
    let newInterval = 1;
    let newReps = entry.reps;

    if (quality < 3) {
      newReps = 0;
      newInterval = 1;
    } else {
      newReps++;
      if (newReps === 1) {
        newInterval = 1;
      } else if (newReps === 2) {
        newInterval = 6;
      } else {
        newInterval = Math.round(entry.interval * newEF);
      }
    }

    // Salvar no banco local
    db[id] = {
      lastReviewed: Date.now(),
      interval: newInterval,
      ef: parseFloat(newEF.toFixed(2)),
      reps: newReps
    };

    saveSRSData(db);

  } catch (error) {
    console.error(`Erro crítico ao processar algoritmo SRS para ID ${id}:`, error);
  }
}
