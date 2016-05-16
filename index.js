/*
index.js - Kademlia DHT K-bucket implementation as a binary tree.

The MIT License (MIT)

Copyright (c) 2013-2016 Tristan Slominski

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
'use strict'

var bufferEquals = require('buffer-equals')
var randomBytes = require('randombytes')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

module.exports = KBucket

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
        emit a `ping` event that contains `numberOfNodesToPing` nodes that have
        not been contacted the longest.
    * `root`: _Object_ _**CAUTION: reserved for internal use**_ Provides a
        reference to the root of the tree data structure as the k-bucket splits
        when new contacts are added.
*/
function KBucket (options) {
  EventEmitter.call(this)
  options = options || {}

  // use an arbiter from options or vectorClock arbiter by default
  this.arbiter = options.arbiter || function arbiter (incumbent, candidate) {
    return incumbent.vectorClock > candidate.vectorClock ? incumbent : candidate
  }

  // the bucket array has least-recently-contacted at the "front/left" side
  // and the most-recently-contaced at the "back/right" side
  this.bucket = []
  this.localNodeId = options.localNodeId || randomBytes(20)
  if (!Buffer.isBuffer(this.localNodeId)) throw new TypeError('localNodeId is not a Buffer')
  this.numberOfNodesPerKBucket = options.numberOfNodesPerKBucket || 20
  this.numberOfNodesToPing = options.numberOfNodesToPing || 3
  this.root = options.root || this

  // V8 hints
  this.dontSplit = null
  this.low = null
  this.high = null
}

inherits(KBucket, EventEmitter)

KBucket.distance = function (firstId, secondId) {
  var distance = 0
  var min = Math.min(firstId.length, secondId.length)
  var max = Math.max(firstId.length, secondId.length)
  for (var i = 0; i < min; ++i) distance = distance * 256 + (firstId[i] ^ secondId[i])
  for (; i < max; ++i) distance = distance * 256 + 255
  return distance
}

// contact: *required* the contact object to add
// bitIndex: the bitIndex to which bit to check in the Buffer for navigating
//           the binary tree
KBucket.prototype._add = function (contact, bitIndex) {
  // first check whether we are an inner node or a leaf (with bucket contents)
  if (this.bucket === null) {
    // this is not a leaf node but an inner node with 'low' and 'high'
    // branches; we will check the appropriate bit of the identifier and
    // delegate to the appropriate node for further processing
    if (this._determineBucket(contact.id, bitIndex++) < 0) {
      return this.low._add(contact, bitIndex)
    } else {
      return this.high._add(contact, bitIndex)
    }
  }

  // check if the contact already exists
  var index = this._indexOf(contact.id)
  if (index >= 0) {
    this._update(contact, index)
    return this
  }

  if (this.bucket.length < this.numberOfNodesPerKBucket) {
    this.bucket.push(contact)
    this.root.emit('added', contact)
    return this
  }

  // the bucket is full
  if (this.dontSplit) {
    // we are not allowed to split the bucket
    // we need to ping the first this.numberOfNodesToPing
    // in order to determine if they are alive
    // only if one of the pinged nodes does not respond, can the new contact
    // be added (this prevents DoS flodding with new invalid contacts)
    this.root.emit('ping', this.bucket.slice(0, this.numberOfNodesToPing), contact)
    return this
  }

  return this._splitAndAdd(contact, bitIndex)
}

// contact: *required* the contact object to add
KBucket.prototype.add = function (contact) {
  if (!Buffer.isBuffer(contact.id)) throw new TypeError('contact.id is not a Buffer')
  return this._add(contact, 0)
}

// id: Buffer *required* node id
// n: Integer *required* maximum number of closest contacts to return
// bitIndex: Integer (Default: 0)
// Return: Array of maximum of `n` closest contacts to the node id
KBucket.prototype._closest = function (id, n, bitIndex) {
  if (this.bucket === null) {
    var contacts
    if (this._determineBucket(id, bitIndex++) < 0) {
      contacts = this.low._closest(id, n, bitIndex)
      if (contacts.length < n) contacts = contacts.concat(this.high._closest(id, n, bitIndex))
    } else {
      contacts = this.high._closest(id, n, bitIndex)
      if (contacts.length < n) contacts = contacts.concat(this.low._closest(id, n, bitIndex))
    }

    return contacts.slice(0, n)
  }

  return this.bucket
    .map(function (storedContact) {
      storedContact.distance = KBucket.distance(storedContact.id, id)
      return storedContact
    })
    .sort(function (a, b) { return a.distance - b.distance })
    .slice(0, n)
}

