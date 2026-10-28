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
 $sql=(Join-Path $root 'db\tduck\007_assistant.sql').Replace('\','/')
 & $mysql @mysqlArgs ('--execute=source '+$sql)
 if($LASTEXITCODE -ne 0){throw 'Assistant migration failed'}
 $actionsSql=(Join-Path $root 'db\tduck\009_assistant_actions.sql').Replace('\','/')
 & $mysql @mysqlArgs ('--execute=source '+$actionsSql)
 if($LASTEXITCODE -ne 0){throw 'Assistant action audit migration failed'}
 $draftSql=(Join-Path $root 'db\tduck\010_ai_draft_workspace.sql').Replace('\','/')
 & $mysql @mysqlArgs ('--execute=source '+$draftSql)
 if($LASTEXITCODE -ne 0){throw 'AI draft workspace migration failed'}
 $slotsSql=(Join-Path $root 'db\tduck\011_ai_draft_slots.sql').Replace('\','/')
 & $mysql @mysqlArgs ('--execute=source '+$slotsSql)
 if($LASTEXITCODE -ne 0){throw 'AI draft slots migration failed'}
 $knowledgeSql=(Join-Path $root 'db\tduck\012_survey_knowledge.sql').Replace('\','/')
 & $mysql @mysqlArgs ('--execute=source '+$knowledgeSql)
 if($LASTEXITCODE -ne 0){throw 'Survey knowledge migration failed'}
 $tables=& $mysql @mysqlArgs '-N' '-B' "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='tduck_vue3_dev' AND table_name IN ('fm_assistant_conversation','fm_assistant_turn','fm_assistant_action','fm_ai_draft_workspace','fm_ai_draft_slot','fm_ai_draft_slot_lock','fm_ai_draft_migration_marker','fm_survey_knowledge')"
 if($LASTEXITCODE -ne 0 -or [int]$tables -ne 8){throw 'Assistant or draft tables missing'}
 Write-Output 'Assistant history, audit, AI draft and knowledge tables ready (8). Existing surveys and answers unchanged.'
}finally{$env:MYSQL_PWD=$priorPassword}
