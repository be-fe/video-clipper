#!/usr/bin/env node

var fs = require('fs');
var _ = require('lodash');
var npath = require('path');
var md5 = require('md5');
var request = require('request');
var clipperFactory = require(__dirname + '/../main/clipper');

var defaultConfig = {
    serverUrl: 'http://example.com:1234/context/',
    tokenPass: 'the token is being used to send back the token for sending files'
};

if (!fs.existsSync('./config.json')) {
    fs.writeFileSync('./config.json',
        JSON.stringify(defaultConfig, null, '   ')
    );
}

var dirConfig = _.extend(
    {},
    defaultConfig,
    JSON.parse(fs.readFileSync('./config.json')),
    {
        path: {
            local: npath.resolve('./videos-local/') + '/',
            removed: npath.resolve('./videos-removed/') + '/'
        }
    });

var utils = {
    init: function (config) {
        this.config = config;
    },
    ajax: {
        upload: 'ajax/upload-file',
        token: 'ajax/request-token',
        check: 'ajax/check-file'
    },
    url: function (type) {
        return this.config.serverUrl + this.ajax[type];
    },
    uploadDir: function (dirpath, callback) {
        var files = fs.readdirSync(dirpath);
        var self = this;

        if (files.length) {
            var uploadNext = function () {
                //console.log('files - ', files);
                var file = files.pop();
                if (!file) {
                    callback();
                    return;
                }
                self.upload(dirpath + file, uploadNext);
            };
            uploadNext();
        } else {
            callback();
        }
    }
    ,
    upload: function (filepath, callback) {
        callback = callback || _.noop;
        var relativePath = npath.relative(dirConfig.path.local, filepath);
        console.log('relative path: ', relativePath);
        request
            .post(utils.url('check'), {
                form: {filePath: relativePath}
            }, function (err, res) {
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
                                console.log(filepath + ' sent.');
                                callback && callback();
                            });
                        });
                } else {
                    console.log(filepath + ' exists.');
                    callback && callback();
                }
            });
    }
};

if (dirConfig.serverUrl == defaultConfig.serverUrl) {
    console.log('Please set up the correct values for the ./config.js, as now it\'s still' +
    ' using the default values.');
    process.exit(1);
}
utils.init(dirConfig);

// @test token url
var videos = fs.readdirSync(dirConfig.path.local);

var nextVideo = function () {
    var video = videos.pop();
    if (!video) return;

    var videoPath = dirConfig.path.local + video + '/';
    if (fs.existsSync(videoPath + 'video/')) {
        utils.uploadDir(videoPath + 'video/', function () {
            utils.uploadDir(videoPath + 'thumb_small/', function () {
                utils.uploadDir(videoPath + 'thumb_big/', function () {
                    // finish a video~ move it to removed if raw doesn't exists
                    if (fs.existsSync(videoPath + 'clipped')) {
                        fs.renameSync(videoPath, dirConfig.path.removed + video);

                        console.log(' >>>>>>>>>>> video uploaded as : http://' + dirConfig.serverUrl + 'index#video=' + video);
                    }
                    nextVideo();
                });
            });
        });
    }
};

var clipper = clipperFactory.getClipper();
clipper.clipAllVideosUnderVideoLocalFolder(function () {
    nextVideo();
});