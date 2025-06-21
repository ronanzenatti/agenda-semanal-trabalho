/**
 * Agenda de Trabalho - Gestão de Agendas (Schedules)
 */

import { atualizarDadosGlobais } from './app.js';
import { carregarCompromissos } from './appointments.js';
import { renderizarCompromissos } from './calendar.js';
import { atualizarRelatorios } from './reports.js';
import { carregarLocaisTrabalho } from './workplaces.js';

// Variável para armazenar agenda ativa
let agendaAtiva = null;
let agendas = [];

// Inicializar módulo de agendas
export function initSchedules() {
    console.log('Inicializando módulo de agendas...');
    
    // Carregar agendas do usuário
    carregarAgendas().then(() => {
        // Configurar event listeners
        configurarEventListeners();
    });
}

// Configurar event listeners
function configurarEventListeners() {
    // Seletor de agenda ativa
    const activeScheduleSelector = document.getElementById('activeScheduleSelector');
    if (activeScheduleSelector) {
        activeScheduleSelector.addEventListener('change', (e) => {
            selecionarAgendaAtiva(e.target.value);
        });
    }

    // Botão adicionar agenda
    const addScheduleBtn = document.getElementById('addScheduleBtn');
    if (addScheduleBtn) {
        addScheduleBtn.addEventListener('click', mostrarFormularioNovaAgenda);
    }

    // Formulário de nova agenda
    const newScheduleForm = document.getElementById('newScheduleForm');
    if (newScheduleForm) {
        newScheduleForm.addEventListener('submit', salvarAgenda);
    }

    // Botão cancelar nova agenda
    const cancelNewScheduleBtn = document.getElementById('cancelNewScheduleBtn');
    if (cancelNewScheduleBtn) {
        cancelNewScheduleBtn.addEventListener('click', esconderFormularioAgenda);
    }

    // Botões de salvar configurações
    const saveFinancialConfigBtn = document.getElementById('saveFinancialConfigBtn');
    if (saveFinancialConfigBtn) {
        saveFinancialConfigBtn.addEventListener('click', salvarConfiguracaoFinanceira);
    }

    const saveCalendarConfigBtn = document.getElementById('saveCalendarConfigBtn');
    if (saveCalendarConfigBtn) {
        saveCalendarConfigBtn.addEventListener('click', salvarConfiguracaoCalendario);
    }
}

// Carregar agendas do servidor
export function carregarAgendas() {
    return fetch('/agendas')
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.agendas) {
                agendas = data.agendas;
                atualizarListaAgendas();
                atualizarSeletorAgendaAtiva();
                
                // Se houver agendas e nenhuma estiver selecionada, selecionar a primeira
                if (agendas.length > 0 && !agendaAtiva) {
                    // Verificar se há uma agenda salva no sessionStorage
                    const agendaAtivaId = sessionStorage.getItem('agendaAtivaId');
                    if (agendaAtivaId && agendas.find(a => a.id_agenda === agendaAtivaId)) {
                        selecionarAgendaAtiva(agendaAtivaId);
                    } else {
                        selecionarAgendaAtiva(agendas[0].id_agenda);
                    }
                } else if (agendas.length === 0) {
                    // CORREÇÃO: Se não há agendas, limpar o calendário
                    import('./calendar.js').then(module => {
                        module.inicializarCalendario();
                    });
                }
            }
        })
        .catch(error => {
            console.error('Erro ao carregar agendas:', error);
        });
}

