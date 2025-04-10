from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from functools import wraps
import os
from dotenv import load_dotenv
from supabase_client import supabase_client

# Carregar variáveis de ambiente
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "chave-secreta-temporaria")

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

# Rotas de API para autenticação
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
            
            # Criar configurações padrão para o usuário
            supabase_client.table('configuracoes_usuario').insert({
                "usuario_id": usuario_id,
                "dias_semana": [1, 2, 3, 4, 5, 6],
                "hora_inicio_padrao": "07:00",
                "hora_fim_padrao": "23:00"
            }).execute()
            
            return jsonify({"sucesso": True, "mensagem": "Usuário registrado com sucesso"})
        else:
            return jsonify({"sucesso": False, "mensagem": "Erro ao registrar usuário"}), 400
            
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

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

@app.route('/locais', methods=['POST'])
@requer_autenticacao
def criar_local():
    dados = request.json
    
    try:
        novo_local = {
            "usuario_id": session['usuario_id'],
            "nome": dados.get('nome'),
            "cor": dados.get('cor'),
            "valor_hora": dados.get('valor_hora'),
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
            "valor_hora": dados.get('valor_hora'),
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

# API de Compromissos
@app.route('/compromissos', methods=['GET'])
@requer_autenticacao
def listar_compromissos():
    try:
        resposta = supabase_client.table('compromissos')\
            .select('*')\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
        return jsonify({"sucesso": True, "compromissos": resposta.data})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/compromissos', methods=['POST'])
@requer_autenticacao
def criar_compromisso():
    dados = request.json
    
    try:
        # Verificar se o local pertence ao usuário
        verificacao = supabase_client.table('locais_trabalho')\
            .select('id_local')\
            .eq('id_local', dados.get('local_id'))\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
            
        if not verificacao.data:
            return jsonify({"sucesso": False, "mensagem": "Local não encontrado ou sem permissão"}), 400
        
        novo_compromisso = {
            "usuario_id": session['usuario_id'],
            "local_id": dados.get('local_id'),
            "dia_semana": dados.get('dia_semana'),
            "hora_inicio": dados.get('hora_inicio'),
            "hora_fim": dados.get('hora_fim'),
            "descricao": dados.get('descricao'),
            "tipo_hora": dados.get('tipo_hora'),
            "duracao": dados.get('duracao')
        }
        
        resposta = supabase_client.table('compromissos').insert(novo_compromisso).execute()
        
        return jsonify({"sucesso": True, "compromisso": resposta.data[0]})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/compromissos/<id_compromisso>', methods=['PUT'])
@requer_autenticacao
def atualizar_compromisso(id_compromisso):
    dados = request.json
    
    try:
        # Verificar se o compromisso pertence ao usuário
        verificacao = supabase_client.table('compromissos')\
            .select('id_compromisso')\
            .eq('id_compromisso', id_compromisso)\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
            
        if not verificacao.data:
            return jsonify({"sucesso": False, "mensagem": "Compromisso não encontrado ou sem permissão"}), 404
        
        # Verificar se o local pertence ao usuário (se estiver sendo atualizado)
        if 'local_id' in dados:
            verificacao_local = supabase_client.table('locais_trabalho')\
                .select('id_local')\
                .eq('id_local', dados.get('local_id'))\
                .eq('usuario_id', session['usuario_id'])\
                .execute()
                
            if not verificacao_local.data:
                return jsonify({"sucesso": False, "mensagem": "Local não encontrado ou sem permissão"}), 400
        
        atualizacao = {}
        campos_permitidos = ['local_id', 'dia_semana', 'hora_inicio', 'hora_fim', 
                           'descricao', 'tipo_hora', 'duracao']
                           
        for campo in campos_permitidos:
            if campo in dados:
                atualizacao[campo] = dados.get(campo)
        
        resposta = supabase_client.table('compromissos')\
            .update(atualizacao)\
            .eq('id_compromisso', id_compromisso)\
            .execute()
        
        return jsonify({"sucesso": True, "compromisso": resposta.data[0]})
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/compromissos/<id_compromisso>', methods=['DELETE'])
@requer_autenticacao
def excluir_compromisso(id_compromisso):
    try:
        # Verificar se o compromisso pertence ao usuário
        verificacao = supabase_client.table('compromissos')\
            .select('id_compromisso')\
            .eq('id_compromisso', id_compromisso)\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
            
        if not verificacao.data:
            return jsonify({"sucesso": False, "mensagem": "Compromisso não encontrado ou sem permissão"}), 404
        
        # Remover o compromisso
        supabase_client.table('compromissos')\
            .delete()\
            .eq('id_compromisso', id_compromisso)\
            .execute()
        
        return jsonify({"sucesso": True})
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

# API de Relatórios
@app.route('/relatorios/semanal', methods=['GET'])
@requer_autenticacao
def relatorio_semanal():
    try:
        # Obter todos os compromissos do usuário
        compromissos = supabase_client.table('compromissos')\
            .select('*, locais_trabalho(*)')\
            .eq('usuario_id', session['usuario_id'])\
            .execute()
            
        # Calcular totais por local de trabalho
        locais = {}
        total_horas = 0
        total_valor = 0
        
        for compromisso in compromissos.data:
            local_id = compromisso['local_id']
            local = compromisso['locais_trabalho']
            tipo_hora = compromisso['tipo_hora']
            duracao = float(compromisso['duracao'])
            
            # Inicializar local se não existir
            if local_id not in locais:
                locais[local_id] = {
                    'nome': local['nome'],
                    'base_horas': 0,
                    'acrescimo_horas': 0,
                    'total_horas': 0,
                    'valor_total': 0
                }
            
            # Adicionar horas base
            locais[local_id]['base_horas'] += duracao
            
            # Calcular acréscimo se for hora-aula (HA)
            if tipo_hora == 'HA' and local['acrescimo_ha_percent'] > 0:
                acrescimo = duracao * (local['acrescimo_ha_percent'] / 100)
                locais[local_id]['acrescimo_horas'] += acrescimo
            
            # Calcular total de horas e valor para o local
            locais[local_id]['total_horas'] = locais[local_id]['base_horas'] + locais[local_id]['acrescimo_horas']
            locais[local_id]['valor_total'] = locais[local_id]['total_horas'] * float(local['valor_hora'])
            
        # Adicionar ao total geral
        total_horas = sum([l['total_horas'] for l in locais.values()])
        total_valor = sum([l['valor_total'] for l in locais.values()])
        
        return jsonify({
            "sucesso": True, 
            "relatorio": {
                "locais": list(locais.values()),
                "total_horas": total_horas,
                "total_valor": total_valor
            }
        })
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

@app.route('/relatorios/mensal', methods=['GET'])
@requer_autenticacao
def relatorio_mensal():
    try:
        # Para simplificar, vamos supor 4 semanas no mês
        # Em uma implementação real, você precisaria calcular com base em datas reais
        semanal = relatorio_semanal().json
        
        if semanal["sucesso"]:
            relatorio = semanal["relatorio"]
            
            return jsonify({
                "sucesso": True,
                "relatorio": {
                    "locais": [
                        {
                            "nome": local["nome"],
                            "base_horas": local["base_horas"] * 4,
                            "acrescimo_horas": local["acrescimo_horas"] * 4,
                            "total_horas": local["total_horas"] * 4,
                            "valor_total": local["valor_total"] * 4
                        }
                        for local in relatorio["locais"]
                    ],
                    "total_horas": relatorio["total_horas"] * 4,
                    "total_valor": relatorio["total_valor"] * 4
                }
            })
        else:
            return jsonify({"sucesso": False, "mensagem": "Erro ao gerar relatório semanal"}), 400
    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
