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

/* eslint-env mocha */
const chai = require('chai');
const assert = chai.assert;
const request = require('request');
const fs = require('fs');
const tmp = require('tmp');
const AdmZip = require('adm-zip');
const sleep = require('sleep');
const tarStream = require('tar-stream');
const gunzip = require('gunzip-maybe');
const stream = require('stream');
const exec = require('child_process').exec;

const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;
const publishCandidate = require('./util').publishCandidate;
const startJob = require('./util').startJob;

const config = require('../config/config');

require("./setup");
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

var secs = 20;

describe('Image download', function () {
    var compendium_id, job_id = null;

    before(function (done) {
        this.timeout(0);

        let req = createCompendiumPostRequest('./test/erc/with_metadata', cookie);

        request(req, (err, res, body) => {
            assert.ifError(err);
            compendium_id = JSON.parse(body).id;

            publishCandidate(compendium_id, cookie, () => {
                startJob(compendium_id, id => {
                    assert.ok(id);
                    job_id = id;
                    sleep.sleep(secs);
                    done();
                })
            });
        });
    });

    describe('downloading a compendium', function () {

        it('should contain a tarball of Docker image in zip archive by default', (done) => {
            let tmpfile = tmp.tmpNameSync() + '.zip';
            let url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    let zip = new AdmZip(tmpfile);
                    let zipEntries = zip.getEntries();

                    let filenames = [];
                    zipEntries.forEach(function (entry) {
                        filenames.push(entry.entryName);
                    });

                    assert.oneOf('bagit.txt', filenames);
                    assert.oneOf('data/image.tar', filenames);
                    assert.oneOf('data/main.Rmd', filenames);
                    assert.oneOf('data/.erc/metadata_o2r.json', filenames);
                    assert.lengthOf(filenames, 15, 'all files in tarball');
                    done();
                });
        }).timeout(secs * 1000);

        it('should contain a tarball of Docker image in gzipped .tar archive', (done) => {
            let url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?gzip';
            let filenames = [];
            let extractTar = tarStream.extract();
            extractTar.on('entry', function (header, stream, next) {
                filenames.push(header.name);
                stream.on('end', function () {
                    next();
                })
                stream.resume();
            });
            extractTar.on('finish', function () {
                assert.oneOf('bagit.txt', filenames);
                assert.oneOf('data/image.tar', filenames);
                assert.oneOf('data/.erc/metadata_o2r.json', filenames);
                assert.lengthOf(filenames, 15, 'all files in tarball');
                done();
            });
            extractTar.on('error', function (e) {
                done(e);
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(gunzip())
                .pipe(extractTar);
        }).timeout(secs * 1000);

        it('should contain a tarball of Docker image in zip archive when explicitly asking for it', (done) => {
            let tmpfile = tmp.tmpNameSync() + '.zip';
            let url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=true';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    let zip = new AdmZip(tmpfile);
                    let zipEntries = zip.getEntries();

                    let filenames = [];
                    zipEntries.forEach(function (entry) {
                        filenames.push(entry.entryName);
                    });
                    assert.oneOf('data/image.tar', filenames);
                    assert.oneOf('data/.erc/metadata_o2r.json', filenames);
                    assert.lengthOf(filenames, 15, 'all files in tarball');
                    done();
                });
        }).timeout(secs * 1000);

        it('should contain a tarball of Docker image in tar.gz archive when explicitly asking for it', (done) => {
            let url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?gzip&image=true';
            let filenames = [];
            let extractTar = tarStream.extract();
            extractTar.on('entry', function (header, stream, next) {
                filenames.push(header.name);
                stream.on('end', function () {
                    next();
                })
                stream.resume();
            });
            extractTar.on('finish', function () {
                assert.oneOf('bagit.txt', filenames);
                assert.oneOf('data/image.tar', filenames);
                assert.lengthOf(filenames, 15, 'all expected files in tarball');
                done();
            });
            extractTar.on('error', function (e) {
                done(e);
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(gunzip())
                .pipe(extractTar);
        }).timeout(secs * 1000);

        it('should not have a tarball of Docker image in zip archive when explicitly not asking for it', (done) => {
            let tmpfile = tmp.tmpNameSync() + '.zip';
            let url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip?image=false';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    let zip = new AdmZip(tmpfile);
                    let zipEntries = zip.getEntries();

                    let filenames = [];
                    zipEntries.forEach(function (entry) {
                        filenames.push(entry.entryName);
                    });
                    assert.oneOf('bagit.txt', filenames);
                    assert.notInclude(filenames, 'data/image.tar');
                    assert.oneOf('data/.erc/metadata_o2r.json', filenames);
                    assert.lengthOf(filenames, 14, 'all expected files in tarball');
                    done();
                });
        }).timeout(secs * 1000);

        it('should not have a tarball of Docker image in tar.gz archive when explicitly not asking for it', (done) => {
            let url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar.gz?image=false';
            let filenames = [];
            let extractTar = tarStream.extract();
            extractTar.on('entry', function (header, stream, next) {
                filenames.push(header.name);
                stream.on('end', function () {
                    next();
                })
                stream.resume();
            });
            extractTar.on('finish', function () {
                assert.oneOf('bagit.txt', filenames);
                assert.notInclude(filenames, 'data/image.tar');
                assert.oneOf('data/.erc/metadata_o2r.json', filenames);
                assert.lengthOf(filenames, 14, 'all expected files in tarball');
                done();
            });
            extractTar.on('error', function (e) {
                done(e);
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(gunzip())
                .pipe(extractTar);
        }).timeout(secs * 1000);

        it('should not have a tarball of Docker image in gzipped tar archive when explicitly not asking for it', (done) => {
            let url = global.test_host + '/api/v1/compendium/' + compendium_id + '.tar?image=false&gzip';
            let filenames = [];
            let extractTar = tarStream.extract();
            extractTar.on('entry', function (header, stream, next) {
                filenames.push(header.name);
                stream.on('end', function () {
                    next();
                })
                stream.resume();
            });
            extractTar.on('finish', function () {
                assert.oneOf('bagit.txt', filenames);
                assert.notInclude(filenames, 'data/image.tar');
                assert.oneOf('data/.erc/metadata_o2r.json', filenames);
                assert.lengthOf(filenames, 14, 'all expected files in tarball');
                done();
            });
            extractTar.on('error', function (e) {
                done(e);
            });

            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(gunzip())
                .pipe(extractTar);
        }).timeout(secs * 1000);

        it('should contain expected files in tarball', (done) => {
            let tmpfile = tmp.tmpNameSync() + '.zip';
            let url = global.test_host + '/api/v1/compendium/' + compendium_id + '.zip';
            request.get(url)
                .on('error', function (err) {
                    done(err);
                })
                .pipe(fs.createWriteStream(tmpfile))
                .on('finish', function () {
                    let zip = new AdmZip(tmpfile);

                    zip.getEntries().forEach(function (entry) {
                        if (entry.entryName === 'data/image.tar') {
                            let filenames = [];
                            let manifestJson = null;
                            let extractTar = tarStream.extract();
                            extractTar.on('entry', function (header, stream, next) {
                                filenames.push(header.name);
                                if (header.name == 'manifest.json') {
                                    const chunks = [];
                                    stream.on('data', function (chunk) {
                                        chunks.push(chunk);
                                    });
                                    stream.on('end', function () {
                                        manifestJson = JSON.parse(chunks)[0];
                                        next();
                                    });
                                } else {
                                    stream.on('end', function () {
                                        next();
                                    })
                                }
                                stream.resume();
                            });
                            extractTar.on('finish', function () {
                                assert.oneOf('manifest.json', filenames);
                                assert.oneOf('repositories', filenames);
                                assert.include(filenames.toString(), '/VERSION');
                                assert.include(filenames.toString(), '/layer.tar');
                                assert.lengthOf(filenames, 7);
                                assert.property(manifestJson, 'RepoTags');
                                assert.oneOf(config.compendium.imageNamePrefix + job_id, manifestJson.RepoTags, '"prefix:job_id" tag is in RepoTags list');
                                
                                done();
                            });
                            extractTar.on('error', function (e) {
                                done(e);
                            });

                            let bufferStream = new stream.PassThrough();
                            bufferStream.end(new Buffer(entry.getData()));
                            bufferStream.pipe(extractTar);
                        }
                    });
                });
        });
    });

    describe('tinkering with local images outside of transporter', function () {
        it('should return an error (HTTP 400, error message in JSON response) when no job was started', (done) => {
            let compendium_id = null;
            let req = createCompendiumPostRequest('./test/erc/with_metadata', cookie);

            request(req, (err, res, body) => {
                assert.ifError(err);
                compendium_id = JSON.parse(body).id;

                publishCandidate(compendium_id, cookie, () => {
                    request(global.test_host + '/api/v1/compendium/' + compendium_id + '.zip', (err, res, body) => {
                        assert.ifError(err);
                        let response = JSON.parse(body);

                        assert.equal(res.statusCode, 400);
                        assert.isObject(response);
                        assert.property(response, 'error');
                        assert.include(response.error, 'no job');
                        done();
                    });

                });
            });
        }).timeout(secs * 1000 * 2);

        it('should return an error (HTTP 500 with valid JSON document) when image was removed locally', (done) => {
            let compendium_id_tinker = null;
            let req = createCompendiumPostRequest('./test/erc/with_metadata', cookie);

            request(req, (err, res, body) => {
                assert.ifError(err);
                compendium_id_tinker = JSON.parse(body).id;

                publishCandidate(compendium_id_tinker, cookie, () => {
                    startJob(compendium_id_tinker, id => {
                        assert.ok(id);
                        sleep.sleep(secs);

                        exec('docker rmi ' + config.compendium.imageNamePrefix + id, (err, stdout, stderr) => {
                            if (err || stderr) {
                                assert.ifError(err);
                                assert.ifError(stderr);
                            } else {
                                request(global.test_host + '/api/v1/compendium/' + compendium_id_tinker + '.zip', (err, res, body) => {
                                    assert.ifError(err);
                                    assert.equal(res.statusCode, 500);
                                    let response = JSON.parse(body);
                                    assert.isObject(response);
                                    assert.property(response, 'error');
                                    assert.include(response.error, 'no such image');
                                    done();
                                });
                            }
                        });
                    });
                });
            });
        }).timeout(secs * 1000 * 2);

        it('should not fail if image got additional tag', (done) => {
            let compendium_id_tag = null;
            let req = createCompendiumPostRequest('./test/erc/with_metadata', cookie);

            request(req, (err, res, body) => {
                assert.ifError(err);
                compendium_id_tag = JSON.parse(body).id;

                publishCandidate(compendium_id_tag, cookie, () => {
                    startJob(compendium_id_tag, id => {
                        assert.ok(id);
                        sleep.sleep(secs);

                        exec('docker tag ' + config.compendium.imageNamePrefix + id + ' another:tag', (err, stdout, stderr) => {
                            if (err || stderr) {
                                assert.ifError(err);
                                assert.ifError(stderr);
                            } else {
                                let tmpfile = tmp.tmpNameSync() + '.zip';
                                request.get(global.test_host + '/api/v1/compendium/' + compendium_id_tag + '.zip')
                                    .on('error', function (err) {
                                        done(err);
                                    })
                                    .pipe(fs.createWriteStream(tmpfile))
                                    .on('finish', function () {
                                        let zip = new AdmZip(tmpfile);
                                        let zipEntries = zip.getEntries();

                                        let filenames = [];
                                        zipEntries.forEach(function (entry) {
                                            filenames.push(entry.entryName);
                                        });
                                        assert.oneOf('bagit.txt', filenames);
                                        assert.oneOf('data/image.tar', filenames);
                                        assert.oneOf('data/.erc/metadata_o2r.json', filenames);
                                        assert.lengthOf(filenames, 15, 'all expected files in tarball');
                                        done();
                                    });
                            }
                        });
                    });
                });
            });
        }).timeout(secs * 1000 * 2);

    });

});