param([string]$Source='D:\tduck-survey-form-master', [string]$Maven='D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd', [string]$JavaHome='D:\jdk\jdk17')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$build=Join-Path $root '.local\tduck-build'
if(!(Test-Path -LiteralPath (Join-Path $Source 'pom.xml'))){throw 'TDuck backend source missing'}
& robocopy $Source $build /E /XD target .git logs readmeImages doc docker /XF *.log /NFL /NDL /NJH /NJS /NP | Out-Null
if($LASTEXITCODE -gt 7){throw 'Private build copy failed'}
Push-Location $root
$priorJava=$env:JAVA_HOME
try{
 & git apply --check --directory=.local/tduck-build patches/tduck-backend/local-acceptance-fixes.patch
 if($LASTEXITCODE -ne 0){throw 'Backend source does not match the reviewed patch'}
 & git apply --directory=.local/tduck-build patches/tduck-backend/local-acceptance-fixes.patch
 if($LASTEXITCODE -ne 0){throw 'Apply patch failed'}
 $env:JAVA_HOME=$JavaHome
 & $Maven -q -f (Join-Path $build 'pom.xml') -DskipTests package
 if($LASTEXITCODE -ne 0){throw 'Backend package failed'}
 Write-Output 'Built private patched TDuck JAR; original source was not modified. HTTP regressions must run separately.'
}finally{$env:JAVA_HOME=$priorJava;Pop-Location}
