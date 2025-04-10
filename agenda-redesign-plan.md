# Plano de Reestruturação da Agenda Semanal

## 1. Visão Geral das Mudanças

O sistema "Agenda Semanal" será transformado em uma aplicação simples e básica com as seguintes características:

1. **Locais de trabalho personalizáveis** (substituindo as instituições fixas)
   - Personalização de cores
   - Configuração do valor da hora de trabalho
   - Configuração de acréscimos percentuais para hora-aula
   - Nova opção de "apenas hora trabalho"
   - Configuração do intervalo entre locais
   - Relacionamento entre locais para soma do limite de 8 horas

2. **Dias da semana configuráveis**
   - Permitir que o usuário selecione quais dias da semana deseja exibir

3. **Cálculo de pagamento semanal e mensal**
   - Implementar totalizadores para valores semanais e mensais

4. **Armazenamento em banco de dados Supabase**
   - Identificação de usuários por CPF e nome
   - Persistência de dados em Supabase
   - Implementação de back-end em Flask

## 2. Arquitetura Proposta

### 2.1 Aplicação Única
- Flask para back-end e servir o front-end
- Templates HTML/CSS/JavaScript
- Hospedagem no Vercel

### 2.2 Back-end
- Python com Flask
- Integração direta com Supabase
- Autenticação via Supabase Auth

### 2.3 Banco de Dados
- Supabase (baseado em PostgreSQL)
- Estrutura de tabelas:
  - usuarios (CPF, nome completo, etc.)
  - locais_trabalho (configurações personalizadas)
  - compromissos (eventos na agenda)
  - configuracoes_usuario (dias da semana, etc.)

## 3. Modificações Detalhadas

### 3.1 Banco de Dados Supabase
```sql
-- Schema do Banco de Dados Supabase (PostgreSQL)

-- Tabela de Usuários
CREATE TABLE usuarios (
  id_usuario UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cpf TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Locais de Trabalho
CREATE TABLE locais_trabalho (
  id_local UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL,
  valor_hora DECIMAL(10,2) NOT NULL,
  acrescimo_ha_percent INTEGER NOT NULL DEFAULT 0,
  periodo_carencia INTEGER NOT NULL DEFAULT 60, -- minutos
  relacionado_com UUID REFERENCES locais_trabalho(id_local) NULL
);

-- Tabela de Compromissos
CREATE TABLE compromissos (
  id_compromisso UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  local_id UUID REFERENCES locais_trabalho(id_local) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL, -- 0 (domingo) a 6 (sábado)
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  descricao TEXT NOT NULL,
  tipo_hora TEXT NOT NULL CHECK (tipo_hora IN ('HA', 'HAE', 'HT')),
  duracao DECIMAL(4,1) NOT NULL
);

-- Tabela de Configurações
CREATE TABLE configuracoes_usuario (
  id_configuracao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  dias_semana JSONB NOT NULL DEFAULT '[1,2,3,4,5,6]'::jsonb,
  hora_inicio_padrao TIME NOT NULL DEFAULT '07:00',
  hora_fim_padrao TIME NOT NULL DEFAULT '23:00'
);
```

### 3.2 Rotas Flask

