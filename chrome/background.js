function getRandomKey(obj) {
    var ret;
    var c = 0;
    for (var key in obj)
        if (Math.random() < 1/++c)
           ret = key;
    return ret;
}

function getRandomInt (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

var proxyList = {
	/* Just dummy servers for testing ;) */
	us: [
		["us01.personalitycores.com", 8000],
		["us02.personalitycores.com", 8000]
	],
	uk: [
		["uk01.personalitycores.com", 8000]
	],
	de: [
		["de01.personalitycores.com", 8000]
	],
	/* Real ones */
	live: [
		["proxy.personalitycores.com", 8000]
	]
}

var bool = function(str){
    if (str.toLowerCase() == 'false') {
       return false;
    } else if (str.toLowerCase() == 'true') {
       return true;
    } else {
       return undefined;
    }
}

var getRandomProxy = function(country) {
	switch (country) {
		case "all": 
			var key = getRandomKey(proxyList);
			break;
		default: 
			var key = country;
			break;
	}

	var proxylist = proxyList[key];

	var length = proxylist.length - 1;
	var randomKey = getRandomInt(0, length);

	return proxylist[randomKey];
}

var setPluginStatus = function() 
{
	var toggle = localStorage["status"];


	// Wenn Toggle = False ist, das icon farbig machen
	if (toggle == "true") {
		chrome.browserAction.setIcon({
			path: "images/icon48_gray.png"
		});

		localStorage["status"] = false;
		chrome.proxy.settings.clear({});
	}
	else
	{
		chrome.browserAction.setIcon({
			path: "images/icon48.png"
		});

		localStorage["status"] = true;
	}
}

var initStorage = function(str, val) {
	if (val === undefined) {
		val = true;
	}

	if (localStorage[str] === undefined) {
		localStorage[str] = val;
	}
}


var init = (function() {

	// Checkt ob das Tool zum ersten mal gestartet wurde
	initStorage("firststart");

	// Prüft ob die jeweiligen storageVariablen gesetzt sind. Fall nein werden sie mit true initialisiert
	initStorage("status");
	initStorage("status_youtube_search");
	initStorage("status_grooveshark");
	initStorage("status_hulu");
	initStorage("status_experimental", false);

	// Statistics
	initStorage("status_statistics");

	// Eigenen proxy im localStorage anlegen um mögliche fehler zu beseitigen
	initStorage("status_cproxy", false);
	initStorage("cproxy_url", "");
	initStorage("cproxy_port", "");


	// Schauen ob der User das Plugin zum ersten mal verwendet
	var firstStart = localStorage["firststart"];

	if (firstStart == "true") {
		chrome.tabs.create(
		{
			url: "http://www.personalitycores.com/projects/proxmate"
		});

		chrome.tabs.create(
		{
			url: "https://www.facebook.com/ProxMate/"			
		});

		localStorage["firststart"] = false;
	}

	// Proxy auf System setzen falls einer gesetzt wurde.
	chrome.proxy.settings.clear({});
})();

chrome.browserAction.onClicked.addListener(setPluginStatus);

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	if (request.action == "setproxy") 
	{

		var randomProxy = getRandomProxy("live");
		var uri = randomProxy[0];
		var port = randomProxy[1];
		
		var pageuri = request.param;

		// Ping server for statistics if allowed
		var allow_statistics = bool(localStorage["status_statistics"]);
		if (allow_statistics) {
			var xhr = new XMLHttpRequest();
			xhr.open("GET", 'http://www.personalitycores.com/projects/proxmate/callback/?u=' + encodeURIComponent(pageuri) + "&b=chrome", true);
			xhr.send();
		}


		// Prüfen ob ein eigener Proxy gesetzt wurde
		if (bool(localStorage["status_cproxy"])) {

			uri = localStorage["cproxy_url"];
			port = localStorage["cproxy_port"];
		}

		var config = {
			mode: "fixed_servers",
			rules: {
				singleProxy: {
					host: uri,
					port: parseInt(port)
				}
			}
		}

		chrome.proxy.settings.set(
			{
				value: config, 
				scope: 'regular'
			},
			function() {
				
			}
		);

		sendResponse({
			status: true
		});	
	}

	// Zurücksetzen des Proxies
	if (request.action == "resetproxy") 
	{
		chrome.proxy.settings.clear({});
		sendResponse({
			status: true
		});	
	}

	if (request.action == "checkStatus") {
		var module = request.param;
		var status = false;

		switch(module) {
			case "global":
				var status = bool(localStorage["status"]);
				break;
			case "youtube_search":
				var status = bool(localStorage["status_youtube_search"]);
				break;
			case "hulu":
				var status = bool(localStorage["status_hulu"]);
				break;
			case "grooveshark": 
				var status = bool(localStorage["status_grooveshark"]);
				break;
			case "experimental": 
				var exp = bool(localStorage["status_experimental"]);
				var cproxy = bool(localStorage["status_cproxy"]);

				if (cproxy)
				{
					var status = exp;
				}
				else 
				{
					var status = false;
				}
				break;
			case "cproxy": 
				var status = bool(localStorage["status_cproxy"]);
				break;
		}

		sendResponse({
			enabled: status
		});
	}
});
