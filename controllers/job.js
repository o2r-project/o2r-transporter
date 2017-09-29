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
const c = require('../config/config');
const debug = require('debug')('compendium');
const fs = require('fs');
const Job = require('../lib/model/job');

const resize = require('../lib/resize.js').resize;

exports.viewPath = (req, res) => {
  let path = req.params.path;
  debug(path);
  let size = req.query.size || null;
  let id = req.params.id;
  Job.findOne({id}).select('id').exec((err, job) => {
    if (err || job == null) {
      res.status(404).send({error: 'no job with this id'});
    } else {
      let localPath = c.fs.job + id + '/' + path;
      try {
        debug(localPath);
        fs.accessSync(localPath); //throws if does not exist
        if(size) {
          resize(localPath, size, (finalPath, err) => {
            if (err) {
              let status = code || 500;
              res.status(status).send({ error: err});
              return;
            }
            debug('returned ' + finalPath);
            res.sendFile(finalPath);
          });
        } else {
          res.sendFile(localPath);
        }
      } catch (e) {
        debug(e);
        res.status(500).send({ error: 'internal error', e});
        return;
      }
    }
  });
};
