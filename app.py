from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from functools import wraps
import os
from dotenv import load_dotenv
from supabase_client import supabase_client
from datetime import timedelta
import copy

# Carregar variáveis de ambiente
load_dotenv()

# Helper Functions for Appointment Validation
def _time_str_to_minutes(time_str):
    """Converts 'HH:MM:SS' or 'HH:MM' to minutes from midnight."""
    if not time_str: return 0
    try:
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        return hours * 60 + minutes
    except Exception: # Handle potential errors like invalid format
        return 0

def _get_workplace_details(supabase_client, local_id):
    """Fetches workplace details relevant for validation."""
    if not local_id: return None
    try:
        response = supabase_client.table('locais_trabalho').select('id_local, nome, cor, acrescimo_ha_percent, periodo_carencia, relacionado_com, usuario_id').eq('id_local', local_id).maybe_single().execute()
        return response.data
    except Exception as e:
        print(f"Error fetching workplace details for {local_id}: {e}")
        return None

def _get_linked_workplace_ids(supabase_client, local_id_principal, usuario_id):
    """
    Fetches a set of workplace IDs linked to local_id_principal.
    A workplace is considered linked if it's the principal, related to the principal,
    or if the principal is related to it (forming a two-way group).
    """
    if not local_id_principal or not usuario_id: return set()

    linked_ids = {local_id_principal}
    try:
        # First, get the details of the principal workplace
        principal_details = _get_workplace_details(supabase_client, local_id_principal)
        if not principal_details or principal_details.get('usuario_id') != usuario_id:
            # If principal doesn't exist or doesn't belong to user, return empty or just itself if we want to be lenient.
            # For safety, if it's not the user's, it shouldn't link to others of the user.
            return set() if principal_details.get('usuario_id') != usuario_id else {local_id_principal}


        # Case 1: local_id_principal IS a primary workplace (it has others related to it)
        query1 = supabase_client.table('locais_trabalho').select('id_local').eq('relacionado_com', local_id_principal).eq('usuario_id', usuario_id).execute()
        if query1.data:
            for item in query1.data:
                linked_ids.add(item['id_local'])

        # Case 2: local_id_principal IS a secondary workplace (it relates to another primary)
        if principal_details.get('relacionado_com'):
            primary_of_principal = principal_details['relacionado_com']
            linked_ids.add(primary_of_principal) # Add its primary
            # Also add all other secondaries related to that same primary
            query2 = supabase_client.table('locais_trabalho').select('id_local').eq('relacionado_com', primary_of_principal).eq('usuario_id', usuario_id).execute()
            if query2.data:
                for item in query2.data:
                    linked_ids.add(item['id_local'])
    except Exception as e:
        print(f"Error fetching linked workplace IDs for {local_id_principal}: {e}")
    return linked_ids


def _get_appointments_for_validation(supabase_client, agenda_id, dia_semana, exclude_id=None):
    """
    Fetches appointments for a given agenda and day, ordered by hora_inicio.
    Excludes a specific appointment if exclude_id is provided.
    Returns a list of appointment dicts.
    """
    if not agenda_id or dia_semana is None: return []
    try:
        query = supabase_client.table('compromissos').select('id_compromisso, local_id, hora_inicio, hora_fim, duracao').eq('agenda_id', agenda_id).eq('dia_semana', int(dia_semana)).order('hora_inicio', desc=False)
        if exclude_id:
            query = query.not_eq('id_compromisso', exclude_id)
        response = query.execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching appointments for validation (agenda: {agenda_id}, dia: {dia_semana}): {e}")
        return []

