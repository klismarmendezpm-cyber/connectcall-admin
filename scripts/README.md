Create Supabase Auth users script

1) Prepare a JSON array file `users.json` in the same folder. Example:
[
  {"email":"kmendez@pureminutes.com","password":"ChangeMe123!"},
  {"email":"hasselcc@mnl.com","password":"ChangeMe123!"},
  {"email":"sa@sa.gmail.com","password":"ChangeMe123!"}
]

2) Run locally (Node 18+ recommended):

On Windows PowerShell:

$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
node create_supabase_auth_users.js users.json

On macOS/Linux:

export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
node create_supabase_auth_users.js users.json

Notes:
- **Do not** commit your service role key to source control.
- Run this only from a secure server or your local machine (never in frontend/browser).
