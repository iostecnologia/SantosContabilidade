# Recuperação de desastre — Santos SAF

Guia para reinstalar o sistema do zero em uma VPS nova, caso a atual (`hostinger-vps`,
187.127.43.89) seja perdida, excluída ou fique inacessível.

## O que existe em cada backup

| Backup | Onde | Contém | Frequência |
|---|---|---|---|
| **GitHub** | `github.com/iostecnologia/SantosContabilidade` (público) | Todo o código-fonte (`apps/api`, `apps/web`), `docker-compose.yml`, `Caddyfile` (versão single-site, sem os outros projetos), scripts de backup | A cada push |
| **Google Drive** | Sua conta pessoal, pasta `SantosSAF-Backups` (remoto rclone `gdrive`) | `*.sql.gz` (dumps do Postgres, raiz da pasta) + `config/<timestamp>/` (`.env`, `docker-compose.yml`, `Caddyfile.vps-live` real, hash do commit) | Diária, cron 02:00–02:15 na VPS |
| **Seu PC** | `backups/vps-<data>/` dentro deste repositório local (git-ignorado) | Snapshot manual completo: `.env`, `docker-compose.yml`, `Caddyfile.vps-live`, todos os dumps, scripts, README | Manual, sob pedido |

**Nenhum backup sozinho é 100% suficiente**: o GitHub não tem segredos nem dados;
o Drive e o PC têm tudo, mas dependem de você ainda ter acesso a pelo menos um dos dois
para os segredos (`.env`) e o `Caddyfile` real. Se **os dois** (PC e Drive) forem perdidos
junto com a VPS, o passo 4 abaixo explica como recriar `.env` do zero (perde-se apenas
sessões de login ativas, não dados).

## Passo a passo — VPS nova

### 1. Provisionar a VPS
Ubuntu 24.04 (mesma versão da atual), acesso root via SSH. Instalar Docker + plugin
Compose:
```bash
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin git
```
Firewall (igual à VPS original — só 22/80/443 abertos, Postgres nunca exposto):
```bash
ufw allow 22,80,443/tcp
ufw enable
```

### 2. Baixar o código (GitHub)
```bash
git clone https://github.com/iostecnologia/SantosContabilidade.git /opt/santos-saf
cd /opt/santos-saf
```
Se quiser restaurar a versão exata que estava rodando (não a última do `main`), use o
`git-commit.txt` de dentro do backup de config (Drive ou PC):
```bash
git checkout <hash-do-git-commit.txt>
```

### 3. Restaurar `.env` e `Caddyfile`
**Opção A — a partir do backup do Drive/PC** (recomendado, mantém as senhas/segredos
originais, nenhuma sessão de usuário é derrubada):
```bash
# copie env.backup -> /opt/santos-saf/.env
# copie Caddyfile.vps-live -> /opt/santos-saf/Caddyfile
```
Baixar do Drive direto na VPS nova (depois de instalar e reconfigurar o rclone lá,
repetindo o processo de OAuth documentado neste projeto):
```bash
rclone copy gdrive:SantosSAF-Backups/config/<timestamp-mais-recente>/ /opt/santos-saf/ -v
mv /opt/santos-saf/env.backup /opt/santos-saf/.env
mv /opt/santos-saf/Caddyfile.vps-live /opt/santos-saf/Caddyfile
```

**Opção B — sem nenhum backup de config disponível** (só o código do GitHub sobrou):
gere segredos novos — isso invalida apenas tokens JWT de login ativos, os dados do
banco (restaurados no passo 5) não dependem deles:
```bash
cp .env.example .env
# edite .env e substitua os 5 valores por saídas de:
openssl rand -base64 48
```
Copie o `Caddyfile` deste repositório (`/opt/santos-saf/Caddyfile`, já vem do git) como
base — ele só tem o bloco `contabil.fabricanet.com.br`. **Atenção**: a VPS antiga também
hospedava outros sites (SEFAN, um CRM em `crm.fabricanet.com.br`, `site.fabricanet.com.br`)
na mesma instância Caddy — isso é responsabilidade separada de cada um desses projetos,
não faz parte deste backup. Se quiser recriá-los ali, adicione os blocos deles de volta
manualmente (estão documentados no `Caddyfile.vps-live` do backup, se disponível).

### 4. Subir os containers
```bash
docker compose up -d --build
```
Aguarde o Postgres ficar `healthy` (`docker compose ps`) antes do próximo passo.

### 5. Restaurar o banco de dados
Pegue o dump mais recente do Drive (ou do backup local do PC):
```bash
rclone copy gdrive:SantosSAF-Backups/santos_saf_db_<mais-recente>.sql.gz /root/
gunzip -c /root/santos_saf_db_*.sql.gz | docker exec -i santos_saf_postgres psql -U postgres santos_saf
```
As migrations do Prisma já são aplicadas automaticamente pelo entrypoint do container
`api` ao subir — o `pg_dump`/`psql` acima restaura os dados, não o schema (o schema já
existe pela migration). Se a versão do schema divergir, rode manualmente:
```bash
docker compose exec api npx prisma migrate deploy
```

### 6. Reativar os backups automáticos
```bash
chmod +x backup-db.sh backup-config.sh rclone-upload-backup.sh
cp backup-db.sh backup-config.sh rclone-upload-backup.sh /opt/santos-saf/
cat > /etc/cron.d/santos-saf-db-backup <<'EOF'
0 2 * * * root /opt/santos-saf/backup-db.sh >> /var/log/santos-saf-db-backup.log 2>&1
EOF
cat > /etc/cron.d/santos-saf-config-backup <<'EOF'
5 2 * * * root /opt/santos-saf/backup-config.sh >> /var/log/santos-saf-config-backup.log 2>&1
EOF
cat > /etc/cron.d/santos-saf-gdrive-backup <<'EOF'
15 2 * * * root /opt/santos-saf/rclone-upload-backup.sh >> /var/log/santos-saf-gdrive-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/santos-saf-*
```
E refaça a autorização OAuth do rclone (`rclone config` → remoto `gdrive`, tipo `drive`,
escopo `drive.file`) — o token é por VPS, não é reaproveitável de uma instalação para
outra.

### 7. DNS e verificação final
- Aponte o registro A de `contabil.fabricanet.com.br` no Cloudflare para o novo IP,
  mantendo **"DNS only"** (nuvem cinza) para o desafio HTTP-01 do Let's Encrypt funcionar.
- Confira `https://contabil.fabricanet.com.br/api/docs` (Swagger) carregando sem login.
- Faça login na UI normalmente e confira alguns lançamentos/relatórios contra o que você
  lembra do sistema antes do incidente.

## Observações
- O repositório é **público** — nunca commitar `.env`, dumps do banco (`backups/`) ou o
  `Caddyfile` com os outros sites. Isso já está garantido pelo `.gitignore`.
- Snapshots de config no Drive/PC têm até 24h de defasagem (rodam 1x/dia) — se algo mudar
  no `.env`/`Caddyfile` da VPS fora desse ciclo, rode `backup-config.sh` manualmente antes
  de confiar nele para uma restauração.
