param([string]$JavaHome='D:\jdk\jdk17')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$jar=Join-Path $root '.local\tduck-m3-build\tduck-api\target\tduck-api.jar'
if(!(Test-Path -LiteralPath $jar)){throw 'M3 staging JAR is missing; build it first'}
if(Get-NetTCPConnection -State Listen -LocalPort 8996 -ErrorAction SilentlyContinue){throw '8996 is occupied. No process was stopped.'}
Write-Output 'Starting M3 staging on 8996. Keep this terminal running; logs stay in .local/tduck-dev/m3-staging.log. Existing 8997 is unchanged.'
Push-Location (Join-Path $root '.local\tduck-dev')
try{
 & (Join-Path $JavaHome 'bin\java.exe') -jar $jar '--spring.config.additional-location=file:./application-local.yml' '--server.address=127.0.0.1' '--server.port=8996' 1>m3-staging.log 2>m3-staging-error.log
 if($LASTEXITCODE -ne 0){throw 'M3 staging exited; inspect the private log.'}
}finally{Pop-Location}
