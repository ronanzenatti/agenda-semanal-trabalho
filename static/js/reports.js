/**
 * Agenda de Trabalho - Geração de Relatórios
 */

import { obterCorLocal } from './utils.js';

// Atualizar relatórios de acordo com o período selecionado
export function atualizarRelatorios() {
    const periodo = document.getElementById('periodSelect')?.value || 'week';
    
    // Endpoint baseado no período selecionado
    const endpoint = periodo === 'week' ? '/relatorios/semanal' : '/relatorios/mensal';
    
    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.relatorio) {
                atualizarInterfaceRelatorios(data.relatorio, periodo);
            }
        })
        .catch(error => {
            console.error('Erro ao carregar relatório:', error);
        });
}

// Atualizar a interface com os dados dos relatórios
export function atualizarInterfaceRelatorios(relatorio, periodo) {
    // Atualizar resumos por local de trabalho
    const workplaceSummaries = document.getElementById('workplaceSummaries');
    if (!workplaceSummaries) return;
    
    workplaceSummaries.innerHTML = '';
    
    // Verificar se há locais no relatório
    if (!relatorio.locais || relatorio.locais.length === 0) {
        workplaceSummaries.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Nenhum dado disponível para o período selecionado.</p>';
    } else {
        relatorio.locais.forEach(local => {
            const localElement = document.createElement('div');
            localElement.className = 'p-4 rounded';
            localElement.style.backgroundColor = obterCorLocal(local.nome);
            localElement.style.color = 'white';
            
            localElement.innerHTML = `
                <h3 class="font-bold mb-2">${local.nome}</h3>
                <div class="space-y-1 text-sm">
                    <p>Base: <span class="base-hours">${local.base_horas.toFixed(1)}h</span></p>
                    <p>Acréscimo: <span class="bonus-hours">${local.acrescimo_horas.toFixed(1)}h</span></p>
                    <p>Total: <span class="text-xl total-hours">${local.total_horas.toFixed(1)}h</span></p>
                    <p>Valor: R$<span class="total-value">${local.valor_total.toFixed(2)}</span></p>
                </div>
            `;
            
            workplaceSummaries.appendChild(localElement);
        });
    }
    
    // Atualizar resumo semanal/mensal
    const summaryContainer = periodo === 'week' ? 'weeklySummary' : 'monthlySummary';
    const totalHorasElement = document.querySelector(`#${summaryContainer} .total-hours`);
    const totalValorElement = document.querySelector(`#${summaryContainer} .total-value`);
    
    if (totalHorasElement) totalHorasElement.textContent = `${relatorio.total_horas.toFixed(1)}h`;
    if (totalValorElement) totalValorElement.textContent = relatorio.total_valor.toFixed(2);
}
