param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$GuidelineId,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$PestId,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SiteId,

    [string]$ChangedSince = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# The Lua shortcode expects standard output to contain JSON only.
# All status and error messages must therefore use standard error.
function Write-ErrorMessage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    [Console]::Error.WriteLine($Message)
}

function Get-EnvironmentValue {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )
 
    foreach ($name in $Names) {
        $value = [Environment]::GetEnvironmentVariable($name)

        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
    }

    return $null
}

function Get-HttpStatusDescription {
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord]$ErrorRecord
    )

    try {
        $response = $ErrorRecord.Exception.Response

        if ($null -ne $response) {
            $statusCode = [int]$response.StatusCode
            $statusDescription = $response.StatusDescription

            if (-not [string]::IsNullOrWhiteSpace($statusDescription)) {
                return "HTTP $statusCode ($statusDescription)"
            }

            return "HTTP $statusCode"
        }
    }
    catch {
        # Fall through to the general exception message.
    }

    return $ErrorRecord.Exception.Message
}

try {
    # The GUIDELINES_API_* names are preferred because they identify
    # exactly which application/API the values belong to.
    #
    # The shorter AUTH0_* names are also accepted for compatibility
    # with the environment variables you may already have configured.
    $auth0Domain = Get-EnvironmentValue -Names @(
        "GUIDELINES_API_AUTH0_DOMAIN",
        "AUTH0_DOMAIN"
    )

    $auth0ClientId = Get-EnvironmentValue -Names @(
        "GUIDELINES_API_AUTH0_CLIENT_ID",
        "AUTH0_CLIENT_ID",
        "AUTH0_CLIENT"
    )

    $auth0ClientSecret = Get-EnvironmentValue -Names @(
        "GUIDELINES_API_AUTH0_CLIENT_SECRET",
        "AUTH0_CLIENT_SECRET"
    )

    $auth0Audience = Get-EnvironmentValue -Names @(
        "GUIDELINES_API_AUTH0_AUDIENCE",
        "AUTH0_AUDIENCE"
    )

    $missingSettings = @()

    if ([string]::IsNullOrWhiteSpace($auth0Domain)) {
        $missingSettings += "GUIDELINES_API_AUTH0_DOMAIN or AUTH0_DOMAIN"
    }

    if ([string]::IsNullOrWhiteSpace($auth0ClientId)) {
        $missingSettings += "GUIDELINES_API_AUTH0_CLIENT_ID, AUTH0_CLIENT_ID, or AUTH0_CLIENT"
    }

    if ([string]::IsNullOrWhiteSpace($auth0ClientSecret)) {
        $missingSettings += "GUIDELINES_API_AUTH0_CLIENT_SECRET or AUTH0_CLIENT_SECRET"
    }

    if ([string]::IsNullOrWhiteSpace($auth0Audience)) {
        $missingSettings += "GUIDELINES_API_AUTH0_AUDIENCE or AUTH0_AUDIENCE"
    }

    if ($missingSettings.Count -gt 0) {
        throw (
            "Missing required environment variable(s): " +
            ($missingSettings -join "; ")
        )
    }

    # Accept either:
    #   newa-apps.auth0.com
    # or:
    #   https://newa-apps.auth0.com/
    $auth0Domain = $auth0Domain.TrimEnd("/")

    if ($auth0Domain -notmatch "^https?://") {
        $auth0Domain = "https://$auth0Domain"
    }

    $tokenUrl = "$auth0Domain/oauth/token"

    $tokenBody = @{
        client_id     = $auth0ClientId
        client_secret = $auth0ClientSecret
        audience      = $auth0Audience
        grant_type    = "client_credentials"
        scope         = "read:treatments"
    } | ConvertTo-Json -Compress

    try {
        $tokenResponse = Invoke-RestMethod `
            -Method Post `
            -Uri $tokenUrl `
            -ContentType "application/json" `
            -Body $tokenBody `
            -TimeoutSec 30
    }
    catch {
        $status = Get-HttpStatusDescription -ErrorRecord $_

        throw (
            "Auth0 could not issue an access token. " +
            "$status. Verify the Auth0 domain, client ID, client secret, " +
            "audience, and Machine-to-Machine API authorization."
        )
    }

    if (
        $null -eq $tokenResponse -or
        [string]::IsNullOrWhiteSpace($tokenResponse.access_token)
    ) {
        throw "Auth0 returned a response, but it did not contain an access token."
    }

    $apiBaseUrl = Get-EnvironmentValue -Names @(
        "GUIDELINES_API_BASE_URL"
    )

    if ([string]::IsNullOrWhiteSpace($apiBaseUrl)) {
        $apiBaseUrl = "https://webguidelines2.psep.cce.cornell.edu"
    }

    $apiBaseUrl = $apiBaseUrl.TrimEnd("/")

    if ($apiBaseUrl -notmatch "^https://") {
        throw "GUIDELINES_API_BASE_URL must use HTTPS."
    }

    $queryParameters = @(
        "guidelineId=$([Uri]::EscapeDataString($GuidelineId))"
        "pestId=$([Uri]::EscapeDataString($PestId))"
        "siteId=$([Uri]::EscapeDataString($SiteId))"
    )

    if (-not [string]::IsNullOrWhiteSpace($ChangedSince)) {
        $queryParameters +=
            "changedSince=$([Uri]::EscapeDataString($ChangedSince.Trim()))"
    }

    $apiUrl =
        "$apiBaseUrl/api/Treatments/search?" +
        ($queryParameters -join "&")

    $apiHeaders = @{
        Authorization = "Bearer $($tokenResponse.access_token)"
        Accept        = "application/json"
    }

    try {
        $result = Invoke-RestMethod `
            -Method Get `
            -Uri $apiUrl `
            -Headers $apiHeaders `
            -TimeoutSec 30
    }
    catch {
        $status = Get-HttpStatusDescription -ErrorRecord $_

        throw (
            "The Guidelines API treatment request failed. $status. " +
            "Verify that the online API is available and that the " +
            "Machine-to-Machine application has permission to read treatments."
        )
    }

    if ($null -eq $result) {
        throw "The Guidelines API returned an empty response."
    }

    try {
        $json = $result | ConvertTo-Json -Depth 100
    }
    catch {
        throw "The Guidelines API response could not be converted to JSON: $($_.Exception.Message)"
    }

    # Remove hidden control characters that LaTeX cannot process.
    # Preserve normal tabs, carriage returns, and line feeds.
    $json = $json -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', ''

    # Write only the successfully generated JSON to standard output,
    # encoded explicitly as UTF-8 without a byte-order mark.
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $utf8Bytes = $utf8.GetBytes($json)

    $stdout = [Console]::OpenStandardOutput()
    $stdout.Write($utf8Bytes, 0, $utf8Bytes.Length)
    $stdout.Flush()

    exit 0
}
catch {
    Write-ErrorMessage -Message (
        "Unable to retrieve pesticide treatment data: " +
        $_.Exception.Message
    )

    exit 1
}