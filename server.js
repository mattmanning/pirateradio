require.paths.unshift(__dirname + '/lib');

var auth     = require('connect-auth');
var crypto   = require('crypto');
var fs       = require('fs');
var identity = require('connect-identity');
var log      = require('log');
var express  = require('express');
var redis    = require('redis');
var sys      = require('sys');
var user     = require('user');
var utility  = require('utility');

/** REDIRECTOR **************************************************************/

if (process.env.SECURE) {
  var redirector = express.createServer();

  redirector.get('/', function(request, response) {
    response.redirect('https://' + request.headers.host);
  });

  redirector.listen(80);
}

/** APP *********************************************************************/

var app = express.createServer(
  express.bodyDecoder(),
  express.cookieDecoder(),
  express.session(),
  identity({ cookie: '_pirate_radio_id' }),
  user.middleware({ host: 'localhost', port: 5984 })
);

app.set('views', __dirname + '/views');

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
      request.user.update({
        auth: { type:'twitter', name:data.screen_name },
        avatar: data.profile_image_url
      });
      response.redirect('/');
    });
  });
});

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

  astrolabe.update(request.user.id, latitude, longitude);

  response.send('OK');
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

/** ASTROLABE ***************************************************************/

var astrolabe = require('astrolabe').create({ psql:"host='127.0.0.1' dbname='pirateradio' user='pirateradio' password='radio'" })

astrolabe.on('update', function(from, latitude, longitude) {
  log('astrolabe.on.update', { from:from })
  hermes.each(function(id, socket) {
    hermes.position(id, from, { latitude:latitude, longitude:longitude });
  });
});

astrolabe.on('connect', function(listener, poster) {
  log('astrolabe.on.connect', { listener:listener, poster:poster });
  switchboard.endpoint(listener).subscribe(poster);
  user.lookup(poster, function(user) {
    hermes.subscribe(listener, poster, {
      name: (user.auth ? user.auth.name : 'Anonymous'),
      avatar: (user.avatar || '')
    })
  });
});

astrolabe.on('disconnect', function(listener, poster) {
  log('astrolabe.on.disconnect', { listener:listener, poster:poster });
  switchboard.endpoint(listener).unsubscribe(poster);
  hermes.unsubscribe(listener, poster);
});

/** HERMES ******************************************************************/

var hermes = require('hermes').create({ app:app });

hermes.on('connection', function(id) {
  log('hermes.on.connection', { id:id });
  user.lookup(id, function(user) {
    if (!user.position) {
      user.update({ position: { latitude: 33.788, longitude: -84.289 }});
    }
    astrolabe.update(user.id, user.position.latitude, user.position.longitude);
  });

  hermes.each(function(from, socket) {
    user.lookup(from, function(user) {
      if (!user.position) {
        user.update({ position: { latitude: 33.788, longitude: -84.289 }});
      }
      hermes.position(id, user.id, user.position);
    });
  });
});

hermes.on('message', function(id, message) {
  log('hermes.on.message', { id:id, message:message });

  switch (message.type) {
    case 'message':
      log('hermes.message.message', { from:id, text:message.message });
      switchboard.endpoint(id).publish(message.message);
      break;
  }
});

hermes.on('disconnect', function(id) {
  log('hermes.on.disconnect', { id:id });
  astrolabe.remove(id);
  switchboard.endpoint(id).close();
});

/** SWITCHBOARD *************************************************************/

var switchboard = require('switchboard').create();

switchboard.on('message', function(from, to, message) {
  log('switchboard.on.message', { from:from, to:to, message:message });
  hermes.send(to, {
    type: 'message',
    from: from,
    text: message
  })
})

/** TWITTER *****************************************************************/

var twitter = require('twitter-connect').createClient({
  consumerKey:    'SL0d7ouDmx4HbjKrx3Cp9Q',
  consumerSecret: 'JUM2ZnY3AwzFQ8U5qb05ZVsvrGymRlVdO3mptvJGec'
});

/** MAIN ********************************************************************/

if (process.env.SECURE) {
  var privateKey = fs.readFileSync(__dirname + '/privatekey.pem').toString();
  var certificate = fs.readFileSync(__dirname + '/certificate.pem').toString();
  var credentials = crypto.createCredentials({key: privateKey, cert: certificate});

  app.setSecure(credentials);
  app.listen(443);
} else {
  app.listen(process.env.PORT || 3000);
}
