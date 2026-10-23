param([string]$JavaHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
if ($JavaHome) { $env:JAVA_HOME=$JavaHome; $env:Path="$JavaHome\bin;$env:Path" }
. "$PSScriptRoot\Load-Env.ps1"
if (Get-NetTCPConnection -State Listen -LocalPort $env:SERVER_PORT -ErrorAction SilentlyContinue) { throw 'Stop the running backend before Verify-M0 (port already occupied).' }
$local = Join-Path $ProjectRoot '.local'
New-Item -ItemType Directory -Force $local | Out-Null
Push-Location (Join-Path $ProjectRoot 'backend')
try {
    & .\mvnw.cmd -B -ntp package '-DskipTests' *> "$local\package.log"
    if ($LASTEXITCODE -ne 0) { throw "Packaging failed: $local/package.log" }
} finally { Pop-Location }
$jar = Join-Path $ProjectRoot 'backend\target\zhiyan-ai-0.0.1-SNAPSHOT.jar'
$base = "http://127.0.0.1:$env:SERVER_PORT"
function Start-App([string]$tag) {
    $java = (Get-Command java.exe).Source
    return Start-Process -FilePath $java -ArgumentList @('-jar', ('"'+$jar+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput "$local\$tag.out.log" -RedirectStandardError "$local\$tag.err.log"
}
function Wait-Healthy($proc) {
    for ($i=0; $i -lt 60; $i++) {
        if ($proc.HasExited) { throw 'Backend exited before ready; inspect .local logs.' }
        try {
            $health=Invoke-RestMethod "$base/actuator/health" -TimeoutSec 2
            if ($health.status -eq 'UP') { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw 'Backend health timeout; inspect .local logs.'
}
function Connect-App {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $csrf = Invoke-RestMethod "$base/api/auth/csrf" -WebSession $session
    $headers = @{}; $headers[$csrf.headerName] = $csrf.token
    $null = Invoke-WebRequest "$base/api/auth/login" -Method Post -WebSession $session -Headers $headers -Body @{username=$env:APP_ADMIN_USER;password=$env:APP_ADMIN_PASSWORD} -ContentType 'application/x-www-form-urlencoded' -UseBasicParsing
    return $session
}
$process = $null
$savedPort = $env:DB_PORT
try {
    $process = Start-App 'smoke-first'
    Wait-Healthy $process
    $session = Connect-App
    $csrf = Invoke-RestMethod "$base/api/auth/csrf" -WebSession $session
    $headers = @{}; $headers[$csrf.headerName] = $csrf.token
    $text = 'M0 restart persistence ' + [Guid]::NewGuid().ToString('N')
    $row = Invoke-RestMethod "$base/api/system-checks" -Method Post -WebSession $session -Headers $headers -Body (@{message=$text}|ConvertTo-Json) -ContentType 'application/json; charset=utf-8'
    Stop-Process -Id $process.Id
    $process.WaitForExit()
    $process = Start-App 'smoke-restart'
    Wait-Healthy $process
    $session = Connect-App
    $rows = Invoke-RestMethod "$base/api/system-checks" -WebSession $session
    $found = @($rows | Where-Object { $_.id -eq $row.id -and $_.message -eq $text })
    if ($found.Count -ne 1) { throw 'Persistence check failed after actual Java restart.' }
    $summary = Invoke-RestMethod "$base/api/system-checks/summary" -WebSession $session
    Stop-Process -Id $process.Id
    $process.WaitForExit()
    $env:DB_PORT='1'
    $process = Start-App 'smoke-invalid-db'
    if (!$process.WaitForExit(30000)) { throw 'Invalid DB configuration did not fail startup within 30 seconds.' }
    if ($process.ExitCode -eq 0) { throw 'Invalid DB configuration unexpectedly exited successfully.' }
    $failureLog = Get-Content "$local\smoke-invalid-db.out.log" -Raw
    if ($failureLog -notmatch 'Communications link failure|Unable to obtain connection|Connection refused') { throw 'Missing clear database error diagnostic.' }
    $result = [ordered]@{ health='PASS'; httpWriteRead='PASS'; actualBackendRestartPersistence='PASS'; invalidDbStartupRejected='PASS'; recordId=$row.id; totalCount=$summary.count; invalidDbExitCode=$process.ExitCode }
    $result | ConvertTo-Json | Set-Content (Join-Path $ProjectRoot 'evidence\m0-smoke.json') -Encoding UTF8
    $result | ConvertTo-Json
} finally {
    $env:DB_PORT=$savedPort
    if ($process -and !$process.HasExited) { Stop-Process -Id $process.Id; $process.WaitForExit() }
}
