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
    localNodeId: new Buffer("my node id") // default: random SHA-1
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

**Public API**
  * [KBucket.distance(firstId, secondId)](#kbucketdistancefirstid-secondid)
  * [new KBucket(options)](#new-kbucketoptions)
  * [kBucket.add(contact, \[bitIndex\])](#kbucketaddcontact-bitindex)
  * [kBucket.closest(contact, n, \[bitIndex\])](#kbucketclosestcontact-n-bitindex)
  * [kBucket.remove(contact, \[bitIndex\])](#kbucketremovecontact-bitindex)
  * [Event 'ping'](#event-ping)

#### KBucket.distance(firstId, secondId)

  * `firstId`: _Buffer_ Buffer containing first id.
  * `secondId`: _Buffer_ Buffer containing second id.
  * Return: _Integer_ The XOR distance between `firstId` and `secondId`.

Finds the XOR distance between firstId and secondId.

#### new KBucket(options)

  * `options`:
    * `localNodeId`: _String (base64)_ or _Buffer_ An optional String or a Buffer representing the local node id. If not provided, a local node id will be created via `crypto.createHash('sha1').update('' + new Date().getTime() + process.hrtime()[1]).digest()`. If a String is provided, it will be assumed to be base64 encoded and will be converted into a Buffer.
    * `root`: _Object_ _**CAUTION: reserved for internal use**_ Provides a reference to the root of the tree data structure as the k-bucket splits when new contacts are added.

Creates a new KBucket.

#### kBucket.add(contact, [bitIndex])

  * `contact`: _Object_ The contact object to add.
    * `id`: _Buffer_ Contact node id.
    * Any satellite data that is part of the `contact` object will not be altered, only `id` is used.
  * `bitIndex`: _Integer_ _(Default: 0)_ _**CAUTION: reserved for internal use**_ The bit index to which bit to check in the `id` Buffer.
  * Return: _Object_ The k-bucket itself.

Adds a `contact` to the k-bucket.

#### kBucket.closest(contact, n, [bitIndex])

  * `contact`: _Object_ The contact object to find closest contacts to.
    * `id`: _Buffer_ Contact node id.
    * Any satellite data that is part of the `contact` object will not be altered, only `id` is used.
  * `n`: _Integer_ The maximum number of closest contacts to return.
  * `bitIndex`: _Integer_ _(Default: 0)_ _**CAUTION: reserved for internal use**_  The bit index to which bit to check in the `id` Buffer.
  * Return: _Array_ Maximum of `n` closest contacts to the `contact`.

Get the `n` closest contacts to the provided `contact`. "Closest" here means: closest according to the XOR metric of the `contact` node id.

#### kBucket.determineBucket(id, [bitIndex])

_**CAUTION: reserved for internal use**_

  * `id`: _Buffer_ Id to compare `localNodeId` with.
  * `bitIndex`: _Integer_ _(Default: 0)_  The bit index to which bit to check in the `id` Buffer.
  * Return: _Integer_ -1 if `id` at `bitIndex` is 0, 1 otherwise.

Determines whether the `id` at the `bitIndex` is 0 or 1. If 0, returns -1, else 1.

#### kBucket.indexOf(contact)

_**CAUTION: reserved for internal use**_

  * `contact`: _Object_ The contact object.
    * `id`: _Buffer_ Contact node id.
    * Any satellite data that is part of the `contact` object will not be altered, only `id` is used.
  * Return: _Integer_ Index of `contact` if it exists, -1 otherwise.

Returns the index of the `contact` if it exists, returns -1 otherwise.

_NOTE: `kBucket.indexOf(contact)` does not compare `contact.vectorClock`_

#### kBucket.remove(contact, [bitIndex])

  * `contact`: _Object_ The contact object to remove.
    * `id`: _Buffer_ contact node id.
    * Any satellite data can be part of the `contact` object, only `id` is used
  * `bitIndex`: _Integer_ _(Default: 0)_ _**CAUTION: reserved for internal use**_  The bit index to which bit to check in the `id` Buffer.
  * Return: _Object_ The k-bucket itself.

Removes the `contact`.

#### kBucket.splitAndAdd(contact, [bitIndex])

_**CAUTION: reserved for internal use**_

  * `contact`: _Object_ The contact object to add.
    * `id`: _Buffer_ Contact node id.
    * Any satellite data that is part of the `contact` object will not be altered, only `id` is used.
  * `bitIndex`: _Integer_ _(Default: 0)_ The bit index to which bit to check in the `id` Buffer.
  * Return: _Object_ The k-bucket itself.

Splits the bucket, redistributes contacts to the new buckets, and marks the bucket that was split as an inner node of the binary tree of buckets by setting `self.bucket = undefined`. Also, marks the "far away" bucket as `dontSplit`.

#### kBucket.update(contact, index)

_**CAUTION: reserved for internal use**_

  * `contact`: _Object_ The contact object to update.
    * `id`: _Buffer_ Contact node id
    * Any satellite data that is part of the `contact` object will not be altered, only `id` is used.
  * `index`: _Integer_ The index in the bucket where contact exists (index has already been computed in previous calculation).

Updates the `contact` and compares the vector clocks if provided. If new `contact` vector clock is deprecated, `contact` is abandoned (not added). If new `contact` vector clock is the same, `contact` is marked as moste recently contacted (by being moved to the right/end of the bucket array). If new `contact` vector clock is more recent, the old `contact` is removed and the new contact is marked as most recently contacted.

#### Event: 'ping'

  * `oldContacts`: _Array_ The array of contacts to ping.
  * `newContact`: _Object_ The new contact to be added if one of old contacts does not respond.

Emitted every time a contact is added that would exceed the capacity of a _don't split_ k-bucket it belongs to.

## Sources

The implementation has been sourced from:

  - [A formal specification of the Kademlia distributed hash table](http://maude.sip.ucm.es/kademlia/files/pita_kademlia.pdf)
  - [Distributed Hash Tables (part 2)](http://offthelip.org/?p=157)