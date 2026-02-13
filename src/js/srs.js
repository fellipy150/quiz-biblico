// =========================================
//  SRS (Spaced Repetition System)
//  Gerencia o algoritmo SM-2 e LocalStorage
// =========================================

const STORAGE_KEY = 'quizSRSData';

export function getSRSData() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
}

export function saveSRSData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetarMemoriaSRS() {
  if (confirm("Tem certeza? Isso apagará todo o histórico de aprendizado do Modo Treino.")) {
    localStorage.removeItem(STORAGE_KEY);
    alert("Memória limpa! O algoritmo recomeçará do zero.");
    location.reload();
  }
}

/**
 * Algoritmo SM-2
 * @param {string} id - ID único da questão
 * @param {boolean} isCorrect - Se acertou
 * @param {number} timeTakenSec - Tempo levado em segundos
 */
export function processarSRS(id, isCorrect, timeTakenSec) {
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
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 6;
    else newInterval = Math.round(entry.interval * newEF);
  }

  // Salvar
  db[id] = {
    lastReviewed: Date.now(),
    interval: newInterval,
    ef: parseFloat(newEF.toFixed(2)),
    reps: newReps
  };

  saveSRSData(db);
}

