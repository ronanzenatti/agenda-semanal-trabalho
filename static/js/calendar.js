/**
 * Agenda de Trabalho - Renderização e Manipulação do Calendário
 */
import { diasSemana, configuracoes, compromissos, locaisTrabalho } from './app.js';
import { converterTempoParaMinutos, formatarHora } from './utils.js';

// Inicializar o calendário com suporte a responsividade
export function inicializarCalendario() {
    const calendar = document.getElementById('calendar');
    if (!calendar) return;

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

// Gerar marcadores de tempo para o calendário
export function gerarMarcadoresTempo() {
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
export function renderizarCompromissos() {
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
            <div class="text-center font-bold text-xs md:text-sm">${formatarHora(compromisso.hora_inicio)} - ${formatarHora(compromisso.hora_fim)}</div> <hr>
            <div class="text-xs mt-1 md:mt-3 hidden md:block">${compromisso.descricao}</div>
            <div class="text-xs mt-1 md:hidden">${compromisso.descricao.substring(0, 30)}${compromisso.descricao.length > 30 ? '...' : ''}</div>
        `;

        dayContainer.appendChild(appointmentElement);
    });
}
