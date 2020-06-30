import { promises as fs } from 'fs';
import axios from 'axios';
import path from 'path';
import cheerio from 'cheerio';
import buildDebug from 'debug';
import Listr from 'listr';
import { URL } from 'url';

const debug = buildDebug('page-loader');

const getName = (link, type = 'file') => {
  const linkWithoutProtocol = link.replace(/http:\/\/|https:\/\//, '');

  const name = {
    file: `${linkWithoutProtocol.replace(/\//, '-')}`,
    page: `${linkWithoutProtocol.replace(/\.|\//g, '-')}.html`,
    directory: `${linkWithoutProtocol.replace(/\.|\//g, '-')}_files`,
  };

  debug(`${name[type]} name has been created for ${type} of ${link}`);

  return name[type];
};

const getLinksOfLocalResources = (html) => {
  const $ = cheerio.load(html, { decodeEntities: false });
  const links = $('link, script, img')
    .toArray()
    .map((element) => $(element).attr('href') || $(element).attr('src'))
    .filter((element) => element)
    .filter((link) => link.split('//').length === 1);

  debug('Extracted local links:', links);

  return links;
};

const downloadResource = (url, link) => {
  const downloadingLink = new URL(url);
  downloadingLink.pathname = path.join(downloadingLink.pathname, link);

  debug(`Download resource from ${downloadingLink.href}`);

  return axios(downloadingLink.href);
};

const changeResourcesLinks = (html, dirname) => {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
  $('link, script, img')
    .each((i, tag) => {
      const mapping = {
        img: 'src',
        link: 'href',
        script: 'src',
      };
      const oldAttr = $(tag).attr('href') || $(tag).attr('src');
      const attrToChange = mapping[tag.name];
      const value = oldAttr.split('//').length === 1 ? `${path.join(dirname, getName(oldAttr))}` : oldAttr;
      $(tag).attr(attrToChange, value);
    });

  return $;
};

export default (dirpath, url) => {
  const pagename = getName(url, 'page');
  const dirname = getName(url, 'directory');

  let linksOnLocalResources;

  debug(`Request to ${url}`);

  return axios(url)
    .then((response) => fs.writeFile(path.join(dirpath, pagename), response.data))
    .then(() => fs.mkdir(path.join(dirpath, dirname)))
    .then(() => fs.readFile(path.join(dirpath, pagename), 'utf-8'))
    .then((html) => getLinksOfLocalResources(html))
    .then((links) => {
      linksOnLocalResources = links;
      const promises = links.map((link) => downloadResource(url, link));
      return Promise.all(promises);
    })
    .then((resources) => {
      const promises = resources.map(({ data }, i) => fs
        .writeFile(path.join(dirpath, dirname, getName(linksOnLocalResources[i])), data));
      return Promise.all(promises);
    })
    .then(() => fs.readFile(`${path.join(dirpath, pagename)}`, 'utf-8'))
    .then((html) => changeResourcesLinks(html, dirname))
    .then(($) => fs.writeFile(`${path.join(dirpath, pagename)}`, $.html()));
};
