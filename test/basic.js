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
const assert = require('chai').assert;
const request = require('request');
const config = require('../config/config');
const sleep = require('sleep');

require("./setup")
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;
const startJob = require('./util').startJob;
const publishCandidate = require('./util').publishCandidate;

describe('Basic: accessing payload data of compendia', () => {
  let compendium_data_uri, compendium_id = '';

  before(function (done) {
    let req = createCompendiumPostRequest('./test/workspace/with_metadata', cookie_o2r);
    this.timeout(30000);

    request(req, (err, res, body) => {
      assert.ifError(err);
      compendium_id = JSON.parse(body).id;
      test_compendium_id = compendium_id;
      compendium_data_uri = global.test_host + '/api/v1/compendium/' + compendium_id + '/data/';
      publishCandidate(compendium_id, cookie_o2r, () => {
        done();
      });
    });
  });

  describe('GET /api/v1/compendium/<id>/data/', () => {
    it('should respond with 200 Found', (done) => {
      request(compendium_data_uri, (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200);
        done();
      });
    });

    it('should respond with valid JSON', (done) => {
      request(compendium_data_uri, (err, res, body) => {
        assert.ifError(err);
        assert.isObject(JSON.parse(body), 'returned JSON');
        done();
      });
    });

    it('should contain the name and base path in the response', (done) => {
      request(compendium_data_uri, (err, res, body) => {
        assert.ifError(err);

        let response = JSON.parse(body);
        assert.property(response, 'path');
        assert.property(response, 'name');
        assert.propertyVal(response, 'path', '/api/v1/compendium/' + compendium_id + '/data/');
        assert.propertyVal(response, 'name', compendium_id);
        done();
      });
    });

    it('should contain file paths of upload files', (done) => {
      request(global.test_host + '/api/v1/compendium/' + compendium_id + '/data/', (err, res, body) => {
        assert.ifError(err);
        assert.include(body, '/api/v1/compendium/' + compendium_id + '/data/Dockerfile');
        assert.include(body, '/api/v1/compendium/' + compendium_id + '/data/main.Rmd');
        assert.include(body, '/api/v1/compendium/' + compendium_id + '/data/display.html');
        done();
      });
    });

    it('should not contain the internal base path', (done) => {
      request(global.test_host + '/api/v1/compendium/' + compendium_id + '/data/', (err, res, body) => {
        assert.ifError(err);
        assert.notInclude(body, config.fs.base);
        done();
      });
    });
  });
});

describe('Basic: accessing archive downloads', function () {
  describe('GET non-existing compendium at tar endpoint', function () {
    it('should respond with HTTP 404 status code at .tar', (done) => {
      request(global.test_host + '/api/v1/compendium/1234.tar', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 404);
        done();
      });
    });

    it('should mention "no compendium" in a valid JSON document with error message at .tar', (done) => {
      request(global.test_host + '/api/v1/compendium/1234.tar', (err, res, body) => {
        assert.ifError(err);
        let response = JSON.parse(body);
        assert.isObject(response);
        assert.property(response, 'error');
        assert.include(response.error, 'no compendium');
        done();
      });
    });

    it('should respond with HTTP 404 status code at tar.gz', (done) => {
      request(global.test_host + '/api/v1/compendium/1234.tar.gz', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 404);
        done();
      });
    });

    it('should mention "no compendium" in a valid JSON document with error message at .tar.gz', (done) => {
      request(global.test_host + '/api/v1/compendium/1234.tar.gz', (err, res, body) => {
        assert.ifError(err);
        let response = JSON.parse(body);
        assert.isObject(response);
        assert.property(response, 'error');
        assert.include(response.error, 'no compendium');
        done();
      });
    });
  });

  describe('GET non-existing compendium at zip endpoint', function () {
    it('should respond with HTTP 404 error at .zip', (done) => {
      request(global.test_host + '/api/v1/compendium/1234.zip', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 404);
        done();
      });
    });
    it('should mention "no compendium" in the error message at .zip', (done) => {
      request(global.test_host + '/api/v1/compendium/1234.zip', (err, res, body) => {
        assert.include(JSON.parse(body).error, 'no compendium');
        done();
      });
    });
  });
});

describe('Basic: accessing job files', () => {
  let job_data_uri, job_id;

  before(function (done) {
    let req = createCompendiumPostRequest('./test/workspace/with_csv_data', cookie_o2r);
    this.timeout(40000);

    request(req, (err, res, body) => {
      assert.ifError(err);
      let compendium_id = JSON.parse(body).id;
      // let compendium_data_uri = global.test_host + '/api/v1/compendium/' + compendium_id + '/data/';
      publishCandidate(compendium_id, cookie_o2r, () => {
        startJob(compendium_id, (res) => {
          job_id = res;
          job_data_uri = global.test_host + '/api/v1/job/' + job_id + '/data/';
          sleep.sleep(10);
          done();
        });
      });
    });
  });

  describe('GET /api/v1/job/<id>/data/display.html', () => {
    it('should respond with 200 Found', (done) => {
      request(job_data_uri + 'display.html', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200);
        done();
      });
    });

    it('should respond with content-type and size of requested file (.html)', (done) => {
      request(job_data_uri + 'display.html', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200, "request not successful");
        assert.include(res.headers, {'content-type': 'text/html; charset=UTF-8', 'content-length': '805400'}, 'returned file has unexpected mime-type or size');
        done();
      });
    });

    it('should respond with content-type and size of requested file (.yml)', (done) => {
      request(job_data_uri + 'erc.yml', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200, "request not successful");
        assert.include(res.headers, {'content-type': 'text/yaml; charset=UTF-8', 'content-length': '81'}, 'returned file has unexpected mime-type or size');
        done();
      });
    });

    it('should respond with content-type and size of requested file (.Rmd)', (done) => {
      request(job_data_uri + 'main.Rmd', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200, "request not successful");
        assert.include(res.headers, {'content-type': 'application/octet-stream', 'content-length': '4346'}, 'returned file has unexpected mime-type or size');
        done();
      });
    });

    it('should respond with content-type and new size of requested file when passing a query-param \'size\' (.Rmd)', (done) => {
      request({uri: job_data_uri + 'main.Rmd', qs: { size: 10 } }, (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200);
        assert.include(res.headers, {'content-type': 'application/octet-stream', 'content-length': '279'}, 'returned file was not truncated correctly');
        done();
      });
    });

    it('should respond with content-type and size of requested file (.csv)', (done) => {
      request(job_data_uri + 'data.csv', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200, "request not successful");
        assert.include(res.headers, {'content-type': 'text/csv; charset=UTF-8', 'content-length': '1645'}, 'returned file has unexpected mime-type or size');
        done();
      });
    });

    it('should respond with content-type and new size of requested file when passing a query-param \'size\' (.csv)', (done) => {
      request({uri: job_data_uri + 'data.csv', qs: { size: 10 } }, (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200);
        assert.include(res.headers, {'content-type': 'text/csv; charset=UTF-8', 'content-length': '319'}, 'returned file was not truncated correctly');
        done();
      });
    });
  });
});