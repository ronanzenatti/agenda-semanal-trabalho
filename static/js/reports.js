/**
 * Agenda de Trabalho - Geração de Relatórios
 */

import { obterCorLocal } from './utils.js';
import { getActiveScheduleId } from './schedules.js';

// Atualizar relatórios de acordo com o período selecionado
export function atualizarRelatorios() {
    const agendaId = getActiveScheduleId();

    if (!agendaId) {
        // Se não há agenda ativa, limpar relatórios
        limparRelatorios();
        return;
    }

    const periodo = document.getElementById('periodSelect')?.value || 'week';

    // Endpoint baseado no período selecionado
    const endpoint = periodo === 'week' ?
        `/agendas/${agendaId}/relatorios/semanal` :
        `/agendas/${agendaId}/relatorios/mensal`;

    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.relatorio) {
                atualizarInterfaceRelatorios(data.relatorio, periodo);
            } else {
                limparRelatorios();
            }
        })
        .catch(error => {
            console.error('Erro ao carregar relatório:', error);
            limparRelatorios();
        });
}

// Limpar relatórios quando não há agenda ativa
function limparRelatorios() {
    const workplaceSummaries = document.getElementById('workplaceSummaries');
    if (workplaceSummaries) {
        workplaceSummaries.innerHTML = '<p class="text-gray-500 italic col-span-full text-center">Selecione uma agenda para ver os relatórios.</p>';
    }

    // Limpar totais
    document.querySelectorAll('.total-hours').forEach(el => el.textContent = '0h');
    document.querySelectorAll('.total-value').forEach(el => el.textContent = '0,00');
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
        // Agrupar locais por relacionamento
        const gruposLocais = agruparLocaisPorRelacionamento(relatorio.locais);

        gruposLocais.forEach(grupo => {
            if (grupo.length === 1) {
                // Local sem relacionamento - exibir normalmente
                const local = grupo[0];
                workplaceSummaries.appendChild(criarCardLocal(local));
            } else {
                // Grupo de locais relacionados - criar container
                const grupoContainer = document.createElement('div');
                grupoContainer.className = 'border-2 border-gray-300 rounded-lg p-2 space-y-2';

                // Adicionar título do grupo
                const tituloGrupo = document.createElement('h4');
                tituloGrupo.className = 'text-sm font-semibold text-gray-700 mb-2';
                tituloGrupo.textContent = 'Locais Relacionados';
                grupoContainer.appendChild(tituloGrupo);

                // Adicionar cards dos locais
                let totalGrupoHoras = 0;
                let totalGrupoValor = 0;

                grupo.forEach(local => {
                    grupoContainer.appendChild(criarCardLocal(local, true));
                    totalGrupoHoras += local.total_horas;
                    totalGrupoValor += local.valor_total;
                });

                // Adicionar total do grupo
                const totalGrupo = document.createElement('div');
                totalGrupo.className = 'border-t pt-2 mt-2 text-sm font-semibold';
                totalGrupo.innerHTML = `
                    <div class="flex justify-between">
                        <span>Total do Grupo:</span>
                        <span>${totalGrupoHoras.toFixed(1)}h - R$ ${totalGrupoValor.toFixed(2)}</span>
                    </div>
                `;
                grupoContainer.appendChild(totalGrupo);

                workplaceSummaries.appendChild(grupoContainer);
            }
        });
    }

    // Atualizar resumo semanal/mensal
    const summaryContainer = periodo === 'week' ? 'weeklySummary' : 'monthlySummary';
    const totalHorasElement = document.querySelector(`#${summaryContainer} .total-hours`);
    const totalValorElement = document.querySelector(`#${summaryContainer} .total-value`);

    if (totalHorasElement) totalHorasElement.textContent = `${relatorio.total_horas.toFixed(1)}h`;
    if (totalValorElement) totalValorElement.textContent = relatorio.total_valor.toFixed(2);
}

// Criar card de local de trabalho
function criarCardLocal(local, compacto = false) {
    const localElement = document.createElement('div');
    localElement.className = compacto ? 'p-3 rounded' : 'p-4 rounded';
    localElement.style.backgroundColor = obterCorLocal(local.nome);
    localElement.style.color = 'white';

    localElement.innerHTML = `
        <h3 class="font-bold mb-2 ${compacto ? 'text-sm' : ''}">${local.nome}</h3>
        <div class="space-y-1 ${compacto ? 'text-xs' : 'text-sm'}">
            <p>Base: <span class="base-hours">${local.base_horas.toFixed(1)}h</span></p>
            <p>Acréscimo: <span class="bonus-hours">${local.acrescimo_horas.toFixed(1)}h</span></p>
            <p>Total: <span class="${compacto ? 'text-base' : 'text-xl'} total-hours">${local.total_horas.toFixed(1)}h</span></p>
            <p>Valor/h: R$<span class="hourly-rate">${local.valor_hora_aplicado ? local.valor_hora_aplicado.toFixed(2) : '0.00'}</span></p>
            <p>Total: R$<span class="total-value">${local.valor_total.toFixed(2)}</span></p>
        </div>
    `;

    return localElement;
}

// Agrupar locais por relacionamento
function agruparLocaisPorRelacionamento(locais) {
    const grupos = [];
    const locaisProcessados = new Set();

    locais.forEach(local => {
        if (locaisProcessados.has(local.id_local)) return;

        const grupo = [local];
        locaisProcessados.add(local.id_local);

        // Encontrar locais relacionados
        if (local.relacionado_com) {
            // Este local está relacionado a outro
            const localPrincipal = locais.find(l => l.id_local === local.relacionado_com);
            if (localPrincipal && !locaisProcessados.has(localPrincipal.id_local)) {
                grupo.push(localPrincipal);
                locaisProcessados.add(localPrincipal.id_local);
            }

            // Encontrar outros locais relacionados ao mesmo principal
            locais.forEach(outroLocal => {
                if (!locaisProcessados.has(outroLocal.id_local) &&
                    outroLocal.relacionado_com === local.relacionado_com) {
                    grupo.push(outroLocal);
                    locaisProcessados.add(outroLocal.id_local);
                }
            });
        } else {
            // Este local pode ser um principal - procurar relacionados
            locais.forEach(outroLocal => {
                if (!locaisProcessados.has(outroLocal.id_local) &&
                    outroLocal.relacionado_com === local.id_local) {
                    grupo.push(outroLocal);
                    locaisProcessados.add(outroLocal.id_local);
                }
            });
        }

        grupos.push(grupo);
    });

    return grupos;
}