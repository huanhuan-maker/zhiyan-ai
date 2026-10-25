param([string]$JavaHome='D:\jdk\jdk17',[string]$Maven='D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd',[string]$Node='D:\nodejs\node.exe',[switch]$RealAI)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$manifest=Get-Content (Join-Path $root '.local\tduck-dev\manifest.json') -Raw | ConvertFrom-Json
if($manifest.database -ne 'tduck_vue3_dev'){throw 'Only the isolated acceptance database is allowed'}
$priorJava=$env:JAVA_HOME
$priorBackend=$env:TD_M3_BASE
Push-Location $root
try{
 $env:JAVA_HOME=$JavaHome
 $env:TD_M3_BASE='http://127.0.0.1:8997'
 & $Maven -q -f .local/tduck-closure-build/pom.xml -pl tduck-api -am test '-Dtest=FollowUpPolicyTest,FollowUpFailureTest,LoginTokenReplayTest,AiDraftServiceTest' '-Dsurefire.failIfNoSpecifiedTests=false' *> .local/tduck-full-audit/m3-unit.log
 if($LASTEXITCODE -ne 0){throw 'Java verification failed; see .local/tduck-full-audit/m3-unit.log'}
 $reports=foreach($name in @('FollowUpPolicyTest','FollowUpFailureTest','LoginTokenReplayTest','AiDraftServiceTest')){
  $reportPath=Join-Path $root ".local\tduck-closure-build\tduck-api\target\surefire-reports\TEST-com.tduck.cloud.api.ai.$name.xml"
  [xml]$report=Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8
  [pscustomobject]@{name=$name;tests=[int]$report.testsuite.tests;failures=[int]$report.testsuite.failures;errors=[int]$report.testsuite.errors;skipped=[int]$report.testsuite.skipped}
 }
 $reports | ConvertTo-Json -Depth 5 | Set-Content evidence/tduck-full/m3/java-tests.json -Encoding UTF8
 foreach($scriptName in @('m3-login-replay','m3-api','m3-limits','m3-ui','m3-followup-visibility')){
  & $Node "scripts/tduck/$scriptName.mjs" *> ".local/tduck-full-audit/$scriptName-final.log"
  if($LASTEXITCODE -ne 0){throw "$scriptName failed; inspect its private log and evidence/tduck-full/m3 report"}
 }
 if($RealAI){
  & $Node scripts/tduck/m3-real-provider.mjs *> .local/tduck-full-audit/m3-real-provider-final.log
  if($LASTEXITCODE -ne 0){throw 'Real-provider check failed; inspect the private log'}
 }
 Write-Output 'Follow-up verification passed: Java reports + concurrent login + real MySQL API/clock boundaries + browser workflow. See evidence/tduck-full/m3. No next milestone started.'
}finally{$env:JAVA_HOME=$priorJava;$env:TD_M3_BASE=$priorBackend;Pop-Location}
