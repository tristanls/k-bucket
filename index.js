"use strict";

require('buffertools');

var constants = require('./lib/constants.js'),
    crypto = require('crypto'),
    events = require('events'),
    util = require('util');

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

KBucket.prototype.add = function add (contact) {
    var self = this;

    // check if the contact already exists
    var index = self.indexOf(contact);
    if (index >= 0) return self;

    self.bucket.push(contact);
    return self;
};

// Returns the index of the contact if it exists
// **NOTE**: indexOf() does not compare vectorClock
KBucket.prototype.indexOf = function indexOf (contact) {
    var self = this;
    for (var i = 0; i < self.bucket.length; i++) {
        if (self.bucket[i].id.equals(contact.id)) return i;
    }
    return -1;
};