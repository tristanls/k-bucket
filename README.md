# k-bucket

_Stability: 1 - [Experimental](https://github.com/tristanls/stability-index#stability-1---experimental)_

Kademlia DHT K-bucket implementation as a binary tree.

## Installation

    npm install k-bucket

## Tests

    npm test

## Usage

```javascript
var KBucket = require('k-bucket');

var kBucket = new KBucket({
    localNodeId: "my node id", /* default: random SHA-1 */
    root: kBucket /* default: self (for internal implementation use) */
});
```

## Overview

A [*Distributed Hash Table (DHT)*](http://en.wikipedia.org/wiki/Distributed_hash_table) is a decentralized distributed system that provides a lookup table similar to a hash table. 

*k-bucket* is an implementation of a storage mechanism for keys within a DHT. It stores `contact` objects which represent locations and addresses of nodes in the decentralized distributed system. `contact` objects are typically identified by a SHA-1 hash, however this restriction is lifted in this implementation. Additionally, node ids of different lengths can be compared.

This Kademlia DHT k-bucket implementation is meant to be as minimal as possible. It assumes that `contact` objects consist only of `id`, and an optional `vectorClock`. It is useful, and necessary, to attach other properties to a `contact`. For example, one may want to attach `ip` and `port` properties which allow the application to send IP traffic to the `contact`. However, this information is extraneous and irrelevant to the operation of a k-bucket.

It is worth highlighting the presence of an optional `vectorClock` as part of `contact` implementation. The purpose of the `vectorClock` (a simple integer) is to enable distinguishing between `contact` objects that may have "physically" moved to a different machine while keeping the same `contact.id`. This is useful when working with actors and an actor moves from one machine to another.

## Documentation

### KBucket

Implementation of a Kademlia DHT k-bucket used for storing contact (peer node) information.

KBucket starts off as a single k-bucket with capacity of _k_. As contacts are added, once the _k+1_ contact is added, the k-bucket is split into two k-buckets. The split happens according to the first bit of the contact node id. The k-bucket that would contain the local node id is the "near" k-bucket, and the other one is the "far" k-bucket. The "far" k-bucket is marked as _don't split_ in order to prevent further splitting. The contact nodes that existed are then redistributed along the two new k-buckets and the old k-bucket becomes an inner node within a tree data structure. 

As even more contacts are added to the "near" k-bucket, the "near" k-bucket will split again as it becomes full. However, this time it is split along the second bit of the contact node id. Again, the two newly created k-buckets are marked "near" and "far" and the "far" k-bucket is marked as _don't split_. Again, the contact nodes that existed in the old bucket are redistributed. This continues as long as nodes are being added to the "near" k-bucket, until the number of splits reaches the length of the local node id.

As more contacts are added to the "far" k-bucket and it reaches its capacity, it does not split. Instead, the k-bucket emits a "ping" event (register a listener: `kBucket.on('ping', function (oldContacts, newContact) {...});` and includes an array of old contact nodes that it hasn't heard from in a while and requires you to confirm that those contact nodes still respond (literally respond to a PING RPC). If an old contact node still responds, it should be re-added (`kBucket.add(oldContact)`) back to the k-bucket. This puts the old contact on the "recently heard from" end of the list of nodes in the k-bucket. If the old contact does not respond, it should be removed (`kBucket.remove(oldContact)`) and the new contact being added now has room to be stored (`kBucket.add(newContact)`).

#### new KBucket(options)

Creates a new KBucket. The `options` are:

  * `localNodeId`: An optional string or a Buffer representing the local node id. If not provided, a local node id will be created via `crypto.createHash('sha1').digest()`. If a string is provided, it will be converted into a Buffer.
  * `root`: _(reserved for internal use)_ provides a reference for to the root of the tree data structure as the k-bucket splits as new contacts are added

#### kBucket.add(contact, [bitIndex])

  * `contact` Object
  * `bitIndex` Integer, Optional, Default: 0
  * Return: Object

Adds a contact to the k-bucket.

#### kBucket.closest(contact, n, [bitIndex])

  * `contact` Object
  * `n` Integer
  * `bitIndex` Integer, Optional, Default: 0
  * Return: Array

Get the n closest contacts to the provided contact. "Closest" here means: closest according to the XOR metric of the contact node id.

#### kBucket.determineBucket(id, [bitIndex])

  * `id` Buffer
  * `bitIndex` Integer
  * Return: Integer

_reserved for internal use_ Determines whether the id at the bitIndex is 0 or 1. If 0, returns -1, else 1. Id is a Buffer.

#### kBucket.distance(firstId, secondId)

  * `firstId` Buffer
  * `secondId` Buffer
  * Return: Integer

Finds the XOR distance between firstId and secondId.

#### kBucket.indexOf(contact)

  * `contact` Object
  * Return: Integer

Returns the index of the contact if it exists, returns -1 otherwise.

#### kBucket.remove(contact, [bitIndex])

  * `contact` Object
  * `bitIndex` Integer, Optional, Default: 0
  * Return: Object

Removes the contact.

#### kBucket.splitAndAdd(contact, [bitIndex])

  * `contact` Object
  * `bitIndex` Integer, Optional, Default: 0
  * Return: Object

_reserved for internal use_ Splits the bucket, redistributes contacts to the new buckets, and marks the bucket that was split as an inner node of the binary tree of buckets by setting self.bucket = undefined. Also, marks the "far away" bucket as `dontSplit`.

#### kBucket.update(contact, index)

  * `contact` Object
  * `index` Integer
  * Return: void

_reserved for internal use_ Updates the contact and compares the vector clocks if provided. If new contact vector clock is deprecated, contact is abandoned (not added). If new contact vector clock is the same, contact is marked as moste recently contacted (by being moved to the right/end of the bucket array). If new contact vector clock is more recent, the old contact is removed and the new contact is marked as most recently contacted.

#### Event: 'ping'

  * `oldContacts` _Array_ The array of contacts to ping
  * `newContact` _Object_ The new contact to be added if one of old contacts does not respond

Emitted every time a contact is added that would exceed the capacity of a _don't split_ k-bucket it belongs to.

## Sources

The implementation has been sourced from:

  - [A formal specification of the Kademlia distributed hash table](http://maude.sip.ucm.es/kademlia/files/pita_kademlia.pdf)
  - [Distributed Hash Tables (part 2)](http://offthelip.org/?p=157)