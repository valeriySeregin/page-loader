import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import nock from 'nock';
import getHTMLPage from '../src';

const getFixturePath = (filename) => path.resolve(__dirname, '..', '__fixtures__', filename);

let tmpdirPath;

beforeAll(async () => {
  tmpdirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download HTML page with local resources', async () => {
  try {
    const response = await fs.readFile(getFixturePath('localhost-test.html'), 'utf-8');
    const expected = await fs.readFile(getFixturePath('localhost-test-changed.html'), 'utf-8');

    nock('http://localhost')
      .get('/')
      .reply(200, response);

    await getHTMLPage(tmpdirPath, 'http://localhost');
    const page = await fs.readFile(path.join(tmpdirPath, 'localhost.html'), 'utf-8');

    expect(page).toEqual(expected);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

test('downloading fails on HTTP error 404', async () => {
  nock('https://somename.smt')
    .get('/')
    .reply(404);

  await expect(getHTMLPage('mySuperDirectory', 'https://somename.smt')).rejects.toThrow(
    'Request failed with status code 404',
  );
});

test('downloading fails on incorrect directory', async () => {
  await expect(getHTMLPage('mySuperDirectory', 'https://hexlet.io')).rejects.toThrow(
    'ENOENT: no such file or directory, mkdir \'mySuperDirectory/hexlet-io_files\'',
  );
});

afterAll(async () => {
  await fs.unlink(path.join(tmpdirPath, 'localhost.html'));
  await fs.rmdir(tmpdirPath, { recursive: true });
});
