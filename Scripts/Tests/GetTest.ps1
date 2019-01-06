param (
    [string] $id
)

$url = "http://localhost:7071"

Write-Host "Getting All ..."
Invoke-RestMethod -UseBasicParsing -Uri ("{0}/api/passwords/" -f $url)  -Method GEt -ContentType "application/json"

Write-Host "Getting $id ..."
Invoke-RestMethod -UseBasicParsing -Uri ("{0}/api/passwords/{1}" -f $url, $id)  -Method GET -ContentType "application/json"