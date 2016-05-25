
		var icons = {	"clear-day" : "B", 
						"clear-night" : "C", 
						"rain" : "R", 
						"snow" : "G", 
						"sleet" : "X", 
						"wind" : "S",
					  "visibility" : "E",
						"pressure" : "F",		 
						"fog" :"N", 
						"cloudy" : "Y",
						"partly-cloudy-day" : "H", 
						"partly-cloudy-night" : "I"
					};

		var cities = {	
						"new york" 		: 	{coords: {latitude: 40.672060, longitude:-73.983898}},
						"los angeles" 	: 	{coords: {latitude: 34.101422, longitude: -118.341224}},
						"chicago" 		: 	{coords: {latitude: 41.879003, longitude: -87.63675}},
			      "san diego" 	: 	{coords: {latitude: 32.7150, longitude: -117.1625}},
						"san francisco" : 	{coords: {latitude: 37.788531, longitude: -122.407237}},
						"miami" 		:	{coords: {latitude: 25.790176, longitude: -80.140133}},
						"current location" : ""
					 };

		function loadWeather(cityCoords){

			console.log(cityCoords);

			var latlng = cityCoords.coords.latitude + "," + cityCoords.coords.longitude;

		//forecast.io 
			
			var forecastURL = "https://api.forecast.io/forecast/8b0e1f8b53a5e7e0e6b2a1b2ced3ceda/"+latlng;

			$.ajax({
			    url: forecastURL,
			    jsonpCallback: 'jsonCallback',
			    contentType: "application/json",
			    dataType: 'jsonp',
			    success: function(json) {
			      console.log(json);
			      $("#current_temp").html(Math.round(json.currently.temperature)+"&#176;F");
						$("#current_temp").attr("data-icon",icons[json.currently.icon]);
						$("#current_temp_roll").html(Math.round(json.currently.temperature)+"&#176;F");
						$("#current_temp_roll").attr("data-icon",icons[json.currently.icon]);
			      $("#current_summary").html(json.currently.summary);
						$("#current_wind_speed").html(Math.round(json.currently.windSpeed) + " Mph");
						$("#current_visibility").html(Math.round(json.currently.visibility) + " Mi.");
						$("#current_pressure").html(Math.round(json.currently.pressure) + " In.");
						 
						 
			       
						 
						 

			    },
			    error: function(e) {
			       console.log(e.message);
			    }
			});

		}

		function loadCity(city){
			$("#location").html(city);

			if (city.toLowerCase() == "current location") {
				if ( navigator.geolocation )
					navigator.geolocation.getCurrentPosition(loadWeather,loadDefaultCity);
				else {
					loadDefaultCity();
				}

			} else {
				loadWeather(cities[city.toLowerCase()]);
			}

		}

		function loadDefaultCity(){
			loadCity("Los Angeles");
		}

		$(document).ready(function(){
			loadCity("San Diego");

			$("a.city").bind("click",function(){
				loadCity($(this).html());
			});
		});

