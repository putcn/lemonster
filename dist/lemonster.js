
(function() {
  var dependencies = [];
  var module = angular.module("lemonster", dependencies);
  var namespace = "lemonster";

  module.factory( namespace + '.services.controller', function($q, $cacheFactory) {
      var controllerPromises = {};
      var serviceStub = {};
      var controllerCache = $cacheFactory("controllerCache");
      serviceStub.getControllerDescriptor = function(controllerId){
        if(controllerPromises[controllerId]){
          return controllerPromises[controllerId];
        }

        var deferred = $q.defer();
        controllerPromises[controllerId] = deferred.promise;

        if(controllerCache.get(controllerId)){
          deferred.resolve( controllerCache.get(controllerId) );
        }else{
          $.ajax({
            url : controllerId + "/controller.js",
            dataType : "text"
          }).done(function(controllerDescriptoStr){
            
            var dummyFn = new Function("return (" + controllerDescriptoStr + ")");
            var controllerDescriptor = dummyFn.apply(this);
            controllerCache.put(controllerId, controllerDescriptor);
            deferred.resolve(controllerDescriptor);
            
          })
        }
        return deferred.promise;
      }
      return serviceStub;
  });


  module.factory( namespace + '.services.dataAccess', function($q, $cacheFactory, $http) {
    var dataAccessCache = $cacheFactory("dataAccessCache");
    var serviceStub = {};
    var dataAccessDefPromise = {};


    var noop = angular.noop,
      forEach = angular.forEach,
      extend = angular.extend,
      copy = angular.copy,
      isFunction = angular.isFunction;

    function encodeUriSegment(val) {
      return encodeUriQuery(val, true).
        replace(/%26/gi, '&').
        replace(/%3D/gi, '=').
        replace(/%2B/gi, '+');
    }

    function encodeUriQuery(val, pctEncodeSpaces) {
      return encodeURIComponent(val).
        replace(/%40/gi, '@').
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, (pctEncodeSpaces ? '%20' : '+'));
    }

    
    function getURLFromPattern(url, params){
      var urlParams = {};
      forEach(url.split(/\W/), function(param){
        if (param === 'hasOwnProperty') {
          throw "hasOwnProperty is not a valid parameter name.";
        }
        if (!(new RegExp("^\\d+$").test(param)) && param &&
             (new RegExp("(^|[^\\\\]):" + param + "(\\W|$)").test(url))) {
          urlParams[param] = true;
        }
      });

      url = url.replace(/\\:/g, ':');

      params = params || {};
      forEach(urlParams, function(_, urlParam){
        var val = params[urlParam];
        if (angular.isDefined(val) && val !== null) {
          encodedVal = encodeUriSegment(val);
          url = url.replace(new RegExp(":" + urlParam + "(\\W|$)", "g"), function(match, p1) {
            return encodedVal + p1;
          });
        } else {
          url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W|$)", "g"), function(match,
              leadingSlashes, tail) {
            if (tail.charAt(0) == '/') {
              return tail;
            } else {
              return leadingSlashes + tail;
            }
          });
        }
      });

      return url;
    }

    function getDataFromPatter(dataPattern, obj){
      var data = {};
      angular.forEach(dataPattern, function(item, key){
        if( typeof(item) == "string" && item.indexof(":") == 0 ){
          data[key] = obj[item.substring(1)];
        }
      })
      return data;
    }


    function serviceParser(serviceDef){
      var serviceObj = {};
      angular.forEach(serviceDef, function(item, key){

        serviceObj[key] = function(configObj){
          var deferred = $q.defer();

          $http({
            url : getURLFromPattern(item.url, configObj),
            data : getDataFromPatter(item.data, configObj),
            method : item.method
          }).then(function(data){
            deferred.resolve(data);
          }, function(error){
            deferred.reject(error);
          })

          return deferred.promise;
        }

      })
      return serviceObj;
    }

    serviceStub.callService = function(serviceName, operationName, configObj){
      var deferred = $q.defer();

      serviceStub.getServiceHelper(serviceName).then(function(service){
        ( service[operationName].apply(this, [configObj]) ).then(function(data){
          deferred.resolve(data);
        }, function(error){
          deferred.reject(error);
        })
      }, function(){
        deferred.reject("error while fetching service");
      })

      return deferred.promise;
    }

    serviceStub.getServiceHelper = function(serviceId){
      if(dataAccessDefPromise[serviceId]){
        return dataAccessDefPromise[serviceId];
      }
      var deferred = $q.defer();

      if(dataAccessCache.get(serviceId)){
        deferred.resolve( dataAccessCache.get(serviceId) );
      }else{
        $http({
          url : serviceId + ".json",
          method : "GET"
        }).then(function(httpStub){
          var service = httpStub.data;
          var serviceObj = serviceParser(service);
          dataAccessCache.put(serviceId, serviceObj);
          deferred.resolve(serviceObj);
        }, function(){ 
          deferred.reject("no such service def file");
        })
      }

      return deferred.promise;
    }
    return serviceStub;
  })

  module.factory( namespace + '.services.i18n', function($q, $cacheFactory, $http) {

      var i18nPromises = {};
      var serviceStub = {};
      var currentLang = "en_us";//$i18nProvider.getLang(); TBD
      var i18nCache = $cacheFactory("i18nCache" + currentLang);
      serviceStub.getI18nDictionary = function(componentId){
        var langBundleId = componentId + "/nls/" +  currentLang + ".json";
        if(i18nPromises[langBundleId]){
          return i18nPromises[langBundleId];
        }

        var deferred = $q.defer();
        i18nPromises[langBundleId] = deferred.promise;
        if( i18nCache.get(langBundleId) ){
          deferred.resolve( i18nCache.get(langBundleId) );
        }else{
          $http.get(langBundleId).then(function(langBundle){
            deferred.resolve(langBundle.data);
          }, function(){
            deferred.resolve({});
          })
        }
        return deferred.promise;

      }
      
      return serviceStub;
  });

  //directive to load component with givn type
  module.directive("lmComponent", function(){
    return {
      restrict : "A",
      scope : {
        param : "=param",
        type : "=lmComponent"
      },
      controller : [
        "$scope",
        "$element", 
        "$http",
        "$log",
        "$q", 
        namespace + ".services.controller", 
        namespace + ".services.dataAccess",
        namespace + ".services.i18n",
        function($scope, $element, $http, $log, $q, controllerService, dataAccess, i18nService){
        
          $scope.services = { //services to provide to each component instance
            dataAccess : dataAccess,
            "$log" : $log
          }

          $scope.i18nDictonary = {};

          $scope.i18n = function(key, config){
            var stringTemplate = $scope.i18nDictonary[key];
            var retString;
            if(!key){
              return "%KEY MISSING%";
            }
            if(!stringTemplate){
              return key;
            }
            if( stringTemplate.indexOf("{{")>0 && stringTemplate.indexOf("}}")>0 ){
              config = config || {};
              retString = $interpolate(stringTemplate)(config);
            }else{
              retString = stringTemplate;
            }
            return retString;
          }

          
          $scope.$watch("type", function(){

            var type = $scope.type;
            if(type){
              $scope.templateURL = type + "/view.html";
              $q.all([
                controllerService.getControllerDescriptor(type),
                i18nService.getI18nDictionary(type)
              ]).then(function (deferredValues) {
                var controllerDescriptor = deferredValues[0];
                var i18nDictonary = deferredValues[1];
                $scope.i18nDictonary = i18nDictonary;

                
                angular.forEach(controllerDescriptor, function(attr, name){
                  if(typeof(attr) == "function"){
                    $scope[name] = angular.bind($scope, attr);
                  }else{
                    $scope[name] = $scope.param[name] || attr;
                  }

                  if(typeof($scope.init) == "function"){
                    $scope.init.apply($scope, []);
                  }
                })

              })
            }
          }) //end of componentName watch
        
        }
      ],
      template : "<div ng-include='templateURL'></div>" 
    }
  })
  
  //directive to parse the UI descriptor JSON
  module.directive("lmParser", function(){
    return {
      restrict : "A",
      scope : {
        descriptor : "=lmParser"
      },
      template : "<div lm-component='descriptor.type' param='descriptor'></div>" 
    }
  })

  

})();