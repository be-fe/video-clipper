var npath = require('path');
var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
var md5 = require('md5');
var _ = require('lodash');
var util = require('../common/util');

var dir = fs.realpathSync(__dirname + '/../../');

module.exports = {
    readInfo: function(videoPath) {
        // console.log(this.context);
        return util.readInfo(videoPath);
    },
    writeInfo: function(videoPath, info) {
        util.writeInfo(videoPath, info);
    },
    readDir: util.readDir,
    mkdir: function(path) {
        if (!fs.existsSync(path)) {
            this.mkdir(npath.dirname(path));
            fs.mkdirSync(path);
        }
    },
    ensureVideoFolderStructure: function(videoPath) {
        var context = this.context;
        var self = this;

        for (var key in context.output) {
            var target = context.output[key];
            if (/\/$/.exec(target)) {
                self.mkdir(videoPath + target);
            }
        }
    },
    outputAllThumbnails: function(outputInfo, callback) {
        //console.log(outputInfo);
        var cmd = ffmpeg(outputInfo.source);
        cmd.withFps(1)
            .withSize('?x' + (outputInfo.size || 200));
        cmd.save(outputInfo.folderPath + '/%5d.jpg')
            .on('end', function() {
                callback();
            })
            .on('error', function(err) {
                throw err;
                callback();
            });
    },

    /**
     *
     * @param outputInfo
     *  times, source, folderPath, size, prefix
     * @param callback
     */
    outputImage: function(outputInfo, callback) {
        var cmd = ffmpeg(outputInfo.source);

        var found = true;
        var prefix = outputInfo.prefix ? outputInfo.prefix + '_' : '';

        outputInfo.times.some(function(time) {
            //console.log('why the fuck this is not running?', outputInfo.folderPath + prefix + time + '.jpg',
            //    fs.existsSync(outputInfo.folderPath + prefix + time + '.jpg'));
            if (!fs.existsSync(outputInfo.folderPath + prefix + time + '.jpg')) {
                found = false;
                return true;
            }
        });

        if (!found) {
            cmd.screenshots({
                timestamps: outputInfo.times,
                folder: outputInfo.folderPath,
                filename: prefix + '%s.jpg',
                size: '?x' + (outputInfo.size || '280')
            }).on('end', function (err) {
                //console.log('why the fuck this is not running?');
                if (err) {
                    console.log('The images can\'t be gotten.');
                    throw err;
                }
                callback();
            });
        } else {
            console.log('Every image found, exit job.');
            callback();
        }
    },
    outputVideo: function(outputInfo, callback) {
        if (fs.existsSync(outputInfo.target)) {
            callback('ok');
            return;
        }
        var self = this, context = self.context;

        var tempPath = context.config.temp + md5(Math.random()) + '.mp4';
        // to tranform the video into mp4 format
        var cmd = ffmpeg(outputInfo.source);

        cmd.videoCodec('libx264');
        cmd.audioCodec('libvo_aacenc');

        cmd.videoBitrate(outputInfo.videoBitrate);
        cmd.audioBitrate(outputInfo.audioBitrate);

        cmd.seekInput(outputInfo.start)
            .duration(outputInfo.duration);

        var target = outputInfo.target;
        cmd.save(tempPath)
            .on('end', function (err) {
                var stat = fs.statSync(tempPath);
                if (stat.size < 5000) {
                    // video output too small
                    callback('none');
                } else {
                    // video size ok
                    fs.renameSync(tempPath, target);
                    callback('ok');
                }
            });
    },
    setupConfig: function() {
        var context = this.context;
        _.extend(context, require('../config'));
    }
};
