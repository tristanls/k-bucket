# k-bucket

_Stability: 1 - [Experimental](https://github.com/tristanls/stability-index#stability-1---experimental)_

Kademlia DHT K-bucket implementation as a binary tree.

## Installation

    npm install k-bucket

## Tests

    npm test

## Overview

_TODO:_ Write an overview of Kademlia DHT and describe why to care about a K-bucket in the first place.

_TODO:_ Define `contact` and give context for it

_TODO:_ Define `contact.id` and give context for it (highlight that it does not need to be a SHA-1 id, but any buffer will do; they don't even need to be the same length)

_TODO:_ Define `contact.vectorClock` and give context for it

This Kademlia DHT K-bucket implementation is meant to be as minimal as possible. It assumes that `contact`s consist only of `id`, and an optional `vectorClock`. It is useful, and necessary, to attach other properties to a `contact`. For example, one may want to attach `ip` and `port` properties which allow the application to send IP traffic to the `contact`. However, this information is extraneous and irrelevant to the operation of K-bucket.

It is worth highlighting the presence of an optional `vectorClock` as part of `contact` implementation. The purpose of the `vectorClock` (a simple integer) is to enable distinguishig between `contact`s that may have "physically" moved to a different machine while keeping the same `contact.id`. This is useful when working with actors and an actor moves from one machine to another.

### Vector Clocks

_TODO:_ Elaborate on how the vector clock mechanism works by demonstrating a simple example and the computation that takes place to track a `contact` that moves from one machine to another

## Sources

The implementation has been sourced from:

  - [A formal specification of the Kademlia distributed hash table](http://maude.sip.ucm.es/kademlia/files/pita_kademlia.pdf)
  - [Distributed Hash Tables (part 2)](http://offthelip.org/?p=157)