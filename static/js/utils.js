/**
 * Agenda de Trabalho - Funções Utilitárias
 */

import { locaisTrabalho } from './app.js';

// Converter tempo no formato HH:MM para minutos
export function converterTempoParaMinutos(tempo) {
    if (!tempo) return 0;
    const [horas, minutos] = tempo.split(':').map(Number);
    return horas * 60 + minutos;
}

// Obter cor associada a um local de trabalho pelo nome
export function obterCorLocal(nomeLocal) {
    const local = locaisTrabalho.find(l => l.nome === nomeLocal);
    return local ? local.cor : '#cccccc';
}

// Formatar CPF no padrão 000.000.000-00
export function formatarCPF(cpf) {
    // Remover caracteres não numéricos
    cpf = cpf.replace(/\D/g, '');
    
    // Verificar se tem 11 dígitos
    if (cpf.length !== 11) return cpf;
    
    // Formatar como 000.000.000-00
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
