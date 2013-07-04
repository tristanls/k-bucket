"use strict";

var events = require('events'),
    util = require('util');

var DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET = 20,
    DEFAULT_NUMBER_OF_NODES_TO_PING = 3;

var KBucket = module.exports = function KBucket (localNodeId) {
    var self = this;
    events.EventEmitter.call(self);

    self.bucket = [];
    self.localNodeId = localNodeId;

    // V8 hints
    self.dontSplit = null;
    self.low = null;
    self.high = null;
};

util.inherits(KBucket, events.EventEmitter);