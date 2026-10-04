[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDatabasePassword,

  [Parameter(Mandatory = $true)]
  [string]$TargetDatabasePassword,

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
$source = [pscustomobject]@{
  Host = 'aws-0-ap-northeast-1.pooler.supabase.com'
  Port = 5432
  Database = 'postgres'
  Username = 'postgres.aqfllncygivcvsacbfpi'
  Password = $SourceDatabasePassword
}
$target = [pscustomobject]@{
  Host = 'aws-0-ap-south-1.pooler.supabase.com'
  Port = 5432
  Database = 'postgres'
  Username = 'postgres.fpdglanfrfsrinlslfie'
  Password = $TargetDatabasePassword
}
$previousPassword = $env:PGPASSWORD
$previousSslMode = $env:PGSSLMODE
$env:PGSSLMODE = 'require'

try {
  $env:PGPASSWORD = $source.Password
  & pg_dump --host $source.Host --port $source.Port --username $source.Username --dbname $source.Database --format=custom --no-owner --no-privileges --file $backupPath
  if ($LASTEXITCODE -ne 0) { throw 'Backup STAGING gagal dibuat.' }

  $env:PGPASSWORD = $target.Password
  & pg_restore --host $target.Host --port $target.Port --username $target.Username --dbname $target.Database --clean --if-exists --no-owner --no-privileges --single-transaction $backupPath
  if ($LASTEXITCODE -ne 0) { throw 'Restore ke project sementara gagal.' }

  $verification = & psql --host $target.Host --port $target.Port --username $target.Username --dbname $target.Database --no-psqlrc --tuples-only --no-align --command "select json_build_object('migration_count', (select count(*) from supabase_migrations.schema_migrations), 'profile_count', (select count(*) from public.profiles), 'product_count', (select count(*) from public.products), 'order_count', (select count(*) from public.orders))::text;"
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
} finally {
  $env:PGPASSWORD = $previousPassword
  $env:PGSSLMODE = $previousSslMode
}
