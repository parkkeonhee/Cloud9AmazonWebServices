var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);
var formidable = require('formidable');

router.use(express.static(path.resolve(__dirname, 'client')));
var messages = [];
var sockets = [];

router.post('/', function(req, res) {

  // create an incoming form object
  var form = new formidable.IncomingForm();

  // specify that we want to allow the user to upload multiple files in a single request
  form.multiples = true;

  // every time a file has been uploaded successfully,
  // rename it to it's orignal name
  form.on('file', function(field, file) {

    // Read a file from disk, store it in Redis, then read it back from Redis.
    var redis = require("redis"),
      client = redis.createClient(6379, "myfirstcluster.lbf1q2.0001.use1.cache.amazonaws.com", {
        no_ready_check: true
      }),
      fs = require("fs"),

      // Directory that stores the JSON file.
      filename = file.path;

    // prints out the directory location of the uploaded JSON file.
    console.log("File successfully saved in: " + filename);

    // Read a file from fs, store it in Redis, get it back from Redis, write it back to fs.
    fs.readFile(filename, function(err, data) {
      if (err) throw err;
      console.log("Read " + data.length + " bytes from filesystem.");

      // set entire file
      client.set(filename, data, redis.print);
      
      // get entire file
      client.get(filename, function(err, reply) {
        if (err) {
          console.log("Get error: " + err);
        }
        else {
          fs.writeFile(filename, reply, function(err) {
            if (err) {
              console.log("Error on write: " + err);
            }
            else {
              console.log("File written.");
            }

            // node_redis: Using .end() without the flush parameter is deprecated and throws from v.3.0.0 on.
            // client.end(flush) forcibly close the connection to the Redis server.
            // Set flush to true.
            // If flush is set to false, then all running commands that are still running will silently fail.
            client.end(true);
          });
        }
      });
    });
  });

  // Log any occurring errors.
  form.on('error', function(err) {
    console.log('An error has occured: \n' + err);
  });

  // Send a response to the client after all the files have been uploaded.
  form.on('end', function() {
    res.end('success');
  });

  // Parse the incoming request containing the form data.
  form.parse(req);
});

io.on('connection', function(socket) {
  messages.forEach(function(data) {
    socket.emit('message', data);
  });

  sockets.push(socket);

  socket.on('disconnect', function() {
    sockets.splice(sockets.indexOf(socket), 1);
    updateRoster();
  });

  socket.on('message', function(msg) {
    var text = String(msg || '');

    if (!text)
      return;

    socket.get('name', function(err, name) {
      var data = {
        name: name,
        text: text
      };

      broadcast('message', data);
      messages.push(data);
    });
  });

  socket.on('identify', function(name) {
    socket.set('name', String(name || 'Anonymous'), function(err) {
      updateRoster();
    });
  });
});

function updateRoster() {
  async.map(
    sockets,
    function(socket, callback) {
      socket.get('name', callback);
    },
    function(err, names) {
      broadcast('roster', names);
    }
  );
}

function broadcast(event, data) {
  sockets.forEach(function(socket) {
    socket.emit(event, data);
  });
}

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function() {
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});