```python
# Aplicação Flask simples

# Página principal - Renderiza o aplicativo
@app.route('/')
def index():
    return render_template('index.html')

# Autenticação
@app.route('/auth/registrar', methods=['POST'])
def registrar():
    # Implementação do registro via Supabase Auth

@app.route('/auth/login', methods=['POST'])
def login():
    # Implementação do login via Supabase Auth

@app.route('/auth/logout', methods=['POST'])
def logout():
    # Implementação do logout

# Locais de Trabalho
@app.route('/locais', methods=['GET'])
def listar_locais():
    # Listar locais de trabalho do usuário logado

@app.route('/locais', methods=['POST'])
def criar_local():
    # Criar novo local de trabalho

@app.route('/locais/<id_local>', methods=['PUT'])
def atualizar_local(id_local):
    # Atualizar local de trabalho

@app.route('/locais/<id_local>', methods=['DELETE'])
def excluir_local(id_local):
    # Excluir local de trabalho

# Compromissos
@app.route('/compromissos', methods=['GET'])
def listar_compromissos():
    # Listar compromissos do usuário logado

@app.route('/compromissos', methods=['POST'])
def criar_compromisso():
    # Criar novo compromisso

@app.route('/compromissos/<id_compromisso>', methods=['PUT'])
def atualizar_compromisso(id_compromisso):
    # Atualizar compromisso

@app.route('/compromissos/<id_compromisso>', methods=['DELETE'])
def excluir_compromisso(id_compromisso):
    # Excluir compromisso

# Configurações
@app.route('/configuracoes', methods=['GET'])
def obter_configuracoes():
    # Obter configurações do usuário

@app.route('/configuracoes', methods=['PUT'])
def atualizar_configuracoes():
    # Atualizar configurações do usuário

# Relatórios
@app.route('/relatorios/semanal', methods=['GET'])
def relatorio_semanal():
    # Gerar relatório semanal

@app.route('/relatorios/mensal', methods=['GET'])
def relatorio_mensal():
    # Gerar relatório mensal
```

### 3.3 Modificações no Front-end

#### 3.3.1 Página de Login/Cadastro
- Formulário de login (CPF/Email e senha)
- Formulário de cadastro (CPF, nome, email, senha)
- Redirecionamento para a agenda após autenticação

#### 3.3.2 Substituição das Instituições por Locais de Trabalho
- Formulário de cadastro/edição de locais de trabalho
- Campos adicionais: relacionamento com outros locais
- Opção para tipo de hora trabalho (HT)

#### 3.3.3 Configuração de Dias da Semana
- Interface para selecionar quais dias exibir
- Persistência das configurações no banco de dados

#### 3.3.4 Cálculos de Pagamento
- Totalizadores por local (base, acréscimo, total)
- Totalizadores semanais
- Totalizadores mensais (baseado em semanas do mês corrente)

## 4. Implementação do Sistema Flask + Supabase

### 4.1 Estrutura de Arquivos do Projeto
```
agenda-trabalho/
├── app.py                 # Aplicação Flask principal
├── config.py              # Configurações da aplicação
├── supabase_client.py     # Cliente Supabase
├── requirements.txt       # Dependências do projeto
├── vercel.json            # Configuração para deploy no Vercel
└── static/                # Arquivos estáticos
    ├── css/
    ├── js/
    └── img/
└── templates/             # Templates HTML
    ├── index.html         # Aplicação principal
    ├── login.html         # Página de login
    └── registro.html      # Página de registro
```

### 4.2 Dependências Principais
```
Flask==2.0.1
supabase-py==0.0.2
python-dotenv==0.19.0
gunicorn==20.1.0
```

### 4.3 Cronograma de Implementação

1. **Fase 1: Configuração Inicial**
   - Configuração do projeto Flask
   - Integração com Supabase
   - Configuração do ambiente de desenvolvimento

2. **Fase 2: Autenticação e Estrutura Básica**
   - Implementação das páginas de login/registro
   - Configuração de autenticação via Supabase
   - Estrutura básica da aplicação

3. **Fase 3: Funcionalidades Principais**
   - Implementação de locais de trabalho personalizáveis
   - Implementação de compromissos
   - Configurações personalizáveis
   - Cálculos de pagamento

4. **Fase 4: Deploy e Ajustes**
   - Configuração para deploy no Vercel
   - Testes finais
   - Ajustes e otimizações

## 5. Considerações Técnicas

- **Simplicidade**: Manter o sistema simples e direto, sem complexidades desnecessárias
- **Integração Supabase**: Utilizar os recursos do Supabase para autenticação e armazenamento de dados
- **Segurança**: Implementar autenticação via Supabase Auth, validação de entrada de dados
- **Responsividade**: Manter a interface adaptável a diferentes dispositivos
- **Hospedagem Vercel**: Configurar corretamente para deploy no Vercel