// id: Buffer *required* node id
// n: Integer *required* maximum number of closest contacts to return
// Return: Array of maximum of `n` closest contacts to the node id
KBucket.prototype.closest = function (id, n) {
  if (!Buffer.isBuffer(id)) throw new TypeError('id is not a Buffer')
  return this._closest(id, n, 0)
}

// Counts the number of contacts recursively.
// If this is a leaf, just return the number of contacts contained. Otherwise,
// return the length of the high and low branches combined.
KBucket.prototype.count = function count () {
  if (this.bucket !== null) return this.bucket.length
  return this.high.count() + this.low.count()
}

// Determines whether the id at the bitIndex is 0 or 1. If 0, returns -1, else 1
// id: a Buffer to compare localNodeId with
// bitIndex: the bitIndex to which bit to check in the id Buffer
KBucket.prototype._determineBucket = function (id, bitIndex) {
  bitIndex = bitIndex || 0

  // **NOTE** remember that id is a Buffer and has granularity of
  // bytes (8 bits), whereas the bitIndex is the _bit_ index (not byte)

  // id's that are too short are put in low bucket (1 byte = 8 bits)
  // parseInt(bitIndex / 8) finds how many bytes the bitIndex describes
  // bitIndex % 8 checks if we have extra bits beyond byte multiples
  // if number of bytes is <= no. of bytes described by bitIndex and there
  // are extra bits to consider, this means id has less bits than what
  // bitIndex describes, id therefore is too short, and will be put in low
  // bucket
  var bytesDescribedByBitIndex = parseInt(bitIndex / 8, 10)
  var bitIndexWithinByte = bitIndex % 8
  if ((id.length <= bytesDescribedByBitIndex) && (bitIndexWithinByte !== 0)) return -1

  var byteUnderConsideration = id[bytesDescribedByBitIndex]

  // byteUnderConsideration is an integer from 0 to 255 represented by 8 bits
  // where 255 is 11111111 and 0 is 00000000
  // in order to find out whether the bit at bitIndexWithinByte is set
  // we construct Math.pow(2, (7 - bitIndexWithinByte)) which will consist
  // of all bits being 0, with only one bit set to 1
  // for example, if bitIndexWithinByte is 3, we will construct 00010000 by
  // Math.pow(2, (7 - 3)) -> Math.pow(2, 4) -> 16
  if (byteUnderConsideration & Math.pow(2, (7 - bitIndexWithinByte))) return 1

  return -1
}

// Get a contact by its exact ID.
// If this is a leaf, loop through the bucket contents and return the correct
// contact if we have it or null if not. If this is an inner node, determine
// which branch of the tree to traverse and repeat.
// id: Buffer *required* The ID of the contact to fetch.
// bitIndex: the bitIndex to which bit to check in the Buffer for navigating
//           the binary tree
KBucket.prototype._get = function (id, bitIndex) {
  if (this.bucket === null) {
    if (this._determineBucket(id, bitIndex++) < 0) {
      return this.low._get(id, bitIndex)
    } else {
      return this.high._get(id, bitIndex)
    }
  }

  var index = this._indexOf(id) // index of uses contact id for matching
  if (index < 0) return null // contact not found

  return this.bucket[index]
}

// Get a contact by its exact ID.
// If this is a leaf, loop through the bucket contents and return the correct
// contact if we have it or null if not. If this is an inner node, determine
// which branch of the tree to traverse and repeat.
// id: Buffer *required* The ID of the contact to fetch.
KBucket.prototype.get = function get (id) {
  if (!Buffer.isBuffer(id)) throw new TypeError('id is not a Buffer')
  return this._get(id, 0)
}

