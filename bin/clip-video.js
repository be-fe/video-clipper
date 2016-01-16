#!/usr/bin/env node
var clipperFactory = require(__dirname + '/../main/clipper');

var clipper = clipperFactory.getClipper();
clipper.clipAllVideosUnderVideoLocalFolder();