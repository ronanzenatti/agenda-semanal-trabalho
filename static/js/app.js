/**
 * Agenda de Trabalho - JavaScript Principal (Responsivo)
 */

// Variáveis Globais
let compromissos = [];
let locaisTrabalho = [];
let configuracoes = {
    diasSemana: [1, 2, 3, 4, 5, 6],
    horaInicioPadrao: '07:00',
    horaFimPadrao: '23:00'
};

// Nomes dos dias da semana
const diasSemana = {
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
    verificarUsuario();
    
    // Inicializar o menu móvel
    inicializarMenuMobile();
    
    // Inicializar listeners dos formulários
    inicializarEventListeners();
    
    // Carregar dados iniciais
    carregarDados();
    
    // Adicionar listener para redimensionamento da janela
    window.addEventListener('resize', verificarResponsividade);
});

// Funções de verificação e autenticação
function verificarUsuario() {
    const nome = sessionStorage.getItem('nome');
    const cpf = sessionStorage.getItem('cpf');
    
    if (nome && cpf) {
        document.getElementById('userDisplayName').innerHTML = `Usuário: <b class="text-blue-700">${nome} (${formatarCPF(cpf)})</b>`;
    } else {
        // Redirecionar para login se não estiver autenticado
        window.location.href = '/login';
    }
}

function logout() {
    fetch('/auth/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.sucesso) {
            // Limpar dados da sessão
            sessionStorage.clear();
            // Redirecionar para login
            window.location.href = '/login';
        }
    })
    .catch(error => {
        console.error('Erro ao fazer logout:', error);
        // Em caso de erro, forçar logout local
        sessionStorage.clear();
        window.location.href = '/login';
    });
}

// Funções para manipulação de compromissos
function openWorkplaceModal() {
    document.getElementById('workplaceModal').classList.remove('hidden');
}

function closeWorkplaceModal() {
    document.getElementById('workplaceModal').classList.add('hidden');
    hideWorkplaceForm();
}

function openAppointmentModal(idCompromisso = null) {
    // Resetar formulário
    document.getElementById('appointmentForm').reset();
    document.getElementById('editingId').value = '';
    
    if (idCompromisso) {
        const compromisso = compromissos.find(c => c.id_compromisso === idCompromisso);
        if (compromisso) {
            document.getElementById('appointmentFormTitle').textContent = 'Editar Compromisso';
            document.getElementById('editingId').value = idCompromisso;
            document.getElementById('dayOfWeek').value = compromisso.dia_semana;
            document.getElementById('workplace').value = compromisso.local_id;
            document.getElementById('startTime').value = compromisso.hora_inicio;
            document.getElementById('endTime').value = compromisso.hora_fim;
            document.getElementById('description').value = compromisso.descricao;
            document.querySelector(`input[name="hourType"][value="${compromisso.tipo_hora}"]`).checked = true;
            document.getElementById('duration').value = compromisso.duracao;
        }
    } else {
        document.getElementById('appointmentFormTitle').textContent = 'Novo Compromisso';
    }
    
    document.getElementById('appointmentModal').classList.remove('hidden');
}

function closeAppointmentModal() {
    document.getElementById('appointmentModal').classList.add('hidden');
}

function calculateDuration() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    if (startTime && endTime) {
        const start = converterTempoParaMinutos(startTime);
        const end = converterTempoParaMinutos(endTime);
        let duration = (end - start) / 60;
        
        // Arredondar para 0.5 mais próximo
        duration = Math.round(duration * 2) / 2;
        
        document.getElementById('duration').value = duration.toFixed(1);
    }
}

