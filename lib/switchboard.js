var log     = require('log');
var on      = require('on');
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
    this.parent.redis.publish(this.id, JSON.stringify({
      text: message
    }));
  }

  this.redis.on("message", function(channel, message) {
    var message = JSON.parse(message);
    log('switchboard.endpoint.message', message);

    endpoint.parent.handle('message', channel, endpoint.id, message.text);
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
      utility.delete(this.subscriptions, id);
    }
  }

  this.unsubscribe_all = function() {
    log('switchboard.endpoint.unsubscribe_all', { from:this.id });
    this.redis.unsubscribe();
    this.subscriptions = [];
  }

  this.close = function() {
    this.unsubscribe_all();
  }
}

var Switchboard = function(settings) {
  this.settings  = (settings || {});
  this.redis     = redis.createClient();
  this.endpoints = {};

  on.inject(this);

  this.endpoint = function(id) {
    var endpoint = (this.endpoints[id] || new Endpoint(this, id));
    this.endpoints[id] = endpoint;
    return endpoint;
  }

  this.remove = function(id) {
    delete this.endpoints[id];
  }
}

module.exports.create = function(settings) {
  return new Switchboard(settings);
}
