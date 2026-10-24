param([string]$JavaHome = 'D:\jdk\jdk17')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$devRoot = Join-Path $projectRoot '.local\tduck-dev'
if (!(Test-Path (Join-Path $devRoot 'application-local.yml'))) { throw 'Run Backup-TDuck.ps1 and Initialize-Dev.ps1 first.' }
if (Get-NetTCPConnection -State Listen -LocalPort 8998 -ErrorAction SilentlyContinue) { throw 'Port 8998 is already occupied; no process was stopped.' }
$java = Join-Path $JavaHome 'bin\java.exe'
Push-Location $devRoot
try {
    & $java -jar tduck-api.jar '--spring.config.additional-location=file:./application-local.yml'
    if ($LASTEXITCODE -ne 0) { throw 'TDuck development backend stopped with an error.' }
} finally { Pop-Location }
