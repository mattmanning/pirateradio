var couchdb = require('couchdb');

module.exports.lookup = function(id, callback) {
  var client = couchdb.createClient(5984, 'localhost');
  var db = client.db('pirateradio');

  if (!db.exists()) db.create();

  db.getDoc(id, function(error, user) {
    user = user || {};
    user.identity = id;
    user.update = function(params) {
      for (var key in params) {
        this[key] = params[key];
      }
      db.saveDoc(id, this);
    }
    callback(user);
  }); 
}

module.exports.middleware = function(settings) {
  return function(request, response, next) {
    module.exports.lookup(request.identity, function(user) {
      request.user = user
      next();
    })
  }
}
