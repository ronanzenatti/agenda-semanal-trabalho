/**
 * Agenda de Trabalho - Gestão de Compromissos
 */

import { atualizarDadosGlobais, compromissos, locaisTrabalho } from './app.js';
import { renderizarCompromissos } from './calendar.js';
import { atualizarRelatorios } from './reports.js';
import { converterTempoParaMinutos } from './utils.js';

// Carregar compromissos do servidor
export function carregarCompromissos() {
    return fetch('/compromissos')
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.compromissos) {
                atualizarDadosGlobais('compromissos', data.compromissos);
            }
        });
}

// Abrir modal de compromisso
export function openAppointmentModal(idCompromisso = null) {
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

// Atalho para editar compromisso
export function editarCompromisso(idCompromisso) {
    openAppointmentModal(idCompromisso);
}

// Excluir compromisso
export function excluirCompromisso(idCompromisso) {
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
