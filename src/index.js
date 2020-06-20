import { promises as fs } from 'fs';
import axios from 'axios';
import path from 'path';
import cheerio from 'cheerio';
import axiosDebug from 'axios-debug-log';
import buildDebug from 'debug';
import Listr from 'listr';
import { URL } from 'url';
import _ from 'lodash';

const debug = buildDebug('page-loader');

axiosDebug({
  request: (getDebugged, config) => {
    getDebugged(`Request with ${config.headers['content-type']}`);
  },
  response: (getDebugged, response) => {
    getDebugged(
      `Response with ${response.headers['content-type']}`,
      `from ${response.config.url}`,
    );
  },
  error: (getDebugged, error) => {
    getDebugged('Boom', error);
  },
});

export const getName = (url, type = 'file') => {
  const urlComponents = url.split(/\/\/|\.|\//);

  const names = {
    file: `${_.initial(urlComponents).join('-')}.${_.last(urlComponents)}`,
    page: `${_.tail(urlComponents).join('-')}.html`,
    directory: `${_.tail(urlComponents).join('-')}_files`,
  };

  debug(`Get name for ${type} of ${url}`);

  return names[type];
};

export const getLinksOfLocalResources = (dirpath, url) => {
  const filename = getName(url, 'page');
  const filepath = `${dirpath}/${filename}`;

  return fs.readFile(filepath, 'utf-8')
    .then((html) => {
      const $ = cheerio.load(html, { decodeEntities: false });
      const links = $('link, script, img')
        .toArray()
        .map((element) => $(element).attr('href') || $(element).attr('src'))
        .filter((element) => element)
        .filter((link) => link.split('//').length === 1);

      debug('Extracted local links:', links);
      return links;
    })
    .catch((error) => {
      console.error(`Getting local resources links error: ${error.message}`);
      throw error;
    });
};

export const downloadPage = (dirpath, url) => {
  const filename = getName(url, 'page');
  const dirname = getName(url, 'directory');
  let html;

  return axios(url)
    .then(({ data }) => {
      html = data;
    })
    .then(() => fs.mkdir(path.join(dirpath, dirname)))
    .then(() => fs.writeFile(path.join(dirpath, filename), html))
    .catch((error) => {
      console.error(`Page downloading error: ${error.message}`);
      throw error;
    });
};

export const downloadResource = (dirpath, url, link) => {
  const filename = getName(link);
  const dirname = getName(url, 'directory');
  const downloadingLink = new URL(link, url);
  let resource;

  return axios(downloadingLink.href)
    .then(({ data }) => {
      resource = data;
    })
    .then(() => fs.writeFile(path.join(dirpath, dirname, filename), resource))
    .catch((error) => {
      console.error(`Resource downloading error: ${error.message}`);
      throw error;
    });
};

export const changeResourcesLinks = (dirpath, url) => {
  const dirname = getName(url, 'directory');
  const filename = getName(url, 'page');

  return fs.readFile(`${dirpath}/${filename}`, 'utf-8')
    .then((html) => {
      debug(`File from ${dirpath} was read`);
      const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
      $('link, script, img')
        .each((i, tag) => {
          const mapping = {
            img: 'src',
            link: 'href',
            script: 'href',
          };
          const oldAttr = $(tag).attr('href') || $(tag).attr('src');
          const attrToChange = mapping[tag.name];
          $(tag).attr(attrToChange, `${dirname}/${oldAttr}`);
        });
      fs.writeFile(`${dirpath}/${filename}`, $.html());
    })
    .catch((error) => {
      console.error(`Error during changing resources links: ${error.message}`);
      throw error;
    });
};

export default (dirpath, url) => {
  const tasks = new Listr([
    {
      title: 'Download HTML page',
      task: () => downloadPage(dirpath, url),
    },
    {
      title: 'Get local resources links and download resources',
      task: () => getLinksOfLocalResources(dirpath, url)
        .then((links) => links.map((link) => downloadResource(dirpath, url, link)
          .then((v) => ({ result: 'success', value: v }))
          .catch((e) => ({ result: 'error', error: e }))))
        .then((promises) => Promise.all(promises)),
    },
    {
      title: 'Change resources links',
      task: () => changeResourcesLinks(dirpath, url),
    },
  ]);

  return tasks.run().catch((err) => {
    console.error(err);
    throw err;
  });
};
