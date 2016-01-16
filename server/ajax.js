var fs = require('fs');
var url = require('url');
var npath = require('path');
var fileBackend = require('./backend/file-backend');

module.exports.setup = function (app) {

    app.all('/ajax/local-video-list', function (req, res) {
        var videos = fileBackend.readVideoList();

        res.json(videos);
    });

    app.all('/ajax/get-video', function(req, res) {
        var videoId = req.body.id;
        console.log(req.body, ':body');

        var info = fileBackend.getVideo(videoId);

        res.json(info);
    });

    app.all('/ajax/write-video-info', function(req, res) {
        var videoId = req.body.videoId;
        var info = req.body.info;

        fileBackend.writeInfo(videoId, info);
        res.json('ok');
    });

    var starred;
    var refreshRandom = function() {
        starred = [];
        var videos = fileBackend.readVideoList();
        videos.forEach(function(video) {
            // use starred
            var info = fileBackend.getVideo(video.key);
            //info.info.selections.forEach(function(clip) {
            //    if (clip.starred) {
            //        clip.video = video.key;
            //        starred.push(clip);
            //    }
            //});

            // use removed
            //console.log(info);
            if (info.removed) {
                info.info.selections.forEach(function(clip) {
                    clip.video = video.key;
                });
                starred = starred.concat(info.info.selections);
            }
        });
    }
    app.all('/ajax/refresh-random', function(req, res) {
        refreshRandom();
        res.json('ok');
    });

    app.all('/ajax/remove', function(req, res) {
        var id = req.body.id;

        fileBackend.removeVideo(id);

        res.json('ok');
    });


    app.all('/ajax/random', function(req, res) {
        if (!starred) {
            refreshRandom();
        }

        var result = [];
        for (var i = 0; i < 20; i++) {
            result.push(starred[Math.floor(Math.random() * starred.length)]);
        }

        res.json(result);
    });
};