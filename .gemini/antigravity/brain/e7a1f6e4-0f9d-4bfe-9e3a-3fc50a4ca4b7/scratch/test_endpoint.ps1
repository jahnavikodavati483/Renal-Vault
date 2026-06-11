# Read test image and convert to base64
$imagePath = "c:\Users\jahnavi kodavati\Downloads\sai-krishna-main\sai-krishna-main\test_report.png"
$bytes = [System.IO.File]::ReadAllBytes($imagePath)
$base64 = [System.Convert]::ToBase64String($bytes)

# Define prompt
$prompt = "Extract eGFR, Creatinine, and BUN from the image. Return JSON."

# Create JSON body
$body = @{
    base64 = $base64
    prompt = $prompt
} | ConvertTo-Json

# Send request to Vercel
Write-Host "Sending request to Vercel api/extractVision..."
try {
    $response = Invoke-RestMethod -Uri "https://sai-krishna-main.vercel.app/api/extractVision" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "Success! Response received:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error occurred:"
    $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    }
}
