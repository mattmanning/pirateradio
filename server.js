require.paths.unshift('lib');

var auth     = require('connect-auth');
var identity = require('connect-identity');
var io       = require('socket.io');
var express  = require('express');
var postgres = require('postgres');
var redis    = require('redis');
var sys      = require('sys');
var user     = require('user');

var MemoryStore = require('connect/middleware/session/memory');

var pgdb = postgres.createConnection("host='' dbname='pirateradio'")

//var redis_sub = redis.createClient();
//redis_sub.select(2);

function pretty(id) {
  return id.substring(0, 6);
}

var redis_pub = redis.createClient();
redis_pub.select(2);

// redis_sub.on("message", function(channel, message) {
//   console.log('wee4');
//   console.log('channel: ' + sys.inspect(channel));
//   console.log('message: ' + sys.inspect(JSON.parse(message)));
// });

var app = express.createServer(
  express.bodyDecoder(),
  express.cookieDecoder(),
  express.session(),
  identity({ cookie: '_pirate_radio_id' }),
  user.middleware({ host: 'localhost', port: 5984 })
);

var socket = io.listen(app);

var sockets = {};

socket.on('connection', function(client) {
  express.cookieDecoder()(client.request, client.response, function(){});
  var id = client.request.cookies['_pirate_radio_id'];
  sockets[id] = client;

  user.lookup(id, function(user) {
    update_position(user);
  });

  console.log('id is: ' + pretty(id));
  //console.log('connected, client is: ' + sys.inspect(client));
  //identity
  client.on('message', function(message) {
    var message = JSON.parse(message);

    console.log('id is: ' + pretty(id));
    console.log('message is: ' + sys.inspect(message));
    console.log('type: ' + message.type);
    switch (message.type) {
      case 'message':
        console.log('hi');
        redis_pub.publish(id, JSON.stringify({
          from: id,
          text: message.message
        }));
        break;
    }
  })

  client.on('disconnect', function() {
    express.cookieDecoder()(this.request, this.response, function(){});
    console.log("delete from locations where id = '" + id + "'");
    pgdb.query("delete from locations where id = '" + id + "'");
    delete sockets[id];
    delete subscribers[id];
  })
});

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
      console.log('ERROR: ' + error);
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
    subscriber.id = id;
    subscriber.select(2);
    subscriber.on("message", function(channel, message) {
      var message = JSON.parse(message);
      user.lookup(message.from, function(user) {
        var from = user.auth ? user.auth.name : 'Anonymous';

        var socket = sockets[id];
        if (socket) {
          console.log('sending to: ' + pretty(id));
          socket.send(JSON.stringify({
            type:'message',
            from:from,
            message:message.text
          }))
        }
      });

      console.log('channel: ' + sys.inspect(channel));
      console.log('id: ' + pretty(this.id));
      console.log('message: ' + sys.inspect(message));
    });
  }
  return subscriber;
}

function update_position(user) {
  if (!user.position) return;

  console.log('id: ' + user.identity);

  var latitude = user.position.latitude;
  var longitude = user.position.longitude;

  console.log('found [' + pretty(user.identity) + '] position [' + latitude + ',' + longitude + ']');

  pgdb.query("delete from locations where id = '" + user.identity + "'");
  pgdb.query("insert into locations (id, radius, located_at, location) values (" +
    "'" + user.identity + "',1609,now()," +
    "ST_Transform(ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 4326), 900913));",
    function(error) {
      pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l1.radius WHERE l1.id = '" + user.identity + "';", function(error, rows) {
        rows.forEach(function(row) {
          var listener = user.identity;
          var poster   = row[0];
          subscriber_for(listener).subscribe(poster);
          console.log(pretty(listener) + ' subscribing to ' + pretty(poster));
        })
      });
      pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l2.radius WHERE l1.id = '" + user.identity + "';", function(error, rows) {
        rows.forEach(function(row) {
          var listener = row[0];
          var poster   = user.identity;
          subscriber_for(listener).subscribe(poster);
          console.log(pretty(listener) + ' subscribing to ' + pretty(poster));            
        })
      });
    }
  );
}

app.post('/position', function(request, response) {
  var latitude  = parseFloat(request.body.latitude);
  var longitude = parseFloat(request.body.longitude);

  request.user.update({
    position: {
      latitude:  latitude,
      longitude: longitude
    }
  });

  update_position(request.user);

  response.send('thanks');
});

app.post('/message', function(request, response) {
  console.log('publishing: ' + request.body.text);
  redis_pub.publish(request.identity, JSON.stringify({
    from: request.identity,
    text: request.body.text
  }));
  response.send('thanks');
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
