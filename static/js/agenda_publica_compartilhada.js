/**
 * Agenda de Trabalho - JavaScript para visualização pública compartilhada
 */

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    inicializarCalendario();
    renderizarCompromissos();
    renderizarResumoHoras();

    // Verificar se é mobile e ajustar a visualização
    if (window.innerWidth <= 768) {
        ajustarParaVisaoMobile();
    }

    // Adicionar listener para redimensionamento da janela
    window.addEventListener('resize', function () {
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
    const diasExibidos = Object.entries(diasSemanaNomes)
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
    // Iterar sobre compromissos
    compromissos.forEach(compromisso => {
        const dayContainer = document.getElementById(`day-${compromisso.dia_semana}`);
        if (!dayContainer) return; // Se o dia não estiver sendo exibido

        // Obter informações do local
        const local = locaisMap[compromisso.local_id];
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
                <strong class="text-xs md:text-sm">${local.nome}</strong>
            </div>
            <div class="text-center font-bold text-xs md:text-sm">${formatarHora(compromisso.hora_inicio)} - ${formatarHora(compromisso.hora_fim)}</div>
            <hr class="my-1">
            <div class="text-xs mt-1 md:mt-2 hidden md:block">${compromisso.descricao || ''}</div>
            <div class="text-xs mt-1 md:hidden">${(compromisso.descricao || '').substring(0, 30)}${(compromisso.descricao || '').length > 30 ? '...' : ''}</div>
        `;

        dayContainer.appendChild(appointmentElement);
    });
}

// Renderizar resumo de horas
function renderizarResumoHoras() {
    const summaryContainer = document.getElementById('horasSummary');
    summaryContainer.innerHTML = '';

    let totalGeralHoras = 0;

    Object.entries(totalHorasPorLocal).forEach(([localId, horas]) => {
        const local = locaisMap[localId];
        if (!local) return;

        totalGeralHoras += parseFloat(horas);

        const card = document.createElement('div');
        card.className = 'p-3 rounded text-white';
        card.style.backgroundColor = local.cor;
        
        card.innerHTML = `
            <h4 class="font-bold">${local.nome}</h4>
            <p class="text-lg">${horas}h</p>
        `;

        summaryContainer.appendChild(card);
    });

    // Adicionar card de total geral
    if (totalGeralHoras > 0) {
        const totalCard = document.createElement('div');
        totalCard.className = 'p-3 rounded bg-gray-800 text-white md:col-span-full';
        totalCard.innerHTML = `
            <h4 class="font-bold">Total Geral</h4>
            <p class="text-xl">${totalGeralHoras.toFixed(1)}h</p>
        `;
        summaryContainer.appendChild(totalCard);
    }
}

// Ajustar para visualização mobile (restante das funções igual ao agenda_publica.js)
function ajustarParaVisaoMobile() {
    // ... (código idêntico ao agenda_publica.js)
}

// Funções auxiliares
function converterTempoParaMinutos(tempo) {
    if (!tempo) return 0;
    const [horas, minutos] = tempo.split(':').map(Number);
    return horas * 60 + minutos;
}

function formatarHora(hora) {
    if (hora && hora.includes(':')) {
        return hora.split(':').slice(0, 2).join('h');
    }
    return hora;
}

// ... (restante das funções de navegação mobile idênticas ao agenda_publica.js)