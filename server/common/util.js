var fs = require('fs');
var npath = require('path');
var ctx = require('../config');

var util = {
        readDir: function (path, cb, sortFunc) {
            path = /\/$/.exec(path) ? path : path + '/';
            var files = fs.readdirSync(path);

            var fileObjs = [];
            files.forEach(function (file, index) {
                if (file.substr(0, 1) != '.') {
                    var filePath = path + file;
                    var extname = npath.extname(file);
                    var basename = npath.basename(file, extname);
                    var stat = fs.statSync(filePath);

                    fileObjs.push({
                        file: file,
                        filePath:  filePath,
                        path: filePath +  '/',
                        stat: stat,
                        ext: extname,
                        base: basename
                    });
                }
            });

            if (sortFunc) {
                fileObjs.sort(sortFunc);
            }
            fileObjs.forEach(function(fileObj) {
                cb(fileObj)
            });
        },
        readInfo: function (videoPath) {
            var infoPath = videoPath + ctx.output.info;

            if (!fs.existsSync(infoPath)) {
                return null;
            } else {
                try {
                    var stat = fs.statSync(infoPath);

                    var info = JSON.parse(fs.readFileSync(infoPath));
                    info.stat = stat;

                    return info;
                } catch (ex) {
                    return null;
                }
            }
        },
        writeInfo: function (videoPath, info) {
            var infoPath = videoPath + '/' + ctx.output.info;
            fs.writeFileSync(infoPath, JSON.stringify(info, null, '   '));
        }
    };

module.exports = util;