/**
 * OpenFB is a micro-library that lets you integrate your JavaScript application with Facebook.
 * OpenFB works for both BROWSER-BASED apps and CORDOVA/PHONEGAP apps.
 * This library has no dependency: You don't need (and shouldn't use) the Facebook SDK with this library. Whe running in
 * Cordova, you also don't need the Facebook Cordova plugin. There is also no dependency on jQuery.
 * OpenFB allows you to login to Facebook and execute any Facebook Graph API request.
 * @author Christophe Coenraets @ccoenraets
 * @version 0.4
 */
var openFB = (function() {
    //var baseURL = localStorage.getItem('baseURL')
    var FB_LOGIN_URL = 'https://www.facebook.com/dialog/oauth',
        FB_LOGOUT_URL = 'https://www.facebook.com/logout.php',
        baseURLCustom = 'http://localhost:3000',

        // By default we store fbtoken in sessionStorage. This can be overridden in init()
        tokenStore = window.sessionStorage,

        tokenStore = window.localStorage,

        fbAppId,

        context = window.location.pathname.substring(0, window.location.pathname.indexOf("/", 2)),


        baseURL = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') + context,


        //   baseURL = 'http://ec2-54-214-99-121.us-west-2.compute.amazonaws.com/iknow/server_side' + context,

        oauthRedirectURL = baseURLCustom + '/oauthcallback.html',

        logoutRedirectURL = baseURLCustom + '/logoutcallback.html',

        // Because the OAuth login spans multiple processes, we need to keep the login callback function as a variable
        // inside the module instead of keeping it local within the login function.
        loginCallback,

        // Indicates if the app is running inside Cordova
        runningInCordova,

        // Used in the exit event handler to identify if the login has already been processed elsewhere (in the oauthCallback function)
        loginProcessed;

    console.log('oauthRedirectURL', oauthRedirectURL);
    console.log('logoutRedirectURL', logoutRedirectURL);

    document.addEventListener("deviceready", function() {
        runningInCordova = true;
    }, false);

    /**
     * Initialize the OpenFB module. You must use this function and initialize the module with an appId before you can
     * use any other function.
     * @param params - init paramters
     *  appId: The id of the Facebook app,
     *  tokenStore: The store used to save the Facebook token. Optional. If not provided, we use sessionStorage.
     */
    function init(params) {
        if (params.appId) {
            fbAppId = params.appId;
        } else {
            throw 'appId parameter not set in init()';
        }

        if (params.tokenStore) {
            tokenStore = params.tokenStore;
        }
    }

    /**
     * Checks if the user has logged in with openFB and currently has a session api token.
     * @param callback the function that receives the loginstatus
     */
    function getLoginStatus(callback) {
        var token = tokenStore['fbtoken'],
            loginStatus = {};
        if (token) {
            loginStatus.status = 'connected';
            loginStatus.authResponse = { token: token };
        } else {
            loginStatus.status = 'unknown';
        }
        if (callback) callback(loginStatus);
    }

    /**
     * Login to Facebook using OAuth. If running in a Browser, the OAuth workflow happens in a a popup window.
     * If running in Cordova container, it happens using the In-App Browser. Don't forget to install the In-App Browser
     * plugin in your Cordova project: cordova plugins add org.apache.cordova.inappbrowser.
     *
     * @param callback - Callback function to invoke when the login process succeeds
     * @param options - options.scope: The set of Facebook permissions requested
     * @returns {*}
     */
    function login(callback, options) {

        var loginWindow,
            startTime,
            scope = '';

        if (!fbAppId) {
            return callback({ status: 'unknown', error: 'Facebook App Id not set.' });
        }

        // Inappbrowser load start handler: Used when running in Cordova only
        function loginWindow_loadStartHandler(event) {
            var url = event.url;
            if (url.indexOf("access_token=") > 0 || url.indexOf("error=") > 0) {
                // When we get the access token fast, the login window (inappbrowser) is still opening with animation
                // in the Cordova app, and trying to close it while it's animating generates an exception. Wait a little...
                var timeout = 600 - (new Date().getTime() - startTime);
                setTimeout(function() {
                    loginWindow.close();
                }, timeout > 0 ? timeout : 0);
                oauthCallback(url);
            }
        }

        // Inappbrowser exit handler: Used when running in Cordova only
        function loginWindow_exitHandler() {
            console.log('exit and remove listeners');
            // Handle the situation where the user closes the login window manually before completing the login process
            deferredLogin.reject({ error: 'user_cancelled', error_description: 'User cancelled login process', error_reason: "user_cancelled" });
            loginWindow.removeEventListener('loadstop', loginWindow_loadStartHandler);
            loginWindow.removeEventListener('exit', loginWindow_exitHandler);
            loginWindow = null;
            console.log('done removing listeners');
        }

        if (options && options.scope) {
            scope = options.scope;
        }

        loginCallback = callback;
        loginProcessed = false;

        //        logout();

        startTime = new Date().getTime();

        loginWindow = window.open(FB_LOGIN_URL + '?client_id=' + fbAppId + '&redirect_uri=' + oauthRedirectURL +
            '&response_type=token&scope=' + scope, '_blank', 'location=no');

        // If the app is running in Cordova, listen to URL changes in the InAppBrowser until we get a URL with an access_token or an error
        if (runningInCordova) {
            loginWindow.addEventListener('loadstart', loginWindow_loadStartHandler);
            loginWindow.addEventListener('exit', loginWindow_exitHandler);
        }
        // Note: if the app is running in the browser the loginWindow dialog will call back by invoking the
        // oauthCallback() function. See oauthcallback.html for details.

    }


    /**
     * Called either by oauthcallback.html (when the app is running the browser) or by the loginWindow loadstart event
     * handler defined in the login() function (when the app is running in the Cordova/PhoneGap container).
     * @param url - The oautchRedictURL called by Facebook with the access_token in the querystring at the ned of the
     * OAuth workflow.
     */
    function oauthCallback(url) {
        // Parse the OAuth data received from Facebook
        var queryString,
            obj;

        loginProcessed = true;
        if (url.indexOf("access_token=") > 0) {
            queryString = url.substr(url.indexOf('#') + 1);
            obj = parseQueryString(queryString);
            tokenStore['fbtoken'] = obj['access_token'];
            deferredLogin.resolve();
        } else if (url.indexOf("error=") > 0) {
            queryString = url.substring(url.indexOf('?') + 1, url.indexOf('#'));
            obj = parseQueryString(queryString);
            deferredLogin.reject(obj);
        } else {
            deferredLogin.reject();
        }
    }

    /**
     * Application-level logout: we simply discard the token.
     */
    function logout() {
        var logoutWindow,
            token = tokenStore['fbtoken'];

        /* Remove token. Will fail silently if does not exist */
        tokenStore.removeItem('fbtoken');

        if (token) {
            logoutWindow = window.open(FB_LOGOUT_URL + '?access_token=' + token + '&next=' + logoutRedirectURL, '_blank', 'location=no,clearcache=yes');
            if (runningInCordova) {
                setTimeout(function() {
                    logoutWindow.close();
                }, 700);
            }
        }
    }

    /**
     * Helper function to de-authorize the app
     * @param success
     * @param error
     * @returns {*}
     */
    function revokePermissions() {
        return api({ method: 'DELETE', path: '/me/permissions' })
            .success(function() {
                console.log('Permissions revoked');
            });
    }

    /**
     * Lets you make any Facebook Graph API request.
     * @param obj - Request configuration object. Can include:
     *  method:  HTTP method: GET, POST, etc. Optional - Default is 'GET'
     *  path:    path in the Facebook graph: /me, /me.friends, etc. - Required
     *  params:  queryString parameters as a map - Optional
     */
    function api(obj) {

        var method = obj.method || 'GET',
            params = obj.params || {};

        params['access_token'] = tokenStore['fbtoken'];

        return $http({ method: method, url: 'https://graph.facebook.com' + obj.path + '?' + toQueryString(params), params: params })
            .error(function(data, status, headers, config) {
                if (data.error && data.error.type === 'OAuthException') {
                    $rootScope.$emit('OAuthException');
                }
            });
    }

    /**
     * Helper function for a POST call into the Graph API
     * @param path
     * @param params
     * @returns {*}
     */
    function post(path, params) {
        return api({ method: 'POST', path: path, params: params });
    }

    /**
     * Helper function for a GET call into the Graph API
     * @param path
     * @param params
     * @returns {*}
     */
    function get(path, params) {
        return api({ method: 'GET', path: path, params: params });
    }

    function parseQueryString(queryString) {
        var qs = decodeURIComponent(queryString),
            obj = {},
            params = qs.split('&');
        params.forEach(function(param) {
            var splitter = param.split('=');
            obj[splitter[0]] = splitter[1];
        });
        return obj;
    }

    function toQueryString(obj) {
        var parts = [];
        for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
                parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
            }
        }
        return parts.join("&");
    }

    return {
        init: init,
        login: login,
        logout: logout,
        revokePermissions: revokePermissions,
        api: api,
        post: post,
        get: get,
        oauthCallback: oauthCallback
    }

});

// Global function called back by the OAuth login dialog
function oauthCallback(url) {
    var injector = angular.element(document.getElementById('main')).injector();
    injector.invoke(function(OpenFB) {
        OpenFB.oauthCallback(url);
    });
}