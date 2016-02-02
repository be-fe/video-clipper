var fs = require('fs');
var context = {};

var dir = fs.realpathSync('./');

context.config = {
    path: dir,
    pathLocalVideo: dir + '/videos-local/',
    pathPackedVideo: dir + '/videos-packed/',
    pathRemovedVideo: dir + '/videos-removed/',
    temp: dir + '/temp-output/'
};

context.rgx = {
    video: /\.(mp4|wmv|avi|rmvb|mkv|rm|rmvb|mov)$/,
    txt: /\.txt$/,
    js: /\.js$/
};

context.output = {
    raw: 'raw/',
    mp4: 'mp4/',

    thumbSmall: 'thumb_small/',
    thumbBig: 'thumb_big/',

    audio: 'audio/',
    video: 'video/',
    image: 'image/',

    temp: 'temp/',

    info: 'info.js'
};

context.infoStat = {};

module.exports = context;