var jobRunner = require('./jobs/job-runner');
var npath = require('path');
var md5 = require('md5');
var ffmpeg = require('fluent-ffmpeg');
var fs = require('fs');
var _ = require('lodash');

var THREAD_COUNT = {
    thumbnailVideos: 1,
    clipVideos: 1,
    clipGetter: 1
};

/**
 *
 */
var VideoThumbnailProcessor = jobRunner('Video Thumbnail Process', {
    readOrCreateInfo: function (videoFolerObj, callback) {
        var self = this;
        var info = self.readInfo(videoFolerObj.path);
        var context = self.context;
        var output = context.output;

        if (!info) {
            var rawFolder = videoFolerObj.path + output.raw;
            info = {};

            self.readDir(rawFolder, function (rawFileObj) {
                if (context.rgx.video.exec(rawFileObj.file)) {
                    info.rawFile = {
                        file: rawFileObj.file,
                        ext: rawFileObj.ext,
                        base: rawFileObj.base
                    };
                }
            });

            self.probeVideoInfo(info, videoFolerObj, callback);
        } else {
            setImmediate(function () {
                callback(info);
            });
        }
    },
    probeVideoInfo: function (info, videoFolderObj, callback) {
        var self = this;
        var output = self.context.output;

        ffmpeg.ffprobe(videoFolderObj.path + output.raw + info.rawFile.file, function (err, metadata) {
            if (err) {
                console.log(' ------- ERROR on -------- ', videoFolderObj.path, err);
                callback();
                return;
            }

            var vopts, aopts;
            _.each(metadata.streams, function (stream) {
                if (stream.codec_type == 'video') {
                    vopts = stream;
                } else if (stream.codec_type == 'audio') {
                    aopts = stream;
                }
            });

            //vopts.bit_rate = vopts.bit_rate ?
            //    vopts.bit_rate > 2500000 ? '2500k' :
            //        ('' + vopts.bit_rate).toLocaleLowerCase() == 'n/a' ? '2200k' :
            //            vopts.bit_rate > 1000000 ? (vopts.bit_rate / 1000 + 200) + 'k' : '1200k'
            //    : '1200k';

            // 暂时设置比较低的码率, 看看效果
            vopts.bit_rate = '1200k';
            aopts.bit_rate = '96k';


            var duration = parseFloat(vopts.duration);
            console.log(' duration of the video : ' + duration);
            if (isNaN(duration) || !duration) {
                duration = 4 * 3600;
            }

            info.videoOpts = vopts;
            info.audioOpts = aopts;
            info.duration = duration;

            // change the logic to getting all clips
            var DURATION = 5;
            console.log('reach here - if info.selections', !!info.selections);
            if (!info.selections) {
                info.selections = [];

                for (var i = 0; i < info.duration; i += DURATION) {
                    var select = {type: 'loop'};
                    select.play = select.start = i;
                    select.end = i + DURATION;
                    info.selections.push(select);
                }
            }

            //console.log(info); @test
            self.writeInfo(videoFolderObj.path, info);

            callback(info);
        });
    },
    outputMp4: function (videoPath, info, callback) {
        var self = this;
        var output = this.context.output;

        self.outputVideo({
            source: videoPath + output.raw + info.rawFile.file,
            target: videoPath + 'output.mp4',
            videoBitrate: info.videoOpts.bit_rate,
            audioBitrate: info.audioOpts.bit_rate,
            start: 0,
            duration: info.duration
        }, function () {
            callback();
        });
    },
    jobProcessVideo: function (videoFolderObj) {
        // getting from raw to mp4
        var self = this;
        var context = self.context;
        var output = self.context.output;
        videoFolderObj.path = videoFolderObj.path + '/';

        self.pushJob({
            name: 'Process video - ' + videoFolderObj.path,
            run: function (next) {
                self.ensureVideoFolderStructure(videoFolderObj.path);
                self.readOrCreateInfo(videoFolderObj, function (info) {
                    if (!info) {
                        console.log('Error ====== : on info found ', videoFolderObj.path);
                    }
                    next();
                });
            }
        })
    }
});


