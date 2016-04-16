var WebSocket = require('ws');
var http = require('http');
var url = require('url');

var frontendUrl = process.argv[2]; // wss://example.com/
var serverUrl = process.argv[3];   // http://localhost:5000/

var parsedServerUrl = url.parse(serverUrl);

var ws = new WebSocket(frontendUrl);

ws.on('error', function(err) {
  console.log('ws error', err);
})

ws.on('message', function(data, flags) {
  var originalReq = JSON.parse(data);
  originalReq.headers.Host = parsedServerUrl.hostname;

  var req = http.request({
    protocol: 'http:',
    host: parsedServerUrl.hostname,
    port: parsedServerUrl.port,
    method: originalReq.method,
    path: originalReq.originalUrl,
    headers: originalReq.headers
  }, function(res) {
    var body = [];

    res.on('data', function(chunk) {
      body.push(chunk);
    });

    res.on('end', function() {
      ws.send(JSON.stringify({
        id: originalReq.id,
        status: res.statusCode,
        headers: res.headers,
        body: body.join('')
      }));
    });
  });

  req.on('error', function(err) {
    ws.send({
      id: originalReq.id,
      status: 500,
      body: err
    });
  })

  if (originalReq.body) {
    req.write(originalReq.body);
  }

  req.end();
});
