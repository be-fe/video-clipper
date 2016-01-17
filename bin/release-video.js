#!/usr/bin/env node

var fs = require('fs');
var md5 = require('md5');
var request = require('request');

var defaultConfig = {
    serverUrl: 'http://example.com:1234/context/',
    tokenPass: 'the token is being used to send back the token for sending files'
};

var utils = {
    init: function(config) {
        this.config = config;
    },
    ajax: {
        upload: 'ajax/upload-file',
        token: 'ajax/request-token',
        check: 'ajax/check-file'
    },
    url: function(type) {
        return this.config.serverUrl + this.ajax[type];
    }
};

if (!fs.existsSync('./config.js')) {
    fs.writeFile('./config.js', 'module.exports =' +
        JSON.stringify(defaultConfig, null, '   ')
    );
}

var dirConfig = require('./config');
if (dirConfig.serverUrl == defaultConfig.serverUrl) {
    console.log('Please set up the correct values for the ./config.js');
    process.exit(1);
}

// @test token url
request
    .post(utils.url('token'))
    .on('response', function(res) {
        console.log(res);
    })