// Atualizar lista de agendas no modal
function atualizarListaAgendas() {
    const schedulesList = document.getElementById('schedulesList');
    if (!schedulesList) return;

    if (agendas.length === 0) {
        schedulesList.innerHTML = '<p class="text-gray-500 italic">Nenhuma agenda cadastrada. Crie sua primeira agenda para começar.</p>';
        return;
    }

    schedulesList.innerHTML = '';
    
    agendas.forEach(agenda => {
        const agendaElement = document.createElement('div');
        agendaElement.className = 'flex justify-between items-center p-3 border rounded hover:bg-gray-50';
        
        const dataInicio = new Date(agenda.data_inicio).toLocaleDateString('pt-BR');
        const dataFim = new Date(agenda.data_fim).toLocaleDateString('pt-BR');
        
        agendaElement.innerHTML = `
            <div>
                <h4 class="font-semibold">${agenda.nome}</h4>
                <p class="text-sm text-gray-600">Período: ${dataInicio} - ${dataFim}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="configurarAgenda('${agenda.id_agenda}')" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">
                    <i class="fas fa-cog"></i> Configurar
                </button>
                <button onclick="editarAgenda('${agenda.id_agenda}')" class="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="excluirAgenda('${agenda.id_agenda}')" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        schedulesList.appendChild(agendaElement);
    });
}

// Atualizar seletor de agenda ativa
function atualizarSeletorAgendaAtiva() {
    const selector = document.getElementById('activeScheduleSelector');
    if (!selector) return;

    selector.innerHTML = '';
    
    if (agendas.length === 0) {
        selector.innerHTML = '<option value="">Nenhuma agenda disponível</option>';
        selector.disabled = true;
        return;
    }

    selector.disabled = false;
    
    agendas.forEach(agenda => {
        const option = document.createElement('option');
        option.value = agenda.id_agenda;
        option.textContent = agenda.nome;
        
        if (agendaAtiva && agenda.id_agenda === agendaAtiva.id_agenda) {
            option.selected = true;
        }
        
        selector.appendChild(option);
    });
}

// Selecionar agenda ativa
function selecionarAgendaAtiva(agendaId) {
    if (!agendaId) return;

    agendaAtiva = agendas.find(a => a.id_agenda === agendaId);
    
    if (agendaAtiva) {
        // Salvar no sessionStorage
        sessionStorage.setItem('agendaAtivaId', agendaId);
        
        // CORREÇÃO: Atualizar as configurações globais com os dados da agenda
        atualizarDadosGlobais('configuracoes', {
            diasSemana: agendaAtiva.dias_semana || [1, 2, 3, 4, 5],
            horaInicioPadrao: agendaAtiva.hora_inicio_padrao || '07:00',
            horaFimPadrao: agendaAtiva.hora_fim_padrao || '23:00'
        });
        
        // Recarregar dados relacionados à agenda
        Promise.all([
            carregarCompromissosAgenda(),
            carregarConfiguracaoFinanceira()
        ]).then(() => {
            // CORREÇÃO: Inicializar calendário antes de renderizar compromissos
            import('./calendar.js').then(module => {
                module.inicializarCalendario();
                module.renderizarCompromissos();
            });
            atualizarRelatorios();
        });
    }
}

// Carregar compromissos da agenda ativa
function carregarCompromissosAgenda() {
    if (!agendaAtiva) return Promise.resolve();

    return fetch(`/agendas/${agendaAtiva.id_agenda}/compromissos`)
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.compromissos) {
                atualizarDadosGlobais('compromissos', data.compromissos);
            }
        });
}

// Carregar configuração financeira da agenda
function carregarConfiguracaoFinanceira() {
    if (!agendaAtiva) return Promise.resolve();

    return fetch(`/agendas/${agendaAtiva.id_agenda}/locais_config`)
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.configuracoes) {
                // Armazenar configurações para uso nos relatórios
                sessionStorage.setItem('configFinanceiraAgenda', JSON.stringify(data.configuracoes));
            }
        });
}

// Mostrar formulário de nova agenda
function mostrarFormularioNovaAgenda() {
    document.getElementById('scheduleFormTitle').textContent = 'Nova Agenda';
    document.getElementById('scheduleId').value = '';
    document.getElementById('scheduleName').value = '';
    document.getElementById('scheduleStartDate').value = '';
    document.getElementById('scheduleEndDate').value = '';
    
    document.getElementById('scheduleFormContainer').classList.remove('hidden');
}

// Esconder formulário de agenda
function esconderFormularioAgenda() {
    document.getElementById('scheduleFormContainer').classList.add('hidden');
}

// Salvar agenda (criar ou editar)
function salvarAgenda(e) {
    e.preventDefault();
    
    const agendaId = document.getElementById('scheduleId').value;
    const dados = {
        nome: document.getElementById('scheduleName').value,
        data_inicio: document.getElementById('scheduleStartDate').value,
        data_fim: document.getElementById('scheduleEndDate').value
    };
    
    // Validar datas
    const dataInicio = new Date(dados.data_inicio);
    const dataFim = new Date(dados.data_fim);
    
    if (dataFim <= dataInicio) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'A data de fim deve ser posterior à data de início'
        });
        return;
    }
    
    const metodo = agendaId ? 'PUT' : 'POST';
    const url = agendaId ? `/agendas/${agendaId}` : '/agendas';
    
    fetch(url, {
        method: metodo,
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
                text: 'Agenda salva com sucesso!'
            });
            
            esconderFormularioAgenda();
            carregarAgendas();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: data.mensagem || 'Erro ao salvar agenda'
            });
        }
    })
    .catch(error => {
        console.error('Erro ao salvar agenda:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Falha ao comunicar com o servidor'
        });
    });
}

// Configurar agenda (abrir modal de configuração)
window.configurarAgenda = function(agendaId) {
    const agenda = agendas.find(a => a.id_agenda === agendaId);
    if (!agenda) return;
    
    document.getElementById('configScheduleId').value = agendaId;
    document.getElementById('configScheduleNameDisplay').textContent = agenda.nome;
    
    // Carregar dados da agenda para configuração
    carregarDadosConfiguracao(agendaId);
    
    // Abrir modal
    document.getElementById('scheduleConfigModal').classList.remove('hidden');
    
    // Mostrar aba financeira por padrão
    showConfigTab('financeiro');
};

// Carregar dados para configuração
function carregarDadosConfiguracao(agendaId) {
    const agenda = agendas.find(a => a.id_agenda === agendaId);
    if (!agenda) return;

    // Carregar configurações financeiras
    fetch(`/agendas/${agendaId}/locais_config`)
        .then(response => response.json())
        .then(data => {
            if (data.sucesso) {
                exibirConfiguracaoFinanceira(data.configuracoes || []);
            }
        });

    // Configurar dados do calendário
    configurarDadosCalendario(agenda);
}

// Exibir configuração financeira
function exibirConfiguracaoFinanceira(configuracoes) {
    const container = document.getElementById('workplaceRatesContainer');
    if (!container) return;

    // Obter locais de trabalho do usuário
    fetch('/locais')
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.locais) {
                container.innerHTML = '';
                
                if (data.locais.length === 0) {
                    container.innerHTML = '<p class="text-gray-500 italic">Nenhum local de trabalho cadastrado. Cadastre locais antes de configurar valores.</p>';
                    return;
                }
                
                data.locais.forEach(local => {
                    const config = configuracoes.find(c => c.local_id === local.id_local);
                    const valorAtual = config ? config.valor_hora : '';
                    
                    const localConfig = document.createElement('div');
                    localConfig.className = 'flex items-center justify-between p-3 border rounded';
                    localConfig.style.borderLeftWidth = '4px';
                    localConfig.style.borderLeftColor = local.cor;
                    
                    localConfig.innerHTML = `
                        <div class="flex-grow">
                            <label class="font-medium">${local.nome}</label>
                            <p class="text-sm text-gray-600">Acréscimo HA: ${local.acrescimo_ha_percent}%</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-gray-600">R$</span>
                            <input type="number" 
                                   class="workplace-rate-input w-24 p-2 border rounded text-right" 
                                   data-local-id="${local.id_local}"
                                   value="${valorAtual}"
                                   min="0" 
                                   step="0.01" 
                                   placeholder="0.00">
                            <span class="text-gray-600">/hora</span>
                        </div>
                    `;
                    
                    container.appendChild(localConfig);
                });
            }
        });
}

// Configurar dados do calendário
function configurarDadosCalendario(agenda) {
    // Dias da semana
    const daysContainer = document.getElementById('scheduleDaysOfWeekContainer');
    if (daysContainer) {
        daysContainer.innerHTML = '';
        
        const diasSemana = {
            0: 'Domingo',
            1: 'Segunda',
            2: 'Terça',
            3: 'Quarta',
            4: 'Quinta',
            5: 'Sexta',
            6: 'Sábado'
        };
        
        Object.entries(diasSemana).forEach(([dia, nome]) => {
            const isChecked = agenda.dias_semana.includes(parseInt(dia));
            
            const dayCheckbox = document.createElement('label');
            dayCheckbox.className = 'flex items-center space-x-2';
            dayCheckbox.innerHTML = `
                <input type="checkbox" 
                       name="scheduleDaysOfWeek" 
                       value="${dia}" 
                       class="rounded" 
                       ${isChecked ? 'checked' : ''}>
                <span>${nome}</span>
            `;
            
            daysContainer.appendChild(dayCheckbox);
        });
    }
    
    // Horários padrão
    const startTimeInput = document.getElementById('scheduleDefaultStartTime');
    const endTimeInput = document.getElementById('scheduleDefaultEndTime');
    
    if (startTimeInput) startTimeInput.value = agenda.hora_inicio_padrao || '07:00';
    if (endTimeInput) endTimeInput.value = agenda.hora_fim_padrao || '23:00';
}

// Salvar configuração financeira
function salvarConfiguracaoFinanceira() {
    const agendaId = document.getElementById('configScheduleId').value;
    const inputs = document.querySelectorAll('.workplace-rate-input');
    
    const promises = [];
    
    inputs.forEach(input => {
        const localId = input.dataset.localId;
        const valorHora = parseFloat(input.value);
        
        if (valorHora && valorHora > 0) {
            // Verificar se já existe configuração
            fetch(`/agendas/${agendaId}/locais_config`)
                .then(response => response.json())
                .then(data => {
                    const configExistente = data.configuracoes?.find(c => c.local_id === localId);
                    
                    if (configExistente) {
                        // Atualizar configuração existente
                        promises.push(
                            fetch(`/agendas/${agendaId}/locais_config/${configExistente.id_agenda_local}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ valor_hora: valorHora })
                            })
                        );
                    } else {
                        // Criar nova configuração
                        promises.push(
                            fetch(`/agendas/${agendaId}/locais_config`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    local_id: localId,
                                    valor_hora: valorHora
                                })
                            })
                        );
                    }
                });
        }
    });
    
    // Aguardar um pouco para as promises serem criadas
    setTimeout(() => {
        Promise.all(promises)
            .then(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso',
                    text: 'Configuração financeira salva com sucesso!'
                });
                
                // Se for a agenda ativa, recarregar dados
                if (agendaAtiva && agendaAtiva.id_agenda === agendaId) {
                    carregarConfiguracaoFinanceira().then(() => {
                        atualizarRelatorios();
                    });
                }
            })
            .catch(error => {
                console.error('Erro ao salvar configuração financeira:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Erro ao salvar configuração financeira'
                });
            });
    }, 500);
}

