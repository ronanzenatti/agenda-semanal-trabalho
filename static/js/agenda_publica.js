/**
 * Agenda de Trabalho - JavaScript para visualização pública
 */

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    inicializarCalendario();
    renderizarCompromissos();
    
    // Verificar se é mobile e ajustar a visualização
    if (window.innerWidth <= 768) {
        ajustarParaVisaoMobile();
    }
    
    // Adicionar listener para redimensionamento da janela
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768) {
            ajustarParaVisaoMobile();
        } else {
            // Em desktop, mostrar todos os dias
            const dayContainers = document.querySelectorAll('.day-container');
            dayContainers.forEach(container => {
                container.style.display = 'block';
            });
            
            // Ocultar navegação de dias
            const navContainer = document.getElementById('day-navigation');
            navContainer.classList.add('hidden');
        }
    });
});

// Inicializar o calendário
function inicializarCalendario() {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    // Filtrar dias da semana conforme configurações
    const diasExibidos = Object.entries(diasSemana)
        .filter(([dia]) => configuracoes.dias_semana.includes(parseInt(dia)))
        .map(([dia, nome]) => ({ dia: parseInt(dia), nome }));
    
    // Definir grid-cols baseado no número de dias
    calendar.className = `grid gap-2`;
    
    // Adicionar classe para desktop
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
    const horaInicio = parseInt(configuracoes.hora_inicio_padrao?.split(':')[0] || 7);
    const horaFim = parseInt(configuracoes.hora_fim_padrao?.split(':')[0] || 23);
    
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
    // Dias da semana para exibir
    const diasSemanaExibidos = configuracoes.dias_semana || [1, 2, 3, 4, 5, 6];
    
    // Iterar sobre compromissos
    compromissos.forEach(compromisso => {
        const dayContainer = document.getElementById(`day-${compromisso.dia_semana}`);
        if (!dayContainer) return; // Se o dia não estiver sendo exibido
        
        // Encontrar o local de trabalho correspondente
        const local = locaisTrabalho.find(l => l.id_local === compromisso.local_id);
        if (!local) return;
        
        const horaInicio = parseInt(configuracoes.hora_inicio_padrao?.split(':')[0] || 7);
        const startMinutes = converterTempoParaMinutos(compromisso.hora_inicio);
        const endMinutes = converterTempoParaMinutos(compromisso.hora_fim);
        
        // Calcular posição e altura
        const topPosition = ((startMinutes - (horaInicio * 60)) / 60) * 60;
        const height = ((endMinutes - startMinutes) / 60) * 60;
        
        // Criar elemento do compromisso
        const appointmentElement = document.createElement('div');
        appointmentElement.className = 'appointment absolute w-[95%] rounded text-white p-2';
        appointmentElement.style.backgroundColor = local.cor;
        appointmentElement.style.top = `${topPosition}px`;
        appointmentElement.style.height = `${height}px`;
        appointmentElement.style.marginLeft = "15px";
        appointmentElement.style.border = "0.5px solid #fff";
        
        appointmentElement.innerHTML = `
            <div class="flex justify-between items-center text-sm">
                <strong class="text-xs md:text-sm">${local.nome} (${compromisso.duracao} ${compromisso.tipo_hora})</strong>
            </div>
            <div class="text-end font-bold text-xs md:text-sm">${compromisso.hora_inicio} - ${compromisso.hora_fim}</div> <hr>
            <div class="text-xs mt-1 md:mt-3 hidden md:block">${compromisso.descricao}</div>
            <div class="text-xs mt-1 md:hidden">${compromisso.descricao.substring(0, 30)}${compromisso.descricao.length > 30 ? '...' : ''}</div>
        `;
        
        dayContainer.appendChild(appointmentElement);
    });
}

// Ajustar para visualização mobile
function ajustarParaVisaoMobile() {
    // Encontrar o dia atual
    const hoje = new Date().getDay();
    
    // Encontrar o dia mais próximo na lista de dias configurados
    let diaProximo = encontrarDiaProximo(hoje);
    
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
    
    // Mostrar e configurar controles de navegação
    const navContainer = document.getElementById('day-navigation');
    navContainer.classList.remove('hidden');
    
    // Atualizar o texto do dia atual
    document.getElementById('current-day-display').textContent = diasSemana[diaProximo];
    
    // Adicionar event listeners para navegação
    document.getElementById('prev-day').addEventListener('click', navegarParaDiaAnterior);
    document.getElementById('next-day').addEventListener('click', navegarParaProximoDia);
}

// Encontrar o dia mais próximo do atual
function encontrarDiaProximo(hoje) {
    if (!configuracoes.dias_semana || configuracoes.dias_semana.length === 0) {
        return hoje;
    }
    
    // Se o dia atual está na lista, retorne-o
    if (configuracoes.dias_semana.includes(hoje)) {
        return hoje;
    }
    
    // Caso contrário, encontre o dia mais próximo
    let menorDiferenca = 7;
    let diaProximo = configuracoes.dias_semana[0];
    
    configuracoes.dias_semana.forEach(dia => {
        // Calcular diferença
        const diferenca = Math.abs(dia - hoje);
        if (diferenca < menorDiferenca) {
            menorDiferenca = diferenca;
            diaProximo = dia;
        }
    });
    
    return diaProximo;
}

// Navegação entre dias
function navegarParaDiaAnterior() {
    navegarEntreDias(-1);
}

function navegarParaProximoDia() {
    navegarEntreDias(1);
}

function navegarEntreDias(direcao) {
    // Ordenar dias disponíveis
    const diasOrdenados = [...configuracoes.dias_semana].sort((a, b) => a - b);
    
    // Encontrar dia atual visível
    let diaAtual = null;
    document.querySelectorAll('.day-container').forEach(container => {
        if (container.style.display === 'block') {
            diaAtual = parseInt(container.getAttribute('data-day'));
        }
    });
    
    if (diaAtual !== null) {
        // Encontrar posição atual
        const posicaoAtual = diasOrdenados.indexOf(diaAtual);
        
        // Calcular próxima posição
        const proximaPosicao = (posicaoAtual + direcao + diasOrdenados.length) % diasOrdenados.length;
        const proximoDia = diasOrdenados[proximaPosicao];
        
        // Atualizar visualização
        document.querySelectorAll('.day-container').forEach(container => {
            const dia = parseInt(container.getAttribute('data-day'));
            container.style.display = dia === proximoDia ? 'block' : 'none';
        });
        
        // Atualizar texto do dia exibido
        document.getElementById('current-day-display').textContent = diasSemana[proximoDia];
    }
}

// Funções utilitárias
function converterTempoParaMinutos(tempo) {
    if (!tempo) return 0;
    const [horas, minutos] = tempo.split(':').map(Number);
    return horas * 60 + minutos;
}
