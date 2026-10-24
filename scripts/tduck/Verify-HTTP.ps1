$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$fixture = Get-Content (Join-Path $projectRoot '.local\tduck-dev\acceptance.json') -Raw | ConvertFrom-Json
if ($fixture.backend -ne 'http://127.0.0.1:8998') { throw 'Verification is restricted to the isolated backend.' }
function Read-API([string]$Path, [string]$Token = '') {
    $headers = @{}
    if ($Token) { $headers.token = $Token }
    # Windows PowerShell 5.1 otherwise misdecodes UTF-8 JSON without a charset.
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($fixture.backend + $Path) -Headers $headers -TimeoutSec 15
    return [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) | ConvertFrom-Json
}
function Login-User([string]$Account) {
    $body = @{ account = $Account; password = $fixture.password } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri ($fixture.backend + '/login/account') -Method Post -ContentType 'application/json' -Body $body
    if ($response.code -ne 200 -or !$response.data.token) { throw 'Real login failed.' }
    return $response.data.token
}
$checks = @()
function Check([string]$Name, [bool]$Pass) {
    $script:checks += @{ name = $Name; passed = $Pass }
    if (!$Pass) { throw "Verification failed: $Name" }
}
Check 'Anonymous request is rejected' ((Read-API '/user/form/page?folderId=0').code -eq 401)
$ownerToken = Login-User $fixture.owner
$profile = Read-API '/user/current/detail' $ownerToken
Check 'Real login and current-user query' ($profile.code -eq 200)
$rows = Read-API '/user/form/page?folderId=0&current=1&size=10' $ownerToken
Check 'Root list persists' ($rows.code -eq 200 -and $rows.data.total -eq 4)
$typeObservations = @()
foreach ($form in $fixture.forms) {
    $detail = Read-API ('/user/form/' + $form.key) $ownerToken
    Check ('Persisted form ' + $form.key) ($detail.code -eq 200 -and $detail.data.name -eq $form.name)
    $fields = Read-API ('/user/form/item/list?key=' + $form.key) $ownerToken
    Check ('Persisted question ' + $form.key) ($fields.code -eq 200 -and $fields.data.Count -eq 1)
    $typeObservations += @{ key = $form.key; createRequestType = 1; returnedType = $detail.data.type; returnedTypeDesc = $detail.data.typeDesc }
}
$totals = @()
foreach ($status in @(1,2,3)) {
    $summary = Read-API "/user/form/page?folderId=0&folder=false&current=1&size=1&status=$status" $ownerToken
    Check "Backend count for status $status" ($summary.code -eq 200 -and $summary.data.total -eq 1)
    $totals += $summary.data.total
}
$one = Read-API '/user/form/page?folderId=0&current=1&size=1' $ownerToken
$two = Read-API '/user/form/page?folderId=0&current=2&size=1' $ownerToken
Check 'Real backend pagination' ($one.data.records.Count -eq 1 -and $two.data.records.Count -eq 1 -and $one.data.records[0].formKey -ne $two.data.records[0].formKey)
$otherToken = Login-User $fixture.other
$denied = Read-API ('/user/form/' + $fixture.forms[0].key) $otherToken
Check 'Cross-account access is rejected by backend' ($denied.code -ne 200 -and $denied.msg -match '\u6743\u9650')
Check 'Invalid token rejected by backend' ((Read-API '/user/current/detail' 'expired-test-token').code -eq 401)
$report = @{ runAt = (Get-Date -Format o); backend = $fixture.backend; passed = $checks.Count; failed = 0; checks = $checks; statusCountsFromBackend = $totals; upstreamTypeRoundTrip = $typeObservations; note = 'Synthetic fixtures; no tokens, credentials or respondent data included.' }
$reportPath = Join-Path $projectRoot 'evidence\tduck-vue3\http-results.json'
$report | ConvertTo-Json -Depth 10 | Set-Content $reportPath -Encoding UTF8
Write-Output "HTTP verification: $($checks.Count) passed, 0 failed. Report: $reportPath"
