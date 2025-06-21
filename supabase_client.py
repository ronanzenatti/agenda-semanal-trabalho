import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configuração do cliente Supabase
SUPABASE_URL = os.getenv('SUPABASE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SUPABASE_KEY')

# Criar cliente
supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)