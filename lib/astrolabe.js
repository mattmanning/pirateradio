var log = require('log');
var utility = require('utility');

if (typeof(String.prototype.toRad) === "undefined") {
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }
}

var Astrolabe = function(settings) {
  this.handlers      = {};
  this.locations     = {};
  this.subscriptions = {};

  var astrolabe = this;

  function calculate_distance(loc1, loc2) {
    sys = require('sys');
    console.log('calculate_distance [' + sys.inspect(loc1) + '] [' + sys.inspect(loc2) + ']')
    log('calculate_distance')
    var R = 6371; // km
    var dLat = (loc2.latitude-loc1.latitude).toRad();
    var dLon = (loc2.longitude-loc1.longitude).toRad();
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(loc1.latitude.toRad()) * Math.cos(loc2.latitude.toRad()) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    console.log('a:' + a);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    console.log('c:' + a);
    var d = R * c;
    console.log('d:' + a);
    return d;
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

  this.remove = function(id) {
    (astrolabe.subscriptions[id] || []).forEach(function(sub) {
      utility.delete(astrolabe.subscriptions[id], sub);
      utility.delete(astrolabe.subscriptions[sub], id);
      astrolabe.handle('disconnect', id, sub);
      astrolabe.handle('disconnect', sub, id);
    });
    delete astrolabe.subscriptions[id];
    delete astrolabe.locations[id];
  }

  this.update = function(id, latitude, longitude) {
    log('astrolabe.update', { id:id, latitude:latitude, longitude:longitude })
    var location = { latitude:latitude, longitude:longitude }
    astrolabe.locations[id] = location;
    astrolabe.handle('update', id, location.latitude, location.longitude);

    (astrolabe.subscriptions[id] || []).forEach(function(sub) {
      var loc1 = astrolabe.locations[id];
      var loc2 = astrolabe.locations[sub];
      var distance = calculate_distance(loc1, loc2);
      log('astrolabe.update.distance', { id:id, sub:sub, distance:distance });
      if (distance > 5000) {
        utility.delete(astrolabe.subscriptions[id], sub);
        utility.delete(astrolabe.subscriptions[sub], id);
        astrolabe.handle('disconnect', id, sub);
        astrolabe.handle('disconnect', sub, id);
      }
    });

    for (var sub in astrolabe.locations) {
      var loc1 = astrolabe.locations[id];
      var loc2 = astrolabe.locations[sub];
      var distance = calculate_distance(loc1, loc2);
      log('astrolabe.update.distance', { id:id, sub:sub, distance:distance });
      if (distance < 5000) {
        if (!astrolabe.subscriptions[id])  { astrolabe.subscriptions[id]  = []; }
        if (!astrolabe.subscriptions[sub]) { astrolabe.subscriptions[sub] = []; }
        astrolabe.subscriptions[id].push(sub);
        astrolabe.subscriptions[sub].push(id);
        astrolabe.handle('connect', id, sub);
        astrolabe.handle('connect', sub, id);
      }
    }
  }
}

module.exports.create = function(settings) {
  return new Astrolabe(settings);
}
