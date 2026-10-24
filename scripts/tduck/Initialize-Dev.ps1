param(
    [string]$MysqlBin = 'D:\MySQL\MySQL Server 8.0\bin',
    [string]$Database = 'tduck_vue3_dev'
)
$ErrorActionPreference = 'Stop'
if ($Database -notmatch '^tduck_vue3_[a-z0-9_]+$') { throw 'Only an isolated tduck_vue3_* database is allowed.' }
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$backup = (Get-Content (Join-Path $projectRoot '.local\tduck-backup-latest.txt') -Raw).Trim()
$config = Get-Content (Join-Path $backup 'backend\tduck-api\target\classes\application-prod.yml') -Raw
$dbBlock = [regex]::Match($config, '(?ms)^  datasource:\s*\r?\n(.*?)(?=^  \S|\z)').Groups[1].Value
function Read-Setting([string]$Name) {
    return ([regex]::Match($dbBlock, '(?m)^\s+' + $Name + ':\s*(.*?)\s*$').Groups[1].Value).Trim().Trim('"').Trim("'")
}
$dbUrl = Read-Setting 'url'
$dbMatch = [regex]::Match($dbUrl, '^jdbc:mysql://([^:/]+)(?::(\d+))?/([A-Za-z0-9_]+)')
if (!$dbMatch.Success -or $dbMatch.Groups[1].Value -notin @('localhost', '127.0.0.1')) { throw 'Only the local MySQL clone is supported.' }
$dbPort = if ($dbMatch.Groups[2].Success) { $dbMatch.Groups[2].Value } else { '3306' }
$mysqlArgs = @('--host=127.0.0.1', "--port=$dbPort", ("--user=" + (Read-Setting 'username')), '--default-character-set=utf8mb4', '--batch', '--skip-column-names')
$priorPassword = $env:MYSQL_PWD
try {
    $env:MYSQL_PWD = Read-Setting 'password'
    $exists = & (Join-Path $MysqlBin 'mysql.exe') @mysqlArgs "--execute=SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$Database'"
    if ($LASTEXITCODE -ne 0 -or $exists -ne '0') { throw 'Database exists or connection failed; refusing to overwrite.' }
    & (Join-Path $MysqlBin 'mysql.exe') @mysqlArgs "--execute=CREATE DATABASE $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    if ($LASTEXITCODE -ne 0) { throw 'Create isolated database failed.' }
    $dumpPath = (Join-Path $backup 'database.sql').Replace('\', '/')
    & (Join-Path $MysqlBin 'mysql.exe') @mysqlArgs $Database "--execute=source $dumpPath"
    if ($LASTEXITCODE -ne 0) { throw 'Restore failed; original database was not changed.' }
    $tableCount = & (Join-Path $MysqlBin 'mysql.exe') @mysqlArgs "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database'"
    if ($LASTEXITCODE -ne 0 -or [int]$tableCount -lt 10) { throw 'Restored schema incomplete.' }
} finally { $env:MYSQL_PWD = $priorPassword }
$devRoot = Join-Path $projectRoot '.local\tduck-dev'
New-Item -ItemType Directory -Path $devRoot -Force | Out-Null
function Yaml-String([string]$Value) { return "'" + $Value.Replace("'", "''") + "'" }
$cloneUrl = [regex]::Replace($dbUrl, '(?<=/)[A-Za-z0-9_]+(?=\?)', $Database)
$jwtBytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($jwtBytes) } finally { $rng.Dispose() }
$jwtSecret = [Convert]::ToBase64String($jwtBytes)
$yaml = @"
server:
  address: 127.0.0.1
  port: 8998
spring:
  datasource:
    url: $(Yaml-String $cloneUrl)
    username: $(Yaml-String (Read-Setting 'username'))
    password: $(Yaml-String (Read-Setting 'password'))
  mail:
    host: 127.0.0.1
    port: 1
platform:
  jwt:
    secret: $(Yaml-String $jwtSecret)
  request:
    trace-log: false
logging:
  level:
    com.tduck.cloud: warn
"@
[IO.File]::WriteAllText((Join-Path $devRoot 'application-local.yml'), $yaml, [Text.UTF8Encoding]::new($false))
Copy-Item (Join-Path $backup 'backend\tduck-api\target\tduck-api.jar') (Join-Path $devRoot 'tduck-api.jar')
@{ database = $Database; backup = $backup; tableCount = [int]$tableCount; backend = 'http://127.0.0.1:8998'; initializedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content (Join-Path $devRoot 'manifest.json') -Encoding UTF8
Write-Output "Restored $tableCount tables into $Database; backend config stored privately in .local\tduck-dev."
