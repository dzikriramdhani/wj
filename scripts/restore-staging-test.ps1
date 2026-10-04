[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$TargetDatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$ArtifactDirectory
)

$ErrorActionPreference = 'Stop'

foreach ($command in 'pg_dump', 'pg_restore', 'psql') {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "$command tidak tersedia pada PATH. Instal PostgreSQL client tools terlebih dahulu."
  }
}

New-Item -ItemType Directory -Force -Path $ArtifactDirectory | Out-Null
$backupPath = Join-Path $ArtifactDirectory 'staging.backup'
$startedAt = Get-Date

& pg_dump --format=custom --no-owner --no-privileges --file $backupPath --dbname $SourceDatabaseUrl
if ($LASTEXITCODE -ne 0) { throw 'Backup STAGING gagal dibuat.' }

& pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname $TargetDatabaseUrl $backupPath
if ($LASTEXITCODE -ne 0) { throw 'Restore ke project sementara gagal.' }

$verification = & psql --no-psqlrc --tuples-only --no-align --command "select json_build_object('migration_count', (select count(*) from supabase_migrations.schema_migrations), 'profile_count', (select count(*) from public.profiles), 'product_count', (select count(*) from public.products), 'order_count', (select count(*) from public.orders))::text;" --dbname $TargetDatabaseUrl
if ($LASTEXITCODE -ne 0) { throw 'Verifikasi restore gagal.' }

$backup = Get-Item -LiteralPath $backupPath
$hash = Get-FileHash -LiteralPath $backupPath -Algorithm SHA256
$elapsedSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)

[pscustomobject]@{
  success = $true
  backup_bytes = $backup.Length
  backup_sha256 = $hash.Hash
  elapsed_seconds = $elapsedSeconds
  restored_counts = $verification.Trim()
} | ConvertTo-Json -Compress
