[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string]$SourceDatabasePassword,
  [Parameter(Mandatory = $true)] [string]$TargetDatabasePassword,
  [Parameter(Mandatory = $true)] [string]$TargetPoolerHost,
  [Parameter(Mandatory = $true)] [string]$TargetDatabaseUser,
  [string]$SourcePoolerHost = 'aws-0-ap-northeast-1.pooler.supabase.com',
  [string]$SourceDatabaseUser = 'postgres.aqfllncygivcvsacbfpi',
  [Parameter(Mandatory = $true)] [string]$ArtifactDirectory
)

$ErrorActionPreference = 'Stop'

function Get-PgClient([string]$name) {
  $command = Get-Command "$name.exe" -ErrorAction SilentlyContinue
  if (-not $command) { $command = Get-Command $name -ErrorAction SilentlyContinue }
  if (-not $command) { throw "$name tidak tersedia pada PATH. Instal PostgreSQL client tools terlebih dahulu." }
  return $command.Source
}

function Invoke-PgClient([string]$executable, [string[]]$arguments, [string]$standardOutput, [string]$standardError) {
  $parameters = @{ FilePath = $executable; ArgumentList = $arguments; Wait = $true; PassThru = $true; NoNewWindow = $true }
  if ($standardOutput) { $parameters.RedirectStandardOutput = $standardOutput }
  if ($standardError) { $parameters.RedirectStandardError = $standardError }
  $process = Start-Process @parameters
  if ($process.ExitCode -ne 0) {
    $detail = if ($standardError -and (Test-Path -LiteralPath $standardError)) { Get-Content -LiteralPath $standardError -Raw } else { 'Tidak ada detail error dari PostgreSQL client.' }
    throw "PostgreSQL client gagal (exit $($process.ExitCode)): $detail"
  }
}

function ConvertTo-PsqlPath([string]$path) { return $path.Replace('\', '/') }

$pgDump = Get-PgClient 'pg_dump'
$psql = Get-PgClient 'psql'
if (Test-Path -LiteralPath $ArtifactDirectory) {
  if ((Get-ChildItem -LiteralPath $ArtifactDirectory -Force | Measure-Object).Count -gt 0) { throw 'ArtifactDirectory harus kosong agar export sebelumnya tidak tertimpa.' }
} else {
  New-Item -ItemType Directory -Path $ArtifactDirectory | Out-Null
}

$authDataPath = Join-Path $ArtifactDirectory 'auth-users.sql'
$publicDataPath = Join-Path $ArtifactDirectory 'public-data.sql'
$restoreSqlPath = Join-Path $ArtifactDirectory 'restore-data.sql'
$restoreOutputPath = Join-Path $ArtifactDirectory 'restore-data.out'
$restoreErrorPath = Join-Path $ArtifactDirectory 'restore-data.err'
$verificationSqlPath = Join-Path $ArtifactDirectory 'verification.sql'
$verificationOutputPath = Join-Path $ArtifactDirectory 'verification.out'
$verificationErrorPath = Join-Path $ArtifactDirectory 'verification.err'
$startedAt = Get-Date

# Kedua endpoint memakai Session pooler. Target harus proyek sementara yang sudah
# menerima migration yang sama dengan source. Jangan gunakan proyek PRODUCTION.
$source = [pscustomobject]@{ Host = $SourcePoolerHost; Port = '6543'; Database = 'postgres'; Username = $SourceDatabaseUser; Password = $SourceDatabasePassword }
$target = [pscustomobject]@{ Host = $TargetPoolerHost; Port = '6543'; Database = 'postgres'; Username = $TargetDatabaseUser; Password = $TargetDatabasePassword }
$previousPassword = $env:PGPASSWORD
$previousSslMode = $env:PGSSLMODE
$env:PGSSLMODE = 'require'

try {
  $env:PGPASSWORD = $source.Password
  Invoke-PgClient $pgDump @('--host', $source.Host, '--port', $source.Port, '--username', $source.Username, '--dbname', $source.Database, '--data-only', '--format=plain', '--no-owner', '--no-privileges', '--table=auth.users', '--file', $authDataPath) $null (Join-Path $ArtifactDirectory 'auth-users.dump.err')
  Invoke-PgClient $pgDump @('--host', $source.Host, '--port', $source.Port, '--username', $source.Username, '--dbname', $source.Database, '--data-only', '--format=plain', '--no-owner', '--no-privileges', '--schema=public', '--file', $publicDataPath) $null (Join-Path $ArtifactDirectory 'public-data.dump.err')

  # Mencegah trigger restore membuat notifikasi atau worker record baru. Exercise ini
  # hanya memulihkan data aplikasi dan auth.users, bukan Storage/session/identity/MFA.
  $authDataPsqlPath = ConvertTo-PsqlPath $authDataPath
  $publicDataPsqlPath = ConvertTo-PsqlPath $publicDataPath
  @(
    'BEGIN;'
    'SET session_replication_role = replica;'
    "\i '$authDataPsqlPath'"
    'DO $$ DECLARE row record; BEGIN FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = ''public'' LOOP EXECUTE format(''TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE'', row.tablename); END LOOP; END $$;'
    "\i '$publicDataPsqlPath'"
    'SET session_replication_role = origin;'
    'COMMIT;'
  ) | Set-Content -LiteralPath $restoreSqlPath

  $env:PGPASSWORD = $target.Password
  Invoke-PgClient $psql @('--host', $target.Host, '--port', $target.Port, '--username', $target.Username, '--dbname', $target.Database, '--set', 'ON_ERROR_STOP=1', '--file', $restoreSqlPath) $restoreOutputPath $restoreErrorPath

  $verificationQuery = "SELECT json_build_object('migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations),'auth_users',(SELECT count(*) FROM auth.users),'profiles',(SELECT count(*) FROM public.profiles),'products',(SELECT count(*) FROM public.products),'orders',(SELECT count(*) FROM public.orders),'organizations',(SELECT count(*) FROM public.organizations))::text;"
  Set-Content -LiteralPath $verificationSqlPath -Value $verificationQuery
  Invoke-PgClient $psql @('--host', $target.Host, '--port', $target.Port, '--username', $target.Username, '--dbname', $target.Database, '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '--file', $verificationSqlPath) $verificationOutputPath $verificationErrorPath

  $verification = (Get-Content -LiteralPath $verificationOutputPath | Where-Object { $_.Trim() } | Select-Object -Last 1).Trim()
  $elapsedSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
  [pscustomobject]@{
    success = $true
    elapsed_seconds = $elapsedSeconds
    auth_export_sha256 = (Get-FileHash -LiteralPath $authDataPath -Algorithm SHA256).Hash
    public_export_sha256 = (Get-FileHash -LiteralPath $publicDataPath -Algorithm SHA256).Hash
    restored_counts = $verification
  } | ConvertTo-Json -Compress
} finally {
  if ($null -eq $previousPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $previousPassword }
  if ($null -eq $previousSslMode) { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue } else { $env:PGSSLMODE = $previousSslMode }
}