def _validate_appointment(supabase_client, agenda_id, appointment_data, usuario_id, existing_appointment_id=None):
    """
    Validates an appointment against business logic rules.
    appointment_data should contain: local_id, dia_semana (int), hora_inicio (str), hora_fim (str), duracao (float).
    Returns (True, None, None) if valid, or (False, error_json_response, status_code) if invalid.
    """
    try:
        duracao_new_app = float(appointment_data['duracao'])
        local_id_new_app = appointment_data['local_id']
        dia_semana_new_app = int(appointment_data['dia_semana'])
        hora_inicio_new_app = appointment_data['hora_inicio']
        hora_fim_new_app = appointment_data['hora_fim']
    except (TypeError, ValueError) as e:
        return False, jsonify({"sucesso": False, "mensagem": f"Dados inválidos para validação: {str(e)}"}), 400


    # Rule 1: Continuous Work Limit (max 6 hours)
    if duracao_new_app > 6.0:
        return False, jsonify({"sucesso": False, "mensagem": "Limite de trabalho contínuo excedido (máx 6 horas)."}), 400

    current_workplace_details = _get_workplace_details(supabase_client, local_id_new_app)
    if not current_workplace_details:
        return False, jsonify({"sucesso": False, "mensagem": "Local de trabalho do compromisso não encontrado para validação."}), 400 # Should be 400 as it's bad input data

    # Get existing appointments for the day
    existing_appointments_today = _get_appointments_for_validation(supabase_client, agenda_id, dia_semana_new_app, exclude_id=existing_appointment_id)

    # CORREÇÃO 1: Verificar sobreposição de horários independente do local
    new_app_start_minutes = _time_str_to_minutes(hora_inicio_new_app)
    new_app_end_minutes = _time_str_to_minutes(hora_fim_new_app)
    
    for app in existing_appointments_today:
        app_start = _time_str_to_minutes(app['hora_inicio'])
        app_end = _time_str_to_minutes(app['hora_fim'])
        
        # Verificar se há sobreposição de horários
        # Sobreposição ocorre quando:
        # 1. O novo compromisso começa durante um existente
        # 2. O novo compromisso termina durante um existente
        # 3. O novo compromisso engloba completamente um existente
        # 4. Um existente engloba completamente o novo compromisso
        if (new_app_start_minutes < app_end and new_app_end_minutes > app_start):
            return False, jsonify({
                "sucesso": False, 
                "mensagem": f"Conflito de horário: já existe um compromisso das {app['hora_inicio']} às {app['hora_fim']}."
            }), 400

    # CORREÇÃO 2: Limite de 8 horas diárias - somar DURAÇÃO em vez de calcular pela diferença de horários
    linked_workplace_ids = _get_linked_workplace_ids(supabase_client, local_id_new_app, usuario_id)
    
    # Iniciar com a duração do novo compromisso
    total_linked_duration_today = duracao_new_app
    
    # Somar as durações dos compromissos existentes em locais relacionados
    for app in existing_appointments_today:
        if app['local_id'] in linked_workplace_ids:
            total_linked_duration_today += float(app['duracao'])

    if total_linked_duration_today > 8.0:
        # Obter nomes dos locais relacionados para mensagem mais clara
        locais_nomes = []
        for local_id in linked_workplace_ids:
            local_details = _get_workplace_details(supabase_client, local_id)
            if local_details:
                locais_nomes.append(local_details.get('nome', local_id))
        
        return False, jsonify({
            "sucesso": False, 
            "mensagem": f"Limite de 8 horas diárias excedido para os locais relacionados ({', '.join(locais_nomes)}). Total atual: {total_linked_duration_today:.1f}h."
        }), 400

    # Rule 3: Grace Period
    grace_period_minutes = int(current_workplace_details.get('periodo_carencia', 60))

    immediate_predecessor = None
    immediate_successor = None

    for app_dict in existing_appointments_today:
        app_end_m = _time_str_to_minutes(app_dict['hora_fim'])
        if app_end_m <= new_app_start_minutes:
            if immediate_predecessor is None or _time_str_to_minutes(immediate_predecessor['hora_fim']) < app_end_m:
                immediate_predecessor = app_dict

        app_start_m = _time_str_to_minutes(app_dict['hora_inicio'])
        if app_start_m >= new_app_end_minutes:
            if immediate_successor is None or _time_str_to_minutes(immediate_successor['hora_inicio']) > app_start_m:
                immediate_successor = app_dict

    if immediate_predecessor:
        if immediate_predecessor['local_id'] != local_id_new_app:
            predecessor_workplace_details = _get_workplace_details(supabase_client, immediate_predecessor['local_id'])
            if predecessor_workplace_details:
                # Are they part of the same linked group?
                # If current_wp is linked to predecessor_wp OR predecessor_wp is linked to current_wp
                # This means they share a common 'relacionado_com' or one is 'relacionado_com' of other.
                # Using the sets:
                predecessor_linked_ids = _get_linked_workplace_ids(supabase_client, immediate_predecessor['local_id'], usuario_id)
                # If there's any intersection, they are considered related for grace period.
                # Or, more simply, if the two local_ids are in the same group derived from local_id_new_app
                are_linked_for_grace = immediate_predecessor['local_id'] in linked_workplace_ids

                if not are_linked_for_grace: # Only apply grace if NOT linked
                    gap = new_app_start_minutes - _time_str_to_minutes(immediate_predecessor['hora_fim'])
                    if gap < grace_period_minutes:
                        return False, jsonify({"sucesso": False, "mensagem": f"Violação do período de carência com o compromisso anterior. Gap de {gap} min, necessário {grace_period_minutes} min."}), 400

    if immediate_successor:
        if immediate_successor['local_id'] != local_id_new_app:
            successor_workplace_details = _get_workplace_details(supabase_client, immediate_successor['local_id'])
            if successor_workplace_details:
                successor_linked_ids = _get_linked_workplace_ids(supabase_client, immediate_successor['local_id'], usuario_id)
                are_linked_for_grace = immediate_successor['local_id'] in linked_workplace_ids

                if not are_linked_for_grace: # Only apply grace if NOT linked
                    gap = _time_str_to_minutes(immediate_successor['hora_inicio']) - new_app_end_minutes
                    if gap < grace_period_minutes:
                        return False, jsonify({"sucesso": False, "mensagem": f"Violação do período de carência com o compromisso seguinte. Gap de {gap} min, necessário {grace_period_minutes} min."}), 400

    # Rule 4: Inter-day Rest Period (11 hours = 660 minutes)
    prev_dia_semana = (dia_semana_new_app - 1 + 7) % 7
    next_dia_semana = (dia_semana_new_app + 1) % 7

    appointments_prev_day = _get_appointments_for_validation(supabase_client, agenda_id, prev_dia_semana, exclude_id=None)
    if appointments_prev_day:
        last_app_prev_day = appointments_prev_day[-1]
        prev_day_end_minutes = _time_str_to_minutes(last_app_prev_day['hora_fim'])
        rest_duration_with_prev = (24 * 60 - prev_day_end_minutes) + new_app_start_minutes
        if rest_duration_with_prev < 11 * 60:
            return False, jsonify({"sucesso": False, "mensagem": "Violação do período de descanso inter-jornada (com o último compromisso do dia anterior)."}), 400

    appointments_next_day = _get_appointments_for_validation(supabase_client, agenda_id, next_dia_semana, exclude_id=None)
    if appointments_next_day:
        first_app_next_day = appointments_next_day[0]
        next_day_start_minutes = _time_str_to_minutes(first_app_next_day['hora_inicio'])
        rest_duration_with_next = (24 * 60 - new_app_end_minutes) + next_day_start_minutes
        if rest_duration_with_next < 11 * 60:
            return False, jsonify({"sucesso": False, "mensagem": "Violação do período de descanso inter-jornada (com o primeiro compromisso do dia seguinte)."}), 400

    return True, None, None # Valid


app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "chave-secreta-temporaria")

app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)  # Sessão válida por 24 horas

# Middleware para verificar autenticação
def requer_autenticacao(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usuario_id' not in session:
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

# Rotas de páginas
@app.route('/')
def index():
    if 'usuario_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/registrar')
def registrar():
    return render_template('registro.html')

# Nova rota para visualização pública da agenda por CPF
@app.route('/<cpf>')
def agenda_publica(cpf):
    try:
        # Limpar formatação do CPF (remover pontos e traços)
        cpf_limpo = cpf.replace('.', '').replace('-', '')
        
        # Validar se o CPF tem 11 dígitos
        if len(cpf_limpo) != 11 or not cpf_limpo.isdigit():
            return render_template('erro.html', mensagem="CPF inválido. O formato correto é 000.000.000-00 ou 00000000000"), 400
        
        # Buscar usuário pelo CPF
        resposta_usuario = supabase_client.table('usuarios').select('*').eq('cpf', cpf_limpo).execute()
        
        if not resposta_usuario.data:
            return render_template('erro.html', mensagem="Usuário não encontrado"), 404
        
        usuario = resposta_usuario.data[0]
        usuario_id = usuario['id_usuario']
        
        # Formatar CPF para exibição (000.000.000-00)
        usuario['cpf_formatado'] = f"{cpf_limpo[:3]}.{cpf_limpo[3:6]}.{cpf_limpo[6:9]}-{cpf_limpo[9:]}"
        
        # Buscar configurações do usuário
        resposta_config = supabase_client.table('configuracoes_usuario').select('*').eq('usuario_id', usuario_id).execute()
        
        if resposta_config.data:
            configuracoes = resposta_config.data[0]
        else:
            configuracoes = {
                "dias_semana": [1, 2, 3, 4, 5, 6],
                "hora_inicio_padrao": "07:00",
                "hora_fim_padrao": "23:00"
            }
        
        # Buscar locais de trabalho do usuário
        resposta_locais = supabase_client.table('locais_trabalho').select('*').eq('usuario_id', usuario_id).execute()
        
        # Buscar compromissos do usuário
        resposta_compromissos = supabase_client.table('compromissos').select('*').eq('usuario_id', usuario_id).execute()
        
        # Passar dados para o template
        return render_template(
            'agenda_publica.html',
            usuario=usuario,
            configuracoes=configuracoes,
            locais=resposta_locais.data,
            compromissos=resposta_compromissos.data
        )
    except Exception as e:
        print(f"Erro ao buscar agenda pública: {str(e)}")
        return render_template('erro.html', mensagem="Ocorreu um erro ao buscar os dados da agenda"), 500

