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

/* eslint-env mocha */
const mongojs = require('mongojs');
const sleep = require('sleep');
const config = require('../config/config');
const debug = require('debug')('test:setup');

// test parameters for local session authentication directly via fixed database entries
const orcid = '0000-0001-6021-1617';
const orcid_plain = '0000-0000-0000-0001';

const sessionId = 'C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo';
const sessionId_plain = 'yleQfdYnkh-sbj9Ez--_TWHVhXeXNEgq';

const env = process.env;
global.test_host = env.TEST_HOST || 'http://localhost:' + config.net.port;
global.test_host_load = env.TEST_HOST_LOAD || 'http://localhost:8088';
global.test_host_publish = env.TEST_HOST_PUBLISH || 'http://localhost:8080';
debug('Testing endpoint at %s with loader at %s and publish via %s', global.test_host, global.test_host_load, global.test_host_publish);

let dbPath = 'localhost/' + config.mongo.database;
const db = mongojs(dbPath, ['users', 'sessions', 'compendia', 'jobs']);

loadTestData = function (done) {
    let session = {
        '_id': sessionId,
        'session': {
            'cookie': {
                'originalMaxAge': null,
                'expires': null,
                'secure': null,
                'httpOnly': true,
                'domain': null,
                'path': '/'
            },
            'passport': {
                'user': orcid
            }
        }
    };
    db.sessions.save(session, function (err, doc) {
        if (err) throw err;
    });
    let session_plain = {
        '_id': sessionId_plain,
        'session': {
            'cookie': {
                'originalMaxAge': null,
                'expires': null,
                'secure': null,
                'httpOnly': true,
                'domain': null,
                'path': '/'
            },
            'passport': {
                'user': orcid_plain
            }
        }
    };
    db.sessions.save(session_plain, function (err, doc) {
        if (err) throw err;
    });

    let o2ruser = {
        '_id': '57dc171b8760d15dc1864044',
        'orcid': orcid,
        'level': 100,
        'name': 'o2r-testuser'
    };
    db.users.save(o2ruser, function (err, doc) {
        if (err) throw err;
    });
    let plainuser = {
        '_id': '57b55ee700aee212007ac27f',
        'orcid': orcid_plain,
        'level': 0,
        'name': 'plain-testuser'
    };
    db.users.save(plainuser, function (err, doc) {
        if (err) throw err;
    });

    sleep.sleep(3);
    debug('Loaded test data to %s', dbPath);
    done();
}

before(function (done) {
    this.timeout(10000);

    // clear all data
    db.sessions.remove(function (err, doc) {
        if (err) throw err;
        db.users.remove(function (err, doc) {
            //if (err) throw err;
            db.compendia.remove(function (err, doc) {
                //if (err) throw err;
                db.jobs.remove(function (err, doc) {
                    debug('Cleared database at %s', dbPath);
                    loadTestData(done);
                });
            });
        });
    });

});

after(function (done) {
    db.close();
    done();
});
