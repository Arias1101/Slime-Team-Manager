# Lightweight PowerShell Static HTTP Server
$port = 8080
$H = New-Object System.Net.HttpListener
$H.Prefixes.Add("http://localhost:$port/")
$H.Start()
Write-Host "Server running at http://localhost:$port/"
Write-Host "Press Ctrl+C in terminal to stop."

while ($H.IsListening) {
    try {
        $context = $H.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        
        $localPath = Join-Path (Get-Location) $path.TrimStart('/')
        
        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            
            # Content Types
            if ($localPath.EndsWith(".html")) { $response.ContentType = "text/html" }
            elseif ($localPath.EndsWith(".css")) { $response.ContentType = "text/css" }
            elseif ($localPath.EndsWith(".js")) { $response.ContentType = "application/javascript" }
            elseif ($localPath.EndsWith(".png")) { $response.ContentType = "image/png" }
            
            $response.ContentLength64 = $bytes.Length
            $response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            $response.Headers["Pragma"] = "no-cache"
            $response.Headers["Expires"] = "0"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    } catch {
        # Listener closed or aborted
    }
}
