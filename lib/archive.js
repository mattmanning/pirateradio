var log = require('log');
var postgres = require('postgres');
var utility = require('utility');

var Archive = function(settings) {
  this.db = postgres.createConnection(settings.psql);

  this.db.addListener("connect", function() {
    this.query("create table messages (from_id varchar(40), message varchar(140), date timestamp)")
    this.query("select AddGeometryColumn('messages', 'location', -1, 'POINT', 2)")
  })

  var archive = this;

  this.save = function(user, message) {
    archive.db.query("insert into messages (from_id, message, date, location) values ('" + user.id + "', '" + message.message.replace("'", "\\'") + "', current_timestamp, ST_GeomFromText('POINT(" + user.position.longitude + " " + user.position.latitude + ")'))");
  }

  this.catchup = function(user, callback) {
    log('archive.catchup', { user:user });
    archive.db.query("select * from messages where st_distance(ST_GeomFromText('POINT(" + user.position.longitude + " " + user.position.latitude + ")'),location)*111120 < " + user.position.radius + "order by date desc limit 50", function(err, rows) {
      rows.forEach(function(row) {
        callback({
          from: row[0],
          type: 'message',
          message: row[1],
        })
      })
    })
  }
}

module.exports.create = function(settings) {
  return new Archive(settings);
}
