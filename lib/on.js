var log     = require('log');
var utility = require('utility');

module.exports.inject = function(object) {
  object.handlers = {};

  object.on = function(key, handler) {
    this.handlers[key] = handler;
  }

  object.handle = function(name, result) {
    log('on.handle', { name:name, result:result });
    var handler = this.handlers[name];
    if (!handler) return;
    handler.call(this, null, result);
  }
}
