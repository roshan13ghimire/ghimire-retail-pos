
param(
    [Parameter(Mandatory = $true)]
    [string]$Database,

    [Parameter(Mandatory = $true)]
    [string]$DbUser,

    [string]$DbHost = "localhost",

    [int]$DbPort = 5432
)

$ErrorActionPreference = "Stop"

# Store backups outside the Git project
$backupDirectory = Join-Path $env:USERPROFILE "POS-Backups"

# Generate a unique filename
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

$backupFile = Join-Path $backupDirectory "pos_$timestamp.dump"
$tempFile = "$backupFile.partial"

try {
    # Check PostgreSQL utilities
    $pgDump = (Get-Command pg_dump -ErrorAction Stop).Source
    $pgRestore = (Get-Command pg_restore -ErrorAction Stop).Source

    # Create backup directory if needed
    New-Item `
        -ItemType Directory `
        -Path $backupDirectory `
        -Force | Out-Null

    Write-Host "Starting PostgreSQL backup..."

    # Create custom-format PostgreSQL backup
    & $pgDump `
        -h $DbHost `
        -p $DbPort `
        -U $DbUser `
        -d $Database `
        -F c `
        -f $tempFile

    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed."
    }

    # Check that backup exists and is not empty
    $fileInfo = Get-Item -LiteralPath $tempFile

    if ($fileInfo.Length -eq 0) {
        throw "Backup file is empty."
    }

    # Verify that PostgreSQL recognizes the archive
    & $pgRestore -l $tempFile | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Backup archive validation failed."
    }

    # Publish only after successful checks
    Move-Item `
        -LiteralPath $tempFile `
        -Destination $backupFile

    Write-Host "Backup completed successfully."
    Write-Host "File: $backupFile"
    Write-Host "Size: $((Get-Item $backupFile).Length) bytes"

}
catch {
    if (Test-Path -LiteralPath $tempFile) {
        Remove-Item -LiteralPath $tempFile -Force
    }

    Write-Error "Backup failed: $_"
    exit 1
}
