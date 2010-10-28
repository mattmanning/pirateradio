require.paths.unshift(__dirname + '/lib');

var auth     = require('connect-auth');
var identity = require('connect-identity');
var io       = require('socket.io');
var log      = require('log');
var express  = require('express');
var postgres = require('postgres');
var redis    = require('redis');
var sys      = require('sys');
var user     = require('user');
var utility  = require('utility');

var MemoryStore = require('connect/middleware/session/memory');

var pgdb = postgres.createConnection("host='127.0.0.1' dbname='pirateradio' user='pirateradio' password='radio'")

var publisher = redis.createClient();
publisher.select(2);

var app = express.createServer(
  express.bodyDecoder(),
  express.cookieDecoder(),
  express.session(),
  identity({ cookie: '_pirate_radio_id' }),
  user.middleware({ host: 'localhost', port: 5984 })
);

app.set('views', __dirname + '/views');

var socket = io.listen(app);

var sockets = {};

socket.on('connection', function(client) {
  express.cookieDecoder()(client.request, client.response, function(){});
  var identity = client.request.cookies['_pirate_radio_id'];
  log('socket.connection', { identity:identity });

  user.lookup_by_identity(identity, function(uu) {
    update_position(uu);

    log('socket.connection.store', { id:uu.id });

    sockets[uu.id] = client;

    for (var id in sockets) {
      user.lookup(id, function(uuu) {
        update_socket_position(client, uuu, (uu.id === uuu.id))
      })
    }

    // pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < 160900 WHERE l1.id = '" + uu.id + "';", function(error, rows) {
    //   rows.forEach(function(row) {
    //     user.lookup(row[0], function(uuu) {
    //       update_socket_position(client, uuu, (uu.id==uuu.id))
    //     });
    //   })
    // });

    client.on('message', function(message) {
      var message = JSON.parse(message);

      log('socket.message', { id:uu.id, type:message.type })

      switch (message.type) {
        case 'message':
          log('socket.message.message', { from:uu.id, text:message.message });
          publisher.publish(uu.id, JSON.stringify({
            from: uu.id,
            text: message.message
          }));
          break;
      }
    })

    client.on('disconnect', function() {
      log('socket.disconnect', { id:uu.id })

      pgdb.query("delete from locations where id = '" + uu.id + "'");
      delete sockets[uu.id];

      for (var id in sockets) {
        sockets[id].send(JSON.stringify({
          type:'remove',
          id:uu.id
        }));
      }

      if (subscribers[uu.id]) {
        subscribers[uu.id].subs.forEach(function(to) {
          subscriber_for(to).unsub(uu.id);
        });
        delete subscribers[uu.id];
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
      log('auth.twitter.error', { error:error })
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
        log('subscriber.sub', { from:this.id, to:to })
        this.subscribe(to);
        this.subs.push(to);
      }
    }
    subscriber.unsub = function(to) {
      if (this.subs.indexOf(to) != -1) {
        log('subscriber.unsub', { from:this.id, to:to })
        this.unsubscribe(to);
        this.subs.splice(this.subs.indexOf(to));
      }
    }
    subscriber.unsub_all = function() {
      log('subscriber.unsub.all');
      for (var id in utility.clone(this.subs)) {
        this.unsub(id);
      }
      this.subs = [];
    }
    subscriber.on("message", function(channel, message) {
      var message = JSON.parse(message);
      log('subscriber.message', message);

      var to_id = this.id;
      user.lookup(message.from, function(uu) {
        log('subscriber.message.user', { from:uu.id, to:to_id });

        var from = uu.auth ? uu.auth.name : 'Anonymous';
        console.log(sys.inspect(message));
        var socket = sockets[to_id];
        if (socket) {
          log('subscriber.message.user.send', { id:to_id })

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

function update_socket_position(socket, user, me) {
  if (!user.position) return;

  var data = {
    type:'position',
    id:user.id,
    me:me,
    latitude:user.position.latitude,
    longitude:user.position.longitude
  }
  log('position.socket.update', data)
  socket.send(JSON.stringify(data));  
}

function update_position(user) {
  if (!user.position) {
    user.update({
      position: {
        latitude: 33.788,
        longitude: -84.289
      }
    })
  }

  log('position.update', { id:user.id, lat:user.position.latitude, lng:user.position.longitude })

  var latitude = user.position.latitude;
  var longitude = user.position.longitude;

  for (var id in sockets) {
    subscriber_for(id).unsub(user.id);
    update_socket_position(sockets[id], user, (id==user.id));
  }

  subscriber_for(user.id).unsub_all();

  console.log("insert into locations (id, radius, located_at, location) values (" +
    "'" + user.id + "',10000,now()," +
    "ST_Transform(ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 4326), 900913));");

  pgdb.query("delete from locations where id = '" + user.id + "'");
  pgdb.query("insert into locations (id, radius, located_at, location) values (" +
    "'" + user.id + "',10000,now()," +
    "ST_Transform(ST_GeomFromText('POINT(" + latitude + ' ' + longitude + ")', 4326), 900913));",
    function(error) {
      console.log("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l1.radius WHERE l1.id = '" + user.id + "';");
      pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l1.radius WHERE l1.id = '" + user.id + "';", function(error, rows) {
        if (rows) {
          rows.forEach(function(row) {
            console.log(sys.inspect(row));
            var listener = user.id;
            var poster   = row.id;
            log('position.subscribe.me', { listener:listener, poster:poster })
            subscriber_for(listener).sub(poster);
          })
        }
      });
      //console.log("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l2.radius WHERE l1.id = '" + user.id + "';");
      pgdb.query("SELECT l2.id FROM locations AS l1 INNER JOIN locations AS l2 ON ST_Distance(l1.location, l2.location) < l2.radius WHERE l1.id = '" + user.id + "';", function(error, rows) {
        if (rows) {
          rows.forEach(function(row) {
            var listener = row.id;
            var poster   = user.id;
            log('position.subscribe.them', { listener:listener, poster:poster })
            subscriber_for(listener).sub(poster);
          })
        }
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

  update_position(request.user);

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
