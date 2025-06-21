-- Políticas de Row Level Security (RLS) para o Sistema de Agenda de Trabalho
-- Execute este script após criar as tabelas

-- =========================================
-- POLÍTICAS PARA A TABELA 'usuarios'
-- =========================================

-- Política para permitir INSERT quando o id_usuario corresponde ao usuário autenticado
CREATE POLICY "Usuários podem inserir seu próprio registro" ON usuarios
    FOR INSERT WITH CHECK (auth.uid() = id_usuario);

-- Política para permitir SELECT do próprio registro
CREATE POLICY "Usuários podem ver seu próprio registro" ON usuarios
    FOR SELECT USING (auth.uid() = id_usuario);

-- Política para permitir UPDATE do próprio registro
CREATE POLICY "Usuários podem atualizar seu próprio registro" ON usuarios
    FOR UPDATE USING (auth.uid() = id_usuario);

-- =========================================
-- POLÍTICAS PARA A TABELA 'locais_trabalho'
-- =========================================

-- Política para INSERT
CREATE POLICY "Usuários podem criar seus próprios locais de trabalho" ON locais_trabalho
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Política para SELECT
CREATE POLICY "Usuários podem ver seus próprios locais de trabalho" ON locais_trabalho
    FOR SELECT USING (auth.uid() = usuario_id);

-- Política para UPDATE
CREATE POLICY "Usuários podem atualizar seus próprios locais de trabalho" ON locais_trabalho
    FOR UPDATE USING (auth.uid() = usuario_id);

-- Política para DELETE
CREATE POLICY "Usuários podem deletar seus próprios locais de trabalho" ON locais_trabalho
    FOR DELETE USING (auth.uid() = usuario_id);

-- =========================================
-- POLÍTICAS PARA A TABELA 'agendas'
-- =========================================

-- Política para INSERT
CREATE POLICY "Usuários podem criar suas próprias agendas" ON agendas
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Política para SELECT próprias agendas
CREATE POLICY "Usuários podem ver suas próprias agendas" ON agendas
    FOR SELECT USING (auth.uid() = usuario_id);

-- Política para SELECT agendas compartilhadas
CREATE POLICY "Usuários podem ver agendas compartilhadas com eles" ON agendas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agenda_permissoes
            WHERE agenda_permissoes.agenda_id = agendas.id_agenda
            AND agenda_permissoes.usuario_recebeu_id = auth.uid()
            AND agenda_permissoes.status = 'ativo'
        )
    );

-- Política para UPDATE
CREATE POLICY "Usuários podem atualizar suas próprias agendas" ON agendas
    FOR UPDATE USING (auth.uid() = usuario_id);

-- Política para DELETE
CREATE POLICY "Usuários podem deletar suas próprias agendas" ON agendas
    FOR DELETE USING (auth.uid() = usuario_id);

-- =========================================
-- POLÍTICAS PARA A TABELA 'agenda_locais_config'
-- =========================================

-- Política para INSERT (usuário deve ser dono da agenda)
CREATE POLICY "Usuários podem configurar locais em suas agendas" ON agenda_locais_config
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = agenda_locais_config.agenda_id
            AND agendas.usuario_id = auth.uid()
        )
    );

-- Política para SELECT (próprias agendas ou compartilhadas)
CREATE POLICY "Usuários podem ver configurações de suas agendas" ON agenda_locais_config
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = agenda_locais_config.agenda_id
            AND (
                agendas.usuario_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM agenda_permissoes
                    WHERE agenda_permissoes.agenda_id = agendas.id_agenda
                    AND agenda_permissoes.usuario_recebeu_id = auth.uid()
                    AND agenda_permissoes.status = 'ativo'
                )
            )
        )
    );

-- Política para UPDATE
CREATE POLICY "Usuários podem atualizar configurações de suas agendas" ON agenda_locais_config
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = agenda_locais_config.agenda_id
            AND agendas.usuario_id = auth.uid()
        )
    );

-- Política para DELETE
CREATE POLICY "Usuários podem deletar configurações de suas agendas" ON agenda_locais_config
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = agenda_locais_config.agenda_id
            AND agendas.usuario_id = auth.uid()
        )
    );

