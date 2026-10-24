param([string]$JavaHome='D:\jdk\jdk17', [switch]$Background, [ValidateRange(1,300)][int]$StartupTimeoutSeconds=120)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$dev=Join-Path $root '.local\tduck-dev'
$manifest=Get-Content (Join-Path $dev 'manifest.json') -Raw | ConvertFrom-Json
if($manifest.database -ne 'tduck_vue3_dev'){throw 'Only the isolated acceptance database is allowed'}
$jar=Join-Path $root '.local\tduck-closure-build\tduck-api\target\tduck-api.jar'
if(!(Test-Path -LiteralPath $jar)){throw 'Run Build-FullBackend.ps1 first'}
if(Get-NetTCPConnection -State Listen -LocalPort 8997 -ErrorAction SilentlyContinue){throw '8997 is occupied. No process was stopped.'}
$java=Join-Path $JavaHome 'bin\java.exe'
$argsFull=@('-jar',$jar,'--spring.config.additional-location=file:./application-local.yml','--server.address=127.0.0.1','--server.port=8997')
$manifest.backend='http://127.0.0.1:8997'
$manifest | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $dev 'manifest.json') -Encoding utf8
$fixturePath=Join-Path $dev 'acceptance.json'
if(Test-Path -LiteralPath $fixturePath){$fixture=Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json;$fixture.backend=$manifest.backend;$fixture|ConvertTo-Json -Depth 15|Set-Content -LiteralPath $fixturePath -Encoding utf8}
if($Background){
 $p=Start-Process -FilePath $java -ArgumentList $argsFull -WorkingDirectory $dev -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dev 'server-full.log') -RedirectStandardError (Join-Path $dev 'server-full.stderr.log') -PassThru
 $deadline=[DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds)
 $ready=$false
 do{
  $p.Refresh()
  if($p.HasExited){throw 'Isolated backend exited during startup; inspect the private server logs.'}
  try{
   $probe=Invoke-RestMethod -Uri 'http://127.0.0.1:8997/public/systemInfoConfig' -TimeoutSec 3
   if($probe.code -eq 200 -and $probe.data){$null=$probe.data | ConvertFrom-Json;$ready=$true;break}
  }catch{ }
  Start-Sleep -Milliseconds 500
 }while([DateTime]::UtcNow -lt $deadline)
 if(!$ready){throw "Backend PID $($p.Id) started but readiness timed out; it was not stopped. Inspect the private server logs before testing."}
 Write-Output "Started isolated patched backend PID $($p.Id) on 8997; public system configuration is ready."
}else{
 Push-Location $dev
 try{& $java @argsFull;if($LASTEXITCODE -ne 0){throw 'Backend exited with an error'}}finally{Pop-Location}
}
