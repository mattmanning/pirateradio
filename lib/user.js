var couchdb = require('couchdb');

module.exports = function(settings) {
  var client = couchdb.createClient(
    settings.port || 5984,
    settings.host || 'localhost'
  );

  var db = client.db('pirateradio');

  if (!db.exists()) db.create();

  return function(request, response, next) {
    db.getDoc(request.identity, function(error, user) {
      user = user || {};
      request.user = user;
      user.update = function(params) {
        for (var key in params) {
          this[key] = params[key];
        }
        db.saveDoc(request.identity, this);
      }
      next();
    });
  }
}
