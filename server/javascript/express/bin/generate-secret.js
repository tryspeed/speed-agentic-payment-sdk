#!/usr/bin/env node
import crypto from 'crypto';
console.log(crypto.randomBytes(32).toString('hex'));