function salvarCompromisso(e) {
    e.preventDefault();
    
    const idCompromisso = document.getElementById('editingId').value;
    const diaSemana = parseInt(document.getElementById('dayOfWeek').value);
    const localId = document.getElementById('workplace').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const description = document.getElementById('description').value;
    const hourType = document.querySelector('input[name="hourType"]:checked').value;
    const duration = parseFloat(document.getElementById('duration').value);
    
    // Validações
    if (!localId) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Selecione um local de trabalho'
        });
        return;
    }
    
    // Verificar se a duração é positiva
    if (duration <= 0) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'A duração deve ser maior que zero'
        });
        return;
    }
    
    // Verificar limite de 8 horas por dia
    const localAtual = locaisTrabalho.find(l => l.id_local === localId);
    
    // Localizar compromissos do mesmo dia e local ou locais relacionados
    const compromissosMesmoDia = compromissos.filter(c => {
        // Ignorar o próprio compromisso em caso de edição
        if (idCompromisso && c.id_compromisso === idCompromisso) return false;
        
        // Verificar se é do mesmo dia
        if (c.dia_semana !== diaSemana) return false;
        
        // Verificar se é do mesmo local
        if (c.local_id === localId) return true;
        
        // Verificar se o local está relacionado
        const localCompromisso = locaisTrabalho.find(l => l.id_local === c.local_id);
        if (!localCompromisso) return false;
        
        // Verificar relação entre locais (em ambas direções)
        return (localCompromisso.relacionado_com === localId || localAtual.relacionado_com === c.local_id);
    });
    
    // Calcular total de horas para o dia
    const totalHorasDia = compromissosMesmoDia.reduce((total, c) => total + parseFloat(c.duracao), 0);
    
    if (totalHorasDia + duration > 8) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'O total de horas por dia para cada local (e locais relacionados) não pode exceder 8 horas!'
        });
        return;
    }
    
    // Verificar sobreposição de compromissos
    const start = converterTempoParaMinutos(startTime);
    const end = converterTempoParaMinutos(endTime);
    
    const temSobreposicao = compromissos.some(c => {
        // Ignorar o próprio compromisso em caso de edição
        if (idCompromisso && c.id_compromisso === idCompromisso) return false;
        
        // Verificar se é do mesmo dia
        if (c.dia_semana !== diaSemana) return false;
        
        const existingStart = converterTempoParaMinutos(c.hora_inicio);
        const existingEnd = converterTempoParaMinutos(c.hora_fim);
        
        return (start < existingEnd && end > existingStart);
    });
    
    if (temSobreposicao) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Já existe um compromisso neste horário!'
        });
        return;
    }
    
    // Verificar período de carência entre locais diferentes
    const localRelacionado = locaisTrabalho.find(l => l.id_local === localAtual.relacionado_com);
    const periodoCarencia = localAtual.periodo_carencia;
    
    const temViolacaoCarencia = compromissos.some(c => {
        // Ignorar o próprio compromisso em caso de edição
        if (idCompromisso && c.id_compromisso === idCompromisso) return false;
        
        // Verificar se é do mesmo dia
        if (c.dia_semana !== diaSemana) return false;
        
        // Ignorar se for do mesmo local ou de um local relacionado
        if (c.local_id === localId) return false;
        if (localRelacionado && c.local_id === localRelacionado.id_local) return false;
        
        const existingStart = converterTempoParaMinutos(c.hora_inicio);
        const existingEnd = converterTempoParaMinutos(c.hora_fim);
        
        const graceBefore = start - existingEnd;
        const graceAfter = existingStart - end;
        
        return (graceBefore >= 0 && graceBefore < periodoCarencia) || 
               (graceAfter >= 0 && graceAfter < periodoCarencia);
    });
    
    if (temViolacaoCarencia) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: `É necessário respeitar o período de carência de ${periodoCarencia} minutos entre locais diferentes!`
        });
        return;
    }
    
    // Preparar dados para envio
    const dados = {
        local_id: localId,
        dia_semana: diaSemana,
        hora_inicio: startTime,
        hora_fim: endTime,
        descricao: description,
        tipo_hora: hourType,
        duracao: duration
    };
    
    // Método e URL baseados em ser novo ou edição
    const metodo = idCompromisso ? 'PUT' : 'POST';
    const url = idCompromisso ? `/compromissos/${idCompromisso}` : '/compromissos';
    
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
                text: 'Compromisso salvo com sucesso!'
            });
            
            closeAppointmentModal();
            
            // Recarregar compromissos
            carregarCompromissos()
                .then(() => renderizarCompromissos())
                .then(() => atualizarRelatorios());
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: data.mensagem || 'Erro ao salvar compromisso'
            });
        }
    })
    .catch(error => {
        console.error('Erro ao salvar compromisso:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Falha ao comunicar com o servidor'
        });
    });
}

