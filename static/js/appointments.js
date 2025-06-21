/**
 * Agenda de Trabalho - Gestão de Compromissos
 */

import { atualizarDadosGlobais, compromissos, locaisTrabalho } from './app.js';
import { renderizarCompromissos } from './calendar.js';
import { atualizarRelatorios } from './reports.js';
import { converterTempoParaMinutos } from './utils.js';
import { getActiveScheduleId } from './schedules.js';

// Carregar compromissos do servidor
export function carregarCompromissos() {
    const agendaId = getActiveScheduleId();

    if (!agendaId) {
        // Se não há agenda ativa, limpar compromissos
        atualizarDadosGlobais('compromissos', []);
        return Promise.resolve();
    }

    return fetch(`/agendas/${agendaId}/compromissos`)
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.compromissos) {
                atualizarDadosGlobais('compromissos', data.compromissos);
            }
        })
        .catch(error => {
            console.error('Erro ao carregar compromissos:', error);
            atualizarDadosGlobais('compromissos', []);
        });
}

// Abrir modal de compromisso
export function openAppointmentModal(idCompromisso = null) {
    // Verificar se há agenda ativa
    const agendaId = getActiveScheduleId();
    if (!agendaId) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Selecione ou crie uma agenda antes de adicionar compromissos.'
        });
        return;
    }

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

// Fechar modal de compromisso
export function closeAppointmentModal() {
    document.getElementById('appointmentModal').classList.add('hidden');
}

// Calcular duração do compromisso baseado nos horários
export function calculateDuration() {
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

// Salvar compromisso
export function salvarCompromisso(e) {
    e.preventDefault();

    const agendaId = getActiveScheduleId();
    if (!agendaId) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Nenhuma agenda ativa selecionada'
        });
        return;
    }

    const idCompromisso = document.getElementById('editingId').value;
    const diaSemana = parseInt(document.getElementById('dayOfWeek').value);
    const localId = document.getElementById('workplace').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const description = document.getElementById('description').value;
    const hourType = document.querySelector('input[name="hourType"]:checked').value;
    const duration = parseFloat(document.getElementById('duration').value);

    // Validações básicas
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
    const url = idCompromisso ?
        `/agendas/${agendaId}/compromissos/${idCompromisso}` :
        `/agendas/${agendaId}/compromissos`;

    // Mostrar loading
    Swal.fire({
        title: 'Salvando...',
        text: 'Aguarde enquanto salvamos o compromisso',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

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

// Atalho para editar compromisso
export function editarCompromisso(idCompromisso) {
    openAppointmentModal(idCompromisso);
}

// Excluir compromisso
export function excluirCompromisso(idCompromisso) {
    const agendaId = getActiveScheduleId();
    if (!agendaId) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Nenhuma agenda ativa selecionada'
        });
        return;
    }

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
            fetch(`/agendas/${agendaId}/compromissos/${idCompromisso}`, {
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