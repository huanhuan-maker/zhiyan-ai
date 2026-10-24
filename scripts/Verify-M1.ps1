param([string]$JavaHome=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
if($JavaHome) { $env:JAVA_HOME=$JavaHome; $env:Path="$JavaHome\bin;$env:Path" }
. "$PSScriptRoot\Load-Env.ps1"
if(Get-NetTCPConnection -State Listen -LocalPort $env:SERVER_PORT -ErrorAction SilentlyContinue) { throw 'Stop backend before running Verify-M1.' }
$local=Join-Path $ProjectRoot '.local'
New-Item -ItemType Directory -Force $local | Out-Null
Push-Location (Join-Path $ProjectRoot 'backend')
try { & .\mvnw.cmd -B -ntp package '-DskipTests' *> "$local\m1-package.log"; if($LASTEXITCODE -ne 0) { throw 'Packaging failed; inspect .local/m1-package.log.' } } finally { Pop-Location }
$jar=Join-Path $ProjectRoot 'backend/target/zhiyan-ai-0.0.1-SNAPSHOT.jar'
$base="http://127.0.0.1:$env:SERVER_PORT"
function Start-App([string]$tag) {
    return Start-Process -FilePath (Get-Command java.exe).Source -ArgumentList @('-jar',('"'+$jar+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput "$local\$tag.out.log" -RedirectStandardError "$local\$tag.err.log"
}
function Wait-App($proc) {
    for($i=0;$i -lt 60;$i++) {
        if($proc.HasExited) { throw 'Backend exited before ready.' }
        try { if((Invoke-RestMethod "$base/actuator/health" -TimeoutSec 2).status -eq 'UP') { return } } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw 'Backend startup timed out.'
}
function Session { return New-Object Microsoft.PowerShell.Commands.WebRequestSession }
function Login($session) {
    $csrf=Invoke-RestMethod "$base/api/auth/csrf" -WebSession $session
    $headers=@{}; $headers[$csrf.headerName]=$csrf.token
    $null=Invoke-WebRequest "$base/api/auth/login" -Method Post -WebSession $session -Headers $headers -Body @{username=$env:APP_ADMIN_USER;password=$env:APP_ADMIN_PASSWORD} -ContentType 'application/x-www-form-urlencoded' -UseBasicParsing
}
function Send($session,[string]$path,$body,[string]$method='Post') {
    $csrf=Invoke-RestMethod "$base/api/auth/csrf" -WebSession $session
    $headers=@{}; $headers[$csrf.headerName]=$csrf.token
    $bytes=[Text.Encoding]::UTF8.GetBytes(($body|ConvertTo-Json -Depth 30 -Compress))
    return Invoke-RestMethod "$base$path" -Method $method -WebSession $session -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $bytes
}
$proc=$null
try {
    $proc=Start-App 'm1-smoke-first'; Wait-App $proc
    $owner=Session; Login $owner
    $draft=Get-Content (Join-Path $ProjectRoot 'fixtures/m1_survey.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $survey=Send $owner '/api/surveys' $draft
    $id=$survey.id
    $published=Send $owner "/api/surveys/$id/publish" @{revision=1}
    $a=Session; $b=Session
    $sa=Send $a "/api/public/surveys/$($published.publicToken)/sessions" @{consent=$true;aiConsent=$false}
    $sb=Send $b "/api/public/surveys/$($published.publicToken)/sessions" @{consent=$true;aiConsent=$true}
    $null=Send $a "/api/public/sessions/$($sa.sessionToken)/answers" @{questionId='suggestion';value='Synthetic response A: queue at lunch.'}
    $restore=Invoke-RestMethod "$base/api/public/sessions/$($sa.sessionToken)" -WebSession $a
    if($restore.answers.suggestion -ne 'Synthetic response A: queue at lunch.') { throw 'Saved answer restore failed.' }
    $bodyA=@{answers=@{satisfaction='yes';factors=@('price','taste');score=4}}
    $bodyB=@{answers=@{satisfaction='no';factors=@('queue');score=2;suggestion='Synthetic response B: improve speed.'}}
    $null=Send $a "/api/public/sessions/$($sa.sessionToken)/complete" $bodyA
    $null=Send $b "/api/public/sessions/$($sb.sessionToken)/complete" $bodyB
    $null=Send $a "/api/public/sessions/$($sa.sessionToken)/complete" $bodyA
    $results=Invoke-RestMethod "$base/api/surveys/$id/results?versionId=$($published.versionId)" -WebSession $owner
    if($results.completedCount -ne 2 -or $results.questions[0].options[0].numerator -ne 1 -or $results.questions[0].options[2].percentage -ne 50 -or $results.questions[2].average -ne 3) { throw 'Real HTTP statistics mismatch.' }
    $draft.title += ' / draft updated'
    $null=Send $owner "/api/surveys/$id" @{draft=$draft;revision=1} 'Put'
    $old=Invoke-RestMethod "$base/api/public/surveys/$($published.publicToken)" -WebSession $a
    if($old.survey.title -eq $draft.title) { throw 'Published snapshot mutated.' }
    Stop-Process -Id $proc.Id; $proc.WaitForExit()
    $proc=Start-App 'm1-smoke-restart'; Wait-App $proc
    $owner=Session; Login $owner
    $persisted=Invoke-RestMethod "$base/api/surveys/$id/results?versionId=$($published.versionId)" -WebSession $owner
    $saved=Invoke-RestMethod "$base/api/surveys/$id" -WebSession $owner
    if($persisted.completedCount -ne 2 -or $saved.draft.title -ne $draft.title) { throw 'Survey/response persistence failed after real Java restart.' }
    # Capability tokens stay in ignored local artifact, never in committed evidence.
    @{surveyId=$id;versionId=$published.versionId;publicPath=$published.publicPath;publicToken=$published.publicToken;sessionA=$sa.sessionToken;sessionB=$sb.sessionToken}|ConvertTo-Json|Set-Content "$local\m1-demo.json" -Encoding UTF8
    $evidence=[ordered]@{realHttp='PASS';saveRestore='PASS';submitted=2;singleYes=1;singleNo=1;percentageEach=50;scaleAverage=3;duplicateSubmit='PASS';publishedSnapshotFrozen='PASS';actualRestartPersistence='PASS';surveyId=$id;versionId=$published.versionId}
    $evidence|ConvertTo-Json|Set-Content (Join-Path $ProjectRoot 'evidence/m1-smoke.json') -Encoding UTF8
    $evidence|ConvertTo-Json
} finally { if($proc -and !$proc.HasExited) { Stop-Process -Id $proc.Id; $proc.WaitForExit() } }
