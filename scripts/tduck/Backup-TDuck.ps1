param(
    [string]$BackendRoot = 'D:\tduck-survey-form-master',
    [string]$LegacyFrontendRoot = 'D:\tduck-front',
    [string]$MysqlBin = 'D:\MySQL\MySQL Server 8.0\bin'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$destination = Join-Path $projectRoot ('.local\tduck-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $destination -Force | Out-Null
foreach ($entry in @(@($BackendRoot, 'backend'), @($LegacyFrontendRoot, 'vue2'))) {
    & robocopy.exe $entry[0] (Join-Path $destination $entry[1]) /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP *> (Join-Path $destination ($entry[1] + '-copy.log'))
    if ($LASTEXITCODE -ge 8) { throw "Backup copy failed: $($entry[1])" }
}
# Read only the datasource block; never print credentials or put them on a command line.
$configPath = Join-Path $BackendRoot 'tduck-api\target\classes\application-prod.yml'
$config = Get-Content -LiteralPath $configPath -Raw
$dbBlock = [regex]::Match($config, '(?ms)^  datasource:\s*\r?\n(.*?)(?=^  \S|\z)').Groups[1].Value
function Read-Setting([string]$Name) {
    $value = [regex]::Match($dbBlock, '(?m)^\s+' + $Name + ':\s*(.*?)\s*$').Groups[1].Value
    return $value.Trim().Trim('"').Trim("'")
}
$dbUrl = Read-Setting 'url'
$dbMatch = [regex]::Match($dbUrl, '^jdbc:mysql://([^:/]+)(?::(\d+))?/([A-Za-z0-9_]+)')
if (!$dbMatch.Success) { throw 'Unsupported datasource URL; no backup attempted.' }
$dbHost = $dbMatch.Groups[1].Value
$dbPort = if ($dbMatch.Groups[2].Success) { $dbMatch.Groups[2].Value } else { '3306' }
$dbName = $dbMatch.Groups[3].Value
$priorPassword = $env:MYSQL_PWD
try {
    $env:MYSQL_PWD = Read-Setting 'password'
    & (Join-Path $MysqlBin 'mysqldump.exe') "--host=$dbHost" "--port=$dbPort" ("--user=" + (Read-Setting 'username')) --single-transaction --routines --triggers --events --hex-blob --set-gtid-purged=OFF --default-character-set=utf8mb4 "--result-file=$destination\database.sql" $dbName 2> (Join-Path $destination 'dump.stderr.log')
    if ($LASTEXITCODE -ne 0) { throw 'Database dump failed; inspect private dump.stderr.log.' }
} finally { $env:MYSQL_PWD = $priorPassword }
if ((Get-Item (Join-Path $destination 'database.sql')).Length -lt 100) { throw 'Database dump is empty.' }
& git -C $projectRoot bundle create (Join-Path $destination 'zhiyan-history.bundle') --all
if ($LASTEXITCODE -ne 0) { throw 'Git history backup failed.' }
$manifest = [ordered]@{
    createdAt = (Get-Date -Format o); sourceBackend = $BackendRoot; sourceVue2 = $LegacyFrontendRoot
    database = $dbName; databaseSha256 = (Get-FileHash (Join-Path $destination 'database.sql')).Hash
    deployedJarSha256 = (Get-FileHash (Join-Path $BackendRoot 'tduck-api\target\tduck-api.jar')).Hash
    backendFiles = @(Get-ChildItem (Join-Path $destination 'backend') -File -Recurse -Force).Count
    vue2Files = @(Get-ChildItem (Join-Path $destination 'vue2') -File -Recurse -Force).Count
    legacyHead = (& git -C $LegacyFrontendRoot rev-parse HEAD)
}
$manifest | ConvertTo-Json | Set-Content (Join-Path $destination 'manifest.json') -Encoding UTF8
$destination | Set-Content (Join-Path $projectRoot '.local\tduck-backup-latest.txt') -Encoding UTF8
Write-Output "Backup complete: $destination"
$manifest | ConvertTo-Json
