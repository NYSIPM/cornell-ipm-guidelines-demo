param(
    [Parameter(Mandatory = $true)]
    [string]$GuidelineId,

    [Parameter(Mandatory = $true)]
    [string]$PestId,

    [Parameter(Mandatory = $true)]
    [string]$SiteId,

    [string]$ChangedSince = ""
)

$ErrorActionPreference = "Stop"

# Ensure text sent back to Quarto/Lua is UTF-8.
$utf8 = New-Object System.Text.UTF8Encoding($false)
#[Console]::OutputEncoding = $utf8
#$OutputEncoding = $utf8

$apiUrl =
    "https://localhost:7145/api/Treatments/search" +
    "?guidelineId=$([Uri]::EscapeDataString($GuidelineId))" +
    "&pestId=$([Uri]::EscapeDataString($PestId))" +
    "&siteId=$([Uri]::EscapeDataString($SiteId))"

if ($ChangedSince) {
    $apiUrl +=
        "&changedSince=$([Uri]::EscapeDataString($ChangedSince))"
}

$result = Invoke-RestMethod `
    -Method Get `
    -Uri $apiUrl `
    -TimeoutSec 30

$json = $result | ConvertTo-Json -Depth 100

# Remove hidden control characters that LaTeX cannot process.
# Keep normal tabs and line breaks.
$json = $json -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', ''

# Write only the cleaned JSON to standard output.
#[Console]::Out.Write($json)
# Write the JSON to standard output as explicit UTF-8 bytes.
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$stdout = [Console]::OpenStandardOutput()
$stdout.Write($utf8Bytes, 0, $utf8Bytes.Length)
$stdout.Flush()