var VideoClipper = jobRunner('Clip single video', {
    jobClipVideo: function (videoPath, info) {
        var self = this;
        var context = self.context;

        self.pushJob({
            name: 'Clip video - ' + videoPath,
            run: function (next) {
                var clipGenerator = new ClipGenerator(THREAD_COUNT.clipGetter - 1);
                if (!info.selections) {
                    next();
                    return;
                }

                info.selections.forEach(function (select) {
                    clipGenerator.generateClip(videoPath, info, select);
                });
                //console.log(clipGenerator.running, clipGenerator._jobs.length, 'clip gen');
                clipGenerator.jobsEnd(function() {
                    console.log('finished video : ', videoPath);
                    fs.writeFileSync(videoPath + '/clipped', '');
                    next();
                });
            }
        });
    }
});

var ClipGenerator = jobRunner('Clip generator', {
    getRawFile: function (videoPath, info) {
        var context = this.context;

        return videoPath + '/' + context.output.raw + info.rawFile.file;
    },
    getClipTarget: function (videoPath, second, loopType, fileType, suffix) {
        var context = this.context;

        return videoPath + '/' + context.output[fileType || 'video'] +
            _.padLeft(second, 5, '0')
            + '_'
            + (loopType == 'non-loop' ? 'nl' : 'l')
            + (suffix || '')
            + '.mp4';
    },
    generateClip: function (videoPath, info, select) {
        var self = this;

        var rawPath = self.getRawFile(videoPath, info);
        var videoTarget = self.getClipTarget(videoPath, select.start, select.type, 'video');
        self.jobGenerateClip(rawPath, videoTarget, select.start, select.end, 'video', info.videoOpts.bit_rate);

        self.jobGenerateClip(rawPath, self.getClipTarget(videoPath, select.start, select.type, 'audio', '_curr'),
            select.start, select.end, 'audio');

        self.jobGenerateThumbnail(videoTarget, self.getThumbailTargetFolder(videoPath, 'thumbBig'), select.start, 320);
        self.jobGenerateThumbnail(videoTarget, self.getThumbailTargetFolder(videoPath, 'thumbSmall'), select.start, 120);
    },
    getThumbailTargetFolder: function (videoPath, thumbnailType) {
        var context = this.context;

        return videoPath + '/' + context.output[thumbnailType] + '/';
    },
    jobGenerateThumbnail: function(source, targetFolder, second, size) {
        var self = this;
        var context = self.context;

        if (!fs.existsSync(targetFolder + second + '.jpg')) {
            self.pushJob({
                name: 'Generate thumbnail for clip - ' + source + '=>' + targetFolder + second + '.jpg',
                run: function(next) {
                    var cmd = ffmpeg(source);
                    cmd.screenshots({
                        timestamps: [0],
                        folder: targetFolder,
                        filename: second + '.jpg',
                        size: '?x' + (size || '280')
                    }).on('end', function (err) {
                        //console.log('why the fuck this is not running?');
                        if (err) {
                            console.log('The images can\'t be gotten.');
                            throw err;
                        }
                        next();
                    });
                }
            })
        }
    },
    jobGenerateClip: function (source, target, start, end, fileType, videoBitRate) {
        var self = this;
        var context = self.context;

        if (!fs.existsSync(target)) {
            self.pushJob({
                name: 'Generate clip - ' + npath.basename(source) + ' => ' + npath.basename(target) + ' (' + start + ', ' + end + ')',
                run: function (next) {
                    var cmd = ffmpeg(source);

                    if (fileType == 'video') {
                        cmd.videoCodec('libx264')
                            .videoBitrate(videoBitRate)
                            //.outputOption('-bf', '0');
                    } else {
                        cmd.noVideo();
                    }

                    cmd.audioCodec('libvo_aacenc')
                        .audioBitrate('128k');

                    cmd.seekInput(start)
                        .duration(end - start);

                    var tempPath = context.config.temp + md5(Math.random()) + '.mp4';
                    cmd.save(tempPath)
                        .on('end', function () {
                            fs.renameSync(tempPath, target);
                            next();
                        });
                }
            });
        }
    }
});

