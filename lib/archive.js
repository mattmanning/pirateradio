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
}

module.exports.create = function(settings) {
  return new Archive(settings);
}
