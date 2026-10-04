$restoreConfig = Get-Content (Join-Path $PSScriptRoot '..\apps\web\.env.restore-test') |
  Where-Object { $_ -match '^[A-Z_]+=' } |
  ForEach-Object {
    $index = $_.IndexOf('=')
    @{ Key = $_.Substring(0, $index); Value = $_.Substring($index + 1) }
  }

$values = @{}
foreach ($entry in $restoreConfig) { $values[$entry.Key] = $entry.Value }

& (Join-Path $PSScriptRoot 'restore-staging-test.ps1') `
  -SourceDatabasePassword $values['RESTORE_SOURCE_DATABASE_PASSWORD'] `
  -TargetDatabasePassword $values['RESTORE_TARGET_DATABASE_PASSWORD'] `
  -ArtifactDirectory (Join-Path $env:TEMP 'winajaya-staging-restore-20261004')
