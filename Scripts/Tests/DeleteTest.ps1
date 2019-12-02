param(
    $url = "http://localhost:7071",
    $key,
    $id
)

Write-Host "Deleting $id ..."

$opts = @{
    Method = "Delete"
    ContentType = "application/json"
}

if( $url -imatch "localhost" ) {
    $opts.Add("Uri",("{0}/api/passwords/{1}" -f $url,$id))
}
else {
    $opts.Add("Uri",("{0}/api/passwords/{1}?code={2}" -f $url,$id,$key))
}

Invoke-RestMethod -UseBasicParsing @opts