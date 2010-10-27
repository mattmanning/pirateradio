require.paths.unshift('lib');

var auth     = require('connect-auth');
var identity = require('connect-identity');
var io       = require('socket.io');
var log      = require('log');
var express  = require('express');
var postgres = require('postgres');
var redis    = require('redis');
var sys      = require('sys');
var user     = require('user');

var MemoryStore = require('connect/middleware/session/memory');

var pgdb = postgres.createConnection("host='' dbname='pirateradio'")

function pretty(id) {
  return id.substring(0, 6);
}

var publisher = redis.createClient();
publisher.select(2);

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
  var identity = client.request.cookies['_pirate_radio_id'];
  log('socket.connection', { identity:pretty(identity) });

  user.lookup_by_identity(identity, function(user) {
    update_position(user);

    log('socket.connection.store', { id:user.id });

    sockets[user.id] = client;

    client.on('message', function(message) {
      var message = JSON.parse(message);

      log('socket.message', { id:pretty(user.id), type:message.type })

      switch (message.type) {
        case 'message':
          log('socket.message.message', { from:user.id, text:message.message });
          publisher.publish(user.id, JSON.stringify({
            from: user.id,
            text: message.message
          }));
          break;
      }
    })

    client.on('disconnect', function() {
      console.log('socket.disconnect', { id:pretty(user.id) })
      
      console.log("delete from locations where id = '" + user.id + "'");
      pgdb.query("delete from locations where id = '" + user.id + "'");
      delete sockets[user.id];
      
      if (subscribers[user.id]) {
        subscribers[user.id].subs.forEach(function(to) {
          subscriber_for(to).unsub(user.id);      
        });
        delete subscribers[user.id];
      }
    })
  });
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
    subscriber.subs = [];
    subscriber.id = id;
    subscriber.select(2);
    subscriber.sub = function(to) {
      if (this.subs.indexOf(to) == -1) {        
        console.log(pretty(this.id) + ' subscribing to ' + pretty(to));            
        this.subscribe(to);
        this.subs.push(to);
      }
    }
    subscriber.unsub = function(to) {
      if (this.subs.indexOf(to) != -1) {
        console.log(pretty(this.id) + ' unsubscribing from ' + pretty(to));            
        this.unsubscribe(to);
        this.subs.splice(this.subs.indexOf(to));
      }
    }
    subscriber.on("message", function(channel, message) {
      var message = JSON.parse(message);
      log('subscriber.message', message);
      user.lookup(message.from, function(user) {
        log('subscriber.message.user', { id:user.id });

        var from = user.auth ? user.auth.name : 'Anonymous';

        var socket = sockets[user.id];
        if (socket) {
          
          console.log('sending to: ' + pretty(id));
          socket.send(JSON.stringify({
            type:'message',
            from:from,
            message:message.text
          }))
        }
      });
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

  pgdb.query("delete from locations where id = '" + user.id + "'");
  pgdb.query("insert into locations (id, radius, located_at, location) values (" +
    "'" + user.id + "',1609,now()," +
    "ST_Transform(ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 4326), 900913));",
    function(error) {
      pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l1.radius WHERE l1.id = '" + user.identity + "';", function(error, rows) {
        rows.forEach(function(row) {
          var listener = user.id;
          var poster   = row[0];
          subscriber_for(listener).sub(poster);
        })
      });
      pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l2.radius WHERE l1.id = '" + user.identity + "';", function(error, rows) {
        rows.forEach(function(row) {
          var listener = row[0];
          var poster   = user.id;
          var subscriber = subscriber_for(listener);
          subscriber_for(listener).sub(poster);
        })
      });
    }
  );
}

app.post('/position', function(request, response) {
  var latitude  = parseFloat(request.body.latitude);
  var longitude = parseFloat(request.body.longitude);
  log('post.position', { lat:latitude, long:longitude });

  request.user.update({
    position: {
      latitude:  latitude,
      longitude: longitude
    }
  });

  console.log(sys.inspect(request.user));

  update_position(request.user);

  response.send('thanks');
});

// app.post('/message', function(request, response) {
//   console.log('publishing: ' + request.body.text);
//   publisher.publish(request.identity, JSON.stringify({
//     from: request.identity,
//     text: request.body.text
//   }));
//   response.send('thanks');
// });

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
