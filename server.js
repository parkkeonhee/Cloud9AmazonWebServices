//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);
var formidable = require('formidable');

router.use(express.static(path.resolve(__dirname, 'client')));
var messages = [];
var sockets = [];

router.post('/', function(req, res){

  // create an incoming form object
  var form = new formidable.IncomingForm();

  // specify that we want to allow the user to upload multiple files in a single request
  form.multiples = true;

  // store all uploads in the /uploads directory
  // form.uploadDir = path.join(__dirname, '/uploads');

  // every time a file has been uploaded successfully,
  // rename it to it's orignal name
  form.on('file', function(field, file) {
    // Read a file from disk, store it in Redis, then read it back from Redis.

var redis = require("redis"),
    client = redis.createClient(6379, "myfirstcluster.lbf1q2.0001.use1.cache.amazonaws.com", {no_ready_check: true}),
    fs = require("fs"),
    filename = file.path+"/"+file.name;
    console.log(filename);

// Get the file I use for testing like this:
//    curl http://ranney.com/kids_in_cart.jpg -o kids_in_cart.jpg
// or just use your own file.

// Read a file from fs, store it in Redis, get it back from Redis, write it back to fs.
fs.readFile(filename, function (err, data) {
    if (err) throw err
    console.log("Read " + data.length + " bytes from filesystem.");
    
    client.set(filename, data, redis.print); // set entire file
    client.get(filename, function (err, reply) { // get entire file
        if (err) {
            console.log("Get error: " + err);
        } else {
            fs.writeFile("duplicate_" + filename, reply, function (err) {
                if (err) {
                    console.log("Error on write: " + err)
                } else {
                    console.log("File written.");
                }
                client.end();
            });
        }
    });
});
  });

  // log any errors that occur
  form.on('error', function(err) {
    console.log('An error has occured: \n' + err);
  });

  // once all the files have been uploaded, send a response to the client
  form.on('end', function() {
    res.end('success');
  });

  // parse the incoming request containing the form data
  form.parse(req);

});

io.on('connection', function (socket) {
    messages.forEach(function (data) {
      socket.emit('message', data);
    });

    sockets.push(socket);

    socket.on('disconnect', function () {
      sockets.splice(sockets.indexOf(socket), 1);
      updateRoster();
    });

    socket.on('message', function (msg) {
      var text = String(msg || '');

      if (!text)
        return;

      socket.get('name', function (err, name) {
        var data = {
          name: name,
          text: text
        };

        broadcast('message', data);
        messages.push(data);
      });
    });

    socket.on('identify', function (name) {
      socket.set('name', String(name || 'Anonymous'), function (err) {
        updateRoster();
      });
    });
  });

function updateRoster() {
  async.map(
    sockets,
    function (socket, callback) {
      socket.get('name', callback);
    },
    function (err, names) {
      broadcast('roster', names);
    }
  );
}

function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});
