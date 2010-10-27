function initialize_map() {
  var latlng = new google.maps.LatLng(33.75, -84.37);
  var myOptions = {
    zoom:      11,
    center:    latlng,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  var map = new google.maps.Map($("#map")[0],
      myOptions);
  
  var marker = new google.maps.Marker({
    position:  latlng,
    draggable: true,
    map:       map
  });

  var dragged = 0;

  google.maps.event.addListener(marker, 'drag', function(event){
    if(dragged > 8) {
      circle.setCenter(event['latLng']);
      circle.setMap(map);
      dragged = 0;
    }
    dragged++;
  });

  var circle = new google.maps.Circle({
    center:       latlng,
    radius:       2000,
    strokeColor:  '#0000FF',
    strokeWidth:  5,
    fillOpacity:  0
  });
  circle.setMap(map);    
}