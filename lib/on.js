var utility = require('utility');

module.exports.inject = function(object) {
  object.handlers = {};

  object.on = function(key, handler) {
    this.handlers[key] = handler;
  }

  object.handle = function() {
    var args = Array.prototype.slice.call(arguments);
    var name = args.shift();
    var handler = this.handlers[name];
    if (!handler) return;
    handler.apply(this, args);
  }
}
