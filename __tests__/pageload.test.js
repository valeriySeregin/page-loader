import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import nock from 'nock';
import {
  downloadPage,
  downloadResource,
  changeResourcesLinks,
} from '../src/utils';

const getFixturePath = (filename) => path.resolve(__dirname, '..', '__fixtures__', filename);

let tmpdirPath;

beforeAll(async () => {
  tmpdirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download page', async () => {
  try {
    const response = await fs.readFile(getFixturePath('localhost-test.html'), 'utf-8');

    nock('http://localhost')
      .get('/test')
      .reply(200, response);

    await downloadPage(tmpdirPath, 'http://localhost/test');
    const page = await fs.readFile(path.join(tmpdirPath, 'localhost-test.html'), 'utf-8');

    expect(page).toEqual(response);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

test('download local resource 1', async () => {
  try {
    const response = await fs.readFile(getFixturePath('image.png'), { encoding: 'utf8' });

    nock('http://localhost')
      .get('/test/image.png')
      .reply(200, response);

    await downloadResource(tmpdirPath, 'http://localhost/test', 'image.png');
    const resource = await fs.readFile(path.join(tmpdirPath, 'localhost-test_files/image.png'), 'utf-8');

    expect(resource).toEqual(response);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

test('download local resource 2', async () => {
  try {
    const response = await fs.readFile(getFixturePath('style.css'), { encoding: 'utf8' });

    nock('http://localhost')
      .get('/test/style.css')
      .reply(200, response);

    await downloadResource(tmpdirPath, 'http://localhost/test', 'style.css');
    const resource = await fs.readFile(path.join(tmpdirPath, 'localhost-test_files/style.css'), 'utf-8');

    expect(resource).toEqual(response);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

test('change resources links on page', async () => {
  try {
    const expected = await fs.readFile(getFixturePath('localhost-test-changed.html'), 'utf-8');
    await changeResourcesLinks(path.join(tmpdirPath, 'localhost-test.html'), 'http://localhost/test');
    const changedPage = await fs.readFile(path.join(tmpdirPath, 'localhost-test.html'), 'utf-8');

    expect(changedPage).toEqual(expected);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

afterAll(async () => {
  await fs.unlink(path.join(tmpdirPath, 'localhost-test.html'));
  await fs.rmdir(tmpdirPath, { recursive: true });
});
