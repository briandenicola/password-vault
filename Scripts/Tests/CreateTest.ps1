$url = "http://localhost:7071"

$questions = @()
$questions += (New-Object PSobject -Property @{
    Question = "What is my madien name?"
    Answer = "Are you kidding me"
})

$accountPassword = New-Object psobject -Property @{
    SiteName = "Example"
    AccountName = "brian@example.com"
    CurrentPassword = "this is a test password!!!!"

    SecurityQuestions = $questions
    isDeleted = $false 
    Notes = [string]::Empty
}

$headers = @{}
$headers.Add('x-functions-key', 'xyz')
Invoke-RestMethod -UseBasicParsing -Uri ("{0}/api/passwords/" -f $url)  -Method POST -ContentType "application/json" -Body (ConvertTo-Json $accountPassword) -Headers $headers