/**
 * Agenda de Trabalho - Autenticação e Gestão de Usuário
 */

import { formatarCPF } from './utils.js';

// Verificar se o usuário está autenticado
export function verificarUsuario() {
    const nome = sessionStorage.getItem('nome');
    const cpf = sessionStorage.getItem('cpf');
    
    if (nome && cpf) {
        document.getElementById('userDisplayName').innerHTML = `Usuário: <b class="text-blue-700">${nome} (${formatarCPF(cpf)})</b>`;
    } else {
        // Redirecionar para login se não estiver autenticado
        window.location.href = '/login';
    }
}

// Realizar logout
export function logout() {
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
