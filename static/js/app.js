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
import { initSchedules, getActiveScheduleId, getActiveSchedule } from './schedules.js';

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
document.addEventListener('DOMContentLoaded', function () {
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
            // Inicializar UI de Agendas
            if (document.getElementById('activeScheduleSelector')) {
                return initSchedules();
            }
        })
        .then(() => {
            // Aguardar um pequeno delay para garantir que a agenda foi selecionada
            return new Promise(resolve => setTimeout(resolve, 100));
        })
        .then(() => {
            // Carregar locais de trabalho
            return workplaces.carregarLocaisTrabalho();
        })
        .then(() => {
            // Carregar compromissos (agora baseado na agenda ativa)
            return appointments.carregarCompromissos();
        })
        .then(() => {
            // CORREÇÃO: Não inicializar calendário aqui, pois já foi feito ao selecionar agenda
            // Apenas renderizar compromissos se houver agenda ativa
            const agendaId = getActiveScheduleId();
            if (agendaId) {
                calendar.renderizarCompromissos();

                // Verificar se é mobile para ajustar visualização
                if (window.innerWidth <= 768) {
                    responsive.ajustarVisualizacaoParaMobile();
                }

                // Atualizar relatórios
                reports.atualizarRelatorios();
            }
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
    switch (tipo) {
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

// Função para abrir o modal de compartilhamento
function shareCalendar() {
    const agendaId = getActiveScheduleId();

    if (!agendaId) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Selecione uma agenda antes de compartilhar.'
        });
        return;
    }

    // Obter link público da agenda
    fetch(`/agendas/${agendaId}/public_link`)
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.link_publico_id) {
                // Criar o link de compartilhamento
                const shareLink = `${window.location.origin}/public/agenda/${data.link_publico_id}`;
                document.getElementById('shareLink').value = shareLink;

                // Abrir o modal
                document.getElementById('shareModal').classList.remove('hidden');
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Não foi possível obter o link de compartilhamento.'
                });
            }
        })
        .catch(error => {
            console.error('Erro ao obter link de compartilhamento:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Falha ao gerar link de compartilhamento.'
            });
        });
}

// Função para fechar o modal de compartilhamento
function closeShareModal() {
    document.getElementById('shareModal').classList.add('hidden');
}

// Função para copiar o link para a área de transferência
function copyShareLink() {
    const linkInput = document.getElementById('shareLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Para dispositivos móveis

    navigator.clipboard.writeText(linkInput.value)
        .then(() => {
            // Feedback visual para o usuário
            Swal.fire({
                icon: 'success',
                title: 'Link Copiado!',
                text: 'O link foi copiado para a área de transferência.',
                timer: 2000,
                showConfirmButton: false
            });
        })
        .catch(err => {
            console.error('Erro ao copiar o link:', err);
            // Fallback para método antigo
            document.execCommand('copy');
            Swal.fire({
                icon: 'success',
                title: 'Link Copiado!',
                text: 'O link foi copiado para a área de transferência.',
                timer: 2000,
                showConfirmButton: false
            });
        });
}

// Expor funções para uso global/janela
window.openWorkplaceModal = workplaces.openWorkplaceModal;
window.closeWorkplaceModal = workplaces.closeWorkplaceModal;
window.openAppointmentModal = appointments.openAppointmentModal;
window.closeAppointmentModal = appointments.closeAppointmentModal;
window.openConfigModal = config.openConfigModal;
window.closeConfigModal = config.closeConfigModal;
window.openHelpModal = function () {
    document.getElementById('helpModal').classList.remove('hidden');
};
window.closeHelpModal = function () {
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
window.shareCalendar = shareCalendar;
window.closeShareModal = closeShareModal;
window.copyShareLink = copyShareLink;
window.formatarHora = utils.formatarHora;