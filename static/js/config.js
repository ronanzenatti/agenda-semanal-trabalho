/**
 * Agenda de Trabalho - Gerenciamento de Configurações
 */

import { atualizarDadosGlobais, configuracoes } from './app.js';
import { inicializarCalendario, renderizarCompromissos } from './calendar.js';
import { verificarResponsividade } from './responsive.js';

// Carregar configurações do usuário
export function carregarConfiguracoes() {
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
        });
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