# Rotas de API para autenticação
# No arquivo app.py, localize a função api_registrar e modifique o bloco try-except:
@app.route('/auth/registrar', methods=['POST'])
def api_registrar():
    dados = request.json
    cpf = dados.get('cpf')
    nome = dados.get('nome')
    email = dados.get('email')
    senha = dados.get('senha')
    
    try:
        # Registrar usuário no Supabase Auth
        resposta_auth = supabase_client.auth.sign_up({
            "email": email,
            "password": senha
        })
        
        if resposta_auth.user:
            usuario_id = resposta_auth.user.id
            
            # Criar registro na tabela usuários
            supabase_client.table('usuarios').insert({
                "id_usuario": usuario_id,
                "cpf": cpf,
                "nome": nome,
                "email": email
            }).execute()
            
            return jsonify({"sucesso": True, "mensagem": "Usuário registrado com sucesso, acesse seu e-mail para ativar a conta!"}), 201
        else:
            return jsonify({"sucesso": False, "mensagem": "Erro ao registrar usuário"}), 400
            
    except Exception as e:
        erro_str = str(e)
        
        # Verificar se é um erro de CPF duplicado
        if "duplicate key value violates unique constraint" in erro_str and "usuarios_cpf_key" in erro_str:
            return jsonify({"sucesso": False, "mensagem": "CPF já está cadastrado!"}), 400
        # Verificar se é um erro de email duplicado
        elif "duplicate key value violates unique constraint" in erro_str and "email" in erro_str:
            return jsonify({"sucesso": False, "mensagem": "E-mail já está cadastrado!"}), 400
        else:
            return jsonify({"sucesso": False, "mensagem": "Erro ao registrar usuário: " + erro_str}), 400

@app.route('/auth/login', methods=['POST'])
def api_login():
    dados = request.json
    email = dados.get('email')
    senha = dados.get('senha')
    
    try:
        # Login no Supabase Auth
        resposta_auth = supabase_client.auth.sign_in_with_password({
            "email": email,
            "password": senha
        })
        
        if resposta_auth.user:
            usuario_id = resposta_auth.user.id
            
            # Buscar dados do usuário
            resposta = supabase_client.table('usuarios').select('*').eq('id_usuario', usuario_id).execute()
            
            if resposta.data:
                usuario = resposta.data[0]
                
                # Salvar dados na sessão
                session['usuario_id'] = usuario_id
                session['nome'] = usuario['nome']
                session['cpf'] = usuario['cpf']
                
                # Para debugging
                print(f"Sessão criada: {session}")
                
                return jsonify({
                    "sucesso": True, 
                    "usuario": {
                        "id": usuario_id,
                        "nome": usuario['nome'],
                        "cpf": usuario['cpf']
                    }
                })
            else:
                return jsonify({"sucesso": False, "mensagem": "Usuário não encontrado"}), 404
        else:
            return jsonify({"sucesso": False, "mensagem": "Credenciais inválidas"}), 401
            
    except Exception as e:
        print(f"Erro no login: {str(e)}")
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400 

@app.route('/auth/logout', methods=['POST'])
def api_logout():
    # Limpar sessão
    session.clear()
    
    # Logout do Supabase Auth
    supabase_client.auth.sign_out()
    
    return jsonify({"sucesso": True})

# API de Locais de Trabalho
@app.route('/locais', methods=['GET'])
@requer_autenticacao
def listar_locais():
    try:
        resposta = supabase_client.table('locais_trabalho').select('*').eq('usuario_id', session['usuario_id']).execute()
        return jsonify({"sucesso": True, "locais": resposta.data})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

# API de Agendas
@app.route('/agendas', methods=['POST'])
@requer_autenticacao
def criar_agenda():
    dados = request.json
    usuario_id = session['usuario_id']

    try:
        nova_agenda_dados = {
            "usuario_id": usuario_id,
            "nome": dados.get('nome'),
            "data_inicio": dados.get('data_inicio'),
            "data_fim": dados.get('data_fim')
        }

        # Campos opcionais - usar valor do request se fornecido, senão o DB usará default
        if 'dias_semana' in dados:
            nova_agenda_dados['dias_semana'] = dados.get('dias_semana')
        if 'hora_inicio_padrao' in dados:
            nova_agenda_dados['hora_inicio_padrao'] = dados.get('hora_inicio_padrao')
        if 'hora_fim_padrao' in dados:
            nova_agenda_dados['hora_fim_padrao'] = dados.get('hora_fim_padrao')

        resposta = supabase_client.table('agendas').insert(nova_agenda_dados).execute()

        if resposta.data:
            return jsonify({"sucesso": True, "agenda": resposta.data[0]}), 201
        else:
            # Tentar extrair mensagem de erro do Supabase se disponível
            error_message = "Erro ao criar agenda."
            if hasattr(resposta, 'error') and resposta.error and hasattr(resposta.error, 'message'):
                error_message = resposta.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/agendas', methods=['GET'])
@requer_autenticacao
def listar_agendas():
    usuario_id = session['usuario_id']
    try:
        resposta = supabase_client.table('agendas').select('*').eq('usuario_id', usuario_id).execute()
        return jsonify({"sucesso": True, "agendas": resposta.data})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/agendas/<id_agenda>', methods=['GET'])
@requer_autenticacao
def obter_agenda(id_agenda):
    usuario_id = session['usuario_id']
    try:
        resposta = supabase_client.table('agendas').select('*').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if resposta.data:
            return jsonify({"sucesso": True, "agenda": resposta.data})
        else:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário"}), 404
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/agendas/<id_agenda>', methods=['PUT'])
@requer_autenticacao
def atualizar_agenda(id_agenda):
    dados = request.json
    usuario_id = session['usuario_id']

    try:
        # Verificar se a agenda pertence ao usuário
        verificacao = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not verificacao.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário"}), 404

        campos_atualizaveis = ['nome', 'data_inicio', 'data_fim', 'dias_semana', 'hora_inicio_padrao', 'hora_fim_padrao']
        atualizacao = {}
        for campo in campos_atualizaveis:
            if campo in dados:
                atualizacao[campo] = dados.get(campo)

        if not atualizacao:
            return jsonify({"sucesso": False, "mensagem": "Nenhum dado fornecido para atualização"}), 400

        resposta = supabase_client.table('agendas').update(atualizacao).eq('id_agenda', id_agenda).execute()

        if resposta.data:
            return jsonify({"sucesso": True, "agenda": resposta.data[0]})
        else:
            error_message = "Erro ao atualizar agenda."
            if hasattr(resposta, 'error') and resposta.error and hasattr(resposta.error, 'message'):
                error_message = resposta.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/agendas/<id_agenda>', methods=['DELETE'])
@requer_autenticacao
def excluir_agenda(id_agenda):
    usuario_id = session['usuario_id']
    try:
        # Verificar se a agenda pertence ao usuário
        verificacao = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not verificacao.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário"}), 404

        resposta = supabase_client.table('agendas').delete().eq('id_agenda', id_agenda).execute()

        # DELETE não retorna dados em 'data' na v2 da API python da Supabase, verificar ausência de erro.
        if not hasattr(resposta, 'error') or resposta.error is None:
             # Adicionando uma verificação explícita se a deleção ocorreu (opcional, mas bom para confirmar)
            confirmacao_delecao = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).execute()
            if not confirmacao_delecao.data:
                return jsonify({"sucesso": True, "mensagem": "Agenda excluída com sucesso"})
            else:
                return jsonify({"sucesso": False, "mensagem": "Falha ao confirmar exclusão da agenda"}), 500
        else:
            error_message = "Erro ao excluir agenda."
            if hasattr(resposta, 'error') and resposta.error and hasattr(resposta.error, 'message'):
                error_message = resposta.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/locais', methods=['POST'])
