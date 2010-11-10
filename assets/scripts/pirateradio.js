var socket = null;
var connected = false;
var nearby = {};
var markers = {};
var distanceWidget;
var map;

$(window).ready(function() {
  init_map();
  locate_user();

  $('#entry').bind('keypress', function(ev) {
    if (ev.keyCode == 13) {
      send_message($('#entry').val());
      $('#entry').val('');
      ev.preventDefault();
    }
  });

  function persistent_connect() {
    if (connected) return;

    if (socket && socket.connected && socket.close) socket.close();

    //socket = new io.Socket(document.location.hostname, { port:document.location.port, secure:true });  console.log(document.location);
    socket = new io.Socket(document.location.hostname, { port:document.location.port });  console.log(document.location);

    socket.on('connect', function(socket) {
      console.log('connected');
      connected = true;
    });

    socket.on('message', function(data) {
      var message = JSON.parse(data);

      console.log('socket.receive: ', message);

      switch(message.type) {
        case 'message':
          if (!nearby[message.from]) {
            // TODO: request user profile
            return;
          }

          var avatar = nearby[message.from].avatar || '/images/pr_anon-avatar_40x40.png';

          // TODO: fix this
          $('#log').append('                                                    \
            <div class="message">                                               \
              <img class="avatar" src="' + avatar + '">                         \
              <div class="text">                                                \
                <a class="name" href="#">' + nearby[message.from].name +  '</a> \
                ' + message.message.message + '                                 \
              </div>                                                            \
              <div class="meta">                                                \
                One hour ago                                                    \
              </div>                                                            \
            </div>                                                              \
          ');
          $('#log').scrollTop($('#log')[0].scrollHeight);
          break;
        case 'position':
          m_latitude = message.latitude;
          m_longitude = message.longitude;
          m_radius = message.radius;
          update_marker(message);
          break;
        case 'subscribe':
          nearby[message.id] = message.user;
          var avatar = nearby[message.id].avatar || '/images/pr_anon-avatar_36x36.png';
          $('#userbar').append('<img class="' + message.id + '" src="' + avatar + '">');
          break;
        case 'unsubscribe':
          $('#userbar .' + message.id).remove();
          delete nearby[message.id];
          break;
        case 'remove':
          var marker = markers[message.id];
          if (marker) {
            if (marker.circle) marker.circle.setMap(null);
            marker.setMap(null);
          }
          $('#userbar .' + message.id).remove();
          delete markers[message.id];
          break;
      }
    });

    socket.on('disconnect', function(data) {
      console.log('disconnect');
      connected = false;
      persistent_connect();
    })

    socket.connect();

    window.setTimeout(persistent_connect, 5000);
  }

  persistent_connect();
});

function locate_user() {
  if (navigator.geolocation) {
    console.log('getting position');
    navigator.geolocation.getCurrentPosition(position_success, position_error);
  } else {
    console.log('geolocation not supported');
  }
}

function send_message(message) {
  console.log('sending: ' + message);
  socket.send(JSON.stringify({ type:'message', message:message }));
}

function position_success(position) {
  update_position(position.coords.latitude, position.coords.longitude);
  map.setCenter(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
}

function position_error(message) {
  console.log('error: ' + message);
}

var m_latitude = null;
var m_longitude = null;
var m_radius = null;

function update_position(latitude, longitude) {
  var coords = {
    latitude:  latitude,
    longitude: longitude,
    radius:    m_radius || 2000
  }

  $.post('/position', coords, function(data) {
    console.log(data);
  });
}

function update_radius(radius) {
  var coords = {
    latitude:  m_latitude,
    longitude: m_longitude,
    radius:    radius
  }

  $.post('/position', coords, function(data) {
    console.log('posreturn: ', data);
  });
}

function create_marker(data) {
  var latlng = new google.maps.LatLng(data.latitude, data.longitude);
  var image;
  var marker;

  if(!data.me) {
    image = new google.maps.MarkerImage('/images/pr_map-point-other_25x25.png',
      new google.maps.Size(50,50),
      new google.maps.Point(0,0),
      new google.maps.Point(25,25));
    marker = markers[data.id] = new google.maps.Marker({
      position: latlng,
      icon: image,
      map: map
    });
  } else {
    image = marker_image('/images/pr_map-point-self_25x25.png', 50);
    var sizer  = marker_image('/images/resize-off.png', 16);
    var active = marker_image('/images/resize.png', 16);
    marker = markers[data.id] = new DistanceWidget({
        position: latlng,
        map: map,
        cursor: 'move',
        icon: image,
        distance: 2000, // Starting distance in meters.
        maxDistance: 2500000,
        color: '#000',
        zIndex: 9999,
        activeColor: '#59b',
        sizerIcon: sizer,
        activeSizerIcon: active
      });

    map.fitBounds(marker.get('bounds'));
  }

  return marker
}

function marker_image(file, side) {
  var markerimage = new google.maps.MarkerImage(file,
    new google.maps.Size(side,side),
    new google.maps.Point(0,0),
    new google.maps.Point(side/2,side/2));
  return markerimage;
}

function update_marker(data) {
  console.log('updating marker', data);
  if (!markers[data.id]) { markers[data.id] = create_marker(data); }
  var marker = markers[data.id];
  var latlng = new google.maps.LatLng(data.latitude, data.longitude);
  console.log(latlng);
  marker.setPosition(latlng);
}

function update_radius_marker(data) {
  var marker = markers[data.id];
  marker.set('distance', data.radius);
}

function init_map() {
  var mapDiv = document.getElementById('map');
  map = new google.maps.Map(mapDiv, {
    center: new google.maps.LatLng(33.75, -84.37),
    zoom: 8,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });
}

function feedbackDialog() {
  $('#feedback').dialog({
    title: 'piraterad.io',
    modal: true,
    width: 400,
    height: 630,
    resizable: false
  });
}
