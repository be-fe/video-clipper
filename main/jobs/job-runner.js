var ffmpeg = require('fluent-ffmpeg');
var _ = require('lodash');

var seq = 0;

var jobRunner = function () {
};

jobRunner.prototype = {

    initRunner: function() {
        this._jobs = [];
        this.running = 0;
        this.context = {};
        this.runnerId = ++seq;

        return this;
    },

    pushJob: function (job) {
        var self = this;
        self._jobs.push(job);
        self.runJob();

        return self;
    },

    unshiftJob: function(job) {
        var self = this;
        self._jobs.unshift(job);
        self.runJob();

        return self;
    },

    runJob: function () {
        var jobs = this._jobs, self = this;
        if (self.running > self.concurrentNumber) return;

        if (jobs.length) {
            var job = jobs.shift();

            self.running++;

            var nextJob = function () {
                console.log('#<===== End %s[%s] #%s: %s ', self.name, self.runnerId, self.running, (job.name || 'unnamed job'));
                setImmediate(function () {
                    self.running--;
                    self.runJob();
                });
            };

            console.log('#=====> Start %s[%s] %s: %s ', self.name, self.runnerId, self.running, (job.name || 'unnamed job'));
            job.run(nextJob, job);
        } else {
            self.running = 0;
            if (this._jobsEnd) {
                this._jobsEnd();
                this._jobsEnd = null;
            }
        }

        return self;
    },

    _jobsEnd: null,
    jobsEnd: function(onJobsEnd) {
        this._jobsEnd = onJobsEnd;
        if (!this.running) {
            this._jobsEnd();
        }
    }
};

_.extend(jobRunner.prototype, require('./runner-util'));


module.exports = function(name, tasks) {
    var fn = function(concurrentNumber) {
        this.name = name || 'unamed runner';
        this.concurrentNumber = concurrentNumber || 0;
        this.initRunner();

        this.setupConfig();
    };

    fn.prototype = new jobRunner();

    _.extend(fn.prototype, tasks);

    return fn;
};