@requer_autenticacao
def criar_local():
    dados = request.json
    
    try:
        novo_local = {
            "usuario_id": session['usuario_id'],
            "nome": dados.get('nome'),
            "cor": dados.get('cor'),
            "acrescimo_ha_percent": dados.get('acrescimo_ha_percent', 0),
            "periodo_carencia": dados.get('periodo_carencia', 60)
        }
        
        # Adicionar relacionamento se fornecido
        if dados.get('relacionado_com'):
            novo_local["relacionado_com"] = dados.get('relacionado_com')
        
        resposta = supabase_client.table('locais_trabalho').insert(novo_local).execute()
        
        return jsonify({"sucesso": True, "local": resposta.data[0]})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/locais/<id_local>', methods=['PUT'])
@requer_autenticacao
def atualizar_local(id_local):
    dados = request.json
    
    try:
        # Verificar se o local pertence ao usuário
        verificacao = supabase_client.table('locais_trabalho')\
            .select('id_local')\
            .eq('id_local', id_local)\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
            
        if not verificacao.data:
            return jsonify({"sucesso": False, "mensagem": "Local não encontrado ou sem permissão"}), 404
        
        atualizacao = {
            "nome": dados.get('nome'),
            "cor": dados.get('cor'),
            "acrescimo_ha_percent": dados.get('acrescimo_ha_percent', 0),
            "periodo_carencia": dados.get('periodo_carencia', 60)
        }
        
        # Adicionar relacionamento se fornecido
        if 'relacionado_com' in dados:
            atualizacao["relacionado_com"] = dados.get('relacionado_com')
        
        resposta = supabase_client.table('locais_trabalho')\
            .update(atualizacao)\
            .eq('id_local', id_local)\
            .execute()
        
        return jsonify({"sucesso": True, "local": resposta.data[0]})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/locais/<id_local>', methods=['DELETE'])
@requer_autenticacao
def excluir_local(id_local):
    try:
        # Verificar se o local pertence ao usuário
        verificacao = supabase_client.table('locais_trabalho')\
            .select('id_local')\
            .eq('id_local', id_local)\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
            
        if not verificacao.data:
            return jsonify({"sucesso": False, "mensagem": "Local não encontrado ou sem permissão"}), 404
        
        # Remover o local
        supabase_client.table('locais_trabalho')\
            .delete()\
            .eq('id_local', id_local)\
            .execute()
        
        return jsonify({"sucesso": True})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

# API de Compromissos (Agendados)
@app.route('/agendas/<id_agenda>/compromissos', methods=['GET'])
@requer_autenticacao
def listar_compromissos(id_agenda):
    usuario_id = session['usuario_id']
    try:
        # Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        resposta = supabase_client.table('compromissos').select('*').eq('agenda_id', id_agenda).execute()
        return jsonify({"sucesso": True, "compromissos": resposta.data})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/agendas/<id_agenda>/compromissos', methods=['POST'])
@requer_autenticacao
def criar_compromisso(id_agenda):
    dados = request.json
    usuario_id = session['usuario_id']
    
    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Verificar se o local_id (workplace) pertence ao usuário - Feito em _validate_appointment indiretamente ou explicitamente antes se necessário
        # No entanto, a verificação de propriedade do local_id é crucial antes de prosseguir.
        local_details_check = _get_workplace_details(supabase_client, dados.get('local_id'))
        if not local_details_check or local_details_check.get('usuario_id') != usuario_id:
             return jsonify({"sucesso": False, "mensagem": "Local de trabalho não encontrado ou não pertence ao usuário."}), 403


        compromisso_para_validacao = {
            "local_id": dados.get('local_id'),
            "dia_semana": int(dados.get('dia_semana')) if dados.get('dia_semana') is not None else None,
            "hora_inicio": dados.get('hora_inicio'),
            "hora_fim": dados.get('hora_fim'),
            "duracao": float(dados.get('duracao')) if dados.get('duracao') is not None else None,
            # agenda_id and usuario_id are passed directly to _validate_appointment
        }
        
        # Validar campos obrigatórios para compromisso (antes de passar para _validate_appointment)
        for campo_key in ['local_id', 'dia_semana', 'hora_inicio', 'hora_fim', 'duracao']: # tipo_hora is not used in validation logic itself
            if compromisso_para_validacao.get(campo_key) is None:
                return jsonify({"sucesso": False, "mensagem": f"Campo '{campo_key}' é obrigatório para validação e não pode ser nulo."}), 400
        if dados.get('tipo_hora') is None: # tipo_hora is for DB insertion
             return jsonify({"sucesso": False, "mensagem": "Campo 'tipo_hora' é obrigatório."}), 400


        # >>> BEGIN BUSINESS LOGIC VALIDATION <<<
        is_valid, error_response, status_code = _validate_appointment(
            supabase_client,
            id_agenda,
            compromisso_para_validacao,
            usuario_id,
            existing_appointment_id=None # None for new appointments
        )
        if not is_valid:
            return error_response, status_code
        # >>> END BUSINESS LOGIC VALIDATION <<<

        # Prepare final data for insertion, using original 'dados' for DB fields
        compromisso_to_insert = {
            "agenda_id": id_agenda,
            "local_id": dados.get('local_id'),
            "dia_semana": int(dados.get('dia_semana')), # Ensure it's int for DB
            "hora_inicio": dados.get('hora_inicio'),
            "hora_fim": dados.get('hora_fim'),
            "descricao": dados.get('descricao'),
            "tipo_hora": dados.get('tipo_hora'),
            "duracao": dados.get('duracao') # Let DB handle decimal conversion from string/number
        }
        resposta = supabase_client.table('compromissos').insert(compromisso_to_insert).execute()
        
        if resposta.data:
            return jsonify({"sucesso": True, "compromisso": resposta.data[0]}), 201
        else:
            error_message = "Erro ao criar compromisso."
            if hasattr(resposta, 'error') and resposta.error and hasattr(resposta.error, 'message'):
                error_message = resposta.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/agendas/<id_agenda>/compromissos/<id_compromisso>', methods=['PUT'])
