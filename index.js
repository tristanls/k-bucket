/*

index.js - Kademlia DHT K-bucket implementation as a binary tree.

The MIT License (MIT)

Copyright (c) 2013-2015 Tristan Slominski

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

*/
"use strict";

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var bufferEquals = require('buffer-equals');
var randomBytes = require('randombytes');

/*
  * `options`:
    * `arbiter`: _Function_ _(Default: vectorClock arbiter)_
        `function (incumbent, candidate) { return contact; }` An optional
        `arbiter` function that givent two `contact` objects with the same `id`
        returns the desired object to be used for updating the k-bucket. For
        more details, see [arbiter function](#arbiter-function).
    * `localNodeId`: _Buffer_ An optional Buffer representing the local node id.
        If not provided, a local node id will be created via
        `crypto.randomBytes(20)`.
    * `numberOfNodesPerKBucket`: _Integer_ _(Default: 20)_ The number of nodes
        that a k-bucket can contain before being full or split.
    * `numberOfNodesToPing`: _Integer_ _(Default: 3)_ The number of nodes to
        ping when a bucket that should not be split becomes full. KBucket will
        call the `ping` callback that contains `numberOfNodesToPing` nodes that have
        not been contacted the longest.
    * `root`: _Object_ _**CAUTION: reserved for internal use**_ Provides a
        reference to the root of the tree data structure as the k-bucket splits
        when new contacts are added.
*/
var KBucket = module.exports = function KBucket (options) {
    var self = this;
    EventEmitter.call(self);
    options = options || {};

    // use an arbiter from options or vectorClock arbiter by default
    self.arbiter = options.arbiter || function arbiter(incumbent, candidate) {
        if (incumbent.vectorClock > candidate.vectorClock) {
            return incumbent;
        }
        return candidate;
    };

    // the bucket array has least-recently-contacted at the "front/left" side
    // and the most-recently-contaced at the "back/right" side
    self.bucket = [];
    self.localNodeId = options.localNodeId || randomBytes(20);
    if (!Buffer.isBuffer(self.localNodeId)) {
        throw new TypeError("localNodeId is not a Buffer");
    }
    self.numberOfNodesPerKBucket = options.numberOfNodesPerKBucket || 20;
    self.numberOfNodesToPing = options.numberOfNodesToPing || 3;
    self.root = options.root || self;

    // V8 hints
    self.dontSplit = null;
    self.low = null;
    self.high = null;
};

inherits(KBucket, EventEmitter);

KBucket.distance = function distance (firstId, secondId) {
    var distance = 0;
    var min = Math.min(firstId.length, secondId.length);
    var max = Math.max(firstId.length, secondId.length);
    for (var i = 0; i < min; ++i) {
        distance = distance * 256 + (firstId[i] ^ secondId[i]);
    }
    for (; i < max; ++i) {
        distance = distance * 256 + 255;
    }
    return distance;
};

// contact: *required* the contact object to add
// bitIndex: the bitIndex to which bit to check in the Buffer for navigating
//           the binary tree
KBucket.prototype._add = function (contact, bitIndex) {
    var self = this;

    // first check whether we are an inner node or a leaf (with bucket contents)
    if (!self.bucket) {
        // this is not a leaf node but an inner node with 'low' and 'high'
        // branches; we will check the appropriate bit of the identifier and
        // delegate to the appropriate node for further processing
        if (self._determineBucket(contact.id, bitIndex++) < 0) {
            return self.low._add(contact, bitIndex);
        } else {
            return self.high._add(contact, bitIndex);
        }
    }

    // check if the contact already exists
    var index = self._indexOf(contact);
    if (index >= 0) {
        self._update(contact, index);
        return self;
    }

    if (self.bucket.length < self.numberOfNodesPerKBucket) {
        self.bucket.push(contact);
        self.emit('add', contact);
        return self;
    }

    // the bucket is full
    if (self.dontSplit) {
        // we are not allowed to split the bucket
        // we need to ping the first self.numberOfNodesToPing
        // in order to determine if they are alive
        // only if one of the pinged nodes does not respond, can the new contact
        // be added (this prevents DoS flodding with new invalid contacts)
        self.root.emit('ping', self.bucket.slice(0, self.numberOfNodesToPing), contact);
        return self;
    }

    return self._splitAndAdd(contact, bitIndex);
};