// id: Buffer Contact node id.
// Returns the index of the contact with the given id if it exists
KBucket.prototype._indexOf = function indexOf (id) {
  for (var i = 0; i < this.bucket.length; i++) {
    if (bufferEquals(this.bucket[i].id, id)) return i
  }

  return -1
}

// id: Buffer *required* The ID of the contact to remove.
// bitIndex: the bitIndex to which bit to check in the Buffer for navigating
//           the binary tree
KBucket.prototype._remove = function (id, bitIndex) {
  // first check whether we are an inner node or a leaf (with bucket contents)
  if (this.bucket === null) {
    // this is not a leaf node but an inner node with 'low' and 'high'
    // branches; we will check the appropriate bit of the identifier and
    // delegate to the appropriate node for further processing
    if (this._determineBucket(id, bitIndex++) < 0) {
      return this.low._remove(id, bitIndex)
    } else {
      return this.high._remove(id, bitIndex)
    }
  }

  var index = this._indexOf(id)
  if (index >= 0) {
    var contact = this.bucket.splice(index, 1)[0]
    this.root.emit('removed', contact)
  }

  return this
}

// id: Buffer *required* he ID of the contact to remove.
KBucket.prototype.remove = function remove (id) {
  if (!Buffer.isBuffer(id)) throw new TypeError('id is not a Buffer')
  return this._remove(id, 0)
}

// Splits the bucket, redistributes contacts to the new buckets, and marks the
// bucket that was split as an inner node of the binary tree of buckets by
// setting this.bucket = null
// contact: *required* the contact object to add
// bitIndex: the bitIndex to which byte to check in the Buffer for navigating the
//          binary tree
KBucket.prototype._splitAndAdd = function (contact, bitIndex) {
  this.low = new KBucket({
    arbiter: this.arbiter,
    localNodeId: this.localNodeId,
    numberOfNodesPerKBucket: this.numberOfNodesPerKBucket,
    numberOfNodesToPing: this.numberOfNodesToPing,
    root: this.root
  })
  this.high = new KBucket({
    arbiter: this.arbiter,
    localNodeId: this.localNodeId,
    numberOfNodesPerKBucket: this.numberOfNodesPerKBucket,
    numberOfNodesToPing: this.numberOfNodesToPing,
    root: this.root
  })

  bitIndex = bitIndex || 0

  // redistribute existing contacts amongst the two newly created buckets
  this.bucket.forEach(function (storedContact) {
    if (this._determineBucket(storedContact.id, bitIndex) < 0) {
      this.low.add(storedContact)
    } else {
      this.high.add(storedContact)
    }
  }.bind(this))

  this.bucket = null // mark as inner tree node

  // don't split the "far away" bucket
  // we check where the local node would end up and mark the other one as
  // "dontSplit" (i.e. "far away")
  if (this._determineBucket(this.localNodeId, bitIndex) < 0) {
    // local node belongs to "low" bucket, so mark the other one
    this.high.dontSplit = true
  } else {
    this.low.dontSplit = true
  }

  // add the contact being added
  this._add(contact, bitIndex)
  return this
}

// Returns all the contacts contained in the tree as an array.
// If this is a leaf, return a copy of the bucket. `slice` is used so that we
// don't accidentally leak an internal reference out that might be accidentally
// misused. If this is not a leaf, return the union of the low and high
// branches (themselves also as arrays).
KBucket.prototype.toArray = function () {
  if (this.bucket !== null) return this.bucket.slice(0)
  return this.low.toArray().concat(this.high.toArray())
}

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
  // sanity check
  if (!bufferEquals(this.bucket[index].id, contact.id)) {
    throw new Error('indexOf() calculation resulted in wrong index')
  }

  var incumbent = this.bucket[index]
  var selection = this.arbiter(incumbent, contact)
  // if the selection is our old contact and the candidate is some new
  // contact, then there is nothing to do
  if (selection === incumbent && incumbent !== contact) return

  this.bucket.splice(index, 1) // remove old contact
  this.bucket.push(selection) // add more recent contact version
  this.root.emit('updated', incumbent, selection)
}
