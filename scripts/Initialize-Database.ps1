param(
    [string]$MySqlHome,
    [string]$AdminUser = 'root',
    [Security.SecureString]$AdminPassword
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (!$MySqlHome) {
    $mysql = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($mysql) { $MySqlHome = Split-Path (Split-Path $mysql.Source -Parent) -Parent }
}
if (!(Test-Path "$MySqlHome\bin\mysql.exe")) { throw 'Pass -MySqlHome pointing to MySQL 8 installation.' }
if (!$AdminPassword) { $AdminPassword = Read-Host 'MySQL administrator password (not saved)' -AsSecureString }
$adminText = [System.Net.NetworkCredential]::new('', $AdminPassword).Password
$envFile = Join-Path $projectRoot '.env'
if (!(Test-Path $envFile)) { Copy-Item (Join-Path $projectRoot '.env.example') $envFile }
$config = Get-Content $envFile -Raw
foreach ($key in @('DB_PASSWORD','APP_ADMIN_PASSWORD')) {
    if ($config -match "(?m)^${key}=\s*$") {
        $generated = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
        $config = [regex]::Replace($config, "(?m)^${key}=[^\r\n]*", "${key}=$generated")
    }
}
[IO.File]::WriteAllText($envFile, $config)
. "$PSScriptRoot\Load-Env.ps1"
foreach ($name in @($env:DB_NAME, $env:DB_TEST_NAME, $env:DB_USER)) {
    if ($name -notmatch '^[a-zA-Z][a-zA-Z0-9_]{0,63}$') { throw 'Database names and user must be simple SQL identifiers.' }
}
if ($env:DB_USER -eq $AdminUser) { throw 'Use a dedicated DB_USER in .env, different from AdminUser.' }
if ($env:DB_PASSWORD -notmatch '^[a-zA-Z0-9_-]{12,128}$') { throw 'Use a 12+ character alphanumeric DB_PASSWORD (or leave blank to generate).' }
# The admin password goes only through the child process environment, never command arguments or logs.
$previousPwd = $env:MYSQL_PWD
try {
    $env:MYSQL_PWD = $adminText
    $sql = @"
CREATE DATABASE IF NOT EXISTS $($env:DB_NAME) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS $($env:DB_TEST_NAME) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$($env:DB_USER)'@'localhost' IDENTIFIED BY '$($env:DB_PASSWORD)';
GRANT ALL PRIVILEGES ON $($env:DB_NAME).* TO '$($env:DB_USER)'@'localhost';
GRANT ALL PRIVILEGES ON $($env:DB_TEST_NAME).* TO '$($env:DB_USER)'@'localhost';
"@
    $sql | & "$MySqlHome\bin\mysql.exe" --protocol=TCP -h $env:DB_HOST -P $env:DB_PORT -u $AdminUser
    if ($LASTEXITCODE -ne 0) { throw 'Database provisioning failed.' }
    $env:MYSQL_PWD = $env:DB_PASSWORD
    & "$MySqlHome\bin\mysql.exe" --protocol=TCP -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USER -D $env:DB_NAME -e 'SELECT VERSION() AS mysql_version, DATABASE() AS database_name;'
    if ($LASTEXITCODE -ne 0) { throw 'App user connection failed. Existing user passwords are intentionally not overwritten.' }
} finally { $env:MYSQL_PWD = $previousPwd; $adminText = $null; $sql = $null }
Write-Host 'Database setup complete. Login username/password are in the ignored .env file.'
