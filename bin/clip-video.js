#!/usr/bin/env node
var clipperFactory = require(__dirname + '/../server/clipper');

var clipper = clipperFactory.getClipper();
clipper.clipAllVideosUnderVideoLocalFolder();