@requer_autenticacao
def atualizar_compromisso(id_agenda, id_compromisso):
    dados = request.json
    usuario_id = session['usuario_id']
    
    print(f"--- INICIANDO ATUALIZAÇÃO DO COMPROMISSO {id_compromisso} ---")
    print(f"Dados recebidos: {dados}")

    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Buscar dados originais do compromisso
        compromisso_original_resp = supabase_client.table('compromissos')\
            .select('*')\
            .eq('id_compromisso', id_compromisso)\
            .eq('agenda_id', id_agenda)\
            .maybe_single().execute()
            
        if not compromisso_original_resp.data:
            return jsonify({"sucesso": False, "mensagem": "Compromisso não encontrado ou não pertence à agenda."}), 404
        
        compromisso_original_data = compromisso_original_resp.data
        print(f"Dados originais do compromisso: {compromisso_original_data}")

        # 3. Preparar os dados para o banco de dados (apenas o que foi enviado)
        atualizacao_para_db = {}
        campos_permitidos_db = ['local_id', 'dia_semana', 'hora_inicio', 'hora_fim',
                                'descricao', 'tipo_hora', 'duracao']
        for campo in campos_permitidos_db:
            if campo in dados:
                atualizacao_para_db[campo] = dados.get(campo)
        
        if not atualizacao_para_db:
            return jsonify({"sucesso": False, "mensagem": "Nenhum dado válido fornecido para atualização."}), 400

        # 4. Construir o estado futuro do compromisso para validação
        #    Usando o dado novo se existir, senão, o original.
        dados_para_validar = {
            "local_id": atualizacao_para_db.get('local_id', compromisso_original_data['local_id']),
            "dia_semana": int(atualizacao_para_db.get('dia_semana', compromisso_original_data['dia_semana'])),
            "hora_inicio": atualizacao_para_db.get('hora_inicio', compromisso_original_data['hora_inicio']),
            "hora_fim": atualizacao_para_db.get('hora_fim', compromisso_original_data['hora_fim']),
            "duracao": float(atualizacao_para_db.get('duracao', compromisso_original_data['duracao']))
        }
        print(f"Dados que serão usados para a validação: {dados_para_validar}")

        # 5. SEMPRE EXECUTAR A VALIDAÇÃO
        is_valid, error_response, status_code = _validate_appointment(
            supabase_client,
            id_agenda,
            dados_para_validar,
            usuario_id,
            existing_appointment_id=id_compromisso  # IMPORTANTE: passar o ID do compromisso sendo editado
        )
        if not is_valid:
            print(f"VALIDAÇÃO FALHOU: {error_response.get_json()}")
            return error_response, status_code
        
        print("--- VALIDAÇÃO CONCLUÍDA COM SUCESSO ---")

        # 6. Se a validação passou, atualizar o banco de dados
        resposta = supabase_client.table('compromissos')\
            .update(atualizacao_para_db)\
            .eq('id_compromisso', id_compromisso)\
            .execute()
        
        if resposta.data:
            print(f"Compromisso {id_compromisso} atualizado com sucesso no DB.")
            return jsonify({"sucesso": True, "compromisso": resposta.data[0]})
        else:
            error_message = "Erro ao atualizar compromisso no DB."
            if hasattr(resposta, 'error') and resposta.error and hasattr(resposta.error, 'message'):
                error_message = resposta.error.message
            print(f"ERRO NO DB: {error_message}")
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        print(f"ERRO INESPERADO: {str(e)}")
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500

@app.route('/agendas/<id_agenda>/compromissos/<id_compromisso>', methods=['DELETE'])
@requer_autenticacao
def excluir_compromisso(id_agenda, id_compromisso):
    usuario_id = session['usuario_id']
    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Verificar se o compromisso pertence à agenda especificada
        verificacao_compromisso = supabase_client.table('compromissos')\
            .select('id_compromisso')\
            .eq('id_compromisso', id_compromisso)\
            .eq('agenda_id', id_agenda)\
            .maybe_single().execute()
            
        if not verificacao_compromisso.data:
            return jsonify({"sucesso": False, "mensagem": "Compromisso não encontrado ou não pertence à agenda especificada."}), 404
        
        # Remover o compromisso
        resposta = supabase_client.table('compromissos')\
            .delete()\
            .eq('id_compromisso', id_compromisso)\
            .execute()
        
        if not hasattr(resposta, 'error') or resposta.error is None:
            confirmacao_delecao = supabase_client.table('compromissos').select('id_compromisso').eq('id_compromisso', id_compromisso).execute()
            if not confirmacao_delecao.data:
                return jsonify({"sucesso": True, "mensagem": "Compromisso excluído com sucesso"})
            else: # Deveria ser impossível chegar aqui se a deleção foi bem sucedida e o item não existe mais
                return jsonify({"sucesso": False, "mensagem": "Falha ao confirmar exclusão do compromisso"}), 500
        else:
            error_message = "Erro ao excluir compromisso."
            if hasattr(resposta, 'error') and resposta.error and hasattr(resposta.error, 'message'):
                error_message = resposta.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

# API de Configurações
@app.route('/configuracoes', methods=['GET'])
@requer_autenticacao
def obter_configuracoes():
    try:
        resposta = supabase_client.table('configuracoes_usuario')\
            .select('*')\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
            
        if resposta.data:
            return jsonify({"sucesso": True, "configuracoes": resposta.data[0]})
        else:
            # Criar configurações padrão se não existirem
            configuracoes_padrao = {
                "usuario_id": session['usuario_id'],
                "dias_semana": [1, 2, 3, 4, 5, 6],
                "hora_inicio_padrao": "07:00",
                "hora_fim_padrao": "23:00"
            }
            
            resposta_criacao = supabase_client.table('configuracoes_usuario')\
                .insert(configuracoes_padrao)\
                .execute()
                
            return jsonify({"sucesso": True, "configuracoes": resposta_criacao.data[0]})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/configuracoes', methods=['PUT'])
@requer_autenticacao
def atualizar_configuracoes():
    dados = request.json
    
    try:
        atualizacao = {}
        campos_permitidos = ['dias_semana', 'hora_inicio_padrao', 'hora_fim_padrao']
        
        for campo in campos_permitidos:
            if campo in dados:
                atualizacao[campo] = dados.get(campo)
        
        # Verificar se configurações existem
        verificacao = supabase_client.table('configuracoes_usuario')\
            .select('id_configuracao')\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
            
        if verificacao.data:
            # Atualizar configurações existentes
            resposta = supabase_client.table('configuracoes_usuario')\
                .update(atualizacao)\
                .eq('usuario_id', session['usuario_id'])\
                .execute()
        else:
            # Criar novas configurações
            atualizacao["usuario_id"] = session['usuario_id']
            resposta = supabase_client.table('configuracoes_usuario')\
                .insert(atualizacao)\
                .execute()
        
        return jsonify({"sucesso": True, "configuracoes": resposta.data[0]})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

# Endpoints para agenda_locais_config (configurações de locais de trabalho por agenda)

@app.route('/agendas/<id_agenda>/locais_config', methods=['POST'])
@requer_autenticacao
def adicionar_local_config_agenda(id_agenda):
    dados = request.json
    usuario_id = session['usuario_id']
    local_id = dados.get('local_id')
    valor_hora = dados.get('valor_hora')

    if not local_id or valor_hora is None:
        return jsonify({"sucesso": False, "mensagem": "local_id e valor_hora são obrigatórios."}), 400

    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Verificar se o local_id (workplace) pertence ao usuário
        local_verif = supabase_client.table('locais_trabalho').select('id_local').eq('id_local', local_id).eq('usuario_id', usuario_id).maybe_single().execute()
        if not local_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Local de trabalho não encontrado ou não pertence ao usuário."}), 404

        # 3. Inserir a nova configuração
        nova_config_dados = {
            "agenda_id": id_agenda,
            "local_id": local_id,
            "valor_hora": valor_hora
        }
        resposta = supabase_client.table('agenda_locais_config').insert(nova_config_dados).execute()

        if resposta.data:
            return jsonify({"sucesso": True, "configuracao": resposta.data[0]}), 201
        else:
            error_message = "Erro ao adicionar configuração de local à agenda."
            if hasattr(resposta, 'error') and resposta.error:
                if "agenda_locais_config_agenda_id_local_id_key" in resposta.error.message: # Unique constraint
                    error_message = "Este local de trabalho já está configurado para esta agenda."
                else:
                    error_message = resposta.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400
            
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500

