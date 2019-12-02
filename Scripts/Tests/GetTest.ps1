param(
    $url = "http://localhost:7071",
    $key,
    $id
)

Write-Host "Getting All ..."

$opts = @{
    Method = "Get"
    ContentType = "application/json"
}

if( $url -imatch "localhost" ) {
    $opts.Add("Uri",("{0}/api/passwords/" -f $url))
}
else {
    $opts.Add("Uri",("{0}/api/passwords?code={1}" -f $url,$key))
}

Invoke-RestMethod -UseBasicParsing @opts

if( $nul -ne $id ) {
    Write-Host "Getting  $id ..."
    if( $url -imatch "localhost" ) {
        $opts.Uri = ("{0}/api/passwords/{1}" -f $url,$id)
    }
    else {
        $opts.Uri = ("{0}/api/passwords/{1}?code={2}" -f $url,$id,$key)
    }

    Invoke-RestMethod -UseBasicParsing @opts
}