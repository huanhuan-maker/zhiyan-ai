# Requires the reviewed backend already running. Synthetic fixtures remain for inspection.
$ErrorActionPreference='Stop'
. "$PSScriptRoot\Load-Env.ps1"
$base="http://127.0.0.1:$env:SERVER_PORT"
$owner=New-Object Microsoft.PowerShell.Commands.WebRequestSession
$participant=New-Object Microsoft.PowerShell.Commands.WebRequestSession
function Http($session,[string]$method,[string]$path,$body,[int]$expected=200) {
    $headers=@{}
    if($method -ne 'Get') {
        $csrf=Invoke-RestMethod "$base/api/auth/csrf" -WebSession $session
        $headers[$csrf.headerName]=$csrf.token
    }
    $params=@{Uri="$base$path";Method=$method;WebSession=$session;Headers=$headers;UseBasicParsing=$true}
    if($null -ne $body) { $params.ContentType='application/json; charset=utf-8'; $params.Body=[Text.Encoding]::UTF8.GetBytes(($body|ConvertTo-Json -Depth 30 -Compress)) }
    try { $response=Invoke-WebRequest @params; $actual=[int]$response.StatusCode }
    catch {
        if(!$_.Exception.Response) { throw 'HTTP transport failed; no capability URL logged.' }
        $actual=[int]$_.Exception.Response.StatusCode
        if($actual -ne $expected) { throw "HTTP assertion failed: expected $expected, actual $actual" }
        return $null
    }
    if($actual -ne $expected) { throw "HTTP assertion failed: expected $expected, actual $actual" }
    if($response.Content) { return $response.Content | ConvertFrom-Json }
}
$csrf=Invoke-RestMethod "$base/api/auth/csrf" -WebSession $owner
$headers=@{}; $headers[$csrf.headerName]=$csrf.token
$null=Invoke-WebRequest "$base/api/auth/login" -Method Post -WebSession $owner -Headers $headers -ContentType 'application/x-www-form-urlencoded' -Body @{username=$env:APP_ADMIN_USER;password=$env:APP_ADMIN_PASSWORD} -UseBasicParsing
$draft=Get-Content (Join-Path $ProjectRoot 'fixtures/m1_survey.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$draft.title='M1 publication HTTP synthetic review'
$survey=Http $owner Post '/api/surveys' $draft 201
$id=$survey.id
$p=Http $owner Post "/api/surveys/$id/publish" @{revision=1}
$v=$p.versionId
$a=Http $participant Post "/api/public/surveys/$($p.publicToken)/sessions" @{consent=$true;aiConsent=$false} 201
$b=Http $participant Post "/api/public/surveys/$($p.publicToken)/sessions" @{consent=$true;aiConsent=$false} 201
$detail=Http $owner Get "/api/surveys/$id" $null
$revision=$detail.versions[0].shareRevision
$rotated=Http $owner Post "/api/surveys/$id/versions/$v/rotate-token" @{expectedShareRevision=$revision}
# Simulate a discarded successful response followed by an identical client retry.
$null=Http $owner Post "/api/surveys/$id/versions/$v/rotate-token" @{expectedShareRevision=$revision} 409
$null=Http $participant Get "/api/public/surveys/$($p.publicToken)" $null 404
$null=Http $participant Post "/api/public/surveys/$($p.publicToken)/sessions" @{consent=$true;aiConsent=$false} 404
$null=Http $participant Get "/api/public/surveys/$($rotated.publicToken)" $null
$null=Http $participant Post "/api/public/sessions/$($a.sessionToken)/complete" @{answers=@{satisfaction='yes';factors=@('price');score=4;suggestion='Synthetic queue comment'}}
$null=Http $owner Post "/api/surveys/$id/close" $null
$null=Http $participant Post "/api/public/sessions/$($b.sessionToken)/answers" @{questionId='score';value=2} 410
$draft.title='M1 publication HTTP synthetic review V2'
$null=Http $owner Put "/api/surveys/$id" @{draft=$draft;revision=1}
$next=Http $owner Post "/api/surveys/$id/publish" @{revision=2}
$null=Http $participant Get "/api/public/surveys/$($rotated.publicToken)" $null 410
$null=Http $participant Get "/api/public/surveys/$($next.publicToken)" $null
$null=Http $participant Post "/api/public/sessions/$($b.sessionToken)/complete" @{answers=@{satisfaction='no';score=2}} 410
$detail=Http $owner Get "/api/surveys/$id" $null
$closed=@($detail.versions | Where-Object { $_.id -eq $v })[0]
$closedLink=Http $owner Post "/api/surveys/$id/versions/$v/rotate-token" @{expectedShareRevision=$closed.shareRevision}
$null=Http $participant Get "/api/public/surveys/$($closedLink.publicToken)" $null 410
$oldResults=Http $owner Get "/api/surveys/$id/results?versionId=$v" $null
$newResults=Http $owner Get "/api/surveys/$id/results?versionId=$($next.versionId)" $null
if($oldResults.completedCount -ne 1 -or $newResults.completedCount -ne 0) { throw 'Version result isolation failed.' }
$result=[ordered]@{realHttp='PASS';repeatRotationRejected='PASS';discardedResponseReplay='PASS';oldTokenRejected='PASS';inFlightSessionPreserved='PASS';closedVersionNotReopened='PASS';closedRotationStaysClosed='PASS';versionIsolation='PASS';surveyId=$id;version1=$v;version2=$next.versionId;oldCompleted=1;newCompleted=0;browser='NOT_EXECUTED'}
$result | ConvertTo-Json | Set-Content (Join-Path $ProjectRoot 'evidence/m1-publication-http.json') -Encoding UTF8
$result | ConvertTo-Json
