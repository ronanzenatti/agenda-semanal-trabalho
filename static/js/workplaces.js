/**
 * Agenda de Trabalho - Gestão de Locais de Trabalho
 */

import { atualizarDadosGlobais, locaisTrabalho } from './app.js';
import { carregarCompromissos } from './appointments.js';
import { renderizarCompromissos } from './calendar.js';
import { atualizarRelatorios } from './reports.js';

// Carregar locais de trabalho do servidor
export function carregarLocaisTrabalho() {
    return fetch('/locais')
        .then(response => response.json())
        .then(data => {
            if (data.sucesso && data.locais) {
                atualizarDadosGlobais('locaisTrabalho', data.locais);
                atualizarInterfaceLocaisTrabalho();
            }
        });
}

// Atualizar interface com os locais de trabalho
export function atualizarInterfaceLocaisTrabalho() {
    // Atualizar lista de locais de trabalho
    const listaLocais = document.getElementById('workplacesList');
    if (!listaLocais) return;

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
                    <p class="text-sm">Acréscimo HA: ${local.acrescimo_ha_percent || 0}% |
                       Carência: ${local.periodo_carencia || 0} min</p>
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
    if (selectRelacionado) {
        selectRelacionado.innerHTML = '<option value="">Nenhum</option>';

        locaisTrabalho.forEach(local => {
            const option = document.createElement('option');
            option.value = local.id_local;
            option.textContent = local.nome;
            selectRelacionado.appendChild(option);
        });
    }

    // Atualizar dropdown de locais de trabalho no formulário de compromissos
    const selectLocal = document.getElementById('workplace');
    if (selectLocal) {
        selectLocal.innerHTML = '';

        locaisTrabalho.forEach(local => {
            const option = document.createElement('option');
            option.value = local.id_local;
            option.textContent = local.nome;
            selectLocal.appendChild(option);
        });
    }
}

// Abrir modal de locais de trabalho
export function openWorkplaceModal() {
    document.getElementById('workplaceModal').classList.remove('hidden');
}

// Fechar modal de locais de trabalho
export function closeWorkplaceModal() {
    document.getElementById('workplaceModal').classList.add('hidden');
    hideWorkplaceForm();
}

// Mostrar formulário de local de trabalho
export function mostrarFormularioLocalTrabalho() {
    document.getElementById('workplaceFormTitle').textContent = 'Novo Local de Trabalho';
    document.getElementById('workplaceId').value = '';
    document.getElementById('workplaceName').value = '';
    document.getElementById('workplaceColor').value = '#' + Math.floor(Math.random() * 16777215).toString(16); // Cor aleatória
    document.getElementById('workplaceBonus').value = '0';
    document.getElementById('workplaceGrace').value = '60';
    document.getElementById('workplaceRelated').value = '';

    document.getElementById('workplaceForm').classList.remove('hidden');
}

// Ocultar formulário de local de trabalho
export function hideWorkplaceForm() {
    document.getElementById('workplaceForm').classList.add('hidden');
}

// Editar local de trabalho
export function editarLocalTrabalho(idLocal) {
    const local = locaisTrabalho.find(l => l.id_local === idLocal);
    if (!local) return;

    document.getElementById('workplaceFormTitle').textContent = 'Editar Local de Trabalho';
    document.getElementById('workplaceId').value = local.id_local;
    document.getElementById('workplaceName').value = local.nome;
    document.getElementById('workplaceColor').value = local.cor;
    document.getElementById('workplaceBonus').value = local.acrescimo_ha_percent;
    document.getElementById('workplaceGrace').value = local.periodo_carencia;
    document.getElementById('workplaceRelated').value = local.relacionado_com || '';

    document.getElementById('workplaceForm').classList.remove('hidden');
}

// Salvar local de trabalho
export function salvarLocalTrabalho(e) {
    e.preventDefault();

    const idLocal = document.getElementById('workplaceId').value;
    const dados = {
        nome: document.getElementById('workplaceName').value,
        cor: document.getElementById('workplaceColor').value,
        acrescimo_ha_percent: parseInt(document.getElementById('workplaceBonus').value) || 0,
        periodo_carencia: parseInt(document.getElementById('workplaceGrace').value) || 0,
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

// Excluir local de trabalho
export function excluirLocalTrabalho(idLocal) {
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