// contact: *required* the contact object to add
KBucket.prototype.add = function add (contact) {
    if (!Buffer.isBuffer(contact.id)) {
        throw new TypeError("contact.id is not a Buffer");
    }
    return this._add(contact, 0);
};

// contact: Object *required* contact object
//   id: Buffer *require* node id
// n: Integer *required* maximum number of closest contacts to return
// bitIndex: Integer (Default: 0)
// Return: Array of maximum of `n` closest contacts to the `contact`
KBucket.prototype._closest = function (contact, n, bitIndex) {
    var self = this;

    var contacts;

    if (!self.bucket) {
        if (self._determineBucket(contact.id, bitIndex++) < 0) {
            contacts = self.low._closest(contact, n, bitIndex);
            if (contacts.length < n) {
                contacts = contacts.concat(self.high._closest(contact, n, bitIndex));
            }
        } else {
            contacts = self.high._closest(contact, n, bitIndex);
            if (contacts.length < n) {
                contacts = contacts.concat(self.low._closest(contact, n, bitIndex));
            }
        }
        return contacts.slice(0, n);
    }

    contacts = self.bucket.slice();
    contacts.forEach(function (storedContact) {
        storedContact.distance = KBucket.distance(storedContact.id, contact.id);
    });

    contacts.sort(function (a, b) {return a.distance - b.distance;});

    return contacts.slice(0, n);
};

// contact: Object *required* contact object
//   id: Buffer *require* node id
// n: Integer *required* maximum number of closest contacts to return
// Return: Array of maximum of `n` closest contacts to the `contact`
KBucket.prototype.closest = function (contact, n) {
    if (!Buffer.isBuffer(contact.id)) {
        throw new TypeError("contact.id is not a Buffer");
    }
    return this._closest(contact, n, 0);
};

// Counts the number of contacts recursively.
// If this is a leaf, just return the number of contacts contained. Otherwise,
// return the length of the high and low branches combined.
KBucket.prototype.count = function count () {
    var self = this;

    if (self.bucket) {
        return self.bucket.length;
    } else {
        return self.high.count() + self.low.count();
    }
};

