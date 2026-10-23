$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $ProjectRoot '.env'
if (!(Test-Path $envFile)) { throw 'Copy .env.example to .env and configure it first.' }
foreach ($line in Get-Content $envFile) {
    if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
    }
}
foreach ($key in @('DB_USER', 'DB_PASSWORD', 'APP_ADMIN_PASSWORD')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($key))) { throw "Missing $key in .env" }
}
