/**
 * Agenda de Trabalho - Gerenciamento de Configurações
 */

import { atualizarDadosGlobais, configuracoes } from './app.js';
import { inicializarCalendario, renderizarCompromissos } from './calendar.js';
import { verificarResponsividade } from './responsive.js';
import { getActiveScheduleId } from './schedules.js';

// Carregar configurações do usuário
export function carregarConfiguracoes() {
    // Por padrão, usar configurações gerais do usuário
    return fetch('/configuracoes')
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.configuracoes) {
                const novasConfig = {
                    diasSemana: data.configuracoes.dias_semana,
                    horaInicioPadrao: data.configuracoes.hora_inicio_padrao,
                    horaFimPadrao: data.configuracoes.hora_fim_padrao
                };

                atualizarDadosGlobais('configuracoes', novasConfig);

                // Atualizar interface com as configurações
                atualizarInterfaceConfiguracoes();
            }
        })
        .catch(error => {
            console.error('Erro ao carregar configurações:', error);
            // Usar configurações padrão em caso de erro
            const configPadrao = {
                diasSemana: [1, 2, 3, 4, 5, 6],
                horaInicioPadrao: '07:00',
                horaFimPadrao: '23:00'
            };
            atualizarDadosGlobais('configuracoes', configPadrao);
        });
}

// Carregar configurações da agenda ativa (sobrescreve as gerais)
export function carregarConfiguracoesAgenda(agenda) {
    if (!agenda) return;

    const novasConfig = {
        diasSemana: agenda.dias_semana || [1, 2, 3, 4, 5],
        horaInicioPadrao: agenda.hora_inicio_padrao || '07:00',
        horaFimPadrao: agenda.hora_fim_padrao || '23:00'
    };

    atualizarDadosGlobais('configuracoes', novasConfig);
    atualizarInterfaceConfiguracoes();

    // Reinicializar calendário com as novas configurações
    inicializarCalendario();
    renderizarCompromissos();
}

// Atualizar interface com as configurações
export function atualizarInterfaceConfiguracoes() {
    // Atualizar checkboxes dos dias da semana
    const checkboxes = document.querySelectorAll('input[name="daysToShow"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = configuracoes.diasSemana.includes(parseInt(checkbox.value));
    });

    // Atualizar horários padrão
    const startTimeInput = document.getElementById('defaultStartTime');
    const endTimeInput = document.getElementById('defaultEndTime');

    if (startTimeInput) startTimeInput.value = configuracoes.horaInicioPadrao;
    if (endTimeInput) endTimeInput.value = configuracoes.horaFimPadrao;
}

// Abrir modal de configurações
export function openConfigModal() {
    const agendaId = getActiveScheduleId();

    if (agendaId) {
        // Se há agenda ativa, mostrar aviso
        Swal.fire({
            icon: 'info',
            title: 'Atenção',
            text: 'As configurações de calendário devem ser feitas diretamente na agenda ativa. Use o botão "Meus Horários" e depois "Configurar" na agenda desejada.',
            confirmButtonText: 'Entendi'
        });
        return;
    }

    // Se não há agenda ativa, permitir configurações gerais
    atualizarInterfaceConfiguracoes();
    document.getElementById('configModal').classList.remove('hidden');
}

// Fechar modal de configurações
export function closeConfigModal() {
    document.getElementById('configModal').classList.add('hidden');
}

// Salvar configurações
export function salvarConfiguracoes(e) {
    e.preventDefault();

    // Verificar se há agenda ativa
    const agendaId = getActiveScheduleId();
    if (agendaId) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Você tem uma agenda ativa. As configurações devem ser salvas na agenda.',
            confirmButtonText: 'OK'
        });
        closeConfigModal();
        return;
    }

    // Obter dias da semana selecionados
    const checkboxes = document.querySelectorAll('input[name="daysToShow"]:checked');
    const diasSemana = Array.from(checkboxes).map(checkbox => parseInt(checkbox.value));

    // Verificar se pelo menos um dia foi selecionado
    if (diasSemana.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Selecione pelo menos um dia da semana'
        });
        return;
    }

    const dados = {
        dias_semana: diasSemana,
        hora_inicio_padrao: document.getElementById('defaultStartTime').value,
        hora_fim_padrao: document.getElementById('defaultEndTime').value
    };

    fetch('/configuracoes', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })
        .then(response => response.json())
        .then(data => {
            if (data.sucesso) {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso',
                    text: 'Configurações salvas com sucesso!'
                });

                closeConfigModal();

                // Atualizar configurações locais
                const novasConfig = {
                    diasSemana: dados.dias_semana,
                    horaInicioPadrao: dados.hora_inicio_padrao,
                    horaFimPadrao: dados.hora_fim_padrao
                };

                atualizarDadosGlobais('configuracoes', novasConfig);

                // Reinicializar calendário e recarregar compromissos
                inicializarCalendario();
                renderizarCompromissos();

                // Verificar responsividade
                verificarResponsividade();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: data.mensagem || 'Erro ao salvar configurações'
                });
            }
        })
        .catch(error => {
            console.error('Erro ao salvar configurações:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Falha ao comunicar com o servidor'
            });
        });
}