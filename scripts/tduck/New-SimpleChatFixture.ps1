$ErrorActionPreference='Stop'
$projectRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
& (Join-Path $PSScriptRoot 'New-AcceptanceFixture.ps1') -FixturePath '.local\assistant-simple\acceptance.json'
$priorFixture=$env:TDUCK_ASSISTANT_FIXTURE
$priorOutput=$env:TDUCK_ASSISTANT_OUTPUT
$priorRun=$env:TDUCK_ASSISTANT_RUN
try {
 $env:TDUCK_ASSISTANT_FIXTURE='.local/assistant-simple/acceptance.json'
 $env:TDUCK_ASSISTANT_OUTPUT='evidence/tduck-full/assistant-simple/legacy-mcp'
 $env:TDUCK_ASSISTANT_RUN='.local/assistant-simple/survey-run.json'
 Push-Location $projectRoot
 try { & node scripts/tduck/assistant-api.mjs --real; if($LASTEXITCODE -ne 0){throw 'Synthetic questionnaire/MCP setup verification failed'} }
 finally { Pop-Location }
} finally {
 $env:TDUCK_ASSISTANT_FIXTURE=$priorFixture
 $env:TDUCK_ASSISTANT_OUTPUT=$priorOutput
 $env:TDUCK_ASSISTANT_RUN=$priorRun
}
