import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import nock from 'nock';
import { URL } from 'url';
import axiosDebug from 'axios-debug-log';
import getHTMLPage from '../src';

axiosDebug({
  request: (debug, config) => {
    debug(`Request with '${config.method}' to ${config.url}`);
  },
  response: (debug, response) => {
    debug(`Response with ${response.status} from ${response.config.url}`);
  },
  error: (debug, error) => {
    debug(`There is problem here: ${error.message}`);
  },
});

const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);

nock.disableNetConnect();

let tmpdirPath;

beforeEach(async () => {
  tmpdirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download HTML page with local resources', async () => {
  const testURL = new URL('http://localhost.loc/resources');
  const pageResponse = await fs.readFile(getFixturePath('localhost-test.html'), 'utf-8');

  nock(testURL.origin)
    .get(testURL.pathname)
    .reply(200, pageResponse)
    .log(console.log);

  const firstResourceResponse = await fs.readFile(getFixturePath('style.css'), 'utf-8');

  nock(testURL.origin)
    .get(`${testURL.pathname}/style.css`)
    .reply(200, firstResourceResponse)
    .log(console.log);

  const secondResourceResponse = await fs.readFile(getFixturePath('image.png'), 'utf-8');

  nock(testURL.origin)
    .get(`${testURL.pathname}/assets/image.png`)
    .reply(200, secondResourceResponse)
    .log(console.log);

  await getHTMLPage(tmpdirPath, testURL.toString());

  const actual1 = await fs.readFile(path.join(tmpdirPath, 'localhost-loc-resources.html'), 'utf-8');
  const expected1 = await fs.readFile(getFixturePath('localhost-test-changed.html'), 'utf-8');

  const assetsDirectory = 'localhost-loc-resources_files';

  const actual2 = await fs.readFile(path.join(tmpdirPath, assetsDirectory, 'style.css'), 'utf-8');
  const expected2 = firstResourceResponse;

  const actual3 = await fs.readFile(path.join(tmpdirPath, assetsDirectory, 'assets-image.png'), 'utf-8');
  const expected3 = secondResourceResponse;

  expect(actual1).toEqual(expected1);
  expect(actual2).toEqual(expected2);
  expect(actual3).toEqual(expected3);
});

test('downloading fails on HTTP error 404', async () => {
  const testURL = new URL('https://somename.smt');

  nock(testURL.origin)
    .get(testURL.pathname)
    .reply(404)
    .log(console.log);

  await expect(getHTMLPage('/tmp', testURL.toString())).rejects.toThrow();
});

test('downloading fails on incorrect directory', async () => {
  const testURL = new URL('https://somename.smt');

  nock(testURL.origin)
    .get(testURL.pathname)
    .reply(200)
    .log(console.log);

  await expect(getHTMLPage('/mySuperDirectory', testURL.toString())).rejects.toThrow();
});

afterEach(async () => {
  await fs.rmdir(tmpdirPath, { recursive: true });
});