@app.route('/agendas/<id_agenda>/locais_config', methods=['GET'])
@requer_autenticacao
def listar_locais_config_agenda(id_agenda):
    usuario_id = session['usuario_id']
    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Selecionar as configurações, opcionalmente com join no nome do local
        resposta = supabase_client.table('agenda_locais_config').select('*, locais_trabalho(nome, cor)').eq('agenda_id', id_agenda).execute()

        return jsonify({"sucesso": True, "configuracoes": resposta.data})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500

@app.route('/agendas/<id_agenda>/locais_config/<id_agenda_local>', methods=['PUT'])
@requer_autenticacao
def atualizar_local_config_agenda(id_agenda, id_agenda_local):
    dados = request.json
    usuario_id = session['usuario_id']
    valor_hora = dados.get('valor_hora')

    if valor_hora is None:
        return jsonify({"sucesso": False, "mensagem": "valor_hora é obrigatório."}), 400

    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Verificar se a configuração (id_agenda_local) existe e pertence à agenda especificada
        #    Esta etapa também implicitamente verifica se o usuario_id tem acesso, devido ao JOIN interno que o Supabase RLS faria ou por esta query:
        config_verif = supabase_client.table('agenda_locais_config').select('id_agenda_local').eq('id_agenda_local', id_agenda_local).eq('agenda_id', id_agenda).maybe_single().execute()
        if not config_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Configuração de local não encontrada ou não pertence à agenda especificada."}), 404

        # 3. Atualizar o valor_hora
        atualizacao_dados = {"valor_hora": valor_hora}
        resposta = supabase_client.table('agenda_locais_config').update(atualizacao_dados).eq('id_agenda_local', id_agenda_local).execute()

        if resposta.data:
            return jsonify({"sucesso": True, "configuracao": resposta.data[0]})
        else:
            error_message = "Erro ao atualizar configuração de local."
            if hasattr(resposta, 'error') and resposta.error and hasattr(resposta.error, 'message'):
                error_message = resposta.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500

@app.route('/agendas/<id_agenda>/locais_config/<id_agenda_local>', methods=['DELETE'])
@requer_autenticacao
def excluir_local_config_agenda(id_agenda, id_agenda_local):
    usuario_id = session['usuario_id']
    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Verificar se a configuração (id_agenda_local) existe e pertence à agenda especificada
        config_verif = supabase_client.table('agenda_locais_config').select('id_agenda_local').eq('id_agenda_local', id_agenda_local).eq('agenda_id', id_agenda).maybe_single().execute()
        if not config_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Configuração de local não encontrada ou não pertence à agenda especificada."}), 404

        # 3. Deletar a configuração
        resposta = supabase_client.table('agenda_locais_config').delete().eq('id_agenda_local', id_agenda_local).execute()

        if not hasattr(resposta, 'error') or resposta.error is None:
            # Adicionando uma verificação explícita se a deleção ocorreu (opcional, mas bom para confirmar)
            confirmacao_delecao = supabase_client.table('agenda_locais_config').select('id_agenda_local').eq('id_agenda_local', id_agenda_local).execute()
            if not confirmacao_delecao.data:
                return jsonify({"sucesso": True, "mensagem": "Configuração de local excluída com sucesso"})
            else:
                 return jsonify({"sucesso": False, "mensagem": "Falha ao confirmar exclusão da configuração"}), 500
        else:
            error_message = "Erro ao excluir configuração de local."
            if hasattr(resposta, 'error') and resposta.error and hasattr(resposta.error, 'message'):
                error_message = resposta.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500

# API de Compartilhamento Privado
@app.route('/agendas/<id_agenda>/share_private', methods=['POST'])
@requer_autenticacao
def compartilhar_agenda_privado(id_agenda):
    usuario_concedeu_id = session['usuario_id']
    dados = request.json
    email_usuario_recebeu = dados.get('email_usuario_recebeu')

    if not email_usuario_recebeu:
        return jsonify({"sucesso": False, "mensagem": "E-mail do usuário para compartilhar é obrigatório."}), 400

    try:
        # 1. Verificar se a agenda pertence ao usuário que está concedendo
        agenda_propria_resp = supabase_client.table('agendas').select('id_agenda, usuario_id').eq('id_agenda', id_agenda).eq('usuario_id', usuario_concedeu_id).maybe_single().execute()
        if not agenda_propria_resp.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Encontrar o usuário que receberá o compartilhamento pelo e-mail
        usuario_recebeu_resp = supabase_client.table('usuarios').select('id_usuario').eq('email', email_usuario_recebeu).maybe_single().execute()
        if not usuario_recebeu_resp.data:
            return jsonify({"sucesso": False, "mensagem": f"Usuário com e-mail '{email_usuario_recebeu}' não encontrado."}), 404
        usuario_recebeu_id = usuario_recebeu_resp.data['id_usuario']

        # 3. Verificar se o usuário está tentando compartilhar consigo mesmo
        if usuario_recebeu_id == usuario_concedeu_id:
            return jsonify({"sucesso": False, "mensagem": "Não é possível compartilhar a agenda consigo mesmo."}), 400

        # 4. Verificar se já existe uma permissão (ativa ou revogada)
        permissao_existente_resp = supabase_client.table('agenda_permissoes')\
            .select('*')\
            .eq('agenda_id', id_agenda)\
            .eq('usuario_recebeu_id', usuario_recebeu_id)\
            .maybe_single().execute()

        if permissao_existente_resp.data:
            permissao_existente = permissao_existente_resp.data
            if permissao_existente['status'] == 'ativo':
                return jsonify({"sucesso": False, "mensagem": "Esta agenda já está compartilhada ativamente com este usuário."}), 409 # Conflict
            elif permissao_existente['status'] == 'revogado':
                # Opção: Reativar a permissão revogada
                update_resp = supabase_client.table('agenda_permissoes')\
                    .update({"status": "ativo", "data_concessao": "now()"}) \
                    .eq('id_permissao', permissao_existente['id_permissao'])\
                    .execute()
                if update_resp.data:
                    return jsonify({"sucesso": True, "mensagem": "Permissão reativada com sucesso.", "permissao": update_resp.data[0]})
                else:
                    return jsonify({"sucesso": False, "mensagem": "Erro ao reativar permissão."}), 500

        # 5. Inserir nova permissão
        nova_permissao_dados = {
            "agenda_id": id_agenda,
            "usuario_concedeu_id": usuario_concedeu_id,
            "usuario_recebeu_id": usuario_recebeu_id,
            "status": "ativo"
        }
        insert_resp = supabase_client.table('agenda_permissoes').insert(nova_permissao_dados).execute()

        if insert_resp.data:
            return jsonify({"sucesso": True, "mensagem": "Agenda compartilhada com sucesso.", "permissao": insert_resp.data[0]}), 201
        else:
            # Handle potential unique constraint violation if not handled by prior check (e.g. race condition or complex state)
            error_message = "Erro ao compartilhar agenda."
            if hasattr(insert_resp, 'error') and insert_resp.error and "agenda_permissoes_agenda_id_usuario_recebeu_id_key" in insert_resp.error.message:
                 error_message = "Este local de trabalho já está configurado para esta agenda (restrição UNIQUE)." # Should have been caught earlier
            elif hasattr(insert_resp, 'error') and insert_resp.error:
                 error_message = insert_resp.error.message
            return jsonify({"sucesso": False, "mensagem": error_message}), 400

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro interno: {str(e)}"}), 500