// Salvar configuração de calendário
function salvarConfiguracaoCalendario() {
    const agendaId = document.getElementById('configScheduleId').value;
    
    // Obter dias selecionados
    const checkboxes = document.querySelectorAll('input[name="scheduleDaysOfWeek"]:checked');
    const diasSemana = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    // Validar se pelo menos um dia foi selecionado
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
        hora_inicio_padrao: document.getElementById('scheduleDefaultStartTime').value,
        hora_fim_padrao: document.getElementById('scheduleDefaultEndTime').value
    };
    
    fetch(`/agendas/${agendaId}`, {
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
                text: 'Configuração de calendário salva com sucesso!'
            });
            
            // Atualizar dados locais
            const agenda = agendas.find(a => a.id_agenda === agendaId);
            if (agenda) {
                agenda.dias_semana = dados.dias_semana;
                agenda.hora_inicio_padrao = dados.hora_inicio_padrao;
                agenda.hora_fim_padrao = dados.hora_fim_padrao;
            }
            
            // Se for a agenda ativa, recarregar calendário
            if (agendaAtiva && agendaAtiva.id_agenda === agendaId) {
                atualizarDadosGlobais('configuracoes', {
                    diasSemana: dados.dias_semana,
                    horaInicioPadrao: dados.hora_inicio_padrao,
                    horaFimPadrao: dados.hora_fim_padrao
                });
                
                // Recarregar calendário
                import('./calendar.js').then(module => {
                    module.inicializarCalendario();
                    module.renderizarCompromissos();
                });
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: data.mensagem || 'Erro ao salvar configuração'
            });
        }
    })
    .catch(error => {
        console.error('Erro ao salvar configuração de calendário:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Falha ao comunicar com o servidor'
        });
    });
}

