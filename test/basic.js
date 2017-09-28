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
const assert = require('chai').assert;
const request = require('request');
const config = require('../config/config');

require("./setup")
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';
const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;

describe('API basics', () => {
  let compendium_id = '';
  before(function (done) {
    let req = createCompendiumPostRequest('./test/erc/with_metadata', cookie_o2r);
    this.timeout(10000);

    request(req, (err, res, body) => {
      assert.ifError(err);
      compendium_id = JSON.parse(body).id;
      done();
    });
  });

  describe('GET /', () => {
    it('should respond with 404 Not Found', (done) => {
      request(global.test_host, (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 404);
        done();
      });
    });
  });

  describe('GET /api/v1/compendium/<id>/data/', () => {
    it('should respond with 200 Found', (done) => {
      request(global.test_host + '/api/v1/compendium/' + compendium_id + '/data/', (err, res, body) => {
        assert.ifError(err);
        assert.equal(res.statusCode, 200);
        done();
      });
    });

    it('should respond with valid JSON', (done) => {
      request(global.test_host + '/api/v1/compendium/' + compendium_id + '/data/', (err, res, body) => {
        assert.ifError(err);
        assert.isObject(JSON.parse(body), 'returned JSON');
        done();
      });
    });

    it('should contain the name and base path in the response', (done) => {
      request(global.test_host + '/api/v1/compendium/' + compendium_id + '/data/', (err, res, body) => {
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
        assert.include(body, '/api/v1/compendium/' + compendium_id + '/data/data/bagtainer.yml');
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
