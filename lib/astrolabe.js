var log = require('log');

var Astrolabe = function(settings) {
  this.postgres = require('postgres').createConnection(settings.psql);
  this.handlers = {};

  var astrolabe = this;
  var postgres = this.postgres;

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
    postgres.query("delete from locations where id = '" + id + "'");    
  }

  this.update = function(id, position) {
    log('astrolabe.update', { id:id, lat:position.latitude, lng:position.longitude })

    var latitude = position.latitude;
    var longitude = position.longitude;

    if (this.handlers.update) this.handlers.update(id);
    astrolabe.handle('update', id);

    console.log("insert into locations (id, radius, located_at, location) values (" +
      "'" + id + "',1600,now()," +
      //"ST_Transform(ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 4326), 900913));",
      "ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 900913));");

    postgres.query("delete from locations where id = '" + id + "'");
    postgres.query("insert into locations (id, radius, located_at, location) values (" +
      "'" + id + "',1600,now()," +
      //"ST_Transform(ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 4326), 900913));",
      "ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 900913));",
      function(error) {
        console.log("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON (ST_Distance(l1.location, l2.location)*100000) < l1.radius WHERE l1.id = '" + id + "';");
        postgres.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON (ST_Distance(l1.location, l2.location)*100000) < l1.radius WHERE l1.id = '" + id + "';", function(error, rows) {
          if (rows) {
            rows.forEach(function(row) {
              var listener = id;
              var poster   = (row.id || row[0]);
              log('astrolabe.subscribe', { listener:listener, poster:poster })
              astrolabe.handle('subscribe', listener, poster);
            })
          }
        });
        console.log("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON (ST_Distance(l1.location, l2.location)*100000) < l2.radius WHERE l1.id = '" + id + "';");
        postgres.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON (ST_Distance(l1.location, l2.location)*100000) < l2.radius WHERE l1.id = '" + id + "';", function(error, rows) {
          if (rows) {
            rows.forEach(function(row) {
              var listener = (row.id || row[0]);
              var poster   = id;
              log('astrolabe.subscribe', { listener:listener, poster:poster })
              astrolabe.handle('subscribe', listener, poster);
            })
          }
        });
      }
    );
  }    
}

module.exports.create = function(settings) {
  return new Astrolabe(settings);
}
