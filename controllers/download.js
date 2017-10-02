/*
 * (C) Copyright 2017 o2r project
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
const config = require('../config/config');
const debug = require('debug')('transporter:download');
const fs = require('fs');
const Compendium = require('../lib/model/compendium');
const Job = require('../lib/model/job');
const archiver = require('archiver');
const Timer = require('timer-machine');
const Docker = require('dockerode');
const path = require('path');

function saveImage(outputStream, compendium_id, res, callback) {
  let docker = new Docker();
  debug('[%s] Docker client set up to accessing image: %s', compendium_id, JSON.stringify(docker));

  let filter = {
    compendium_id: compendium_id,
    status: "success"
  };
  Job.find(filter).select('id').limit(1).sort({ updatedAt: 'desc' }).exec((err, jobs) => {
    if (err) {
      res.status(500).send({ error: 'error finding last job for compendium' });
    } else {
      if (jobs.length <= 0) {
        debug('Error: No job for %s found, cannot add image.', compendium_id);
        res.status(400).send({ error: 'no job found for this compendium, run a job before downloading with image' });
      } else {
        // image creation steps as promises
        let inspect = (passon) => {
          return new Promise((fulfill, reject) => {
            passon.image.inspect((err, data) => {
              if (err) {
                debug('Error inspecting image: %s', err);
                reject(err);
              }
              else {
                debug('Image tags (a.k.a.s): %s', JSON.stringify(data.RepoTags));
                fulfill(passon);
              }
            });
          })
        };
        let getAndSave = (passon) => {
          return new Promise((fulfill, reject) => {
            debug('Getting image %s ...', JSON.stringify(passon.image));
            passon.image.get((err, imageStream) => {
              if (err) {
                debug('Error while handling image stream: %s', err.message);
                reject(err);
              }
              else {
                debug('Saving image stream to provided stream: %s > %s', imageStream, passon.outputStream);
                //archive.append(stream, { name: config.compendium.imageTarballFile, date: new Date() });
                imageStream.pipe(passon.outputStream);

                passon.outputStream.on('finish', function () {
                  debug('Image saved to provided stream for %s', passon.id);
                  fulfill(passon);
                });
                passon.outputStream.on('error', (err) => {
                  debug('Error saving image to provided stream: %s', err);
                  reject(err);
                })
              }
            });
          })
        };
        let answer = (passon) => {
          return new Promise((fulfill) => {
            debug('Answering callback for compendium %s with image %s', passon.id, passon.image.name);
            callback();
            fulfill(passon);
          })
        };

        let job = jobs[0];
        let imageTag = config.compendium.imageNamePrefix + job.id;
        debug('Found latest job %s for compendium %s and will include image %s', job.id, compendium_id, imageTag);
        let image = docker.getImage(imageTag);
        debug('Found image: %s', image.name);

        inspect({ image: image, outputStream: outputStream, id: compendium_id })
          .then(getAndSave)
          .then(answer)
          .catch(err => {
            debug("Rejection or unhandled failure while saving image %s to file: \n\t%s", image.name, JSON.stringify(err));
            callback(err);
          });
      }
    }
  });
}

function imageTarballExists(compendiumPath) {
  let p = path.join(compendiumPath, config.compendium.imageTarballFile);
  try {
    let stats = fs.statSync(p);
    if (stats.size > 0) {
      debug('Tarball file for already exists at %s', p);
      return true;
    } else {
      debug('Tarball file exists at %s but file size is %s', p, stats.size);
      return false;
    }
  } catch (err) {
    debug('Tarball file at %s does not exist (or other file system error): %s', p, err);
    return false;
  }
}

function archiveCompendium(archive, compendiumPath, ignoreImage, ignoreMetadataFiles) {
  let glob = '**';
  let options = {};
  options.cwd = compendiumPath;
  if (ignoreImage) {
    options.ignore = [config.compendium.imageTarballFile];
  }
  if (!ignoreMetadataFiles) {
    options.dot = true;
  }

  debug('Putting "%s" into archive with options %s', glob, JSON.stringify(options));
  archive.glob(glob, options);
  archive.finalize();
}

// based on https://github.com/archiverjs/node-archiver/blob/master/examples/express.js
exports.downloadZip = (req, res) => {
  let includeImage = config.download.defaults.includeImage;
  if (req.query.image) {
    includeImage = (req.query.image === "true");
  }
  let id = req.params.id;
  let originalUrl = req.protocol + '://' + ':' + req.port + '/' + req.hostname + req.path;
  debug('Download zip archive for %s (image? %s) with original request %s', id, includeImage, originalUrl);

  Compendium.findOne({ id }).select('id').exec((err, compendium) => {
    if (err || compendium == null) {
      res.setHeader('Content-Type', 'application/json');
      res.status(404).send({ error: 'no compendium with this id' });
    } else {
      let localPath = path.join(config.fs.compendium, id);

      let timer = new Timer();
      timer.start();

      try {
        debug('Going to zip %s (image: %s)', localPath, includeImage);
        fs.accessSync(localPath); //throws if does not exist

        let archive = archiver('zip', {
          comment: 'Created by o2r [' + originalUrl + ']',
          statConcurrency: config.download.defaults.statConcurrency
        });

        archive.on('error', function (err) {
          res.setHeader('Content-Type', 'application/json');
          res.status(500).send({ error: err.message });
        });

        archive.on('end', function () {
          timer.stop();
          debug('Wrote %d bytes in %s ms to archive', archive.pointer(), timer.time());
        });

        //set the archive name
        res.attachment(id + '.zip');

        //this is the streaming magic
        archive.pipe(res);

        if (includeImage) {
          if (!imageTarballExists(localPath)) {
            // this breaks the streaming magic, but simplest way to update bag is to save the tarball as a file
            let stream = fs.createWriteStream(path.join(localPath, config.compendium.imageTarballFile));

            saveImage(stream, id, res, (err) => {
              if (err) {
                debug('Error saving image for %s: %s', id, JSON.stringify(err));
                res.status(500).send({ error: err.message });
                timer.stop();
                return;
              }
              debug('Image saved for %s', id);

              if (!res.headersSent) {
                archiveCompendium(archive, localPath, false, false);
              } else {
                debug('Image written to file but headers already sent!');
              }
            });
          } else {
            archiveCompendium(archive, localPath, false, false);
          }
        } else {
          archiveCompendium(archive, localPath, true, false);
        }
      } catch (e) {
        debug(e);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).send({ error: e.message });
        timer.stop();
        return;
      }
    }
  });
};


exports.downloadTar = (req, res) => {
  let includeImage = config.download.defaults.includeImage;
  if (req.query.image) {
    includeImage = (req.query.image === "true");
  }
  let id = req.params.id;
  let gzip = false;
  if (req.query.gzip !== undefined) {
    gzip = true;
  }
  let originalUrl = req.protocol + '://' + ':' + req.port + '/' + req.hostname + req.path;
  debug('Download zip archive for %s (image? %s gzip? %s) with original request %s', id, includeImage, gzip, originalUrl);

  Compendium.findOne({ id }).select('id').exec((err, compendium) => {
    if (err || compendium == null) {
      res.setHeader('Content-Type', 'application/json');
      res.status(404).send({ error: 'no compendium with this id' });
    } else {
      let localPath = path.join(config.fs.compendium, id);

      let timer = new Timer();
      timer.start();

      try {
        debug('Going to tar %s (image: %s, gzip: %s)', localPath, includeImage, gzip);
        fs.accessSync(localPath); //throws if does not exist

        let archive = archiver('tar', {
          gzip: gzip,
          gzipOptions: config.download.defaults.tar.gzipOptions,
          statConcurrency: config.download.defaults.statConcurrency
        });

        archive.on('error', function (err) {
          res.setHeader('Content-Type', 'application/json');
          res.status(500).send({ error: err.message });
        });

        //on stream closed we can end the request
        archive.on('end', function () {
          timer.stop();
          debug('Archive wrote %d bytes in %s ms', archive.pointer(), timer.time());
        });

        //set the archive name
        let filename = id + '.tar';
        if (gzip) {
          filename = filename + '.gz';
          res.set('Content-Type', 'application/gzip'); // https://superuser.com/a/960710
        }
        res.attachment(filename);

        //this is the streaming magic
        archive.pipe(res);

        if (includeImage) {
          if (!imageTarballExists(localPath)) {
            // this breaks the streaming magic, but simplest way to update bag is to save the tarball as a file
            let stream = fs.createWriteStream(path.join(localPath, config.compendium.imageTarballFile));

            saveImage(stream, id, res, (err) => {
              if (err) {
                debug('Error saving image for %s: %s', id, JSON.stringify(err));
                res.setHeader('Content-Type', 'application/json');
                res.status(500).send({ error: err.message });
                timer.stop();
                return;
              }
              debug('Image saved for %s', id);

              if (!res.headersSent) {
                archiveCompendium(archive, localPath, false);
              } else {
                debug('Image written to file but headers already sent!');
              }
            });
          } else {
            archiveCompendium(archive, localPath, false);
          }
        } else {
          archiveCompendium(archive, localPath, true);
        }
      } catch (e) {
        debug(e);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).send({ error: e.message });
        timer.stop();
        return;
      }
    }
  });
};
