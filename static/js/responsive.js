/**
 * Agenda de Trabalho - Ajustes Responsivos
 */

import { configuracoes, diasSemana } from './app.js';
import { renderizarCompromissos } from './calendar.js';

// Inicializar o menu móvel
export function inicializarMenuMobile() {
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

// Abrir menu móvel
export function abrirMenu() {
    document.getElementById('mobile-menu').classList.add('open');
    document.getElementById('mobile-menu-overlay').classList.add('active');
    document.body.style.overflow = 'hidden'; // Impedir rolagem
}

// Fechar menu móvel
export function fecharMenu() {
    document.getElementById('mobile-menu').classList.remove('open');
    document.getElementById('mobile-menu-overlay').classList.remove('active');
    document.body.style.overflow = ''; // Restaurar rolagem
}

// Verificar responsividade quando a janela é redimensionada
export function verificarResponsividade() {
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

// Função para ajustar a visualização do calendário em dispositivos móveis
export function ajustarVisualizacaoParaMobile() {
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
export function encontrarDiaProximo(hoje) {
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
export function adicionarControlesNavegacao(diaAtual) {
    // Obter o container de navegação
    const navContainer = document.getElementById('day-navigation');
    if (!navContainer) return;

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
export function navegarParaDiaAnterior() {
    navegarEntreDias(-1);
}

// Navega para o próximo dia na lista de dias configurados
export function navegarParaProximoDia() {
    navegarEntreDias(1);
}

// Função comum para navegação entre dias
export function navegarEntreDias(direcao) {
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
        const currentDayDisplay = document.getElementById('current-day-display');
        if (currentDayDisplay) {
            currentDayDisplay.textContent = diasSemana[proximoDia];
        }
    }
}
