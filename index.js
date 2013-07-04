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

// contact: *required* the contact object to add
// id: a Buffer we use to walk the KBucket binary tree
// bitIndex: the bitIndex to which byte to check in the Buffer for navigating the
//          binary tree
KBucket.prototype.add = function add (contact, id, bitIndex) {
    var self = this;

    // console.dir(self);

    // first check whether we are an inner node or a leaf (with bucket contents)
    if (!self.bucket) {
        // this is not a leaf node but an inner node with 'low' and 'high'
        // branches; we will check the appropriate byte of the identifier and
        // delegate to the appropriate node for further processing
        id = id || contact.id;
        bitIndex = bitIndex || 0;

        if (id[bitIndex++] < 0x80) {
            return self.low.add(contact, id, bitIndex);
        } else {
            return self.high.add(contact, id, bitIndex);
        }
    }

    // check if the contact already exists
    var index = self.indexOf(contact);
    if (index >= 0) return self;

    if (self.bucket.length >= constants.DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET) {
        return self.splitAndAdd(contact);
    }
    
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

// Splits the bucket, redistributes contacts to the new buckets, and marks the
// bucket that was split as an inner node of the binary tree of buckets by
// setting self.bucket = undefined;
// contact: *required* the contact object to add
// id: a Buffer we use to walk the KBucket binary tree
// bitIndex: the bitIndex to which byte to check in the Buffer for navigating the
//          binary tree
KBucket.prototype.splitAndAdd = function splitAndAdd (contact, id, bitIndex) {
    var self = this;
    self.low = new KBucket({localNodeId: self.localNodeId});
    self.high = new KBucket({localNodeId: self.localNodeId});

    id = id || contact.id;
    bitIndex = bitIndex || 0;

    // redistribute existing contacts amongst the two newly created buckets
    self.bucket.forEach(function (storedContact) {
        // TODO: add extra check for identifiers that are too short
        if (storedContact.id[bitIndex] < 0x80) {
            self.low.add(storedContact);
        } else {
            self.high.add(storedContact);
        }
    });

    self.bucket = undefined; // mark as inner tree node
    
    // add the contact being added
    self.add(contact, id, bitIndex);

    return self;
};

// Determines whether the id at the bitIndex is 0 or 1. If 0, returns -1, else 1
// id: a Buffer to compare localNodeId with
// bitIndex: the bitIndex to which bit to check in the id Buffer
KBucket.prototype.determineBucket = function determineBucket (id, bitIndex) {
    var self = this;

    bitIndex = bitIndex || 0;

    // **NOTE** remember that id is a Buffer and has granularity of 
    // bytes (8 bits), whereas the bitIndex is the _bit_ index (not byte)

    // id's that are too short are put in low bucket (1 byte = 8 bits)
    // parseInt(bitIndex / 8) finds how many bytes the bitIndex describes
    // bitIndex % 8 checks if we have extra bits beyond byte multiples
    // if number of bytes is <= no. of bytes described by bitIndex and there
    // are extra bits to consider, this means id has less bits than what 
    // bitIndex describes, id therefore is too short, and will be put in low 
    // bucket
    var bytesDescribedByBitIndex = parseInt(bitIndex / 8);
    var bitIndexWithinByte = bitIndex % 8;
    if ((id.length <= bytesDescribedByBitIndex)
        && (bitIndexWithinByte != 0)) return -1; 

    var byteUnderConsideration = id[bytesDescribedByBitIndex];

    // byteUnderConsideration is an integer from 0 to 255 represented by 8 bits 
    // where 255 is 11111111 and 0 is 00000000
    // in order to find out whether the bit at bitIndexWithinByte is set 
    // we construct Math.pow(2, (7 - bitIndexWithinByte)) which will consist 
    // of all bits being 0, with only one bit set to 1
    // for example, if bitIndexWithinByte is 3, we will construct 00010000 by
    // Math.pow(2, (7 - 3)) -> Math.pow(2, 4) -> 16
    if (byteUnderConsideration & Math.pow(2, (7 - bitIndexWithinByte))) {
        return 1;
    }
    
    return -1;
};