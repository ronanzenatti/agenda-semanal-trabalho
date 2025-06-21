-- Schema Completo do Banco de Dados - Sistema de Agenda de Trabalho
-- Execute este script no Supabase SQL Editor

-- Enable the UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- =========================================
-- TABELA: usuarios
-- =========================================
-- Armazena informações básicas dos usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario UUID PRIMARY KEY,
  cpf TEXT UNIQUE NOT NULL CHECK (char_length(cpf) = 11),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_auth_users FOREIGN KEY (id_usuario) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =========================================
-- TABELA: locais_trabalho
-- =========================================
-- Templates globais dos locais de trabalho do usuário
CREATE TABLE IF NOT EXISTS locais_trabalho (
  id_local UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#374151',
  acrescimo_ha_percent INTEGER NOT NULL DEFAULT 0,
  periodo_carencia INTEGER NOT NULL DEFAULT 60, -- Em minutos
  relacionado_com UUID REFERENCES locais_trabalho(id_local) ON DELETE SET NULL
);

-- =========================================
-- TABELA: agendas
-- =========================================
-- Nova entidade central da arquitetura
CREATE TABLE IF NOT EXISTS agendas (
  id_agenda UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  link_publico_id UUID UNIQUE DEFAULT uuid_generate_v4(),
  dias_semana JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  hora_inicio_padrao TIME NOT NULL DEFAULT '07:00:00',
  hora_fim_padrao TIME NOT NULL DEFAULT '23:00:00'
);

-- =========================================
-- TABELA: agenda_locais_config
-- =========================================
-- Associa um local de trabalho com uma agenda, definindo o valor/hora específico
CREATE TABLE IF NOT EXISTS agenda_locais_config (
  id_agenda_local UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES agendas(id_agenda) ON DELETE CASCADE NOT NULL,
  local_id UUID REFERENCES locais_trabalho(id_local) ON DELETE CASCADE NOT NULL,
  valor_hora DECIMAL(10,2) NOT NULL,
  UNIQUE(agenda_id, local_id)
);

-- =========================================
-- TABELA: compromissos
-- =========================================
-- Eventos do calendário, agora pertencendo a uma agenda específica
CREATE TABLE IF NOT EXISTS compromissos (
  id_compromisso UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES agendas(id_agenda) ON DELETE CASCADE NOT NULL,
  local_id UUID REFERENCES locais_trabalho(id_local) ON DELETE CASCADE NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  duracao DECIMAL(4,1) NOT NULL,
  descricao TEXT,
  tipo_hora TEXT NOT NULL CHECK (tipo_hora IN ('HA', 'HAE', 'HT'))
);

-- =========================================
-- TABELA: agenda_permissoes
-- =========================================
-- Gerencia o compartilhamento de agendas entre usuários
CREATE TABLE IF NOT EXISTS agenda_permissoes (
  id_permissao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES agendas(id_agenda) ON DELETE CASCADE NOT NULL,
  usuario_concedeu_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL,
  usuario_recebeu_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL,
  data_concessao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'revogado')),
  UNIQUE(agenda_id, usuario_recebeu_id)
);

-- =========================================
-- TABELA: configuracoes_usuario (FALTANTE)
-- =========================================
-- Armazena configurações gerais do usuário
CREATE TABLE IF NOT EXISTS configuracoes_usuario (
  id_configuracao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL UNIQUE,
  dias_semana JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  hora_inicio_padrao TIME NOT NULL DEFAULT '07:00:00',
  hora_fim_padrao TIME NOT NULL DEFAULT '23:00:00'
);

-- =========================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- =========================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_locais_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE compromissos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_usuario ENABLE ROW LEVEL SECURITY;

-- =========================================
-- POLÍTICAS RLS PARA configuracoes_usuario
-- =========================================

-- Política para INSERT
CREATE POLICY "Usuários podem criar suas próprias configurações" ON configuracoes_usuario
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Política para SELECT
CREATE POLICY "Usuários podem ver suas próprias configurações" ON configuracoes_usuario
    FOR SELECT USING (auth.uid() = usuario_id);

-- Política para UPDATE
CREATE POLICY "Usuários podem atualizar suas próprias configurações" ON configuracoes_usuario
    FOR UPDATE USING (auth.uid() = usuario_id);

-- Política para DELETE
CREATE POLICY "Usuários podem deletar suas próprias configurações" ON configuracoes_usuario
    FOR DELETE USING (auth.uid() = usuario_id);

-- =========================================
-- ÍNDICES PARA MELHOR PERFORMANCE
-- =========================================
CREATE INDEX IF NOT EXISTS idx_locais_trabalho_usuario ON locais_trabalho(usuario_id);
CREATE INDEX IF NOT EXISTS idx_agendas_usuario ON agendas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_agenda_locais_config_agenda ON agenda_locais_config(agenda_id);
CREATE INDEX IF NOT EXISTS idx_compromissos_agenda ON compromissos(agenda_id);
CREATE INDEX IF NOT EXISTS idx_compromissos_local ON compromissos(local_id);
CREATE INDEX IF NOT EXISTS idx_agenda_permissoes_agenda ON agenda_permissoes(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agenda_permissoes_usuario_recebeu ON agenda_permissoes(usuario_recebeu_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_usuario ON configuracoes_usuario(usuario_id);

-- =========================================
-- COMENTÁRIOS NAS TABELAS
-- =========================================
COMMENT ON TABLE usuarios IS 'Informações básicas dos usuários do sistema';
COMMENT ON TABLE locais_trabalho IS 'Locais de trabalho configurados pelos usuários';
COMMENT ON TABLE agendas IS 'Agendas/horários criados pelos usuários';
COMMENT ON TABLE agenda_locais_config IS 'Configuração de valor/hora por local em cada agenda';
COMMENT ON TABLE compromissos IS 'Compromissos/eventos agendados';
COMMENT ON TABLE agenda_permissoes IS 'Permissões de compartilhamento de agendas entre usuários';
COMMENT ON TABLE configuracoes_usuario IS 'Configurações gerais do usuário (dias da semana, horários padrão)';

-- =========================================
-- FUNÇÃO PARA VERIFICAR INTEGRIDADE
-- =========================================
CREATE OR REPLACE FUNCTION verificar_schema()
RETURNS TABLE (
    tabela TEXT,
    existe BOOLEAN,
    colunas_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::TEXT,
        TRUE,
        COUNT(c.column_name)::INTEGER
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'usuarios', 
        'locais_trabalho', 
        'agendas', 
        'agenda_locais_config', 
        'compromissos', 
        'agenda_permissoes',
        'configuracoes_usuario'
    )
    GROUP BY t.table_name;
END;
$$ LANGUAGE plpgsql;

-- Execute esta função para verificar se todas as tabelas foram criadas:
-- SELECT * FROM verificar_schema();