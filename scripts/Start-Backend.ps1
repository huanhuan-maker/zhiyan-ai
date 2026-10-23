param([string]$JavaHome = $env:JAVA_HOME, [switch]$Test)
$ErrorActionPreference = 'Stop'
if ($JavaHome) { $env:JAVA_HOME = $JavaHome; $env:Path = "$JavaHome\bin;$env:Path" }
if (!(Get-Command java.exe -ErrorAction SilentlyContinue)) { throw 'Install JDK 17+ and set JAVA_HOME, or pass -JavaHome.' }
. "$PSScriptRoot\Load-Env.ps1"
Push-Location (Join-Path $ProjectRoot 'backend')
try {
    if ($Test) { & .\mvnw.cmd clean test } else { & .\mvnw.cmd spring-boot:run }
    if ($LASTEXITCODE -ne 0) { throw "Maven failed: $LASTEXITCODE" }
} finally { Pop-Location }
