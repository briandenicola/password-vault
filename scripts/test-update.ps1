param(
    $url = "http://localhost:7071",
    $key,
    $id,
    $AccountName
)

$opts = @{
    Method = "Get"
    ContentType = "application/json"
}

if( $url -imatch "localhost" ) {
    $opts.Add("Uri",("{0}/api/passwords/{1}" -f $url,$id))
}
else {
    $opts.Add("Uri",("{0}/api/passwords/{1}?code={2}" -f $url,$id,$key))
}

$accountPassword = Invoke-RestMethod -UseBasicParsing @opts

$securtiy = New-Object psobject -Property @{
    Question = "Favoite Pet"
    Answer = "Snakes"
}
$pass = (New-Guid).ToString('N').Substring(20)
$accountPassword.AccountName = $AccountName
$accountPassword.SecurityQuestions += @($securtiy)
$accountPassword.CurrentPassword = $pass
$accountPassword.Notes = "This is an update to the record"

$opts.Method = "PUT"
$opts.Add("Body", (ConvertTo-Json $accountPassword) )
Invoke-RestMethod -UseBasicParsing @opts

Write-Host "New password is $pass"
