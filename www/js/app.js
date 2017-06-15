// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
var base_url = "http://ec2-54-186-121-116.us-west-2.compute.amazonaws.com/iknow/server_side";
//var base_url = "http://ec2-54-214-99-121.us-west-2.compute.amazonaws.com:80/iknow/server_side"
var fallbackSrc = 'img/no-image.png'
    //localStorage.setItem('baseURL', base_url)
angular.module('app', ['ionic', 'app.controllers', 'app.routes', 'app.services', 'app.directives', 'app.profiles'])

.run(function($ionicPlatform, $http) {
    $ionicPlatform.ready(function($http) {
        // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
        // for form inputs)
        if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
            cordova.plugins.Keyboard.disableScroll(true);

        }
        if (window.StatusBar) {
            // org.apache.cordova.statusbar required
            StatusBar.styleDefault();
        }



    });

})




angular.module('app.profiles', ['app.config'])