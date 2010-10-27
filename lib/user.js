var couchdb = require('couchdb');
var log     = require('log');
var utility = require('utility');

var db = null;

function create_database(settings) {
  log('user.create_database', settings);

  var settings = settings || {};

  db = couchdb.createClient(
    settings.port || 5984,
    settings.host || 'localhost'
  ).db(
    settings.database || 'pirateradio'
  );

  if (!db.exists()) db.create();

  db.saveDesign('users', {
    views: {
      'by_identity': {
        map: function(doc) {
          if (doc.identity) {
            emit(doc.identity, doc);
          }
        }
      }
    }
  });

  return db;
}

function build_user(data) {
  var data = data || {};

  log('user.build_user', { id:data.id, identity:pretty(data.identity) });

  var user = utility.clone(data);

  if (!user.id) {
    user.id = Hash.sha1((new Date()).toString() + Math.random());
  }

  user.update = function(params) {
    var new_data = utility.clone(this);;
    var changes  = false;
    var u = this;
    utility.keys(params).forEach(function(key) {
      if (new_data[key] != params[key]) changes = true;
      new_data[key] = params[key];
      u[key] = params[key];
    });
    delete new_data['update'];
    if (changes) db.saveDoc(this.id, new_data);
  }

  return user;
}

function pretty(id) {
  var id = id || '';
  return id.substring(0, 6);
}

module.exports.database = function(settings) {
  log('user.database', settings);

  if (settings) create_database(settings);
  if (!db)      create_database(settings);

  return db;
}

module.exports.lookup = function(id, callback) {
  log('user.lookup', { id:id });

  module.exports.database().getDoc(id, function(error, user) {
    log('user.lookup.get', { id:(user && user.id) })
    callback(build_user(user));
  });
}

module.exports.lookup_by_identity = function(identity, callback) {
  log('user.lookup_by_identity', { identity:pretty(identity) });

  module.exports.database().view('users', 'by_identity', {limit:1, startkey:identity}, function(error, data) {
    var user = data.rows[0] && data.rows[0].value;
    log('user.lookup_by_identity.get', { identity:(user && pretty(user.identity)) })

    var user = build_user(user);
    user.update({ identity:identity });
    callback(user);
  });
}

module.exports.middleware = function(settings) {
  log('user.middleware', settings);

  return function(request, response, next) {
    module.exports.lookup_by_identity(request.identity, function(user) {
      log('user.middleware.call', { identity:pretty(request.identity) });
      request.user = user;
      user.update({ identity: request.identity });
      next();
    })
  }
}
