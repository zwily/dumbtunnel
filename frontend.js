var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var Guid = require('guid');
var _ = require('lodash');

var connections = {};
var responses = {};

var ID_REGEX = /(DUMBTUNNEL-\w{10})/;

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

  var id = req.query.id;
  if (!id || !id.match(ID_REGEX)) {
    console.log('Closing ws connection with invalid id', id);
    ws.terminate();
    return;
  }

  if (connections[id]) {
    console.log(id, 'closing old ws');
    connections[id].terminate();
    delete connections[id];
  }

  connections[id] = ws;
  console.log(id, 'backend connected for ');

  ws.on('message', function(message, flags) {
    if (!message) {
      console.log(id, 'ignoring empty message');
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

    console.log(id, 'got response from backend', response.id, response.statusCode);

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
    console.log(id, 'ws error', err);
  });

  ws.on('close', function() {
    console.log(id, 'backend disconnected');
    if (connections[id] === ws) {
      delete connections[id];
    }
  });
});

app.all('*', function(req, res) {
  console.log('got request', req.originalUrl);

  var match = req.url.match(ID_REGEX);
  if (!match) {
    console.log('no id found', req.url);
    res.status(500).send('no id found\n');
    return;
  }

  var id = match[1];

  var body = [];
  req.on('data', function(chunk) {
    body.push(chunk);
  });

  req.on('end', function() {
    var ws = connections[id];

    if (ws) {
      var reqId = Guid.raw();
      var serializedReq = JSON.stringify({
        id: reqId,
        method: req.method,
        originalUrl: req.originalUrl,
        body: body.join(),
        headers: req.headers
      });

      responses[reqId] = res;

      ws.send(serializedReq)
      console.log(id, 'send request to backend with id', reqId);
    } else {
      console.log(id, 'no backend');
      res.status(500).send('no backend\n');
    }
  });
});

app.listen(process.env.PORT || 5000);
console.log('frontend listening');
