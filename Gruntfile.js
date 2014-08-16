/* jshint node:true */

module.exports = function (grunt) {
  'use strict';

  var distDir = "dist/";

  var fs = require('fs.extra');

  var config = {
    pkg: grunt.file.readJSON('package.json'),
    tempDir: 'tmp',
    docsDir: 'docs',
    testDir: 'test',
    unitTests: 'test/unit/specs/**/*.js',
    unitTestDir: 'test/unit/',
    copy : {
      all : {
        files :[
          {
            expand : true,
            src : ["**"],
            cwd  : "src/",
            dest : distDir
          }
        ]
      }
    }
  };

  grunt.loadNpmTasks('grunt-contrib-copy');
  
  // show elapsed time at the end
  require('time-grunt')(grunt);

  grunt.task.registerTask("emptyDist", "empty dist folder before compile", function(){
    try {
      fs.rmrfSync( distDir );
    }catch(e){

    }
  })



  // pass the config to grunt
  grunt.initConfig(config);

  grunt.registerTask('default', ["emptyDist", "copy:all"]);
};