var Clipper = jobRunner('Clipper', {
    jobEnsureFolders: function () {
        var self = this;
        var config = self.context.config;

        self.pushJob({
            name: 'ensure all folders',
            run: function (next) {

                self.mkdir(config.pathLocalVideo);
                self.mkdir(config.pathPackedVideo);
                self.mkdir(config.pathRemovedVideo);
                self.mkdir(config.temp);

                next();
            }
        });

        return self;
    },
    jobMkdirVideos: function () {
        var self = this;
        var config = self.context.config;
        var context = self.context;

        self.pushJob({
            name: 'ensure video folders made',
            run: function (next) {
                self.readDir(config.pathLocalVideo, function (fileObj) {
                    if (context.rgx.video.exec(fileObj.file)) {
                        console.log('Video found - ', fileObj.path);

                        var videoFolder = fileObj.base.replace(/\W/g, '_') + '__' + md5(fileObj.file).substr(0, 16);

                        var videoPath = config.pathLocalVideo + videoFolder + '/';
                        self.mkdir(videoPath);
                        self.ensureVideoFolderStructure(videoPath);
                        fs.renameSync(fileObj.filePath, videoPath + 'raw/' + fileObj.file);
                    }
                });

                next();
            }
        });

        return self;
    },
    jobProcessVideos: function () {
        var self = this;
        var context = self.context;

        self.pushJob({
            name: 'Process videos',
            run: function (next) {
                var videoThumbnailProcess = new VideoThumbnailProcessor(THREAD_COUNT.thumbnailVideos - 1);

                self.readDir(context.config.pathLocalVideo, function (fileObj) {
                    if (fileObj.stat.isDirectory()) {
                        videoThumbnailProcess
                            .jobProcessVideo(fileObj);
                    }
                });

                videoThumbnailProcess.jobsEnd(next);
            }
        });

        return self;
    },
    jobClipVideos: function (skipRemove) {
        var self = this;
        var context = self.context;
        var infoStat = context.infoStat;

        self.pushJob({
            name: 'Clip videos',
            run: function (next) {
                var videoClipper = new VideoClipper(THREAD_COUNT.clipVideos - 1);

                self.readDir(context.config.pathLocalVideo, function (fileObj) {
                    var info = self.readInfo(fileObj.path);

                    if (info
                        && (!infoStat[fileObj.path] || infoStat[fileObj.path].mtime < info.stat.mtime)
                            //&& info.thumbnailDone
                        && info.selections) {
                        var videos = {}, audios = {};
                        infoStat[fileObj.path] = info.stat;

                        info.selections.forEach(function (select) {
                            var base = _.padLeft(select.start, 5, '0')
                                + (select.type != 'loop' ? '_nl' : '_l');
                            videos[base + '.mp4'] = 1;
                            audios[base + '_curr.mp4'] = 1;
                            if (select.type == 'loop') {
                                audios[base + '_prev.mp4'] = 1;
                                audios[base + '_next.mp4'] = 1;
                            }
                        });

                        //console.log(videos, audios);

                        if (!skipRemove) {
                            self.readDir(fileObj.path + context.output.video, function (videoObj) {
                                if (!videos[videoObj.file]) {
                                    console.log('Removing non-specified videos - %s', videoObj.filePath);
                                    fs.unlinkSync(videoObj.filePath);
                                }
                            });
                            self.readDir(fileObj.path + context.output.audio, function (audioObj) {
                                if (!audios[audioObj.file]) {
                                    console.log('Removing non-specified audio - %s', audioObj.filePath);
                                    fs.unlinkSync(audioObj.filePath);
                                }
                            });
                        }

                        videoClipper.jobClipVideo(fileObj.path, info);
                    }
                });

                videoClipper.jobsEnd(next);
            }
        });

        return self;
    },
    clipAllVideosUnderVideoLocalFolder: function() {
        this.jobEnsureFolders()
            .jobMkdirVideos()
            .jobProcessVideos()
            .jobClipVideos()
            .jobsEnd(function() {
                console.log(' #=============== END of video clipping ===================# ');
            });
    }
});


var getClipper = function () {
    var clipper = new Clipper();
    return clipper;
};

module.exports = {
    getClipper: getClipper
};