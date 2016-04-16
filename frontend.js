var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var Guid = require('guid');
var _ = require('lodash');

var currentWs = null;
var responses = {};

if (!process.env.TOKEN) {
  console.log('You must supply a TOKEN in the environment.');
  process.exit(1);
}

app.ws('/_connect', function(ws, req) {
  if (req.get('Authorization') !== `Token ${process.env.TOKEN}`) {
    console.log('Closing rogue ws connection');
    ws.terminate();
    return;
  }

  if (currentWs) {
    console.log('closing old ws');
    currentWs.terminate();
  }

  console.log('backend connected');

  ws.on('message', function(message, flags) {
    if (!message) {
      console.log('ignoring empty message');
      return;
    }

    var response = null;
    try {
      var response = JSON.parse(message);
    } catch (e) {
      console.log('error parsing', e);
      ws.terminate();
      return;
    }

    console.log('got response from backend', response.id, response.statusCode);

    var res = responses[response.id];
    if (res) {
      _.each(response.headers, function(value, name) {
        res.set(name, value);
      });

      res.status(response.status).send(response.body);
      delete responses[response.id];
    }
  });

  ws.on('error', function(err) {
    console.log('ws error', err);
  });

  ws.on('close', function() {
    console.log('backend disconnected');
    if (currentWs === ws) {
      currentWs = null;
    }
  });

  currentWs = ws;
});

app.all('*', function(req, res) {
  console.log('got request', req.originalUrl);

  var body = [];
  req.on('data', function(chunk) {
    body.push(chunk);
  });

  req.on('end', function() {
    if (currentWs) {
      var reqId = Guid.raw();
      var serializedReq = JSON.stringify({
        id: reqId,
        method: req.method,
        originalUrl: req.originalUrl,
        body: body.join(),
        headers: req.headers
      });

      responses[reqId] = res;

      currentWs.send(serializedReq)
      console.log('send request to backend with id', reqId);
    } else {
      console.log('no backend');
      res.status(500).send('no backend\n');
    }
  });
});

app.listen(process.env.PORT || 5000);
console.log('frontend listening');
