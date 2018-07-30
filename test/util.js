/*
 * (C) Copyright 2016 o2r project
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

const request = require('request');
const tmp = require('tmp');
const AdmZip = require('adm-zip');
const fs = require('fs');
const debug = require('debug')('transporter:test');
const AsyncPolling = require('async-polling');

const cookie_plain = 's:yleQfdYnkh-sbj9Ez--_TWHVhXeXNEgq.qRmINNdkRuJ+iHGg5woRa9ydziuJ+DzFG9GnAZRvaaM';

module.exports.createCompendiumPostRequest = function createCompendiumPostRequest(path, cookie) {
  let zip = new AdmZip();
  zip.addLocalFolder(path);
  let tmpfile = tmp.tmpNameSync() + '.zip';
  zip.writeZip(tmpfile);

  let formData = {
    'content_type': 'workspace',
    'compendium': {
      value: fs.createReadStream(tmpfile),
      options: {
        filename: 'another.zip',
        contentType: 'application/zip'
      }
    }
  };
  let j = request.jar();
  let ck = request.cookie('connect.sid=' + cookie);
  j.setCookie(ck, global.test_host);

  let reqParams = {
    uri: global.test_host_load + '/api/v1/compendium',
    method: 'POST',
    jar: j,
    formData: formData,
    timeout: 30000
  };

  return (reqParams);
}

// publish a candidate with a direct copy of the metadata
module.exports.publishCandidate = function (compendium_id, cookie, done) {
  let j = request.jar();
  let ck = request.cookie('connect.sid=' + cookie);
  j.setCookie(ck, global.test_host);

  let getMetadata = {
    uri: global.test_host_publish + '/api/v1/compendium/' + compendium_id,
    method: 'GET',
    jar: j,
    timeout: 10000
  };

  let updateMetadata = {
    uri: global.test_host_publish + '/api/v1/compendium/' + compendium_id + '/metadata',
    method: 'PUT',
    jar: j,
    timeout: 10000
  };

  request(getMetadata, (err, res, body) => {
    if (err) {
      console.error('error publishing candidate: %o', err);
    } else {
      let response = JSON.parse(body);
      if (response.error) {
        console.error('error publishing candidate: %s', JSON.stringify(response));
        throw new Error('Could not publish candidate, aborting test.');
      } else {
        //debug("Received metadata for compendium %s: \%s", compendium_id, util.inspect(response, {color: true, depth: 2}));
        updateMetadata.json = { o2r: response.metadata.o2r };
        //debug("Now updating it as user %s with document:\n", cookie, util.inspect(updateMetadata, {color: true, depth: 2}));

        request(updateMetadata, (err, res, body) => {
          debug("Published candidate: %o", body);
          done();
        });
      }
    }
  });
}

module.exports.startJob = function (compendium_id, done) {
  let j = request.jar();
  let ck = request.cookie('connect.sid=' + cookie_plain);
  j.setCookie(ck, global.test_host_publish);

  request({
    uri: global.test_host_publish + '/api/v1/job',
    method: 'POST',
    jar: j,
    formData: {
      compendium_id: compendium_id
    },
    timeout: 10000
  }, (err, res, body) => {
    let response = JSON.parse(body);
    debug("Started job: %s", JSON.stringify(response));
    done(response.job_id);
  });
}

module.exports.waitForJob = function (job_id, done) {
  var polling = AsyncPolling(function (end) {
    request({
      uri: global.test_host_publish + '/api/v1/job/' + job_id,
      method: 'GET',
      timeout: 500
    }, (err, res, body) => {
      if (err) end(err, null);
      else {
        let response = JSON.parse(body);
        if (response.status !== 'running') {
          end(null, response);
        } else {
          end(new Error(response.status));
        }
      }
    });
  }, global.test_job_poll_interval);

  polling.on('error', function (error) {
    debug("Job %s: %s", job_id, error.message);
  });

  polling.on('result', function (result) {
    debug('Job finished with %s', result.status);
    done(result.status);
    polling.stop();
  });

  polling.run();
}
