param([string]$MysqlBin='D:\MySQL\MySQL Server 8.0\bin')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$dev=Join-Path $root '.local\tduck-dev'
$manifest=Get-Content (Join-Path $dev 'manifest.json') -Raw | ConvertFrom-Json
if($manifest.database -ne 'tduck_vue3_dev'){throw 'Only the isolated migration database is allowed'}
$config=Get-Content (Join-Path $dev 'application-local.yml') -Raw
function Read-Value([string]$Name){return ([regex]::Match($config,'(?m)^    '+$Name+": '(.*?)'\s*$").Groups[1].Value).Replace("''", "'")}
$port=[regex]::Match($config,':([0-9]+)/tduck_vue3_dev').Groups[1].Value
if(!$port){$port='3306'}
$prior=$env:MYSQL_PWD
try{
 $env:MYSQL_PWD=Read-Value 'password'
 $mysql=Join-Path $MysqlBin 'mysql.exe'
 $mysqlArgs=@('--host=127.0.0.1',"--port=$port",('--user='+(Read-Value 'username')),'--default-character-set=utf8mb4',$manifest.database)
 $sql=(Join-Path $root 'db\tduck\005_followup.sql').Replace('\','/')
 & $mysql @mysqlArgs ('--execute=source '+$sql)
 if($LASTEXITCODE -ne 0){throw 'Follow-up migration failed'}
 $tables=& $mysql @mysqlArgs '-N' '-B' "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='tduck_vue3_dev' AND table_name IN ('fm_followup_policy','fm_followup_session','fm_followup_core_answer','fm_followup_decision','fm_followup_event')"
 if($LASTEXITCODE -ne 0 -or [int]$tables -ne 5){throw 'Follow-up tables missing'}
 Write-Output 'M3 follow-up tables ready (5); migration is repeatable, no existing answer rows changed.'
}finally{$env:MYSQL_PWD=$prior}
