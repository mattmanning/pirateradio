require.paths.unshift('lib');

var auth     = require('connect-auth');
var identity = require('connect-identity');
var express  = require('express');
var postgres = require('postgres');
var redis    = require('redis-node');
var sys      = require('sys');
var user     = require('user');

var MemoryStore = require('connect/middleware/session/memory');

var pgdb = postgres.createConnection("host='' dbname='pirateradio'")

var redis_sub = redis.createClient();
redis_sub.select(2);

var redis_pub = redis.createClient();
redis_pub.select(2);

var app = express.createServer(
  express.bodyDecoder(),
  express.cookieDecoder(),
  express.session(),
  identity({ cookie: '_pirate_radio_id' }),
  user({ host: 'localhost', port: 5984 })
);

var twitter = require('twitter-connect').createClient({
  consumerKey:    'SL0d7ouDmx4HbjKrx3Cp9Q',
  consumerSecret: 'JUM2ZnY3AwzFQ8U5qb05ZVsvrGymRlVdO3mptvJGec'
});

app.get('/', function(request, response) {
  response.render('index.haml', { locals: {
    identify_partial: (request.user.auth) ?
      response.partial('identified.haml', { locals: { name: request.user.auth.name }}) :
      response.partial('identify.haml')
  }});
});

app.get('/auth/twitter', function(request, response) {
  twitter.authorize(request, response, function(error, api) {
    api.get('/account/verify_credentials.json', function(error, data) {
      request.user.update({ auth: { type:'twitter', name:data.screen_name }})
      response.redirect('/');
    });
  });
});

var EARTH_RADIUS = 6378137.0;

var subscribers = {}
function subscriber_for(id) {
  var subscriber = subscribers[id];
  if (!subscriber) {
    subscribers[id] = subscriber = redis.createClient();
    subscriber.select(2);
  }
  return subscriber;
}

app.post('/position', function(request, response) {
  var latitude  = parseFloat(request.body.latitude);
  var longitude = parseFloat(request.body.longitude);

  console.log('found position [' + latitude + ',' + longitude + ']');

  pgdb.query("delete from locations where id = '" + request.identity + "'");
  pgdb.query("insert into locations (id, radius, located_at, location) values (" +
    "'" + request.identity + "',1609,now()," +
    "ST_Transform(ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 4326), 900913));",
    function(error) {
      pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l1.radius WHERE l1.id = '" + request.identity + "';", function(error, rows) {
        rows.forEach(function(row) {
          console.log('subscribe to: ' + row[0]);
          var listener = request.identity;
          var poster   = row[0];
          subscriber_for(listener).subscribeTo(poster, function(channel, msg) {
            console.log('listener: ' + listener);
            console.log('poster:   ' + poster);
            console.log('channel:  ' + channel);
            console.log('msg:      ' + msg);
          });
        })
      });
      pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l2.radius WHERE l1.id = '" + request.identity + "';", function(error, rows) {
        rows.forEach(function(row) {
          console.log('tell subscribe to: ' + row[0]);
          var listener = row[0];
          var poster   = request.identity;
          subscriber_for(poster).subscribeTo(listener, function(channel, msg) {
            console.log('listener: ' + listener);
            console.log('poster:   ' + poster);
            console.log('channel:  ' + channel);
            console.log('msg:      ' + msg);
          });
        })
      });
    }
  );

  request.user.update({
    position: {
      latitude:  latitude,
      longitude: longitude
    }
  });
});

app.post('/message', function(request, response) {
  console.log('publishing: ' + request.body.text);
  redis_pub.publish('queue:' + request.identity, request.body.text);
});

app.get('/assets/:name.css', function(request, response) {
  var sass = __dirname + '/assets/styles/' + request.params.name + '.sass';
  response.headers['Content-Type'] = 'text/css';
  response.render(sass, { layout: false });
});

app.get('/assets/:name.js', function(request, response) {
  var js = __dirname + '/assets/scripts/' + request.params.name + '.js';
  response.headers['Content-Type'] = 'text/javascript';
  response.sendfile(js);
});

app.listen(process.env.PORT || 3000);
