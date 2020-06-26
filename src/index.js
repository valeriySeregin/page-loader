import { promises as fs } from 'fs';
import axios from 'axios';
import path from 'path';
import cheerio from 'cheerio';
import buildDebug from 'debug';
import Listr from 'listr';
import { URL } from 'url';
import _ from 'lodash';

const debug = buildDebug('page-loader');

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

export const getLinksOfLocalResources = (dirpath, pagename) => {
  const filepath = `${dirpath}/${pagename}`;

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
    });
};

export const downloadPage = (dirpath, url, pagename, dirname) => {
  let html;

  debug(`Download page from ${url}`);

  return axios(url)
    .then(({ data }) => {
      html = data;
    })
    .then(() => fs.mkdir(path.join(dirpath, dirname)))
    .then(() => fs.writeFile(path.join(dirpath, pagename), html));
};

export const downloadResource = (dirpath, url, link, dirname) => {
  const filename = getName(link);
  const downloadingLink = new URL(url);
  downloadingLink.pathname = `${downloadingLink.pathname}/${link}`;
  let resource;

  debug(`Download resource from ${downloadingLink.href}`);

  return axios(downloadingLink.href)
    .then(({ data }) => {
      resource = data;
    })
    .then(() => fs.writeFile(path.join(dirpath, dirname, filename), resource));
};

export const changeResourcesLinks = (dirpath, pagename, dirname) => fs.readFile(`${dirpath}/${pagename}`, 'utf-8')
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
    fs.writeFile(`${dirpath}/${pagename}`, $.html());
  });

export default (dirpath, url) => {
  const pagename = getName(url, 'page');
  const dirname = getName(url, 'directory');

  const tasks = new Listr([
    {
      title: 'Download HTML page',
      task: () => downloadPage(dirpath, url, pagename, dirname),
    },
    {
      title: 'Get local resources links and download resources',
      task: () => getLinksOfLocalResources(dirpath, pagename)
        .then((links) => links.map((link) => downloadResource(dirpath, url, link, dirname)
          .then((v) => ({ result: 'success', value: v }))
          .catch((e) => ({ result: 'error', error: e }))))
        .then((promises) => Promise.all(promises)),
    },
    {
      title: 'Change resources links',
      task: () => changeResourcesLinks(dirpath, pagename, dirname),
    },
  ]);

  return tasks.run();
};
