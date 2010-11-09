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
    var R = 6371; // km
    var dLat = (loc2.latitude-loc1.latitude).toRad();
    var dLon = (loc2.longitude-loc1.longitude).toRad();
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(loc1.latitude.toRad()) * Math.cos(loc2.latitude.toRad()) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d * 1000;
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
      if (!astrolabe.subscriptions[id])  { astrolabe.subscriptions[id]  = []; }
      if (!astrolabe.subscriptions[sub]) { astrolabe.subscriptions[sub] = []; }
      utility.delete(astrolabe.subscriptions[id], sub);
      utility.delete(astrolabe.subscriptions[sub], id);
      astrolabe.handle('disconnect', id, sub);
      astrolabe.handle('disconnect', sub, id);
    });
    delete astrolabe.subscriptions[id];
    delete astrolabe.locations[id];
  }

  this.update = function(id, latitude, longitude, radius) {
    log('astrolabe.update', { id:id, lat:latitude, lng:longitude, rad:radius })
    var location = { latitude:latitude, longitude:longitude, radius:radius }
    astrolabe.locations[id] = location;
    astrolabe.handle('update', id, location.latitude, location.longitude, location.radius);

    (astrolabe.subscriptions[id] || []).forEach(function(sub) {
      var loc1 = astrolabe.locations[id];
      var loc2 = astrolabe.locations[sub];
      var distance = calculate_distance(loc1, loc2);
      log('astrolabe.update.distance', { id:id, sub:sub, distance:distance });
      if (distance > loc1.radius) {
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
      if (distance < loc1.radius) {
        if (!astrolabe.subscriptions[id])  { astrolabe.subscriptions[id]  = []; }
        if (!astrolabe.subscriptions[sub]) { astrolabe.subscriptions[sub] = []; }

        if (astrolabe.subscriptions[id].indexOf(sub) == -1) {
          astrolabe.subscriptions[id].push(sub);
          astrolabe.handle('connect', id, sub);
        }

        if (astrolabe.subscriptions[sub].indexOf(id) == -1) {
          astrolabe.subscriptions[sub].push(id);
          astrolabe.handle('connect', sub, id);
        }
      }
    }
  }
}

module.exports.create = function(settings) {
  return new Astrolabe(settings);
}