@app.route('/agendas/<id_agenda>/shares_private', methods=['GET'])
@requer_autenticacao
def listar_compartilhamentos_agenda(id_agenda):
    usuario_id = session['usuario_id']
    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_propria_resp = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_propria_resp.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Buscar permissões ativas para esta agenda, com detalhes do usuário que recebeu
        permissoes_resp = supabase_client.table('agenda_permissoes')\
            .select('id_permissao, data_concessao, status, usuarios!inner(id_usuario, nome, email)')\
            .eq('agenda_id', id_agenda)\
            .eq('status', 'ativo')\
            .execute()

        if permissoes_resp.data:
            # Formatar a resposta
            shares_formatado = []
            for p in permissoes_resp.data:
                usuario_data = p.get('usuarios', {}) # usuarios is the joined table data
                shares_formatado.append({
                    "id_permissao": p['id_permissao'],
                    "email_usuario_recebeu": usuario_data.get('email', 'N/A'),
                    "nome_usuario_recebeu": usuario_data.get('nome', 'N/A'),
                    "data_concessao": p['data_concessao']
                })
            return jsonify({"sucesso": True, "compartilhamentos": shares_formatado})
        else:
            return jsonify({"sucesso": True, "compartilhamentos": []}) # Retorna lista vazia se não houver compartilhamentos

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro ao listar compartilhamentos: {str(e)}"}), 500

@app.route('/agendas/<id_agenda>/shares_private/<id_permissao>', methods=['DELETE'])
@requer_autenticacao
def revogar_compartilhamento_agenda(id_agenda, id_permissao):
    usuario_concedeu_id = session['usuario_id']
    try:
        # 1. Verificar se a agenda pertence ao usuário
        agenda_propria_resp = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_concedeu_id).maybe_single().execute()
        if not agenda_propria_resp.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        # 2. Verificar se a permissão existe, pertence à agenda e foi concedida pelo usuário logado
        permissao_resp = supabase_client.table('agenda_permissoes')\
            .select('id_permissao')\
            .eq('id_permissao', id_permissao)\
            .eq('agenda_id', id_agenda)\
            .eq('usuario_concedeu_id', usuario_concedeu_id)\
            .maybe_single().execute()

        if not permissao_resp.data:
            return jsonify({"sucesso": False, "mensagem": "Permissão não encontrada, não pertence à agenda especificada ou não foi concedida por este usuário."}), 404
            
        # 3. Atualizar status para 'revogado'
        update_resp = supabase_client.table('agenda_permissoes')\
            .update({"status": "revogado"})\
            .eq('id_permissao', id_permissao)\
            .execute()
            
        if update_resp.data:
            return jsonify({"sucesso": True, "mensagem": "Permissão revogada com sucesso."})
        else:
            return jsonify({"sucesso": False, "mensagem": "Erro ao revogar permissão."}), 500

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro interno: {str(e)}"}), 500

@app.route('/agendas/shared_with_me', methods=['GET'])
@requer_autenticacao
def listar_agendas_compartilhadas_comigo():
    usuario_recebeu_id = session['usuario_id']
    try:
        # Buscar permissões ativas onde o usuário logado é quem recebeu
        # E fazer join com agendas e com usuarios (para pegar dados do proprietário/concedente)
        permissoes_resp = supabase_client.table('agenda_permissoes')\
            .select('*, agendas!inner(*), usuarios!agenda_permissoes_usuario_concedeu_id_fkey!inner(nome, email)')\
            .eq('usuario_recebeu_id', usuario_recebeu_id)\
            .eq('status', 'ativo')\
            .execute()

        if permissoes_resp.data:
            agendas_formatadas = []
            for p in permissoes_resp.data:
                agenda_data = p.get('agendas', {}) # 'agendas' é o alias da tabela agendas no join
                proprietario_data = p.get('usuarios', {}) # 'usuarios' é o alias da tabela usuarios no join

                agendas_formatadas.append({
                    "id_permissao": p['id_permissao'],
                    "agenda_id": agenda_data.get('id_agenda'),
                    "agenda_nome": agenda_data.get('nome'),
                    "data_inicio_agenda": agenda_data.get('data_inicio'),
                    "data_fim_agenda": agenda_data.get('data_fim'),
                    "proprietario_nome": proprietario_data.get('nome'),
                    "proprietario_email": proprietario_data.get('email'),
                    "data_concessao": p['data_concessao']
                })
            return jsonify({"sucesso": True, "agendas_compartilhadas": agendas_formatadas})
        else:
            return jsonify({"sucesso": True, "agendas_compartilhadas": []})

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro ao listar agendas compartilhadas: {str(e)}"}), 500

# API de Compartilhamento Público
@app.route('/agendas/<id_agenda>/public_link', methods=['GET'])
@requer_autenticacao
def obter_link_publico_agenda(id_agenda):
    usuario_id = session['usuario_id']
    try:
        # Verificar se a agenda pertence ao usuário
        agenda_resp = supabase_client.table('agendas').select('link_publico_id, usuario_id').eq('id_agenda', id_agenda).maybe_single().execute()

        if not agenda_resp.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada."}), 404

        if agenda_resp.data['usuario_id'] != usuario_id:
            return jsonify({"sucesso": False, "mensagem": "Acesso não autorizado à agenda."}), 403
            
        link_publico_id = agenda_resp.data.get('link_publico_id')
        if not link_publico_id:
            # This case should ideally not happen if DB default works, but good to handle
            return jsonify({"sucesso": False, "mensagem": "Link público não gerado para esta agenda."}), 500
            
        return jsonify({"sucesso": True, "link_publico_id": link_publico_id})

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro ao obter link público: {str(e)}"}), 500

@app.route('/public/agenda/<link_publico_id>', methods=['GET'])
def obter_dados_agenda_publica(link_publico_id):
    try:
        # 1. Encontrar agenda pelo link_publico_id
        agenda_resp = supabase_client.table('agendas').select('id_agenda, nome, dias_semana, hora_inicio_padrao, hora_fim_padrao, usuario_id').eq('link_publico_id', link_publico_id).maybe_single().execute()
        
        if not agenda_resp.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda pública não encontrada."}), 404

        agenda_data = agenda_resp.data
        agenda_id = agenda_data['id_agenda']
        proprietario_id = agenda_data['usuario_id']

        # 2. Buscar compromissos associados (apenas campos não sensíveis)
        compromissos_resp = supabase_client.table('compromissos').select('dia_semana, hora_inicio, hora_fim, descricao, local_id, duracao').eq('agenda_id', agenda_id).execute()
        compromissos_publicos = compromissos_resp.data if compromissos_resp.data else []

        # 3. Buscar locais de trabalho do proprietário da agenda (apenas campos não sensíveis)
        locais_resp = supabase_client.table('locais_trabalho').select('id_local, nome, cor').eq('usuario_id', proprietario_id).execute()
        locais_map = {local['id_local']: {"nome": local['nome'], "cor": local['cor']} for local in (locais_resp.data if locais_resp.data else [])}

        # 4. Calcular total de horas por local
        total_horas_por_local = {}
        for comp in compromissos_publicos:
            local_id = comp['local_id']
            duracao = float(comp.get('duracao', 0))
            if local_id not in total_horas_por_local:
                total_horas_por_local[local_id] = 0.0
            total_horas_por_local[local_id] += duracao
            # Remove duracao from individual compromisso if not desired in public view, or keep it
            # For now, let's remove it from individual and only show total.
            # del comp['duracao']


        return jsonify({
            "sucesso": True,
            "agenda_nome": agenda_data['nome'],
            "dias_semana": agenda_data['dias_semana'],
            "hora_inicio_padrao": agenda_data['hora_inicio_padrao'],
            "hora_fim_padrao": agenda_data['hora_fim_padrao'],
            "compromissos": compromissos_publicos, # Each compromisso contains local_id
            "locais_map": locais_map, # Maps local_id to name and color
            "total_horas_por_local": {lid: round(horas,1) for lid, horas in total_horas_por_local.items()}
        })

    except Exception as e:
        print(f"Erro ao buscar dados da agenda pública {link_publico_id}: {str(e)}")
        return jsonify({"sucesso": False, "mensagem": "Erro interno ao processar a solicitação da agenda pública."}), 500

