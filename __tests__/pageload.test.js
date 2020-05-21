import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import nock from 'nock';
import getHTMLPage from '../src';

const getPath = (filename) => path.resolve(__dirname, '..', '__fixtures__', filename);

let tmpdirPath;

beforeEach(async () => {
  tmpdirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download and save page', async () => {
  try {
    const expected = await fs.readFile(getPath('hexlet-io-courses.html'), 'utf-8');

    nock('https://hexlet.io')
      .get('/courses')
      .reply(200, expected);

    await getHTMLPage(tmpdirPath, 'https://hexlet.io/courses');
    const loadedPage = await fs.readFile(path.join(tmpdirPath, 'hexlet-io-courses.html'), 'utf-8');

    expect(loadedPage).toEqual(expected);
  } catch (e) {
    console.log(e);
    throw e;
  }
});

afterEach(async () => {
  await fs.unlink(path.join(tmpdirPath, 'hexlet-io-courses.html'));
  await fs.rmdir(tmpdirPath);
});
