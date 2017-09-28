/*
 * (C) Copyright 2017 o2r-project.
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
var c = require('../config/config');
var debug = require('debug')('compendium');
var fs = require('fs');
var Job = require('../lib/model/job');

var resize = require('../lib/resize.js').resize;

exports.viewPath = (req, res) => {
  var path = req.params.path;
  debug(path);
  var size = req.query.size || null;
  var id = req.params.id;
  Job.findOne({id}).select('id').exec((err, job) => {
    if (err || job == null) {
      res.status(404).send({error: 'no job with this id'});
    } else {
      var localpath = c.fs.job + id + '/' + path;
      try {
        debug(localpath);
        fs.accessSync(localpath); //throws if does not exist
        if(size) {
          resize(localpath, size, (finalpath, err) => {
            if (err) {
              var status = code || 500;
              res.status(status).send({ error: err});
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
        res.status(500).send({ error: 'internal error', e});
        return;
      }
    }
  });
};
