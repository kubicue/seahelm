// onSuccess Callback
    //   This method accepts a `Position` object, which contains
    //   the current GPS coordinates
    //
    function onSuccess(position) {
        var element = document.getElementById('geolocation');
        element.innerHTML = '<strong>Latitude:</strong> '  + position.coords.latitude      + '<br />' +
                            '<strong>Longitude:</strong> ' + position.coords.longitude     + '<br />' +
					                  '<strong>Heading:</strong> ' + Math.round(position.coords.heading)    + '<br />' +
					                  '<strong>Speed:</strong> ' + Math.round(position.coords.speed)     + '<br />' 
                            '<hr />'      + element.innerHTML;
    }

    // onError Callback receives a PositionError object
    //
    function onError(error) {
        alert('code: '    + error.code    + '\n' +
              'message: ' + error.message + '\n');
    }

    // Options: throw an error if no update is received every 30 seconds.
    //
    var watchID = navigator.geolocation.watchPosition(onSuccess, onError, { maximumAge: 3000, timeout: 5000, enableHighAccuracy: true });