function excluirCompromisso(idCompromisso) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Esta ação não poderá ser revertida!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/compromissos/${idCompromisso}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.sucesso) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Excluído!',
                        text: 'Compromisso removido com sucesso.'
                    });
                    
                    // Recarregar compromissos
                    carregarCompromissos()
                        .then(() => renderizarCompromissos())
                        .then(() => atualizarRelatorios());
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: data.mensagem || 'Erro ao excluir compromisso'
                    });
                }
            })
            .catch(error => {
                console.error('Erro ao excluir compromisso:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Falha ao comunicar com o servidor'
                });
            });
        }
    });
}

// Funções para modal de ajuda
function openHelpModal() {
    document.getElementById('helpModal').classList.remove('hidden');
}

function closeHelpModal() {
    document.getElementById('helpModal').classList.add('hidden');
}

// Funções utilitárias
function converterTempoParaMinutos(tempo) {
    const [horas, minutos] = tempo.split(':').map(Number);
    return horas * 60 + minutos;
}

function obterCorLocal(nomeLocal) {
    const local = locaisTrabalho.find(l => l.nome === nomeLocal);
    return local ? local.cor : '#cccccc';
}

function formatarCPF(cpf) {
    // Remover caracteres não numéricos
    cpf = cpf.replace(/\D/g, '');
    
    // Verificar se tem 11 dígitos
    if (cpf.length !== 11) return cpf;
    
    // Formatar como 000.000.000-00
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Função para expor fechamento do menu móvel para acesso global
window.closeMenu = fecharMenu;error => {
        console.error('Erro ao salvar compromisso:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Falha ao comunicar com o servidor'
        });
    });
}

// Funções para o menu móvel
function inicializarMenuMobile() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const closeMenuButton = document.getElementById('close-menu-button');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', abrirMenu);
    }
    
    if (closeMenuButton) {
        closeMenuButton.addEventListener('click', fecharMenu);
    }
    
    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', fecharMenu);
    }
}

function abrirMenu() {
    document.getElementById('mobile-menu').classList.add('open');
    document.getElementById('mobile-menu-overlay').classList.add('active');
    document.body.style.overflow = 'hidden'; // Impedir rolagem
}

function fecharMenu() {
    document.getElementById('mobile-menu').classList.remove('open');
    document.getElementById('mobile-menu-overlay').classList.remove('active');
    document.body.style.overflow = ''; // Restaurar rolagem
}

// Verificar responsividade quando a janela é redimensionada
function verificarResponsividade() {
    if (window.innerWidth <= 768) {
        ajustarVisualizacaoParaMobile();
    } else {
        // Em desktop, mostrar todos os dias
        const dayContainers = document.querySelectorAll('.day-container');
        dayContainers.forEach(container => {
            container.style.display = 'block';
        });
        
        // Remover navegação de dias se existir
        const navContainer = document.getElementById('day-navigation');
        if (navContainer) {
            navContainer.innerHTML = '';
            navContainer.classList.add('hidden');
        }
    }
}

// Inicialização de Event Listeners
function inicializarEventListeners() {
    // Formulário de configurações
    document.getElementById('configForm').addEventListener('submit', salvarConfiguracoes);
    
    // Formulário de locais de trabalho
    document.getElementById('newWorkplaceForm').addEventListener('submit', salvarLocalTrabalho);
    document.getElementById('addWorkplaceBtn').addEventListener('click', mostrarFormularioLocalTrabalho);
    
    // Formulário de compromissos
    document.getElementById('appointmentForm').addEventListener('submit', salvarCompromisso);
    
    // Listener para atualização de relatórios
    document.getElementById('periodSelect').addEventListener('change', atualizarRelatorios);
}

// Carregamento de dados
function carregarDados() {
    // Carregar configurações do usuário
    carregarConfiguracoes()
        .then(() => {
            // Inicializar calendário após carregar configurações
            inicializarCalendario();
            
            // Carregar locais de trabalho
            return carregarLocaisTrabalho();
        })
        .then(() => {
            // Carregar compromissos
            return carregarCompromissos();
        })
        .then(() => {
            // Renderizar compromissos
            renderizarCompromissos();
            
            // Verificar se é mobile para ajustar visualização
            if (window.innerWidth <= 768) {
                ajustarVisualizacaoParaMobile();
            }
            
            // Atualizar relatórios
            atualizarRelatorios();
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

// Carregar configurações do usuário
function carregarConfiguracoes() {
    return fetch('/configuracoes')
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.configuracoes) {
                configuracoes = {
                    diasSemana: data.configuracoes.dias_semana,
                    horaInicioPadrao: data.configuracoes.hora_inicio_padrao,
                    horaFimPadrao: data.configuracoes.hora_fim_padrao
                };
                
                // Atualizar interface com as configurações
                atualizarInterfaceConfiguracoes();
            }
        });
}

