"use strict";

var crypto = require('crypto'),
    events = require('events'),
    util = require('util');

var DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET = 20,
    DEFAULT_NUMBER_OF_NODES_TO_PING = 3;

var KBucket = module.exports = function KBucket (options) {
    var self = this;
    options = options || {};
    events.EventEmitter.call(self);

    // the bucket array has least-recently-contacted at the "front/left" side
    // and the most-recently-contaced at the "back/right" side
    self.bucket = [];
    self.localNodeId = options.localNodeId || crypto.createHash('sha1').digest();
    if (!(self.localNodeId instanceof Buffer)) {
        self.localNodeId = new Buffer(self.localNodeId);
    }

    // V8 hints
    self.dontSplit = null;
    self.low = null;
    self.high = null;
};

util.inherits(KBucket, events.EventEmitter);