-- Enable the UUID extension if not already active, essential for primary keys.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Users Table: Stores basic public user information.
-- The 'id_usuario' is the primary key and is linked to the user in Supabase's auth system.
CREATE TABLE usuarios (
  id_usuario UUID PRIMARY KEY,
  cpf TEXT UNIQUE NOT NULL CHECK (char_length(cpf) = 11),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_auth_users FOREIGN KEY (id_usuario) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Workplaces Table: Global templates for a user's workplaces.
CREATE TABLE locais_trabalho (
  id_local UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#374151',
  acrescimo_ha_percent INTEGER NOT NULL DEFAULT 0,
  periodo_carencia INTEGER NOT NULL DEFAULT 60, -- In minutes
  relacionado_com UUID REFERENCES locais_trabalho(id_local) ON DELETE SET NULL -- Self-referencing link
);

-- Schedules Table: The new core entity of the architecture.
CREATE TABLE agendas (
  id_agenda UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  link_publico_id UUID UNIQUE DEFAULT uuid_generate_v4(),
  dias_semana JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb, -- e.g., [1,2,3,4,5] for Mon-Fri
  hora_inicio_padrao TIME NOT NULL DEFAULT '07:00:00',
  hora_fim_padrao TIME NOT NULL DEFAULT '23:00:00'
);

-- Junction Table: Associates a workplace with a schedule, defining a specific hourly rate for that period.
CREATE TABLE agenda_locais_config (
  id_agenda_local UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES agendas(id_agenda) ON DELETE CASCADE NOT NULL,
  local_id UUID REFERENCES locais_trabalho(id_local) ON DELETE CASCADE NOT NULL,
  valor_hora DECIMAL(10,2) NOT NULL,
  UNIQUE(agenda_id, local_id) -- Ensures a workplace can only have one configuration per schedule.
);

-- Appointments Table: Calendar events, now belonging to a specific schedule.
CREATE TABLE compromissos (
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

-- Permissions Table: Manages the sharing of schedules between users.
CREATE TABLE agenda_permissoes (
  id_permissao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES agendas(id_agenda) ON DELETE CASCADE NOT NULL,
  usuario_concedeu_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL,
  usuario_recebeu_id UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE NOT NULL,
  data_concessao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'revogado')),
  UNIQUE(agenda_id, usuario_recebeu_id) -- Prevents duplicate shares.
);

-- Enable Row Level Security (RLS) to protect user data.
-- Specific policies must be created via the Supabase dashboard or script.
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_locais_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE compromissos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_permissoes ENABLE ROW LEVEL SECURITY;
