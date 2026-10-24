param([switch]$Restore, [string]$MysqlBin='D:\MySQL\MySQL Server 8.0\bin')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$dev=Join-Path $root '.local\tduck-dev'
$manifest=Get-Content (Join-Path $dev 'manifest.json') -Raw | ConvertFrom-Json
if($manifest.database -ne 'tduck_vue3_dev' -or $manifest.backend -ne 'http://127.0.0.1:8997'){throw 'Admin acceptance is restricted to the isolated database.'}
$config=Get-Content (Join-Path $dev 'application-local.yml') -Raw
function Read-Value([string]$Name){return ([regex]::Match($config,'(?m)^    '+$Name+": '(.*?)'\s*$").Groups[1].Value).Replace("''", "'")}
$port=[regex]::Match($config,':([0-9]+)/tduck_vue3_').Groups[1].Value
if(!$port){$port='3306'}
$backup=Join-Path $dev 'admin-acceptance-backup.sql'
$prior=$env:MYSQL_PWD
try{
 $env:MYSQL_PWD=Read-Value 'password'
 $mysqlArgs=@('--host=127.0.0.1',"--port=$port",('--user='+(Read-Value 'username')),'--default-character-set=utf8mb4',$manifest.database)
 if($Restore){
  if(!(Test-Path -LiteralPath $backup)){throw 'Admin backup missing'}
  & (Join-Path $MysqlBin 'mysql.exe') @mysqlArgs ('--execute=source '+$backup.Replace('\','/'))
  if($LASTEXITCODE -ne 0){throw 'Restore failed'}
  Write-Output 'Restored the isolated administrator profile. Original database was not touched.'
 }else{
  if(Test-Path -LiteralPath $backup){
   & (Join-Path $MysqlBin 'mysql.exe') @mysqlArgs ('--execute=source '+$backup.Replace('\','/'))
   if($LASTEXITCODE -ne 0){throw 'Baseline restore failed'}
  }else{
  & (Join-Path $MysqlBin 'mysqldump.exe') --host=127.0.0.1 "--port=$port" ('--user='+(Read-Value 'username')) --default-character-set=utf8mb4 --no-create-info --complete-insert --replace --skip-comments --skip-add-locks '--where=id=1' ("--result-file=$backup") $manifest.database ac_user
  if($LASTEXITCODE -ne 0){throw 'Backup failed'}
  }
  $f=Get-Content (Join-Path $dev 'acceptance.json') -Raw | ConvertFrom-Json
  if($f.password -notmatch '^[A-Za-z0-9-]+$'){throw 'Invalid test password format'}
  $admin='vue3-admin-acceptance@example.test'
  $sql="UPDATE ac_user SET email='$admin', name='Vue3 Test Administrator', avatar='', password=SHA2('$($f.password)',256), password_type=0, need_change_password=0 WHERE id=1;"
  $sqlPath=Join-Path $dev 'admin-acceptance-fixture.sql'
  [IO.File]::WriteAllText($sqlPath,$sql,[Text.UTF8Encoding]::new($false))
  & (Join-Path $MysqlBin 'mysql.exe') @mysqlArgs ('--execute=source '+$sqlPath.Replace('\','/'))
  if($LASTEXITCODE -ne 0){throw 'Fixture failed'}
  @{account=$admin;password=$f.password;backend=$manifest.backend} | ConvertTo-Json | Set-Content (Join-Path $dev 'admin-acceptance.json') -Encoding utf8
  Write-Output 'Created a temporary administrator fixture only in tduck_vue3_dev; backup saved privately.'
 }
}finally{$env:MYSQL_PWD=$prior}
