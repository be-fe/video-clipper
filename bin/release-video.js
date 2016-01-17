#!/usr/bin/env node

var fs = require('fs');
var _ = require('lodash');
var npath = require('path');
var md5 = require('md5');
var request = require('request');

var defaultConfig = {
    serverUrl: 'http://example.com:1234/context/',
    tokenPass: 'the token is being used to send back the token for sending files',
    path: {
        local: npath.resolve('./videos-local/') + '/',
        removed: npath.resolve('./videos-removed/') + '/'
    }
};

if (!fs.existsSync('./config.json')) {
    fs.writeFileSync('./config.json',
        JSON.stringify(defaultConfig, null, '   ')
    );
}

var dirConfig = _.extend({}, defaultConfig, JSON.parse(fs.readFileSync('./config.json')));

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
    },
    upload: function(filepath, callback) {
        var relativePath = npath.relative(dirConfig.path.local, filepath);
        request
            .post(utils.url('check'), function(err, res) {
                if (res.body == 'no') {
                    request
                        .post(utils.url('token'), function (err, res) {
                            console.log('token got as : %s', res.body);
                            request.post(utils.url('upload'), {
                                formData: {
                                    filePath: relativePath,
                                    content: fs.createReadStream(filepath),
                                    tokenHash: md5(res.body + dirConfig.tokenPass)
                                }
                            }, function (err, res) {
                                callback('sent');
                                console.log(res.body);
                            });
                        });
                } else {
                    callback('exists');
                }
            });
    }
};

if (dirConfig.serverUrl == defaultConfig.serverUrl) {
    console.log('Please set up the correct values for the ./config.js, as now it\'s still' +
        ' using the default values.' );
    process.exit(1);
}
utils.init(dirConfig);

// @test token url
utils.upload(npath.resolve('./videos-local/screencast_2016_01_16_19_03_25__b681fabda351fcb8/video/00000_l.mp4'));



