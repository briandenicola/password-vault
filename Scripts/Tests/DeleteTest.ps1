param(
    [string] $id
)

$url = "http://localhost:7071"

Write-Host "Deleting $id ..."
Invoke-RestMethod -UseBasicParsing -Uri ("{0}/api/passwords/{1}" -f $url,$id)  -Method Delete -ContentType "application/json"