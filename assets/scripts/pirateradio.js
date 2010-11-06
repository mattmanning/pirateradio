var socket = null;
var connected = false;
var nearby = {};

$(window).ready(function() {
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
          $('#log').append('                                              \
            <div class="message">                                         \
              <img class="avatar" src="' + nearby[message.from].avatar + '">                                        \
              <div class="text">                                          \
                <a class="name" href="#">' + nearby[message.from].name + '</a>         \
                ' + message.text + '                                      \
              </div>                                                      \
              <div class="meta">                                          \
                One hour ago                                              \
              </div>                                                      \
            </div>                                                        \
          ');
          $('#log').scrollTop($('#log')[0].scrollHeight);
          break;
        case 'position':
          update_marker(message);
          break;
        case 'subscribe':
          nearby[message.id] = message.user;
          $('#userbar').append('<img class="' + message.id + '" src="' + message.user.avatar + '">');
          break;
        case 'unsubscribe':
          $('#userbar .' + message.id).remove();
          delete nearby[message.id];
          break;
        case 'remove':
          $('#userbar .' + message.id).remove();
          delete nearby[message.id];
          var marker = markers[message.id];
          if (marker) {
            if (marker.circle) marker.circle.setMap(null);
            marker.setMap(null);
          }
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
}

function position_error(message) {
  console.log('error: ' + message);
}

function update_position(latitude, longitude) {
  var coords = {
    latitude:  latitude,
    longitude: longitude
  }

  console.log(coords);

  $.post('/position', coords, function(data) {
    console.log(data);
  });
}

var markers = {};
var map = null;

function create_marker(data) {
  var latlng = new google.maps.LatLng(data.latitude, data.longitude);
  var marker = markers[data.id] = new google.maps.Marker({
    position: latlng,
    draggable: data.me,
    map: map
  });

  if (data.me) {
    marker.circle = new google.maps.Circle({
      center:       latlng,
      radius:       2000,
      strokeColor:  '#0000FF',
      strokeWidth:  5,
      fillOpacity:  0
    });
    marker.circle.setMap(map);
  }

  google.maps.event.addListener(marker, 'dragstart', function(event){
    if (marker.circle) {
      marker.circle.setMap(null);
    }
  });

  google.maps.event.addListener(marker, 'dragend', function(event) {
    if (marker.circle) {
      marker.circle.setMap(map);
      marker.circle.setCenter(event.latLng);
    }
    update_position(event.latLng.lat(), event.latLng.lng());
  });
  
  return marker
}

function update_marker(data) {
  console.log('updating marker', data);
  if (!markers[data.id]) { markers[data.id] = create_marker(data); }
  var marker = markers[data.id];
  var latlng = new google.maps.LatLng(data.latitude, data.longitude);
  console.log(latlng);
  marker.setPosition(latlng);
  if (marker.circle) marker.circle.setCenter(latlng);
}

function initialize_map() {
  var latlng = new google.maps.LatLng(33.75, -84.37);

  var myOptions = {
    zoom:      11,
    center:    latlng,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };

  map = new google.maps.Map($("#map")[0], myOptions);
}
