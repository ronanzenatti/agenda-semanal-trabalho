/**
 * Agenda de Trabalho - Arquivo Principal
 * Coordena a inicialização dos módulos e suas interações
 */

// Importar módulos
import * as auth from './auth.js';
import * as calendar from './calendar.js';
import * as appointments from './appointments.js';
import * as workplaces from './workplaces.js';
import * as config from './config.js';
import * as reports from './reports.js';
import * as responsive from './responsive.js';
import * as utils from './utils.js';

// Variáveis Globais compartilhadas entre módulos - exportadas para acesso em outros arquivos
export let compromissos = [];
export let locaisTrabalho = [];
export let configuracoes = {
    diasSemana: [1, 2, 3, 4, 5, 6],
    horaInicioPadrao: '07:00',
    horaFimPadrao: '23:00'
};

// Nomes dos dias da semana
export const diasSemana = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado'
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Verificar usuário
    auth.verificarUsuario();
    
    // Inicializar o menu móvel
    responsive.inicializarMenuMobile();
    
    // Inicializar listeners dos formulários
    inicializarEventListeners();
    
    // Carregar dados iniciais
    carregarDados();
    
    // Adicionar listener para redimensionamento da janela
    window.addEventListener('resize', responsive.verificarResponsividade);
});

// Inicialização de Event Listeners
function inicializarEventListeners() {
    // Formulário de configurações
    document.getElementById('configForm')?.addEventListener('submit', config.salvarConfiguracoes);
    
    // Formulário de locais de trabalho
    document.getElementById('newWorkplaceForm')?.addEventListener('submit', workplaces.salvarLocalTrabalho);
    document.getElementById('addWorkplaceBtn')?.addEventListener('click', workplaces.mostrarFormularioLocalTrabalho);
    
    // Formulário de compromissos
    document.getElementById('appointmentForm')?.addEventListener('submit', appointments.salvarCompromisso);
    
    // Listener para atualização de relatórios
    document.getElementById('periodSelect')?.addEventListener('change', reports.atualizarRelatorios);
}

// Carregamento de dados
function carregarDados() {
    // Carregar configurações do usuário
    config.carregarConfiguracoes()
        .then(() => {
            // Inicializar calendário após carregar configurações
            calendar.inicializarCalendario();
            
            // Carregar locais de trabalho
            return workplaces.carregarLocaisTrabalho();
        })
        .then(() => {
            // Carregar compromissos
            return appointments.carregarCompromissos();
        })
        .then(() => {
            // Renderizar compromissos
            calendar.renderizarCompromissos();
            
            // Verificar se é mobile para ajustar visualização
            if (window.innerWidth <= 768) {
                responsive.ajustarVisualizacaoParaMobile();
            }
            
            // Atualizar relatórios
            reports.atualizarRelatorios();
        })
        .catch(error => {
            console.error('Erro ao carregar dados:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Falha ao carregar dados. Por favor, recarregue a página.'
            });
        });
}

// Atualizar dados globais (usado pelos módulos para atualizar o estado global)
export function atualizarDadosGlobais(tipo, dados) {
    switch(tipo) {
        case 'compromissos':
            compromissos = dados;
            break;
        case 'locaisTrabalho':
            locaisTrabalho = dados;
            break;
        case 'configuracoes':
            configuracoes = dados;
            break;
    }
}

// Expor funções para uso global/janela
window.openWorkplaceModal = workplaces.openWorkplaceModal;
window.closeWorkplaceModal = workplaces.closeWorkplaceModal;
window.openAppointmentModal = appointments.openAppointmentModal;
window.closeAppointmentModal = appointments.closeAppointmentModal;
window.openConfigModal = config.openConfigModal;
window.closeConfigModal = config.closeConfigModal;
window.openHelpModal = function() {
    document.getElementById('helpModal').classList.remove('hidden');
};
window.closeHelpModal = function() {
    document.getElementById('helpModal').classList.add('hidden');
};
window.logout = auth.logout;
window.editarLocalTrabalho = workplaces.editarLocalTrabalho;
window.excluirLocalTrabalho = workplaces.excluirLocalTrabalho;
window.editarCompromisso = appointments.editarCompromisso;
window.excluirCompromisso = appointments.excluirCompromisso;
window.navegarParaDiaAnterior = responsive.navegarParaDiaAnterior;
window.navegarParaProximoDia = responsive.navegarParaProximoDia;
window.closeMenu = responsive.fecharMenu;
window.calculateDuration = appointments.calculateDuration;
window.hideWorkplaceForm = workplaces.hideWorkplaceForm;