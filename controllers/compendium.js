/*
 * (C) Copyright 2017 o2r project.
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
// General modules
const config = require('../config/config');
const debug = require('debug')('transporter:compendium');
const fs = require('fs');
const Compendium = require('../lib/model/compendium');

const resize = require('../lib/resize.js').resize;

const dirTree = require('directory-tree');
const rewriteTree = require('../lib/rewrite-tree');

exports.viewPath = (req, res) => {
  var path = req.params.path;
  debug('view path %s', path);
  var size = req.query.size || null;
  var id = req.params.id;
  Compendium.findOne({ id }).select('id').exec((err, compendium) => {
    if (err || compendium == null) {
      res.status(404).send({ error: 'no compendium with this id' });
    } else {
      var localpath = config.fs.compendium + id + '/' + path;
      try {
        debug(localpath);
        fs.accessSync(localpath); //throws if does not exist
        if (size) {
          resize(localpath, size, (finalpath, err, code) => {
            if (err) {
              var status = code || 500;
              res.status(status).send({ error: err });
              return;
            }
            debug('returned ' + finalpath);
            res.sendFile(finalpath);
          });
        } else {
          res.sendFile(localpath);
        }
      } catch (e) {
        debug(e);
        res.status(500).send({ error: 'internal error', e });
        return;
      }
    }
  });
};

exports.viewData = (req, res) => {
  var id = req.params.id;
  Compendium.findOne({ id }).select('id').exec((err, compendium) => {
    if (err || compendium == null) {
      res.status(404).send({ error: 'no compendium with this id' });
    } else {
      var localpath = config.fs.compendium + id + '/';
      try {
        debug('Reading file listing from %s', localpath);
        fs.accessSync(localpath); //throws if does not exist

        let answer = rewriteTree(dirTree(config.fs.compendium + id),
          config.fs.compendium.length + config.id_length, // remove local fs path and id
          '/api/v1/compendium/' + id + '/data' // prepend proper location
        );

        res.status(200).send(answer);
      } catch (e) {
        debug(e);
        res.status(500).send({ error: 'internal error', e });
        return;
      }
    }
  });
};