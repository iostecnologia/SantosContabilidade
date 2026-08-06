#!/bin/sh
# Cria os dois papéis de banco usados pela aplicação:
#   app_migrator: dono das tabelas, roda `prisma migrate`, ignora RLS por ser dono.
#   app_user: papel de runtime da API, sujeito a Row-Level Security (NOBYPASSRLS).
# As senhas vêm de variáveis de ambiente do container (ver docker-compose.yml),
# nunca hardcoded aqui — este arquivo é versionado no git.
set -e

: "${APP_MIGRATOR_PASSWORD:?APP_MIGRATOR_PASSWORD não definida}"
: "${APP_USER_PASSWORD:?APP_USER_PASSWORD não definida}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_migrator') THEN
    CREATE ROLE app_migrator WITH LOGIN PASSWORD '$APP_MIGRATOR_PASSWORD' CREATEDB;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD '$APP_USER_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
\$\$;

ALTER DATABASE santos_saf OWNER TO app_migrator;
GRANT ALL ON SCHEMA public TO app_migrator;
GRANT USAGE ON SCHEMA public TO app_user;

-- Privilégios padrão para tabelas futuras criadas pelo app_migrator (via \`prisma migrate\`):
-- app_user recebe apenas o que precisa; UPDATE/DELETE em journal_entries e
-- journal_entry_lines são revogados explicitamente na migração de RLS (imutabilidade contábil).
ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
EOSQL
