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
 # ALTER 不幂等：version_no 列已存在时剔除该行，其余语句均可重复执行
 $columnExists=& $mysql @mysqlArgs '-N' '-B' '--execute=SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=''tduck_vue3_dev'' AND table_name=''fm_user_form_data'' AND column_name=''version_no'''
 if($LASTEXITCODE -ne 0){throw 'Column check failed'}
 $sqlPath=Join-Path $root 'db\tduck\003_form_versions.sql'
 $lines=Get-Content -LiteralPath $sqlPath -Encoding UTF8
 if([int]$columnExists -gt 0){
  $lines=$lines | Where-Object {$_ -notmatch '^ALTER TABLE fm_user_form_data'}
 }
 $tempSql=Join-Path $dev '003_form_versions.applied.sql'
 [System.IO.File]::WriteAllLines($tempSql,$lines,(New-Object System.Text.UTF8Encoding($false)))
 & $mysql @mysqlArgs ('--execute=source '+$tempSql.Replace('\','/'))
 if($LASTEXITCODE -ne 0){throw 'Version migration failed'}
 $versions=& $mysql @mysqlArgs '-N' '-B' '--execute=SELECT COUNT(*) FROM fm_user_form_version'
 $bound=& $mysql @mysqlArgs '-N' '-B' '--execute=SELECT COUNT(*) FROM fm_user_form_data WHERE version_no IS NOT NULL'
 Write-Output "Version snapshots ready: $versions version rows, $bound bound answers. Existing answer contents unchanged."
}finally{$env:MYSQL_PWD=$prior}
