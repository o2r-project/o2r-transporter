/*
 * (C) Copyright 2017 o2r-project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const util = require('util');
const debug = require('debug')('transporter:config');

var c = {};
c.net = {};
c.mongo = {};
c.fs = {};
const env = process.env;

c.version = require('../package.json').version;
c.api_version = 1;

// network & database
c.net.port         = env.TRANSPORTER_PORT || 8081;
c.mongo.location   = env.TRANSPORTER_MONGODB || 'mongodb://localhost/';
c.mongo.database = env.TRANSPORTER_MONGODB_DATABASE || 'muncher';
c.mongo.initial_connection_attempts = 30;
c.mongo.initial_connection_max_delay = 5000;
c.mongo.initial_connection_initial_delay = 1000;

// fix mongo location if trailing slash was omitted
if (c.mongo.location[c.mongo.location.length-1] !== '/') {
  c.mongo.location += '/';
}

// fs paths
const path = require('path');
c.fs.base = env.TRANSPORTER_BASEPATH || '/tmp/o2r';
c.fs.incoming = path.join(c.fs.base, 'incoming');
c.fs.compendium = path.join(c.fs.base, 'compendium');
c.fs.job = path.join(c.fs.base, 'job');
c.fs.tmp = path.join(c.fs.base, 'imgtmp');
c.fs.delete_inc = true;
c.id_length = 5;

// session secret
c.sessionsecret = env.SESSION_SECRET || 'o2r';

// authentication levels
c.user = {};
c.user.level = {};
c.user.level.view_status = 500;

c.download = {};
c.download.defaults = {};
c.download.defaults.statConcurrency = 4; // archiver.js default is '4'
c.download.defaults.tar = {};
c.download.defaults.tar.gzipOptions = {}; // https://nodejs.org/api/zlib.html#zlib_class_options
c.download.defaults.includeImage = true;

c.compendium = {};
c.compendium.imageTarballFile = 'image.tar';

debug('CONFIGURATION:\n%s', util.inspect(c, { depth: null, colors: true }));

module.exports = c;
