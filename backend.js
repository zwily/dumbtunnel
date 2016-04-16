var WebSocket = require('ws');
var http = require('http');
var url = require('url');

var frontendUrl = process.env.FRONTEND_URL; // wss://example.com
var serverUrl = process.env.SERVICE_URL;   // http://localhost:5000
var token = process.env.TOKEN;

var parsedServerUrl = url.parse(serverUrl);

function reconnect() {
  console.log('connecting to frontend');

  var ws = new WebSocket(frontendUrl + '/_connect', {
    headers: {
      authorization: `Token ${token}`
    }
  });

  var pingInterval = null;
  ws.on('open', function() {
    console.log('connected to frontend');

    pingInterval = setInterval(function() {
      ws.ping(null, null, true);
    }, 10000);
  });

  ws.on('error', function(err) {
    console.log('ws error', err);
  });

  ws.on('close', function(code, message) {
    console.log('ws close', code, message);

    if (pingInterval) {
      clearInterval(pingInterval);
    }

    reconnect();
  });

  ws.on('message', function(data, flags) {
    var originalReq = null;
    try {
      originalReq = JSON.parse(data);
    } catch (e) {
      console.log('error parsing message', e);
      return;
    }

    console.log('received request from frontend', originalReq.method, originalReq.originalUrl);

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
        console.log('sending response to frontend', res.statusCode);

        ws.send(JSON.stringify({
          id: originalReq.id,
          status: res.statusCode,
          headers: res.headers,
          body: body.join('')
        }));
      });
    });

    req.on('error', function(err) {
      console.log('got error from service', err);

      ws.send({
        id: originalReq.id,
        status: 500,
        body: err
      });
    });

    if (originalReq.body) {
      req.write(originalReq.body);
    }

    req.end();
  });
}

reconnect();
