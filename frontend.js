var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var Guid = require('guid');
var _ = require('lodash');

var currentWs = null;
var responses = {};

app.ws('/_connect', function(ws, req) {
  if (currentWs) {
    console.log('closing old ws');
    currentWs.terminate();
  }

  console.log('backend connected');

  ws.on('message', function(message) {
    var response = JSON.parse(message);
    var res = responses[response.id];
    if (res) {
      _.each(response.headers, function(value, name) {
        res.set(name, value);
      });

      res.status(response.status).send(response.body);
      delete responses[response.id];
    }
  });

  ws.on('close', function() {
    console.log('ws closed');
    if (currentWs === ws) {
      currentWs = null;
    }
  });

  currentWs = ws;
});

app.all('*', function(req, res) {
  if (currentWs) {
    var reqId = Guid.raw();
    var serializedReq = JSON.stringify({
      id: reqId,
      method: req.method,
      originalUrl: req.originalUrl,
      body: req.body,
      headers: req.headers
    });

    responses[reqId] = res;

    currentWs.send(serializedReq)
  } else {
    res.status(500).send('no backend\n');
  }
});

app.listen(process.env.PORT || 5000);
