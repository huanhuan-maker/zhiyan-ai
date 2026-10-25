param([string]$MysqlBin='D:\MySQL\MySQL Server 8.0\bin')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$dev=Join-Path $root '.local\tduck-dev'
$manifest=Get-Content (Join-Path $dev 'manifest.json') -Raw | ConvertFrom-Json
if($manifest.database -ne 'tduck_vue3_dev'){throw 'Only the isolated development database is allowed'}
$config=Get-Content (Join-Path $dev 'application-local.yml') -Raw
function Read-Setting([string]$Name){return ([regex]::Match($config,'(?m)^    '+$Name+": '(.*?)'\s*$").Groups[1].Value).Replace("''", "'")}
$port=[regex]::Match($config,':([0-9]+)/tduck_vue3_dev').Groups[1].Value
if(!$port){$port='3306'}
$priorPassword=$env:MYSQL_PWD
try{
 $env:MYSQL_PWD=Read-Setting 'password'
 $mysql=Join-Path $MysqlBin 'mysql.exe'
 $mysqlArgs=@('--host=127.0.0.1',"--port=$port",('--user='+(Read-Setting 'username')),'--default-character-set=utf8mb4',$manifest.database)
 $sql=(Join-Path $root 'db\tduck\006_analysis_report.sql').Replace('\','/')
 & $mysql @mysqlArgs ('--execute=source '+$sql)
 if($LASTEXITCODE -ne 0){throw 'Analysis migration failed'}
 $tables=& $mysql @mysqlArgs '-N' '-B' "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='tduck_vue3_dev' AND table_name IN ('fm_analysis_report','fm_analysis_review')"
 if($LASTEXITCODE -ne 0 -or [int]$tables -ne 2){throw 'Analysis tables missing'}
 Write-Output 'M4-R analysis tables ready (2). Repeatable migration; existing answers unchanged.'
}finally{$env:MYSQL_PWD=$priorPassword}
