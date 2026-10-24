param([string]$MysqlBin = 'D:\MySQL\MySQL Server 8.0\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$backup = (Get-Content (Join-Path $projectRoot '.local\tduck-backup-latest.txt') -Raw).Trim()
$manifest = Get-Content (Join-Path $backup 'manifest.json') -Raw | ConvertFrom-Json
$differences = @()
$checked = 0
foreach($pair in @(@($manifest.sourceBackend, 'backend'), @($manifest.sourceVue2, 'vue2'))) {
    $source = $pair[0]
    $snapshot = Join-Path $backup $pair[1]
    $sourceFiles = Get-ChildItem $source -Recurse -File -Force | Where-Object { $_.FullName.Substring($source.Length) -notmatch '\\(node_modules|target|logs|\.git)\\|\.log$' }
    foreach($file in $sourceFiles) {
        $relative = $file.FullName.Substring($source.Length).TrimStart('\')
        $copy = Join-Path $snapshot $relative
        $checked++
        if (!(Test-Path -LiteralPath $copy) -or (Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $copy).Hash) { $differences += ($pair[1] + '/' + $relative) }
    }
}
$config = Get-Content (Join-Path $backup 'backend\tduck-api\target\classes\application-prod.yml') -Raw
$dbBlock = [regex]::Match($config, '(?ms)^  datasource:\s*\r?\n(.*?)(?=^  \S|\z)').Groups[1].Value
function Setting([string]$Name) { return ([regex]::Match($dbBlock, '(?m)^\s+' + $Name + ':\s*(.*?)\s*$').Groups[1].Value).Trim().Trim('"').Trim("'") }
$dbMatch = [regex]::Match((Setting 'url'), '^jdbc:mysql://([^:/]+)(?::(\d+))?/([A-Za-z0-9_]+)')
if (!$dbMatch.Success -or $dbMatch.Groups[1].Value -notin @('localhost','127.0.0.1')) { throw 'Only local database verification is allowed.' }
$dbPort = if($dbMatch.Groups[2].Success) { $dbMatch.Groups[2].Value } else { '3306' }
$afterDump = Join-Path $projectRoot '.local\tduck-dev\original-after.sql'
$priorPassword = $env:MYSQL_PWD
try {
    $env:MYSQL_PWD = Setting 'password'
    & (Join-Path $MysqlBin 'mysqldump.exe') --host=127.0.0.1 "--port=$dbPort" ("--user=" + (Setting 'username')) --single-transaction --hex-blob --set-gtid-purged=OFF --default-character-set=utf8mb4 "--result-file=$afterDump" $dbMatch.Groups[3].Value 2> (Join-Path $projectRoot '.local\tduck-dev\original-dump.stderr.log')
    if($LASTEXITCODE -ne 0) { throw 'Original database verification dump failed.' }
} finally { $env:MYSQL_PWD = $priorPassword }
function Data-Hash([string]$Path) {
    $rows = @(Get-Content -LiteralPath $Path -Encoding UTF8 | Where-Object { $_ -match '^(INSERT INTO|REPLACE INTO) ' } | Sort-Object)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($rows -join "`n"))))).Replace('-','') } finally { $sha.Dispose() }
}
$sameData = (Data-Hash (Join-Path $backup 'database.sql')) -eq (Data-Hash $afterDump)
$beforeRows = @(Get-Content (Join-Path $backup 'database.sql') -Encoding UTF8 | Where-Object { $_ -match '^(INSERT INTO|REPLACE INTO) ' })
$afterRows = @(Get-Content $afterDump -Encoding UTF8 | Where-Object { $_ -match '^(INSERT INTO|REPLACE INTO) ' })
$tables = @($beforeRows + $afterRows | ForEach-Object { [regex]::Match($_, '^(?:INSERT INTO|REPLACE INTO) `([^`]+)`').Groups[1].Value } | Sort-Object -Unique)
$changedTables = @()
foreach($table in $tables) {
    $prefix = '^(?:INSERT INTO|REPLACE INTO) `' + [regex]::Escape($table) + '`'
    $beforeTable = @($beforeRows | Where-Object { $_ -match $prefix }) -join "`n"
    $afterTable = @($afterRows | Where-Object { $_ -match $prefix }) -join "`n"
    if($beforeTable -cne $afterTable) { $changedTables += $table }
}
$sameJar = (Get-FileHash (Join-Path $manifest.sourceBackend 'tduck-api\target\tduck-api.jar')).Hash -eq $manifest.deployedJarSha256
$report = @{ checkedAt = (Get-Date -Format o); sourceFilesChecked = $checked; sourceDifferences = $differences; originalDatabaseDataUnchanged = $sameData; changedDataTables = $changedTables; nonAccountDataUnchanged = @($changedTables | Where-Object { $_ -notin @('ac_user','ac_user_token') }).Count -eq 0; originalJarUnchanged = $sameJar; backupDatabaseSha256 = $manifest.databaseSha256; deployedJarSha256 = $manifest.deployedJarSha256 }
$report | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $projectRoot 'evidence\tduck-vue3\original-integrity.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 5
if($differences.Count -or !$sameData -or !$sameJar) { throw 'Original source or database changed since backup; inspect the integrity report.' }
