var socket = null;
var connected = false;

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

    socket = new io.Socket(document.location.hostname, { port: document.location.port });  console.log(document.location);

    socket.on('connect', function(socket) {
      console.log('connected');
      connected = true;
    });

    socket.on('message', function(data) {
      var message = JSON.parse(data);
      $('#chat').append('[' + message.from + '] ' + message.message + '\n');
      $('#chat').scrollTop($('#chat')[0].scrollHeight);
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
  socket.send(JSON.stringify({ type:'message', message:message }));
}

function position_success(position) {
  console.log('position: ' + position);

  var coords = {
    latitude:  position.coords.latitude,
    longitude: position.coords.longitude
  }

  $.post('/position', coords, function(data) {
    console.log(data);
  });
}

function position_error(message) {
  console.log('error: ' + message);
}
