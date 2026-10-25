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
 function Test-Column([string]$Table,[string]$Column){
  $count=(& $mysql @mysqlArgs '-N' '-B' "--execute=SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='tduck_vue3_dev' AND table_name='$Table' AND column_name='$Column'") | Select-Object -First 1
  if($LASTEXITCODE -ne 0){throw "Column check failed: $Table.$Column"}
  return ([int]$count) -gt 0
 }
 # ALTER 不幂等：已存在的列/主键对应语句会被剔除，UPDATE 均带空值条件可重复执行
 $lines=Get-Content -LiteralPath (Join-Path $root 'db\tduck\004_version_fixes.sql') -Encoding UTF8
 if(Test-Column 'fm_user_form_version' 'form_snapshot'){$lines=$lines | Where-Object {$_ -notmatch '^ALTER TABLE fm_user_form_version ADD COLUMN form_snapshot'}}
 if(Test-Column 'fm_user_form_version' 'logic_snapshot'){$lines=$lines | Where-Object {$_ -notmatch '^ALTER TABLE fm_user_form_version ADD COLUMN logic_snapshot'}}
 if(Test-Column 'fm_user_form_version' 'theme_snapshot'){$lines=$lines | Where-Object {$_ -notmatch '^ALTER TABLE fm_user_form_version ADD COLUMN theme_snapshot'}}
 if(Test-Column 'fm_public_submission' 'version_no'){
  $lines=$lines | Where-Object {$_ -notmatch '^ALTER TABLE fm_public_submission ADD COLUMN'}
  $pkHasVersion=[int](& $mysql @mysqlArgs '-N' '-B' "--execute=SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='tduck_vue3_dev' AND table_name='fm_public_submission' AND column_name='version_no'") -gt 0
  if($pkHasVersion){$lines=$lines | Where-Object {$_ -notmatch '^ALTER TABLE fm_public_submission DROP PRIMARY KEY'}}
 }
 $tempSql=Join-Path $dev '004_version_fixes.applied.sql'
 [System.IO.File]::WriteAllLines($tempSql,$lines,(New-Object System.Text.UTF8Encoding($false)))
 & $mysql @mysqlArgs ('--execute=source '+$tempSql.Replace('\','/'))
 if($LASTEXITCODE -ne 0){throw 'Fix migration failed'}
 $snapped=& $mysql @mysqlArgs '-N' '-B' '--execute=SELECT CONCAT(COUNT(*),'','',SUM(form_snapshot IS NOT NULL),'','',SUM(logic_snapshot IS NOT NULL),'','',SUM(theme_snapshot IS NOT NULL)) FROM fm_user_form_version'
 $receipts=& $mysql @mysqlArgs '-N' '-B' '--execute=SELECT CONCAT(COUNT(*),'','',SUM(version_no>0)) FROM fm_public_submission'
 Write-Output "Version snapshots completed: (versions,form,logic,theme)=$snapped; receipts: (total,version_bound)=$receipts"
}finally{$env:MYSQL_PWD=$prior}
