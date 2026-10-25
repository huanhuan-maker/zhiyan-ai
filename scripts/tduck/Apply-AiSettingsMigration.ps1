param([string]$MysqlBin='D:\MySQL\MySQL Server 8.0\bin')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$dev=Join-Path $root '.local\tduck-dev'
$manifest=Get-Content (Join-Path $dev 'manifest.json') -Raw | ConvertFrom-Json
if($manifest.database -ne 'tduck_vue3_dev'){throw 'Only the isolated development database is allowed'}
# Preserve this key with private backups; never rotate or overwrite automatically.
$keyFile=Join-Path $dev 'ai-config.key'
if(!(Test-Path -LiteralPath $keyFile)){
 $bytes=New-Object byte[] 32
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
 [IO.File]::WriteAllText($keyFile,[Convert]::ToBase64String($bytes),(New-Object Text.UTF8Encoding($false)))
}
$keyBytes=[Convert]::FromBase64String([IO.File]::ReadAllText($keyFile).Trim())
if($keyBytes.Length -ne 32){throw 'Invalid existing ai-config.key; restore it rather than overwrite'}
$config=Get-Content (Join-Path $dev 'application-local.yml') -Raw
function Read-Setting([string]$Name){return ([regex]::Match($config,'(?m)^    '+$Name+": '(.*?)'\s*$").Groups[1].Value).Replace("''", "'")}
$port=[regex]::Match($config,':([0-9]+)/tduck_vue3_dev').Groups[1].Value
if(!$port){$port='3306'}
$priorPassword=$env:MYSQL_PWD
try{
 $env:MYSQL_PWD=Read-Setting 'password'
 $mysql=Join-Path $MysqlBin 'mysql.exe'
 $mysqlArgs=@('--host=127.0.0.1',"--port=$port",('--user='+(Read-Setting 'username')),'--default-character-set=utf8mb4',$manifest.database)
 $sql=(Join-Path $root 'db\tduck\008_ai_settings.sql').Replace('\','/')
 & $mysql @mysqlArgs ('--execute=source '+$sql)
 if($LASTEXITCODE -ne 0){throw 'AI settings migration failed'}
 $tables=& $mysql @mysqlArgs '-N' '-B' "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='tduck_vue3_dev' AND table_name='fm_ai_settings'"
 if($LASTEXITCODE -ne 0 -or [int]$tables -ne 1){throw 'AI settings table missing'}
 Write-Output 'AI settings table ready (1); private encryption key preserved. Existing questionnaires unchanged.'
}finally{$env:MYSQL_PWD=$priorPassword}
