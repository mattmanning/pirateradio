var express = require('express');
var io      = require('socket.io');
var log     = require('log');
var on      = require('on');
var user    = require('user');

var Hermes = function(settings) {
  this.app      = settings.app;
  this.master   = io.listen(this.app);
  this.sockets  = {};

  on.inject(this);

  var hermes = this;

  this.send = function(id, message) {
    var socket = this.sockets[id];
    if (socket) socket.send(JSON.stringify(message));
  }

  this.send_all = function(message) {
    for (var id in this.sockets) {
      this.send(id, message);
    }
  }

  this.position = function(to, from, position) {
    this.send(to, {
      type:'position',
      id:from,
      me:(from == to),
      latitude:position.latitude,
      longitude:position.longitude,
      radius:position.radius
    });
  }

  this.subscribe = function(to, from, user) {
    this.send(to, {
      type:'subscribe',
      id:from,
      user:user
    })
  }

  this.unsubscribe = function(to, from) {
    this.send(to, {
      type:'unsubscribe',
      id:from
    })
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
      log('hermes.connection.lookup', { id:user.id });
      hermes.sockets[user.id] = client;
      hermes.handle('connection', user.id);

      client.on('message', function(message) {
        var message = JSON.parse(message);
        message.message = message.message.substring(0, 140);
        message.timestamp = new Date();
        log('hermes.message', { id:user.id, type:message.type, ts:message.timestamp })
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