function atualizarInterfaceConfiguracoes() {
    // Atualizar checkboxes dos dias da semana
    const checkboxes = document.querySelectorAll('input[name="daysToShow"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = configuracoes.diasSemana.includes(parseInt(checkbox.value));
    });
    
    // Atualizar horários padrão
    document.getElementById('defaultStartTime').value = configuracoes.horaInicioPadrao;
    document.getElementById('defaultEndTime').value = configuracoes.horaFimPadrao;
}

// Carregar locais de trabalho
function carregarLocaisTrabalho() {
    return fetch('/locais')
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.locais) {
                locaisTrabalho = data.locais;
                atualizarInterfaceLocaisTrabalho();
            }
        });
}

function atualizarInterfaceLocaisTrabalho() {
    // Atualizar lista de locais de trabalho
    const listaLocais = document.getElementById('workplacesList');
    listaLocais.innerHTML = '';
    
    if (locaisTrabalho.length === 0) {
        listaLocais.innerHTML = '<p class="text-gray-500 italic">Nenhum local de trabalho cadastrado.</p>';
    } else {
        locaisTrabalho.forEach(local => {
            const localElement = document.createElement('div');
            localElement.className = 'flex justify-between items-center p-3 border rounded';
            localElement.style.borderLeft = `4px solid ${local.cor}`;
            
            localElement.innerHTML = `
                <div>
                    <strong>${local.nome}</strong>
                    <p class="text-sm">Valor/Hora: R$ ${parseFloat(local.valor_hora).toFixed(2)} | 
                       Acréscimo HA: ${local.acrescimo_ha_percent}% | 
                       Carência: ${local.periodo_carencia} min</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editarLocalTrabalho('${local.id_local}')" class="bg-yellow-500 text-white p-2 rounded hover:bg-yellow-600">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="excluirLocalTrabalho('${local.id_local}')" class="bg-red-500 text-white p-2 rounded hover:bg-red-600">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            listaLocais.appendChild(localElement);
        });
    }
    
    // Atualizar dropdown de relacionamentos em locais de trabalho
    const selectRelacionado = document.getElementById('workplaceRelated');
    selectRelacionado.innerHTML = '<option value="">Nenhum</option>';
    
    locaisTrabalho.forEach(local => {
        const option = document.createElement('option');
        option.value = local.id_local;
        option.textContent = local.nome;
        selectRelacionado.appendChild(option);
    });
    
    // Atualizar dropdown de locais de trabalho no formulário de compromissos
    const selectLocal = document.getElementById('workplace');
    selectLocal.innerHTML = '';
    
    locaisTrabalho.forEach(local => {
        const option = document.createElement('option');
        option.value = local.id_local;
        option.textContent = local.nome;
        selectLocal.appendChild(option);
    });
}

// Carregar compromissos
function carregarCompromissos() {
    return fetch('/compromissos')
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.compromissos) {
                compromissos = data.compromissos;
            }
        });
}

// Inicializar o calendário com suporte a responsividade
function inicializarCalendario() {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    // Filtrar dias da semana conforme configurações
    const diasExibidos = Object.entries(diasSemana)
        .filter(([dia]) => configuracoes.diasSemana.includes(parseInt(dia)))
        .map(([dia, nome]) => ({ dia: parseInt(dia), nome }));
    
    // Definir grid-cols baseado no número de dias
    calendar.className = `grid gap-2`;
    
    // Adicionar classe para ajustar as colunas em telas maiores
    if (diasExibidos.length > 0) {
        calendar.classList.add(`md:grid-cols-${diasExibidos.length}`);
    }
    
    // Adicionar colunas dos dias
    diasExibidos.forEach(({ dia, nome }) => {
        const dayElement = document.createElement('div');
        dayElement.className = 'border p-2 relative day-container';
        dayElement.setAttribute('data-day', dia);
        dayElement.innerHTML = `
            <h3 class="font-bold mb-2">${nome}</h3>
            <div id="day-${dia}" class="appointments-container relative" style="height: 960px;">
                ${gerarMarcadoresTempo()}
            </div>
        `;
        calendar.appendChild(dayElement);
    });
}

// Gerar marcadores de tempo
function gerarMarcadoresTempo() {
    let markers = '';
    const horaInicio = parseInt(configuracoes.horaInicioPadrao.split(':')[0]);
    const horaFim = parseInt(configuracoes.horaFimPadrao.split(':')[0]);
    
    for (let hora = horaInicio; hora <= horaFim; hora++) {
        markers += `
            <div class="absolute w-full border-t border-gray-300" style="top: ${(hora - horaInicio) * 60}px;">
                <span class="absolute -mt-3 -ml-2 text-xs text-gray-500">${hora}h</span>
            </div>
        `;
        if (hora < horaFim) {
            markers += `
                <div class="absolute w-full border-t border-gray-300 border-dashed" style="top: ${(hora - horaInicio) * 60 + 30}px;">
                </div>
            `;
        }
    }
    
    return markers;
}

// Renderizar compromissos no calendário
function renderizarCompromissos() {
    // Primeiro, limpar os compromissos atuais (mantendo os marcadores de tempo)
    configuracoes.diasSemana.forEach(dia => {
        const dayContainer = document.getElementById(`day-${dia}`);
        if (dayContainer) {
            dayContainer.innerHTML = gerarMarcadoresTempo();
        }
    });
    
    // Filtrar compromissos e ordená-los por hora de início
    compromissos.forEach(compromisso => {
        const dayContainer = document.getElementById(`day-${compromisso.dia_semana}`);
        if (!dayContainer) return; // Se o dia não estiver sendo exibido
        
        // Encontrar o local de trabalho correspondente
        const local = locaisTrabalho.find(l => l.id_local === compromisso.local_id);
        if (!local) return;
        
        const horaInicio = parseInt(configuracoes.horaInicioPadrao.split(':')[0]);
        const startMinutes = converterTempoParaMinutos(compromisso.hora_inicio);
        const endMinutes = converterTempoParaMinutos(compromisso.hora_fim);
        
        // Calcular posição e altura
        const topPosition = ((startMinutes - (horaInicio * 60)) / 60) * 60;
        const height = ((endMinutes - startMinutes) / 60) * 60;
        
        // Criar elemento do compromisso
        const appointmentElement = document.createElement('div');
        appointmentElement.className = 'appointment absolute w-[95%] rounded text-white p-2 cursor-pointer transition-all hover:shadow-lg';
        appointmentElement.style.backgroundColor = local.cor;
        appointmentElement.style.top = `${topPosition}px`;
        appointmentElement.style.height = `${height}px`;
        appointmentElement.style.marginLeft = "15px";
        appointmentElement.style.border = "0.5px solid #fff";
        
        appointmentElement.innerHTML = `
            <div class="flex justify-between items-center">
                <strong class="text-xs md:text-sm">${local.nome} (${compromisso.duracao} ${compromisso.tipo_hora})</strong>
                <div>
                    <button onclick="editarCompromisso('${compromisso.id_compromisso}')" class="text-xs bg-yellow-200 text-gray-800 px-2 py-1 rounded">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="excluirCompromisso('${compromisso.id_compromisso}')" class="text-xs bg-red-500 text-white px-2 py-1 rounded ml-1">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="text-center font-bold text-xs md:text-sm">${compromisso.hora_inicio} - ${compromisso.hora_fim}</div> <hr>
            <div class="text-xs mt-1 md:mt-3 hidden md:block">${compromisso.descricao}</div>
            <div class="text-xs mt-1 md:hidden">${compromisso.descricao.substring(0, 30)}${compromisso.descricao.length > 30 ? '...' : ''}</div>
        `;
        
        dayContainer.appendChild(appointmentElement);
    });
}

// Função para ajustar a visualização do calendário em dispositivos móveis
function ajustarVisualizacaoParaMobile() {
    // Encontrar o dia atual
    const today = new Date().getDay();
    
    // Encontrar o dia mais próximo na lista de dias configurados
    let diaProximo = encontrarDiaProximo(today);
    
    // Esconder todos os dias exceto o mais próximo
    const diasContainers = document.querySelectorAll('.day-container');
    diasContainers.forEach(container => {
        const diaDaSemana = parseInt(container.getAttribute('data-day'));
        if (diaDaSemana === diaProximo) {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    });
    
    // Adicionar controles de navegação se não existirem
    adicionarControlesNavegacao(diaProximo);
}

// Encontra o dia mais próximo do atual na lista de dias configurados
function encontrarDiaProximo(hoje) {
    if (!configuracoes.diasSemana || configuracoes.diasSemana.length === 0) {
        return hoje;
    }
    
    // Se o dia atual está na lista, retorne-o
    if (configuracoes.diasSemana.includes(hoje)) {
        return hoje;
    }
    
    // Caso contrário, encontre o dia mais próximo
    let menorDiferenca = 7;
    let diaProximo = configuracoes.diasSemana[0];
    
    configuracoes.diasSemana.forEach(dia => {
        // Calcular a diferença circular (considerando a semana como um ciclo)
        let diferenca = Math.abs(dia - hoje);
        if (diferenca > 3) {
            diferenca = 7 - diferenca; // Ajustar para encontrar o caminho mais curto no ciclo
        }
        
        if (diferenca < menorDiferenca) {
            menorDiferenca = diferenca;
            diaProximo = dia;
        }
    });
    
    return diaProximo;
}

// Adiciona controles de navegação para calendário em mobile
function adicionarControlesNavegacao(diaAtual) {
    // Obter o container de navegação
    const navContainer = document.getElementById('day-navigation');
    
    // Limpar e mostrar o container
    navContainer.innerHTML = '';
    navContainer.classList.remove('hidden');
    
    // Criar elementos de navegação
    navContainer.className = 'flex justify-between items-center p-2 bg-gray-100 rounded-lg mb-2 md:hidden';
    navContainer.innerHTML = `
        <button id="prev-day" class="bg-blue-500 text-white px-3 py-1 rounded-full">
            <i class="fas fa-chevron-left"></i>
        </button>
        <div id="current-day-display" class="font-bold text-lg">${diasSemana[diaAtual]}</div>
        <button id="next-day" class="bg-blue-500 text-white px-3 py-1 rounded-full">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    // Adicionar event listeners
    document.getElementById('prev-day').addEventListener('click', navegarParaDiaAnterior);
    document.getElementById('next-day').addEventListener('click', navegarParaProximoDia);
}

// Navega para o dia anterior na lista de dias configurados
function navegarParaDiaAnterior() {
    navegarEntreDias(-1);
}

// Navega para o próximo dia na lista de dias configurados
function navegarParaProximoDia() {
    navegarEntreDias(1);
}

// Função comum para navegação entre dias
function navegarEntreDias(direcao) {
    // Ordenar os dias da semana disponíveis
    const diasOrdenados = [...configuracoes.diasSemana].sort((a, b) => a - b);
    
    // Encontrar o dia atualmente visível
    let diaAtual = null;
    document.querySelectorAll('.day-container').forEach(container => {
        if (container.style.display === 'block') {
            diaAtual = parseInt(container.getAttribute('data-day'));
        }
    });
    
    if (diaAtual !== null) {
        // Encontrar a posição do dia atual na lista ordenada
        const posicaoAtual = diasOrdenados.indexOf(diaAtual);
        
        // Calcular a próxima posição
        const proximaPosicao = (posicaoAtual + direcao + diasOrdenados.length) % diasOrdenados.length;
        const proximoDia = diasOrdenados[proximaPosicao];
        
        // Atualizar a visualização
        document.querySelectorAll('.day-container').forEach(container => {
            const dia = parseInt(container.getAttribute('data-day'));
            container.style.display = dia === proximoDia ? 'block' : 'none';
        });
        
        // Atualizar o texto do dia exibido
        document.getElementById('current-day-display').textContent = diasSemana[proximoDia];
    }
}

// Atualizar relatórios
function atualizarRelatorios() {
    const periodo = document.getElementById('periodSelect').value;
    
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

function atualizarInterfaceRelatorios(relatorio, periodo) {
    // Atualizar resumos por local de trabalho
    const workplaceSummaries = document.getElementById('workplaceSummaries');
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
    document.querySelector(`#${summaryContainer} .total-hours`).textContent = `${relatorio.total_horas.toFixed(1)}h`;
    document.querySelector(`#${summaryContainer} .total-value`).textContent = relatorio.total_valor.toFixed(2);
}

// Funções para manipulação de locais de trabalho
function mostrarFormularioLocalTrabalho() {
    document.getElementById('workplaceFormTitle').textContent = 'Novo Local de Trabalho';
    document.getElementById('workplaceId').value = '';
    document.getElementById('workplaceName').value = '';
    document.getElementById('workplaceColor').value = '#' + Math.floor(Math.random()*16777215).toString(16); // Cor aleatória
    document.getElementById('workplaceHourRate').value = '';
    document.getElementById('workplaceBonus').value = '0';
    document.getElementById('workplaceGrace').value = '60';
    document.getElementById('workplaceRelated').value = '';
    
    document.getElementById('workplaceForm').classList.remove('hidden');
}

function hideWorkplaceForm() {
    document.getElementById('workplaceForm').classList.add('hidden');
}

function editarLocalTrabalho(idLocal) {
    const local = locaisTrabalho.find(l => l.id_local === idLocal);
    if (!local) return;
    
    document.getElementById('workplaceFormTitle').textContent = 'Editar Local de Trabalho';
    document.getElementById('workplaceId').value = local.id_local;
    document.getElementById('workplaceName').value = local.nome;
    document.getElementById('workplaceColor').value = local.cor;
    document.getElementById('workplaceHourRate').value = local.valor_hora;
    document.getElementById('workplaceBonus').value = local.acrescimo_ha_percent;
    document.getElementById('workplaceGrace').value = local.periodo_carencia;
    document.getElementById('workplaceRelated').value = local.relacionado_com || '';
    
    document.getElementById('workplaceForm').classList.remove('hidden');
}

function salvarLocalTrabalho(e) {
    e.preventDefault();
    
    const idLocal = document.getElementById('workplaceId').value;
    const dados = {
        nome: document.getElementById('workplaceName').value,
        cor: document.getElementById('workplaceColor').value,
        valor_hora: parseFloat(document.getElementById('workplaceHourRate').value),
        acrescimo_ha_percent: parseInt(document.getElementById('workplaceBonus').value),
        periodo_carencia: parseInt(document.getElementById('workplaceGrace').value),
        relacionado_com: document.getElementById('workplaceRelated').value || null
    };
    
    // Método e URL baseados em ser novo ou edição
    const metodo = idLocal ? 'PUT' : 'POST';
    const url = idLocal ? `/locais/${idLocal}` : '/locais';
    
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
                text: 'Local de trabalho salvo com sucesso!'
            });
            
            hideWorkplaceForm();
            carregarLocaisTrabalho();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: data.mensagem || 'Erro ao salvar local de trabalho'
            });
        }
    })
    .catch(error => {
        console.error('Erro ao salvar local de trabalho:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Falha ao comunicar com o servidor'
        });
    });
}

function excluirLocalTrabalho(idLocal) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Esta ação não poderá ser revertida! Todos os compromissos associados a este local também serão removidos.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/locais/${idLocal}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.sucesso) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Excluído!',
                        text: 'Local de trabalho removido com sucesso.'
                    });
                    
                    // Recarregar dados
                    carregarLocaisTrabalho()
                        .then(() => carregarCompromissos())
                        .then(() => renderizarCompromissos())
                        .then(() => atualizarRelatorios());
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: data.mensagem || 'Erro ao excluir local de trabalho'
                    });
                }
            })
            .catch(error => {
                console.error('Erro ao excluir local de trabalho:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Falha ao comunicar com o servidor'
                });
            });
        }
    });
}

// Funções para modal de configurações
function openConfigModal() {
    atualizarInterfaceConfiguracoes();
    document.getElementById('configModal').classList.remove('hidden');
}

function closeConfigModal() {
    document.getElementById('configModal').classList.add('hidden');
}

function salvarConfiguracoes(e) {
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
            configuracoes = {
                diasSemana: dados.dias_semana,
                horaInicioPadrao: dados.hora_inicio_padrao,
                horaFimPadrao: dados.hora_fim_padrao
            };
            
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