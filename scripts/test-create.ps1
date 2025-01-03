param(
    $url = "http://localhost:7071",
    $key,
    $siteName
)

$questions = @()
$questions += (New-Object PSobject -Property @{
    Question = "What is my madien name?"
    Answer = (New-Guid).ToString('N').Substring(10)   
})

$pass = (New-Guid).ToString('N').Substring(20)
$accountPassword = New-Object psobject -Property @{
    SiteName = $siteName
    AccountName = "sample@example.com"
    CurrentPassword = $pass

    SecurityQuestions = $questions
    isDeleted = $false 
    Notes = [string]::Empty
}

$opts = @{
    Method = "POST"
    ContentType = "application/json"
    Body = (ConvertTo-Json $accountPassword)
}

if( $url -imatch "localhost" ) {
    $opts.Add("Uri",("{0}/api/passwords/" -f $url))
}
else {
    $opts.Add("Uri",("{0}/api/passwords?code={1}" -f $url,$key))
}

Invoke-RestMethod -UseBasicParsing @opts
Write-Host "Password is set to $pass"