// Editar agenda
window.editarAgenda = function(agendaId) {
    const agenda = agendas.find(a => a.id_agenda === agendaId);
    if (!agenda) return;
    
    document.getElementById('scheduleFormTitle').textContent = 'Editar Agenda';
    document.getElementById('scheduleId').value = agenda.id_agenda;
    document.getElementById('scheduleName').value = agenda.nome;
    document.getElementById('scheduleStartDate').value = agenda.data_inicio;
    document.getElementById('scheduleEndDate').value = agenda.data_fim;
    
    document.getElementById('scheduleFormContainer').classList.remove('hidden');
};

// Excluir agenda
window.excluirAgenda = function(agendaId) {
    const agenda = agendas.find(a => a.id_agenda === agendaId);
    if (!agenda) return;
    
    Swal.fire({
        title: 'Tem certeza?',
        text: `Deseja excluir a agenda "${agenda.nome}"? Todos os compromissos associados também serão removidos.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/agendas/${agendaId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.sucesso) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Excluída!',
                        text: 'Agenda removida com sucesso.'
                    });
                    
                    // Se era a agenda ativa, limpar
                    if (agendaAtiva && agendaAtiva.id_agenda === agendaId) {
                        agendaAtiva = null;
                        sessionStorage.removeItem('agendaAtivaId');
                        atualizarDadosGlobais('compromissos', []);
                        renderizarCompromissos();
                        atualizarRelatorios();
                    }
                    
                    carregarAgendas();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: data.mensagem || 'Erro ao excluir agenda'
                    });
                }
            })
            .catch(error => {
                console.error('Erro ao excluir agenda:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Falha ao comunicar com o servidor'
                });
            });
        }
    });
};

// Funções para controle de abas no modal de configuração
window.showConfigTab = function(tab) {
    // Ocultar todas as abas
    document.getElementById('configTabFinanceiro').classList.add('hidden');
    document.getElementById('configTabCalendario').classList.add('hidden');
    
    // Remover classes ativas dos botões
    document.getElementById('tabButtonFinanceiro').classList.remove('border-indigo-500', 'text-indigo-600');
    document.getElementById('tabButtonFinanceiro').classList.add('border-transparent', 'text-gray-500');
    document.getElementById('tabButtonCalendario').classList.remove('border-indigo-500', 'text-indigo-600');
    document.getElementById('tabButtonCalendario').classList.add('border-transparent', 'text-gray-500');
    
    // Mostrar aba selecionada
    if (tab === 'financeiro') {
        document.getElementById('configTabFinanceiro').classList.remove('hidden');
        document.getElementById('tabButtonFinanceiro').classList.add('border-indigo-500', 'text-indigo-600');
        document.getElementById('tabButtonFinanceiro').classList.remove('border-transparent', 'text-gray-500');
    } else if (tab === 'calendario') {
        document.getElementById('configTabCalendario').classList.remove('hidden');
        document.getElementById('tabButtonCalendario').classList.add('border-indigo-500', 'text-indigo-600');
        document.getElementById('tabButtonCalendario').classList.remove('border-transparent', 'text-gray-500');
    }
};

// Fechar modal de configuração
window.closeScheduleConfigModal = function() {
    document.getElementById('scheduleConfigModal').classList.add('hidden');
};

// Funções globais para abrir/fechar modal de agendas
window.openSchedulesModal = function() {
    document.getElementById('schedulesModal').classList.remove('hidden');
    carregarAgendas();
};

window.closeSchedulesModal = function() {
    document.getElementById('schedulesModal').classList.add('hidden');
};

// Exportar função para obter ID da agenda ativa
export function getActiveScheduleId() {
    return agendaAtiva ? agendaAtiva.id_agenda : null;
}

// Exportar função para obter a agenda ativa completa
export function getActiveSchedule() {
    return agendaAtiva;
}