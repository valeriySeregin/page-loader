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

  debug(`Download resource from ${downloadingLink.toString()}`);

  return axios({
    method: 'get',
    url: downloadingLink.toString(),
    responseType: 'arraybuffer',
  })
    .then((resource) => fs.writeFile(writingPath, resource.data));
};

const changeLinksOnPage = (html, dirname, urlOrigin, pageUrl) => {
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
      const URLToCheckOrigin = new URL(link, pageUrl);

      return URLToCheckOrigin.origin === urlOrigin;
    });

  debug('Extracted local links:', links);

  $('link, script, img')
    .each((i, tag) => {
      const oldAttr = $(tag).attr('href') || $(tag).attr('src');
      const newAttr = new URL(oldAttr, pageUrl);
      const attrToChange = mapping[tag.name];
      const value = newAttr.origin === urlOrigin ? path.join(dirname, getName(newAttr)) : oldAttr;
      $(tag).attr(attrToChange, value);
    });

  return {
    html: $.html(),
    links,
  };
};

export default (outputDirname, pageUrl) => {
  const url = new URL(pageUrl);
  const pagename = getName(url, 'page');
  const filesDirectoryName = getName(url, 'directory');

  let changedPageInformation;

  debug(`Request to ${url.href}`);

  return axios(url.href)
    .then((response) => {
      const html = response.data;
      changedPageInformation = changeLinksOnPage(
        html,
        filesDirectoryName,
        url.origin,
        url.toString(),
      );
    })
    .then(() => fs.mkdir(path.join(outputDirname, filesDirectoryName)))
    .then(() => {
      const tasksForListr = changedPageInformation.links.map((link) => ({
        title: link,
        task: () => downloadResource(url.href, link, outputDirname, filesDirectoryName),
      }));

      const tasks = new Listr(tasksForListr, { concurrent: true });

      return tasks.run();
    })
    .then(() => {
      const writingPath = path.join(outputDirname, pagename);
      return fs.writeFile(writingPath, changedPageInformation.html);
    });
};
