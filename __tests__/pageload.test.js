import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import nock from 'nock';
import {
  downloadPage,
  downloadResource,
  changeResourcesLinks,
  getLinksOfLocalResources,
} from '../src';

const getFixturePath = (filename) => path.resolve(__dirname, '..', '__fixtures__', filename);

let tmpdirPath;

beforeAll(async () => {
  tmpdirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download page', async () => {
  try {
    const response = await fs.readFile(getFixturePath('localhost-test.html'), 'utf-8');

    nock('http://localhost')
      .get('/')
      .reply(200, response);

    await downloadPage(tmpdirPath, 'http://localhost');
    const page = await fs.readFile(path.join(tmpdirPath, 'localhost.html'), 'utf-8');

    expect(page).toEqual(response);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

test.each([
  ['style.css'],
  ['image.png'],
])('downloadLocalResource(%s, %s, %s)', async (link) => {
  try {
    const response = await fs.readFile(getFixturePath(link), { encoding: 'utf8' });

    nock('http://localhost')
      .get(`/${link}`)
      .reply(200, response);

    await downloadResource(tmpdirPath, 'http://localhost', link);
    const resource = await fs.readFile(path.join(tmpdirPath, `localhost_files/${link}`), 'utf-8');

    expect(resource).toEqual(response);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

test('get links of local resources', async () => {
  try {
    const expected = ['style.css', 'image.png'];
    const resourcesLinks = await getLinksOfLocalResources(tmpdirPath, 'http://localhost');

    expect(resourcesLinks).toEqual(expected);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

test('change resources links on page', async () => {
  try {
    const expected = await fs.readFile(getFixturePath('localhost-test-changed.html'), 'utf-8');
    await changeResourcesLinks(tmpdirPath, 'http://localhost');
    const changedPage = await fs.readFile(path.join(tmpdirPath, 'localhost.html'), 'utf-8');

    expect(changedPage).toEqual(expected);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

afterAll(async () => {
  await fs.unlink(path.join(tmpdirPath, 'localhost.html'));
  await fs.rmdir(tmpdirPath, { recursive: true });
});
