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
 $sql=Join-Path $root 'db\tduck\002_public_submission.sql'
 & (Join-Path $MysqlBin 'mysql.exe') --host=127.0.0.1 "--port=$port" ('--user='+(Read-Value 'username')) --default-character-set=utf8mb4 $manifest.database ('--execute=source '+$sql.Replace('\','/'))
 if($LASTEXITCODE -ne 0){throw 'Closure migration failed'}
 Write-Output 'Added persistent public submission receipts; existing questionnaire and answer tables unchanged.'
}finally{$env:MYSQL_PWD=$prior}
