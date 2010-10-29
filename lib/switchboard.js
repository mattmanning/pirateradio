var log     = require('log');
var redis   = require('redis');
var utility = require('utility');
var user    = require('user');

var Endpoint = function(parent, id) {
  this.id            = id;
  this.parent        = parent;
  this.redis         = redis.createClient();
  this.subscriptions = [];

  var endpoint = this;

  this.publish = function(message) {
    log('switchboard.endpoint.publish', { id:this.id, message:message });
    console.log(require('sys').inspect(this.subscriptions));
    this.parent.redis.publish(this.id, JSON.stringify({
      text: message
    }));
  }

  this.redis.on("message", function(channel, message) {
    var message = JSON.parse(message);
    log('switchboard.endpoint.message', message);

    var handler = endpoint.parent.handlers.message;
    if (handler) handler(channel, endpoint.id, message.text);
  });

  this.subscribe = function(id) {
    if (this.subscriptions.indexOf(id) == -1) {
      log('switchboard.endpoint.subscribe', { from:this.id, to:id });
      this.redis.subscribe(id);
      this.subscriptions.push(id);
    }
  }

  this.unsubscribe = function(id) {
    if (this.subscriptions.indexOf(id) != -1) {
      log('switchboard.endpoint.unsubscribe', { from:this.id, to:id })
      this.redis.unsubscribe(id);
      this.subscriptions.splice(this.subscriptions.indexOf(id));
    }
  }

  this.unsubscribe_all = function() {
    log('switchboard.endpoint.unsubscribe_all', { from:this.id });
    for (var id in utility.clone(this.subscriptions)) {
      this.unsubscribe(id);
    }
  }

  this.close = function() {
    this.unsubscribe_all();
  }
}

var Switchboard = function(settings) {
  this.settings  = (settings || {});
  this.redis     = redis.createClient();
  this.endpoints = {};
  this.handlers  = {};

  this.endpoint = function(id) {
    var endpoint = (this.endpoints[id] || new Endpoint(this, id));
    this.endpoints[id] = endpoint;
    return endpoint;
  }

  this.on = function(key, handler) {
    this.handlers[key] = handler;
  }

  this.remove = function(id) {
    delete this.endpoints[id];
  }
}

module.exports.create = function(settings) {
  return new Switchboard(settings);
}
