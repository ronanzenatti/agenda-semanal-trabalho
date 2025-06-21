import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Carregar variáveis de ambiente (apenas tem efeito em desenvolvimento local)
load_dotenv()

# Configuração do cliente Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Debug: verificar se estamos no Vercel
is_vercel = os.getenv('VERCEL_ENV') is not None

# Verificar se as variáveis foram carregadas
if not SUPABASE_URL or not SUPABASE_KEY:
    error_msg = (
        "As variáveis de ambiente SUPABASE_URL e SUPABASE_KEY são obrigatórias.\n " + os.getenv('SUPABASE_URL') + " \n- " + os.getenv('SUPABASE_KEY') + "\n\n"
    )
    
    if is_vercel:
        error_msg += (
            "Você está no Vercel. Configure as variáveis em:\n"
            "Dashboard > Seu Projeto > Settings > Environment Variables"
        )
    else:
        error_msg += (
            "Você está em desenvolvimento local. Crie um arquivo .env com:\n"
            "SUPABASE_URL=sua_url_aqui\n"
            "SUPABASE_KEY=sua_chave_aqui"
        )
    
    raise ValueError(error_msg)

# Criar cliente
try:
    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Supabase client criado com sucesso! (Vercel: {is_vercel})")
except Exception as e:
    raise ValueError(f"Erro ao criar cliente Supabase: {str(e)}")