#!/usr/bin/env node

var express = require('express');
var app = express();

app.get('/', function (req, res) {
    //
    // CORS
    //
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send('Hello World!');
});

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});