-- =========================================
-- POLÍTICAS PARA A TABELA 'compromissos'
-- =========================================

-- Política para INSERT
CREATE POLICY "Usuários podem criar compromissos em suas agendas" ON compromissos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = compromissos.agenda_id
            AND agendas.usuario_id = auth.uid()
        )
    );

-- Política para SELECT (próprias agendas ou compartilhadas)
CREATE POLICY "Usuários podem ver compromissos de suas agendas" ON compromissos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = compromissos.agenda_id
            AND (
                agendas.usuario_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM agenda_permissoes
                    WHERE agenda_permissoes.agenda_id = agendas.id_agenda
                    AND agenda_permissoes.usuario_recebeu_id = auth.uid()
                    AND agenda_permissoes.status = 'ativo'
                )
            )
        )
    );

-- Política para UPDATE
CREATE POLICY "Usuários podem atualizar compromissos de suas agendas" ON compromissos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = compromissos.agenda_id
            AND agendas.usuario_id = auth.uid()
        )
    );

-- Política para DELETE
CREATE POLICY "Usuários podem deletar compromissos de suas agendas" ON compromissos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = compromissos.agenda_id
            AND agendas.usuario_id = auth.uid()
        )
    );

-- =========================================
-- POLÍTICAS PARA A TABELA 'agenda_permissoes'
-- =========================================

-- Política para INSERT (apenas o dono da agenda pode compartilhar)
CREATE POLICY "Donos podem compartilhar suas agendas" ON agenda_permissoes
    FOR INSERT WITH CHECK (
        auth.uid() = usuario_concedeu_id
        AND EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = agenda_permissoes.agenda_id
            AND agendas.usuario_id = auth.uid()
        )
    );

-- Política para SELECT (quem concedeu ou recebeu pode ver)
CREATE POLICY "Usuários podem ver permissões relacionadas a eles" ON agenda_permissoes
    FOR SELECT USING (
        auth.uid() = usuario_concedeu_id 
        OR auth.uid() = usuario_recebeu_id
    );

-- Política para UPDATE (apenas quem concedeu pode atualizar)
CREATE POLICY "Donos podem atualizar permissões concedidas" ON agenda_permissoes
    FOR UPDATE USING (auth.uid() = usuario_concedeu_id);

-- Política para DELETE (apenas quem concedeu pode deletar)
CREATE POLICY "Donos podem revogar permissões concedidas" ON agenda_permissoes
    FOR DELETE USING (auth.uid() = usuario_concedeu_id);

-- =========================================
-- POLÍTICA ESPECIAL PARA VISUALIZAÇÃO PÚBLICA
-- =========================================

-- Permitir SELECT anônimo em agendas quando acessadas via link_publico_id
-- (Isso requer uma função RPC personalizada ou ajuste na aplicação)

-- Função auxiliar para verificar se uma agenda é pública
CREATE OR REPLACE FUNCTION is_agenda_public(agenda_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM agendas 
        WHERE id_agenda = agenda_uuid 
        AND link_publico_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Política adicional para permitir visualização anônima de agendas públicas
CREATE POLICY "Acesso anônimo a agendas públicas" ON agendas
    FOR SELECT USING (
        link_publico_id IS NOT NULL
    );

-- Política adicional para permitir visualização anônima de compromissos de agendas públicas
CREATE POLICY "Acesso anônimo a compromissos de agendas públicas" ON compromissos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = compromissos.agenda_id
            AND agendas.link_publico_id IS NOT NULL
        )
    );

-- Política adicional para permitir visualização anônima de configurações de agendas públicas
CREATE POLICY "Acesso anônimo a configurações de agendas públicas" ON agenda_locais_config
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agendas
            WHERE agendas.id_agenda = agenda_locais_config.agenda_id
            AND agendas.link_publico_id IS NOT NULL
        )
    );

-- =========================================
-- NOTAS IMPORTANTES
-- =========================================
-- 1. Certifique-se de que RLS está habilitado em todas as tabelas
-- 2. As políticas usam auth.uid() que é o ID do usuário autenticado no Supabase
-- 3. Para visualização pública, considere criar uma API route específica
-- 4. Teste todas as operações após aplicar estas políticas