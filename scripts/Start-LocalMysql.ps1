param([Parameter(Mandatory=$true)][string]$MySqlHome, [int]$Port = 3307)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$local = Join-Path $root '.local'
$data = Join-Path $local 'mysql-data'
if (!(Test-Path "$MySqlHome\bin\mysqld.exe")) { throw 'MySQL 8 installation not found.' }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { throw "Port $Port already in use; use that existing MySQL instance or choose another port." }
New-Item -ItemType Directory -Force $local | Out-Null
$secret = Join-Path $local 'mysql-root-password.txt'
if (!(Test-Path $data)) {
    & "$MySqlHome\bin\mysqld.exe" --no-defaults --initialize-insecure "--basedir=$MySqlHome" "--datadir=$data"
    if ($LASTEXITCODE -ne 0) { throw 'MySQL initialization failed.' }
    # A fresh isolated datadir only; never read or change an existing MySQL datadir.
    [IO.File]::WriteAllText($secret, [Guid]::NewGuid().ToString('N'))
}
if (!(Test-Path $secret)) { throw 'No local root credential marker; refusing to manage unknown datadir.' }
$arguments = @('--no-defaults', ('--basedir="' + $MySqlHome + '"'), ('--datadir="' + $data + '"'), "--port=$Port", '--bind-address=127.0.0.1', '--mysqlx=OFF')
Start-Process -FilePath "$MySqlHome\bin\mysqld.exe" -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput "$local\mysql.out.log" -RedirectStandardError "$local\mysql.err.log" | Out-Null
$ready = $false
for ($i=0; $i -lt 30; $i++) {
    if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { $ready=$true; break }
    Start-Sleep -Seconds 1
}
if (!$ready) { throw 'MySQL did not start; inspect .local/mysql.err.log.' }
$marker = Join-Path $local 'mysql-secured'
if (!(Test-Path $marker)) {
    $pw = (Get-Content $secret -Raw).Trim()
    "ALTER USER 'root'@'localhost' IDENTIFIED BY '$pw';" | & "$MySqlHome\bin\mysql.exe" --protocol=TCP -h 127.0.0.1 -P $Port -u root --skip-password
    if ($LASTEXITCODE -ne 0) { throw 'Unable to secure fresh MySQL root account.' }
    New-Item -ItemType File $marker | Out-Null
}
Write-Host "MySQL listening on 127.0.0.1:$Port. Root credential: .local/mysql-root-password.txt (local only). Set DB_PORT=$Port in .env."