# Helper function for generating report data
def _generate_report_data(id_agenda_verified, supabase_client, usuario_id):
    report_details = {}
    grand_total_horas = 0.0
    grand_total_valor = 0.0

    try:
        # 1. Fetch agenda_locais_config for valor_hora
        config_resp = supabase_client.table('agenda_locais_config').select('local_id, valor_hora').eq('agenda_id', id_agenda_verified).execute()
        if not config_resp.data: # No configurations for this agenda, report will be empty
            return {"locais": [], "total_horas": 0.0, "total_valor": 0.0, "erros": ["Nenhuma configuração de local/hora encontrada para esta agenda."]}

        valor_hora_map = {item['local_id']: float(item['valor_hora']) for item in config_resp.data}

        # 2. Fetch all workplaces for the user
        workplaces_resp = supabase_client.table('locais_trabalho').select('id_local, nome, acrescimo_ha_percent, relacionado_com').eq('usuario_id', usuario_id).execute()
        if not workplaces_resp.data: # User has no workplaces defined
             return {"locais": [], "total_horas": 0.0, "total_valor": 0.0, "erros": ["Nenhum local de trabalho encontrado para o usuário."]}
        workplaces_map = {item['id_local']: item for item in workplaces_resp.data}

        # 3. Fetch all appointments for the agenda
        appointments_resp = supabase_client.table('compromissos').select('local_id, tipo_hora, duracao').eq('agenda_id', id_agenda_verified).execute()

        calculation_errors = []

        for app in appointments_resp.data:
            local_id = app['local_id']
            tipo_hora = app['tipo_hora']
            duracao = float(app['duracao'])

            if local_id not in valor_hora_map:
                calculation_errors.append(f"Configuração de valor/hora não encontrada para o local ID {local_id} (compromisso ignorado).")
                continue
            if local_id not in workplaces_map:
                calculation_errors.append(f"Detalhes do local de trabalho ID {local_id} não encontrados (compromisso ignorado).")
                continue

            valor_hora = valor_hora_map[local_id]
            workplace = workplaces_map[local_id]

            acrescimo_ha_percent = float(workplace.get('acrescimo_ha_percent', 0))
            relacionado_com = workplace.get('relacionado_com')


            if local_id not in report_details:
                report_details[local_id] = {
                    'id_local': local_id,
                    'nome': workplace.get('nome', 'Nome Desconhecido'),
                    'relacionado_com': relacionado_com,
                    'base_horas': 0.0,
                    'acrescimo_horas': 0.0,
                    'total_horas': 0.0,
                    'valor_hora_aplicado': valor_hora, # Store the hourly rate used for this local in this agenda
                    'valor_total': 0.0
                }

            entry = report_details[local_id]
            entry['base_horas'] += duracao

            acrescimo_individual = 0.0
            if tipo_hora == 'HA' and acrescimo_ha_percent > 0:
                acrescimo_individual = duracao * (acrescimo_ha_percent / 100)
                entry['acrescimo_horas'] += acrescimo_individual

            entry['total_horas'] = entry['base_horas'] + entry['acrescimo_horas']
            entry['valor_total'] = entry['total_horas'] * valor_hora

        for local_data in report_details.values():
            grand_total_horas += local_data['total_horas']
            grand_total_valor += local_data['valor_total']

        final_report = {
            "locais": list(report_details.values()),
            "total_horas": round(grand_total_horas, 2),
            "total_valor": round(grand_total_valor, 2)
        }
        if calculation_errors:
            final_report["erros_calculo"] = calculation_errors

        return final_report

    except Exception as e:
        print(f"Error generating report data for agenda {id_agenda_verified}: {e}")
        return {"locais": [], "total_horas": 0.0, "total_valor": 0.0, "erros": [f"Erro interno ao gerar relatório: {str(e)}"]}

# API de Relatórios
@app.route('/agendas/<id_agenda>/relatorios/semanal', methods=['GET'])
@requer_autenticacao
def relatorio_semanal(id_agenda):
    usuario_id = session['usuario_id']
    try:
        # Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        report_data = _generate_report_data(id_agenda, supabase_client, usuario_id)

        if "erros" in report_data and report_data["erros"]:
             # You might want to distinguish between data not found errors (404-like) vs internal processing errors (500-like)
            return jsonify({"sucesso": False, "mensagem": "Não foi possível gerar o relatório completo.", "detalhes": report_data["erros"]}), 400 # Or 500 if errors are internal

        return jsonify({"sucesso": True, "relatorio": report_data})

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro ao gerar relatório semanal: {str(e)}"}), 500

@app.route('/agendas/<id_agenda>/relatorios/mensal', methods=['GET'])
@requer_autenticacao
def relatorio_mensal(id_agenda):
    usuario_id = session['usuario_id']
    try:
        # Verificar se a agenda pertence ao usuário
        agenda_verif = supabase_client.table('agendas').select('id_agenda').eq('id_agenda', id_agenda).eq('usuario_id', usuario_id).maybe_single().execute()
        if not agenda_verif.data:
            return jsonify({"sucesso": False, "mensagem": "Agenda não encontrada ou não pertence ao usuário."}), 404

        weekly_data_result = _generate_report_data(id_agenda, supabase_client, usuario_id)

        if "erros" in weekly_data_result and weekly_data_result["erros"]:
            return jsonify({"sucesso": False, "mensagem": "Não foi possível gerar a base semanal para o relatório mensal.", "detalhes": weekly_data_result["erros"]}), 400

        # Deepcopy para não alterar o original (se _generate_report_data for usado em outro lugar)
        monthly_report = copy.deepcopy(weekly_data_result) # weekly_data_result is already the content of 'relatorio'

        for local in monthly_report["locais"]:
            local["base_horas"] = round(local["base_horas"] * 4.5, 2)
            local["acrescimo_horas"] = round(local["acrescimo_horas"] * 4.5, 2)
            local["total_horas"] = round(local["total_horas"] * 4.5, 2)
            local["valor_total"] = round(local["valor_total"] * 4.5, 2)

        monthly_report["total_horas"] = round(monthly_report["total_horas"] * 4.5, 2)
        monthly_report["total_valor"] = round(monthly_report["total_valor"] * 4.5, 2)

        return jsonify({"sucesso": True, "relatorio": monthly_report})

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro ao gerar relatório mensal: {str(e)}"}), 500

if __name__ == '__main__':
    app.run()
