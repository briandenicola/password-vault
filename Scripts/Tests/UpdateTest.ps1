param(
    [string] $id
)

$url = "http://localhost:7071"

$accountPassword = Invoke-RestMethod -UseBasicParsing -Uri ("{0}/api/passwords/{1}" -f $url, $id)  -Method GET -ContentType "application/json"

$securtiy = New-Object psobject -Property @{
    Question = "Madien Name"
    Answer = "Smith"
}
$accountPassword.SecurityQuestions += @($securtiy)
$accountPassword.CurrentPassword = "this is a ninth test password!!!!" 
$accountPassword.Notes = "This is an update to the record"

Invoke-RestMethod -UseBasicParsing -Uri ("{0}/api/passwords/{1}" -f $url, $id)  -Method PUT -ContentType "application/json" -Body (ConvertTo-Json $accountPassword) -Debug -Verbose