// Determines whether the id at the bitIndex is 0 or 1. If 0, returns -1, else 1
// id: a Buffer to compare localNodeId with
// bitIndex: the bitIndex to which bit to check in the id Buffer
KBucket.prototype._determineBucket = function (id, bitIndex) {
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
    var bytesDescribedByBitIndex = parseInt(bitIndex / 8, 10);
    var bitIndexWithinByte = bitIndex % 8;
    if ((id.length <= bytesDescribedByBitIndex)
        && (bitIndexWithinByte != 0))
        return -1;

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

// Get a contact by its exact ID.
// If this is a leaf, loop through the bucket contents and return the correct
// contact if we have it or null if not. If this is an inner node, determine
// which branch of the tree to traverse and repeat.
// id: *required* a Buffer specifying the ID of the contact to fetch
// bitIndex: the bitIndex to which bit to check in the Buffer for navigating
//           the binary tree
KBucket.prototype._get = function (id, bitIndex) {
    var self = this;

    if (!self.bucket) {
        if (self._determineBucket(id, bitIndex++) < 0) {
            return self.low._get(id, bitIndex);
        } else {
            return self.high._get(id, bitIndex);
        }
    }

    var index = self._indexOf({id: id}); // index of uses contact.id for matching
    if (index < 0) {
        return null; // contact not found
    }

    return self.bucket[index];
};

// Get a contact by its exact ID.
// If this is a leaf, loop through the bucket contents and return the correct
// contact if we have it or null if not. If this is an inner node, determine
// which branch of the tree to traverse and repeat.
// id: *required* a Buffer specifying the ID of the contact to fetch
KBucket.prototype.get = function get (id) {
    if (!Buffer.isBuffer(id)) {
        throw new TypeError("id is not a Buffer");
    }
    return this._get(id, 0);
};

// Returns the index of the contact if it exists
// **NOTE**: indexOf() does not compare vectorClock
KBucket.prototype._indexOf = function indexOf (contact) {
    var self = this;
    for (var i = 0; i < self.bucket.length; i++) {
        if (bufferEquals(self.bucket[i].id, contact.id)) return i;
    }
    return -1;
};

// contact: *required* the contact object to remove
// bitIndex: the bitIndex to which bit to check in the Buffer for navigating
//           the binary tree
KBucket.prototype._remove = function (contact, bitIndex) {
    var self = this;

    // first check whether we are an inner node or a leaf (with bucket contents)
    if (!self.bucket) {
        // this is not a leaf node but an inner node with 'low' and 'high'
        // branches; we will check the appropriate bit of the identifier and
        // delegate to the appropriate node for further processing
        if (self._determineBucket(contact.id, bitIndex++) < 0) {
            return self.low._remove(contact, bitIndex);
        } else {
            return self.high._remove(contact, bitIndex);
        }
    }

    var index = self._indexOf(contact);
    if (index >= 0) {
        self.bucket.splice(index, 1);
        self.emit('remove', contact);
    }
    return self;
};

// contact: *required* the contact object to remove
KBucket.prototype.remove = function remove (contact) {
    if (!Buffer.isBuffer(contact.id)) {
        throw new TypeError("contact.id is not a Buffer");
    }
    return this._remove(contact, 0);
};

// Splits the bucket, redistributes contacts to the new buckets, and marks the
// bucket that was split as an inner node of the binary tree of buckets by
// setting self.bucket = undefined;
// contact: *required* the contact object to add
// bitIndex: the bitIndex to which byte to check in the Buffer for navigating the
//          binary tree
KBucket.prototype._splitAndAdd = function (contact, bitIndex) {
    var self = this;
    self.low = new KBucket({
        arbiter: self.arbiter,
        localNodeId: self.localNodeId,
        numberOfNodesPerKBucket: self.numberOfNodesPerKBucket,
        numberOfNodesToPing: self.numberOfNodesToPing,
        root: self.root
    });
    self.high = new KBucket({
        arbiter: self.arbiter,
        localNodeId: self.localNodeId,
        numberOfNodesPerKBucket: self.numberOfNodesPerKBucket,
        numberOfNodesToPing: self.numberOfNodesToPing,
        root: self.root
    });

    bitIndex = bitIndex || 0;

    // redistribute existing contacts amongst the two newly created buckets
    self.bucket.forEach(function (storedContact) {
        if (self._determineBucket(storedContact.id, bitIndex) < 0) {
            self.low.add(storedContact);
        } else {
            self.high.add(storedContact);
        }
    });

    self.bucket = undefined; // mark as inner tree node

    // don't split the "far away" bucket
    // we check where the local node would end up and mark the other one as
    // "dontSplit" (i.e. "far away")
    if (self._determineBucket(self.localNodeId, bitIndex) < 0) {
        // local node belongs to "low" bucket, so mark the other one
        self.high.dontSplit = true;
    } else {
        self.low.dontSplit = true;
    }

    // add the contact being added
    self._add(contact, bitIndex);

    return self;
};

// Returns all the contacts contained in the tree as an array.
// If self is a leaf, return a copy of the bucket. `slice` is used so that we
// don't accidentally leak an internal reference out that might be accidentally
// misused. If self is not a leaf, return the union of the low and high
// branches (themselves also as arrays).
KBucket.prototype.toArray = function toArray () {
    var self = this;

    if (self.bucket) {
        return self.bucket.slice(0);
    } else {
        return self.low.toArray().concat(self.high.toArray());
    }
};

// Updates the contact selected by the arbiter.
// If the selection is our old contact and the candidate is some new contact
// then the new contact is abandoned (not added).
// If the selection is our old contact and the candidate is our old contact
// then we are refreshing the contact and it is marked as most recently
// contacted (by being moved to the right/end of the bucket array).
// If the selection is our new contact, the old contact is removed and the new
// contact is marked as most recently contacted.
// contact: *required* the contact to update
// index: *required* the index in the bucket where contact exists
//        (index has already been computed in a previous calculation)
KBucket.prototype._update = function (contact, index) {
    var self = this;
    // sanity check
    if (!bufferEquals(self.bucket[index].id, contact.id)) {
        throw new Error("indexOf() calculation resulted in wrong index")
    }

    var incumbent = self.bucket[index];
    var selection = self.arbiter(incumbent, contact);
    if (selection === incumbent && incumbent !== contact) {
        // if the selection is our old contact and the candidate is some new
        // contact, then there is nothing to do
        return;
    }

    self.bucket.splice(index, 1); // remove old contact
    self.bucket.push(selection); // add more recent contact version
    self.emit('update', incumbent, selection);
};
