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

require("./setup")
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;
const publishCandidate = require('./util').publishCandidate;

describe('Accessing payload data', () => {
  let compendium_data_uri, compendium_id = '';

  before(function (done) {
    let req = createCompendiumPostRequest('./test/erc/with_metadata', cookie_o2r);
    this.timeout(10000);

    request(req, (err, res, body) => {
      assert.ifError(err);
      compendium_id = JSON.parse(body).id;
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

    it('should contain selected file paths', (done) => {
      request(global.test_host + '/api/v1/compendium/' + compendium_id + '/data/', (err, res, body) => {
        assert.ifError(err);
        assert.include(body, '/api/v1/compendium/' + compendium_id + '/data/data/Dockerfile');
        assert.include(body, '/api/v1/compendium/' + compendium_id + '/data/data/erc.yml');
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

describe('Accessing archive downloads', function () {
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

    it('should mention "no compendium" in a valid JSON document with  error message at .tar.gz', (done) => {
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
