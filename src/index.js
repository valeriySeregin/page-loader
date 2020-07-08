import { promises as fs } from 'fs';
import axios from 'axios';
import path from 'path';
import cheerio from 'cheerio';
import buildDebug from 'debug';
import Listr from 'listr';
import { URL } from 'url';
import _ from 'lodash';

const debug = buildDebug('page-loader');

const getName = (url, type = 'file') => {
  const linkWithoutProtocol = `${url.hostname}${url.pathname}`
    .replace(/\//g, '-')
    .replace(/\./, '-');

  const nameMapping = {
    file: `${_.trimStart(url.pathname, '/').replace(/\//g, '-')}`,
    page: `${linkWithoutProtocol}.html`,
    directory: `${linkWithoutProtocol}_files`,
  };

  debug(`${nameMapping[type]} name has been created for ${type} of ${url.href}`);

  return nameMapping[type];
};

const downloadResource = (url, link, dirpath, dirname) => {
  const downloadingLink = new URL(link, url);
  const writingPath = path.join(dirpath, dirname, getName(downloadingLink));

  debug(`Download resource from ${downloadingLink.href}`);

  return axios({
    method: 'get',
    url: downloadingLink.href,
    responseType: 'arraybuffer',
  })
    .then((resource) => fs.writeFile(writingPath, resource.data));
};

const changeLinksOnPage = (html, dirname, locator) => {
  const url = new URL(locator);
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });

  const mapping = {
    img: 'src',
    link: 'href',
    script: 'src',
  };

  const links = $('link, script, img')
    .toArray()
    .map((element) => $(element).attr('href') || $(element).attr('src'))
    .filter((element) => element)
    .filter((link) => {
      const URLToCheckOrigin = new URL(link, locator);

      return URLToCheckOrigin.origin === url.origin;
    });

  debug('Extracted local links:', links);

  $('link, script, img')
    .each((i, tag) => {
      const oldAttr = $(tag).attr('href') || $(tag).attr('src');
      const newAttr = new URL(oldAttr, locator);
      const attrToChange = mapping[tag.name];
      const value = newAttr.origin === url.origin ? path.join(dirname, getName(newAttr)) : oldAttr;
      $(tag).attr(attrToChange, value);
    });

  return {
    jQueryMimic: $,
    links,
  };
};

export default (pathToDirectoryToWrite, locator) => {
  const url = new URL(locator);
  const pagename = getName(url, 'page');
  const filesDirectoryName = getName(url, 'directory');

  let html;
  let changedPageInformation;

  debug(`Request to ${url.href}`);

  return axios({
    method: 'get',
    url: url.href,
    responseType: 'arraybuffer',
  })
    .then((response) => {
      html = response.data;
    })
    .then(() => fs.mkdir(path.join(pathToDirectoryToWrite, filesDirectoryName)))
    .then(() => {
      changedPageInformation = changeLinksOnPage(html, filesDirectoryName, url.href);
    })
    .then(() => {
      const tasksForListr = changedPageInformation.links.map((link) => ({
        title: link,
        task: () => downloadResource(url.href, link, pathToDirectoryToWrite, filesDirectoryName),
      }));

      const tasks = new Listr(tasksForListr, { concurrent: true });

      return tasks.run();
    })
    .then(() => {
      const writingPath = path.join(pathToDirectoryToWrite, pagename);
      return fs.writeFile(writingPath, changedPageInformation.jQueryMimic.html());
    });
};
