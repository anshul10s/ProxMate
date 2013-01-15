/*jslint browser: true*/
/*global localStorage, chrome, console*/
var pac_config = {};

/**
 * tries to cast a string into bool
 * chrome saves localStorage vars in string only. Needed for conversion
 * @param  {string} str string to casat
 * @return {bool}
 */
var bool = function (str) {
	"use strict";
	if (str.toLowerCase() === 'false') {
		return false;
	} else if (str.toLowerCase() === 'true') {
		return true;
	} else {
		return undefined;
	}
};

/**
 * shuffles a array and returns random result
 * @param  {array} o the array to shuffle
 * @return {array} the shuffled array
 */
var shuffle = function (o) {
	"use strict";
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

/**
 * Get pac_script form localStorage and set
 */
var resetProxy = function () {
	"use strict";
	var pcs, pac_config;

	pcs = localStorage.pac_script;

	pac_config = {
		mode: "pac_script",
		pacScript: {
			data: pcs
		}
	};


	chrome.proxy.settings.set(
		{value: pac_config, scope: 'regular'},
		function () {}
	);
};

/**
 * Will be invoked when clicking the ProxMate logo. Simply toggles the plugins status
 */
var togglePluginstatus = function () {
	"use strict";
	var toggle = bool(localStorage.status);

	if (toggle) {
		chrome.browserAction.setIcon({path: "images/icon24_grey.png"});
		localStorage.status = false;

		// Remove proxy entirely and allow other plugins to write
		chrome.proxy.settings.clear({});
	} else {
		chrome.browserAction.setIcon({path: "images/icon24.png"});
		localStorage.status = true;

		// ProxMate has just been turned on. Set the proxy
		resetProxy();
	}
};

/**
 * Initialises a specific localStorage space
 * @param  {string} str localStorage key
 * @param  {string} val localStorage value
 */
var initStorage = function (str, val) {
	"use strict";
	if (val === undefined) {
		val = true;
	}

	if (localStorage[str] === undefined) {
		localStorage[str] = val;
	}
};

/**
 * Experimental module for reacting on onAuthRequired prompts. Might be useful for using user auth in proxy servers
 */
chrome.webRequest.onAuthRequired.addListener(function (details, callback) {
	"use strict";
	if (details.isProxy === true) {
		callback({ authCredentials: {username: localStorage.proxy_user, password: localStorage.proxy_password}});
	} else {
		callback({ cancel: false });
	}
}, {urls: ["<all_urls>"]}, ["asyncBlocking"]);

/**
 * Parses script and saves generated proxy autoconfig in localStorage
 * @param  {string} config a config json string. If none is set, localStorage.last_config is used.
 */
var createPacFromConfig = function (config) {
	"use strict";
	if (config === undefined) {
		config = localStorage.last_config;
	}

	var json, pac_script, counter, list, rule, proxystring, proxy, country, service, service_list, service_rules, rules, proxies;
	json = JSON.parse(config);

	// Do we have user infos in answer json? If yes, save them. If no, remove old ones from storage
	if (json.list.auth.user !== undefined) {
		localStorage.proxy_user = json.list.auth.user;
		localStorage.proxy_password = json.list.auth.pass;
	} else {
		delete localStorage.proxy_user;
		delete localStorage.proxy_password;
	}

	// create a proxy auto config string
	pac_script = "function FindProxyForURL(url, host) {";
	counter = 0;

	service_list = [];
	for (country in json.list.proxies) {
		// Only parse if there are nodes and proxies available for the specific country
		if (json.list.proxies[country].nodes.length > 0 && Object.keys(json.list.proxies[country].services).length > 0) {


			list = json.list.proxies[country].services;

			service_rules = [];
			for (service in list) {
				// Apply only if we have rules for the current service
				if (list[service].length > 0) {
					// Create localStorage space for the current service.
					// This will enable toggling when using a custom options page
					var ls_string = "st_" + service;
					initStorage(ls_string);

					service_list.push(service);
					// check if the current service is enabled by the user. If no, skip it, if yes, join by OR condition
					if (bool(localStorage[ls_string]) === true) {

						rules = list[service].join(" || ");
						service_rules.push(rules);
					}
				}
			}

			// Check if we have some rules available. If not, just skip
			if (service_rules.length === 0) {
				continue;
			}

			rule = service_rules.join(" || ");

			// Check for custom userproxy
			if (bool(localStorage.status_cproxy) === true) {
				proxystring = localStorage.cproxy_url + ":" + localStorage.cproxy_port;
			} else {
				// Shuffle proxies for a traffic randomizing
				proxies = shuffle(json.list.proxies[country].nodes);
				proxystring = proxies.join("; PROXY ");
			}

			// Some special treatment on first iteration
			if (counter === 0) {
				pac_script += "if (" + rule + ") { return 'PROXY " + proxystring + "';}";
			} else {
				pac_script += " else if (" + rule + ") { return 'PROXY " + proxystring + "';}";
			}

			counter += 1;
		}

	}

	pac_script += " else { return 'DIRECT'; }";
	pac_script += "}";
	localStorage.services = service_list;
	localStorage.pac_script = pac_script;
};

/**
 * Loads external config and saves in localStorage
 * Invokes createPacFromConfig after fetching
 */
var loadExternalConfig = function () {
	"use strict";
	var xhr = new XMLHttpRequest();

	xhr.addEventListener("load", function () {
		var json, jsonstring, pac_script, counter, list, rule, proxystring, proxy, country, service;

		jsonstring = xhr.responseText;
		json = JSON.parse(jsonstring);

		if (json.success) {

			// Save last config in localStorage. For fallback
			localStorage.last_config = jsonstring;
			createPacFromConfig(jsonstring);
		}

	}, false);

	xhr.addEventListener("error", function () {
		// Do nothing
	}, false);

	try {
		xhr.open("GET", "http://proxmate.dave.cx/api/config.json?key=" + localStorage.api_key, false);
		xhr.send();
	} catch (e) {
		// Do nothing
	}
};

/**
 * Invoke proxy fetching all 10 minutes
 */
setInterval(function () {
	"use strict";
	if (bool(localStorage.status) === true) {
		loadExternalConfig();
		resetProxy();
	} else {
		loadExternalConfig();
	}
}, 600000);

/**
 * Self-invoking init function. Basically the starting point of this addon.
 */
var init = (function () {
	"use strict";

	// Init some storage space we need later
	initStorage("firststart");
	initStorage("pre21");

	initStorage("status");
	initStorage("status_youtube_autounblock", true);

	initStorage("status_cproxy", false);
	initStorage("cproxy_url", "");
	initStorage("cproxy_port", "");

	initStorage("pac_script", "");
	initStorage("api_key", "");

	// Is this the first start? Spam some tabs!
	var firstStart, url, port, xhr;

	firstStart = localStorage.firststart;
	if (firstStart === "true") {
		chrome.tabs.create({
			url: "http://proxmate.dave.cx"
		});

		chrome.tabs.create({
			url: "https://www.facebook.com/ProxMate/"
		});

		localStorage.firststart = false;
		localStorage.pre21 = false;
	}

	// Used when showing a changelog page. Only neccessary for big changes
	if (bool(localStorage.pre21)) {
		localStorage.pre21 = false;
		chrome.tabs.create({
			url: "http://proxmate.dave.cx/changelog/"
		});
	}

	// Request a proxy from master server & Error handling
	loadExternalConfig();

	// Set the icon color on start
	if (bool(localStorage.status) === false) {
		chrome.browserAction.setIcon({path: "images/icon24_grey.png"});
		chrome.proxy.settings.clear({});
	} else {
		resetProxy();
	}

}());

/**
 * Add a click listener on plugin icon
 */
chrome.browserAction.onClicked.addListener(togglePluginstatus);

/**
 * Event listener for cummunication between page scripts / options and background.js
 */
chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
	"use strict";
	var config, module, status;

	// ResetProxy to default
	if (request.action === "resetproxy") {
		loadExternalConfig();
		resetProxy();
	}

	if (request.action === "checkStatus") {

		module = request.param;
		status = false;

		switch (module) {
		case "global":
			status = bool(localStorage.status);
			break;
		case "cproxy":
			status = bool(localStorage.status_cproxy);
			break;
		default:
			status = bool(localStorage[module]);
			break;
		}

		sendResponse({
			enabled: status
		});
	}

});
