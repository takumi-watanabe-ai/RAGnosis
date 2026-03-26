# Claude.mk - Custom development tasks

include .env
export

claude_sql: ## Execute SQL query (Usage: make claude_sql SQL="SELECT * FROM pg_tables")
	@python -c "import os; from supabase import create_client; \
	sb = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY')); \
	result = sb.rpc('exec_sql', {'query': '$(SQL)'}).execute(); \
	print(result.data if hasattr(result, 'data') else result)"
