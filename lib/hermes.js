var log     = require('log');
var redis   = require('redis');
var utility = require('utility');
var user    = require('user');

var Endpoint = function(hermes, id) {
  this.id            = id;
  this.hermes        = hermes;
  this.redis         = redis.createClient();
  this.subscriptions = [];

  var endpoint = this;

  this.publish = function(message) {
    log('hermes.endpoint.publish', { id:this.id, message:message });

    this.hermes.redis.publish(this.id, JSON.stringify({
      text: message
    }));
  }

  this.redis.on("message", function(channel, message) {
    var message = JSON.parse(message);
    log('hermes.endpoint.message', message);

    var handler = endpoint.hermes.handlers['message'];
    if (handler) handler(channel, endpoint.id, message.text);
  });

  this.subscribe = function(id) {
    if (this.subscriptions.indexOf(id) == -1) {
      log('hermes.endpoint.subscribe', { from:this.id, to:id });
      this.redis.subscribe(id);
      this.subscriptions.push(id);
    }
  }

  this.unsubscribe = function(id) {
    if (this.subscriptions.indexOf(id) != -1) {
      log('hermes.endpoint.unsubscribe', { from:this.id, to:id })
      this.unsubscribe(id);
      this.subs.splice(this.subs.indexOf(id));
    }
  }

  this.unsubscribe_all = function() {
    for (var id in utility.clone(this.subscriptions)) {
      this.unsubscribe(id);
    }    
  }

  this.close = function() {
    this.unsubscribe_all();
  }
}

var Hermes = function(settings) {
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
  return new Hermes(settings);
}
