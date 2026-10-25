param([string]$Source='D:\tduck-survey-form-master', [string]$Maven='D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd', [string]$JavaHome='D:\jdk\jdk17', [ValidatePattern('^[a-z0-9-]+$')][string]$BuildName='tduck-closure-build')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$build=Join-Path $root ('.local\'+$BuildName)
if(Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object {$_.CommandLine -like "*$build\tduck-api\target\tduck-api.jar*"}){throw 'The patched JAR is running. Stop your isolated instance before rebuilding; no files changed.'}
if(!(Test-Path -LiteralPath (Join-Path $Source 'pom.xml'))){throw 'TDuck backend source missing'}
& robocopy $Source $build /E /XD target .git logs readmeImages doc docker /XF *.log /NFL /NDL /NJH /NJS /NP | Out-Null
if($LASTEXITCODE -gt 7){throw 'Private build copy failed'}
# robocopy does not remove files introduced by the closure/version/ai patches on earlier builds.
foreach($relative in @(
  'tduck-form\src\main\java\com\tduck\cloud\form\mapper\PublicSubmissionMapper.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\service\PublicSubmissionService.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\entity\UserFormVersionEntity.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\mapper\UserFormVersionMapper.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\service\UserFormVersionService.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\ai\AiProvider.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\ai\AiProviderException.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\ai\OpenAiCompatibleProvider.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\ai\MockAiProvider.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\ai\AiDraftInput.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\ai\AiDraftSpec.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\ai\AiDraftValidator.java',
  'tduck-form\src\main\java\com\tduck\cloud\form\ai\AiDraftService.java',
  'tduck-api\src\main\java\com\tduck\cloud\api\web\controller\AiDraftController.java',
  'tduck-api\src\test\java\com\tduck\cloud\api\ai\AiDraftServiceTest.java')){
 $generated=Join-Path $build $relative
 if(Test-Path -LiteralPath $generated){Remove-Item -LiteralPath $generated}
}
# Git for Windows may check out patches as CRLF while upstream Java uses LF.
# Normalize only the private patch/source copies; never rewrite the upstream tree.
$utf8=New-Object System.Text.UTF8Encoding($false)
foreach($patchName in @('local-acceptance-fixes','core-closure','version-snapshots','ai-draft','followup')){
 $patchText=[System.IO.File]::ReadAllText((Join-Path $root "patches\tduck-backend\$patchName.patch")).Replace("`r`n","`n")
 if($patchName -eq 'followup'){
  foreach($created in [regex]::Matches($patchText,'(?m)^--- /dev/null\n\+\+\+ b/(.+)$')){
   $newPath=[System.IO.Path]::GetFullPath((Join-Path $build $created.Groups[1].Value))
   $buildRoot=[System.IO.Path]::GetFullPath($build)+[System.IO.Path]::DirectorySeparatorChar
   if(!$newPath.StartsWith($buildRoot,[System.StringComparison]::OrdinalIgnoreCase)){throw 'Generated source path escapes private build'}
   if(Test-Path -LiteralPath $newPath){Remove-Item -LiteralPath $newPath}
  }
 }
 foreach($match in [regex]::Matches($patchText,'(?m)^--- a/(.+)$')){
  $privateSource=Join-Path $build $match.Groups[1].Value
  if(Test-Path -LiteralPath $privateSource){[System.IO.File]::WriteAllText($privateSource,[System.IO.File]::ReadAllText($privateSource).Replace("`r`n","`n"),$utf8)}
 }
 [System.IO.File]::WriteAllText((Join-Path $build "$patchName.patch"),$patchText,$utf8)
}
Push-Location $root
$priorJava=$env:JAVA_HOME
try{
 & git apply --check "--directory=.local/$BuildName" (Join-Path $build 'local-acceptance-fixes.patch')
 if($LASTEXITCODE -ne 0){throw 'Backend source does not match the reviewed patch'}
 & git apply "--directory=.local/$BuildName" (Join-Path $build 'local-acceptance-fixes.patch')
 if($LASTEXITCODE -ne 0){throw 'Apply patch failed'}
 & git apply --check "--directory=.local/$BuildName" (Join-Path $build 'core-closure.patch')
 if($LASTEXITCODE -ne 0){throw 'Closure patch does not match the reviewed baseline'}
 & git apply "--directory=.local/$BuildName" (Join-Path $build 'core-closure.patch')
 if($LASTEXITCODE -ne 0){throw 'Apply closure patch failed'}
 & git apply --check "--directory=.local/$BuildName" (Join-Path $build 'version-snapshots.patch')
 if($LASTEXITCODE -ne 0){throw 'Version patch does not match the reviewed baseline'}
 & git apply "--directory=.local/$BuildName" (Join-Path $build 'version-snapshots.patch')
 if($LASTEXITCODE -ne 0){throw 'Apply version patch failed'}
 & git apply --check "--directory=.local/$BuildName" (Join-Path $build 'ai-draft.patch')
 if($LASTEXITCODE -ne 0){throw 'AI draft patch does not match the reviewed baseline'}
 & git apply "--directory=.local/$BuildName" (Join-Path $build 'ai-draft.patch')
 if($LASTEXITCODE -ne 0){throw 'Apply AI draft patch failed'}
 & git apply --check "--directory=.local/$BuildName" (Join-Path $build 'followup.patch')
 if($LASTEXITCODE -ne 0){throw 'Follow-up patch does not match the reviewed baseline'}
 & git apply "--directory=.local/$BuildName" (Join-Path $build 'followup.patch')
 if($LASTEXITCODE -ne 0){throw 'Apply follow-up patch failed'}
 $env:JAVA_HOME=$JavaHome
 & $Maven -q -f (Join-Path $build 'pom.xml') clean package -DskipTests
 if($LASTEXITCODE -ne 0){throw 'Backend package failed'}
 Write-Output 'Built private patched TDuck JAR; original source was not modified. HTTP regressions must run separately.'
}finally{$env:JAVA_HOME=$priorJava;Pop-Location}
