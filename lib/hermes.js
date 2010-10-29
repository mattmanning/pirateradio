var express = require('express');
var io      = require('socket.io');
var log     = require('log');
var user    = require('user');

var Hermes = function(settings) {
  this.app      = settings.app;
  this.master   = io.listen(this.app);
  this.handlers = {};
  this.sockets  = {};

  var hermes = this;

  this.position = function(id, position, me) {
    this.send(id, data);
    socket.send(JSON.stringify(data));    
  }

  this.send = function(id, message) {
    var socket = this.sockets[id];
    if (socket) socket.send(JSON.stringify(message));
  }

  this.send_all = function(message) {
    for (var id in this.sockets) {
      this.send(id, message);
    }
  }

  this.on = function(key, handler) {
    this.handlers[key] = handler;
  }

  this.handle = function() {
    var args = Array.prototype.slice.call(arguments);
    var name = args.shift();
    var handler = this.handlers[name];
    if (!handler) return;
    handler.apply(this, args);
  }

  this.each = function(callback) {
    for (var id in this.sockets) {
      callback(id, this.sockets[id]);
    }
  }

  this.master.on('connection', function(client) {
    express.cookieDecoder()(client.request, client.response, function(){});
    var identity = client.request.cookies['_pirate_radio_id'];
    log('hermes.connection', { identity:identity });

    user.lookup_by_identity(identity, function(user) {
      // TODO: update_position(uu);

      log('hermes.connection.lookup', { id:user.id });
      hermes.sockets[user.id] = client;
      hermes.handle('connection', user.id);

      // for (var id in sockets) {
      //   user.lookup(id, function(uuu) {
      //     update_socket_position(client, uuu, (uu.id === uuu.id))
      //   })
      // }

      client.on('message', function(message) {
        var message = JSON.parse(message);
        log('hermes.message', { id:user.id, type:message.type })
        hermes.handle('message', user.id, message);
      })

      client.on('disconnect', function() {
        log('hermes.disconnect', { id:user.id })
        delete hermes.sockets[user.id];
        hermes.send_all({ type:'remove', id:user.id });
        hermes.handle('disconnect', user.id);
      })
    });
  });
}

module.exports.create = function(settings) {
  return new Hermes(settings);
}
