import os

# Simulated Supabase configuration
# In a real scenario, these would be set as environment variables
# and accessed using os.environ.get()

# Replace with your actual Supabase URL
SUPABASE_URL = os.environ.get("SUPABASE_URL", "YOUR_SUPABASE_URL_HERE")

# Replace with your actual Supabase anon key (public key)
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "YOUR_SUPABASE_ANON_KEY_HERE")

# It's also common to have a service role key for admin tasks,
# but it should be kept secret and not used in client-side code.
# SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "YOUR_SUPABASE_SERVICE_KEY_HERE")

if SUPABASE_URL == "YOUR_SUPABASE_URL_HERE":
    print("Warning: SUPABASE_URL is not set. Please set it in your environment or config.py.")

if SUPABASE_KEY == "YOUR_SUPABASE_ANON_KEY_HERE":
    print("Warning: SUPABASE_KEY is not set. Please set it in your environment or config.py.")

# Example of how these might be used in a Flask app:
# from supabase import create_client, Client
# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
