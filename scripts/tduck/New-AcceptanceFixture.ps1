param([string]$MysqlBin = 'D:\MySQL\MySQL Server 8.0\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$devRoot = Join-Path $projectRoot '.local\tduck-dev'
$manifest = Get-Content (Join-Path $devRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.database -notmatch '^tduck_vue3_[a-z0-9_]+$' -or $manifest.backend -ne 'http://127.0.0.1:8998') { throw 'Fixture may only target the isolated dev database.' }
$config = Get-Content (Join-Path $devRoot 'application-local.yml') -Raw
function Read-Yaml([string]$Name) {
    $value = [regex]::Match($config, '(?m)^    ' + $Name + ": '(.*?)'\s*$").Groups[1].Value
    return $value.Replace("''", "'")
}
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
$password = 'Dev3-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$owner = "vue3-owner-$suffix@example.test"
$other = "vue3-other-$suffix@example.test"
$sql = @"
INSERT INTO ac_user (name,email,password,password_type,need_change_password,reg_channel,deleted,create_time,update_time)
VALUES ('Vue3 Researcher','$owner',SHA2('$password',256),0,0,0,0,NOW(),NOW()),
('Vue3 Observer','$other',SHA2('$password',256),0,0,0,0,NOW(),NOW());
"@
$priorPassword = $env:MYSQL_PWD
try {
    $env:MYSQL_PWD = Read-Yaml 'password'
    $fixtureSql = Join-Path $devRoot 'acceptance-fixture.sql'
    [IO.File]::WriteAllText($fixtureSql, $sql, [Text.UTF8Encoding]::new($false))
    $dbPort = [regex]::Match($config, ':([0-9]+)/tduck_vue3_').Groups[1].Value
    if (!$dbPort) { $dbPort = '3306' }
    & (Join-Path $MysqlBin 'mysql.exe') --host=127.0.0.1 "--port=$dbPort" ("--user=" + (Read-Yaml 'username')) --default-character-set=utf8mb4 $manifest.database ("--execute=source " + $fixtureSql.Replace('\','/'))
    if ($LASTEXITCODE -ne 0) { throw 'Fixture insert failed.' }
} finally { $env:MYSQL_PWD = $priorPassword }
$base = $manifest.backend
function Invoke-TDuck([string]$Path, [object]$Body, [string]$Token = '') {
    $headers = @{}
    if ($Token) { $headers.token = $Token }
    $json = ConvertTo-Json $Body -Depth 30 -Compress
    $response = Invoke-RestMethod -Uri ($base + $Path) -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
    if ($response.code -ne 200) { throw "TDuck API failed at $Path; code $($response.code)" }
    return $response.data
}
$login = Invoke-TDuck '/login/account' @{ account = $owner; password = $password }
$titles = @('Research experience - acceptance fixture', 'Learning habits - acceptance fixture', 'Product feedback - acceptance fixture')
$forms = @()
foreach ($title in $titles) {
    $form = Invoke-TDuck '/user/form/create' @{ name = $title; description = 'Synthetic acceptance data. No real respondent information.'; type = 1; folder = $false; folderId = 0 } $login.token
    $question = @{ formKey = $form.formKey; formItemId = ('field' + [guid]::NewGuid().ToString('N').Substring(0,8)); type = 'INPUT'; label = 'What would improve your experience?'; required = $false; sort = 1; span = 24; displayType = $false; hideType = $false; specialType = $false; showLabel = $true; scheme = @{} }
    Invoke-TDuck '/user/form/item/batch/create' @($question) $login.token | Out-Null
    $forms += $form
}
Invoke-TDuck '/user/form/publish' @{ formKey = $forms[1].formKey } $login.token | Out-Null
Invoke-TDuck '/user/form/publish' @{ formKey = $forms[2].formKey } $login.token | Out-Null
Invoke-TDuck '/user/form/stop' @{ formKey = $forms[2].formKey } $login.token | Out-Null
$folder = Invoke-TDuck '/user/form/create' @{ name = 'Archive - acceptance fixture'; type = 3; folder = $true; folderId = 0 } $login.token
$nested = Invoke-TDuck '/user/form/create' @{ name = 'Nested survey - acceptance fixture'; type = 1; folder = $false; folderId = $folder.id } $login.token
$fixture = @{ owner = $owner; other = $other; password = $password; forms = @($forms | ForEach-Object { @{ key = $_.formKey; name = $_.name } }); folderId = $folder.id; nestedKey = $nested.formKey; baseUrl = 'http://127.0.0.1:5180'; backend = $base; generatedAt = (Get-Date -Format o) }
$fixture | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $devRoot 'acceptance.json') -Encoding UTF8
Write-Output 'Created synthetic accounts, three root surveys, one folder and one nested survey in isolated MySQL. Credentials are in .local\tduck-dev\acceptance.json (not committed).'
