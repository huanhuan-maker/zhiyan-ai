param([ValidatePattern('^[a-z0-9-]+$')][string]$BuildName='tduck-analysis-build')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
New-Item -ItemType Directory -Path (Join-Path $root '.local\tduck-ui-review') -Force | Out-Null
$source=Join-Path $root ".local\$BuildName\tduck-api\target\tduck-api.jar"
$destination=Join-Path $root '.local\tduck-closure-build\tduck-api\target\tduck-api.jar'
if(!(Test-Path -LiteralPath $source)){throw 'Build the analysis backend before installation'}
if([IO.Path]::GetFullPath($source) -eq [IO.Path]::GetFullPath($destination)){throw 'Use an independent build directory'}
$processes=@(Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { $_.CommandLine -like "*$destination*" -and $_.CommandLine -like '*--server.port=8997*' })
if($processes.Count -gt 1){throw 'Unexpected multiple managed backend processes'}
$listener=Get-NetTCPConnection -State Listen -LocalPort 8997 -ErrorAction SilentlyContinue
if($listener -and (!$processes.Count -or $listener.OwningProcess -notin $processes.ProcessId)){throw '8997 belongs to another process; nothing was stopped'}
$backup=Join-Path $root ('.local\tduck-ui-review\backend-before-analysis-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.jar')
if(Test-Path -LiteralPath $destination){Copy-Item -LiteralPath $destination -Destination $backup}
foreach($backendProcess in $processes){Stop-Process -Id $backendProcess.ProcessId -ErrorAction Stop}
Copy-Item -LiteralPath $source -Destination $destination -Force
& (Join-Path $PSScriptRoot 'Start-FullBackend.ps1') -Background -StartupTimeoutSeconds 45
if((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $destination).Hash){throw 'Installed backend hash mismatch'}
Write-Output 'Analysis backend installed on the existing isolated 8997 entry; previous JAR backed up privately.'
